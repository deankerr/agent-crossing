import * as Prefabs from "@agent-crossing/definitions/Prefabs";
import * as Cell from "@agent-crossing/world/Cell";
import * as Command from "@agent-crossing/world/Command";
import * as Event from "@agent-crossing/world/Event";
import { FeedFrame } from "@agent-crossing/world/feed/frame";
import { openingFrames } from "@agent-crossing/world/feed/opening";
import * as Region from "@agent-crossing/world/Region";
import * as Span from "@agent-crossing/world/Span";
import * as Tally from "@agent-crossing/world/Tally";
import { eventText } from "@agent-crossing/world/text/event";
import { findText } from "@agent-crossing/world/text/find";
import {
  HISTORY_MAX_LIMIT,
  historyText,
} from "@agent-crossing/world/text/history";
import { inspectText } from "@agent-crossing/world/text/inspect";
import { mapIfAny } from "@agent-crossing/world/text/map";
import { summaryText } from "@agent-crossing/world/text/summary";
import * as World from "@agent-crossing/world/World";
import * as Rivet from "@alchemy.run/rivet";
import * as Arr from "effect/Array";
import * as Clock from "effect/Clock";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as PubSub from "effect/PubSub";
import * as Ref from "effect/Ref";
import * as Result from "effect/Result";
import * as Schema from "effect/Schema";
import * as Semaphore from "effect/Semaphore";
import * as Stream from "effect/Stream";

import { Default } from "../cluster.ts";
import { EventRow, SCHEMA, statementsOf, worldOfRows } from "./rows.ts";
import { FeedItem, Verdict } from "./wire.ts";

/** The one world every caller shares. */
export const WORLD_NAME = "world-5";

const HEARTBEAT_INTERVAL = Duration.seconds(15);

const COMMIT_TIMEOUT = Duration.minutes(5);

interface Happened {
  readonly seq: typeof Event.Seq.Type;
  readonly event: typeof Event.Event.Type;
}

const decodeCommand = Schema.decodeUnknownEffect(Command.Command);
const decodeCell = Schema.decodeUnknownEffect(Cell.Cell);
const decodeArea = Schema.decodeUnknownEffect(Schema.NullOr(Span.Area));
const decodeRegion = Schema.decodeUnknownEffect(Schema.NullOr(Region.Region));
const decodePrefab = Schema.decodeUnknownEffect(Schema.NullOr(Prefabs.Name));
const decodeSeq = Schema.decodeUnknownEffect(Event.Seq);
const decodeEventRows = Schema.decodeUnknownEffect(Schema.Array(EventRow));

const encodeEventJson = Schema.encodeEffect(Schema.fromJsonString(Event.Event));
const encodeVerdict = Schema.encodeEffect(Verdict);
const encodeFeedItem = Schema.encodeEffect(FeedItem);

const heartbeat = FeedItem.cases.Heartbeat.make({});

const framed = (frame: typeof FeedFrame.Type) =>
  FeedItem.cases.Frame.make({ frame });

const clampedLimit = (limit: number, maximum: number) =>
  Math.max(1, Math.min(maximum, Math.trunc(limit)));

const instance = Effect.gen(function* () {
  const { storage } = yield* Rivet.DurableObjectState;

  const run = <Row extends Record<string, unknown>>(
    query: string,
    ...bindings: readonly unknown[]
  ) =>
    Effect.flatMap(storage.sql.exec<Row>(query, ...bindings), (cursor) =>
      cursor.toArray()
    );

  yield* Effect.forEach(SCHEMA, (statement) => run(statement), {
    discard: true,
  });

  const awake = yield* Effect.orDie(
    worldOfRows({
      entities: yield* run("SELECT id, prefab, x, y, components FROM entities"),
      meta: yield* run("SELECT spawned FROM meta WHERE id = 1"),
    })
  );

  const lastSeq = Effect.flatMap(
    run<{ head: number }>("SELECT COALESCE(MAX(seq), 0) AS head FROM events"),
    (rows) => Effect.orDie(decodeSeq(rows[0]?.head ?? 0))
  );

  const world = yield* Ref.make<World.World>(awake);
  const head = yield* Ref.make<typeof Event.Seq.Type>(yield* lastSeq);
  const live = yield* PubSub.unbounded<Happened>();
  const serialised = Semaphore.withPermits(yield* Semaphore.make(1), 1);

  yield* Effect.logInfo(
    `World awake: ${World.cellCount(awake)} cells, ${World.entityCount(awake)} entities, ${yield* Ref.get(head)} events.`
  );

  const step = (event: typeof Event.Event.Type) =>
    Effect.gen(function* () {
      const rows = yield* run<{ seq: number }>(
        "INSERT INTO events (event) VALUES (?) RETURNING seq",
        yield* encodeEventJson(event)
      );

      const seq = yield* decodeSeq(rows[0]?.seq);

      yield* Effect.forEach(
        yield* statementsOf(event),
        ({ bindings, sql }) => run(sql, ...bindings),
        { discard: true }
      );

      return { event, seq } satisfies Happened;
    });

  const record = (events: readonly (typeof Event.Event.Type)[]) =>
    storage.transaction(Effect.forEach(events, step), {
      timeout: COMMIT_TIMEOUT,
    });

  const commit = (command: typeof Command.Command.Type) =>
    serialised(
      Effect.gen(function* () {
        const now = yield* Clock.currentTimeMillis;
        const before = yield* Ref.get(world);
        const decision = Command.decide(before, command, now);

        if (Result.isFailure(decision)) {
          return Verdict.cases.Rejected.make({ rejection: decision.failure });
        }

        const events = decision.success;
        const happened = yield* record(events);

        yield* Ref.set(world, World.applyAll(before, events));
        yield* Option.match(Arr.last(happened), {
          onNone: () => Effect.void,
          onSome: ({ seq }) => Ref.set(head, seq),
        });
        yield* PubSub.publishAll(live, happened);

        return Verdict.cases.Accepted.make({
          sentences: Arr.map(events, eventText),
          tally: Arr.reduce(events, Tally.none, Tally.tallied),
          ...Option.match(Span.ofCells(Arr.flatMap(events, Event.cells)), {
            onNone: () => ({}),
            onSome: (span) => ({ edited: Span.toArea(span) }),
          }),
        });
      })
    );

  const reading = <A>(read: (current: World.World) => A) =>
    Effect.map(Ref.get(world), read);

  return {
    act: (command: typeof Command.Command.Encoded) =>
      Effect.gen(function* () {
        const verdict = yield* commit(yield* decodeCommand(command));

        return yield* encodeVerdict(verdict);
      }).pipe(Effect.orDie),
    feed: () =>
      Stream.unwrap(
        Effect.gen(function* () {
          // WARNING: subscribe and read the world in one serialised step, or events are lost or repeated.
          const opened = yield* serialised(
            Effect.all({
              cursor: Ref.get(head),
              subscription: PubSub.subscribe(live),
              world: Ref.get(world),
            })
          );

          const opening = Stream.fromIterable(
            Arr.map(openingFrames(opened.world, opened.cursor), framed)
          );

          const happenings = Stream.map(
            Stream.fromSubscription(opened.subscription),
            ({ event, seq }) =>
              framed(FeedFrame.cases.Happened.make({ event, seq }))
          );

          const beats = Stream.map(
            Stream.tick(HEARTBEAT_INTERVAL),
            () => heartbeat
          );

          return Stream.merge(beats, Stream.concat(opening, happenings)).pipe(
            Stream.mapEffect((item) => Effect.orDie(encodeFeedItem(item)))
          );
        })
      ),
    find: (
      region: typeof Region.Region.Encoded | null,
      prefab: string | null,
      limit: number
    ) =>
      Effect.gen(function* () {
        const within = yield* decodeRegion(region);
        const only = yield* decodePrefab(prefab);

        return yield* reading((current) =>
          findText(
            current,
            Option.fromNullishOr(within),
            Option.fromNullishOr(only),
            limit
          )
        );
      }).pipe(Effect.orDie),
    history: (limit: number) =>
      Effect.gen(function* () {
        const rows = yield* run(
          "SELECT seq, event FROM (SELECT seq, event FROM events ORDER BY seq DESC LIMIT ?) ORDER BY seq",
          clampedLimit(limit, HISTORY_MAX_LIMIT)
        );

        return historyText(yield* decodeEventRows(rows), yield* Ref.get(head));
      }).pipe(Effect.orDie),
    inspect: (cell: typeof Cell.Cell.Encoded) =>
      Effect.flatMap(Effect.orDie(decodeCell(cell)), (at) =>
        reading((current) => inspectText(current, at))
      ),
    map: (area: typeof Span.Area.Encoded | null) =>
      Effect.flatMap(Effect.orDie(decodeArea(area)), (shown) =>
        reading((current) =>
          Option.getOrNull(mapIfAny(current, Option.fromNullishOr(shown)))
        )
      ),
    summary: () =>
      Effect.gen(function* () {
        const text = yield* reading(summaryText);
        const events = yield* Ref.get(head);

        return `${text}\nHistory: ${events} events.`;
      }),
  };
});

export default class WorldObject extends Rivet.DurableObject<WorldObject>()(
  "World",
  { main: import.meta.url },
  Effect.succeed(instance).pipe(Effect.provide(Default))
) {}
