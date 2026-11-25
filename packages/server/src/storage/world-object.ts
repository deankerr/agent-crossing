import { PrefabName } from "@agent-crossing/world/definitions/prefabs";
import { Command } from "@agent-crossing/world/engine/editing/command";
import { decide } from "@agent-crossing/world/engine/editing/decide";
import { Editor } from "@agent-crossing/world/engine/editing/edit";
import {
  changesOf,
  WorldEvent,
} from "@agent-crossing/world/engine/editing/event";
import { Region } from "@agent-crossing/world/engine/editing/region";
import { FeedFrame, Seq } from "@agent-crossing/world/engine/feed";
import { fromSnapshot } from "@agent-crossing/world/engine/state/snapshot";
import type { Span } from "@agent-crossing/world/engine/state/span";
import {
  applyAll,
  cellCount,
  entityCount,
} from "@agent-crossing/world/engine/state/world";
import type { World } from "@agent-crossing/world/engine/state/world";
import { agentViewText } from "@agent-crossing/world/engine/text/agent-view";
import { eventText } from "@agent-crossing/world/engine/text/event";
import { inspectText } from "@agent-crossing/world/engine/text/inspect";
import { summaryText } from "@agent-crossing/world/engine/text/summary";
import { Cell } from "@agent-crossing/world/schema/cell";
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

import {
  Area,
  areaOfSpan,
  spanOfCells,
  touchedBy,
  widen,
} from "../admin/affected.ts";
import {
  EventRow,
  findText,
  HISTORY_MAX_LIMIT,
  historyText,
  mapOf,
} from "../admin/queries.ts";
import { Default } from "../cluster.ts";
import {
  FeedItem,
  noTally,
  openingFrames,
  tallied,
  Verdict,
} from "../feed/wire.ts";
import type { Tally } from "../feed/wire.ts";
import { SCHEMA, snapshotOfRows, statementsOf } from "./rows.ts";

/** The one world every caller shares. */
export const WORLD_NAME = "world-2";

export const HEARTBEAT_INTERVAL = Duration.seconds(15);

/** How long one command's transaction may take: generating a large landscape writes tens of thousands of rows. */
export const COMMIT_TIMEOUT = Duration.minutes(5);

interface Happened {
  readonly seq: typeof Seq.Type;
  readonly event: typeof WorldEvent.Type;
}

interface Recorded {
  readonly world: World;
  readonly happened: readonly Happened[];
  readonly changeCount: number;
  readonly edited: Option.Option<Span>;
  readonly tally: typeof Tally.Type;
}

const decodeCommand = Schema.decodeUnknownEffect(Command);
const decodeEditor = Schema.decodeUnknownEffect(Editor);
const decodeCell = Schema.decodeUnknownEffect(Cell);
const decodeArea = Schema.decodeUnknownEffect(Schema.NullOr(Area));
const decodeRegion = Schema.decodeUnknownEffect(Schema.NullOr(Region));
const decodePrefab = Schema.decodeUnknownEffect(Schema.NullOr(PrefabName));
const decodeSeq = Schema.decodeUnknownEffect(Seq);
const decodeCount = Schema.decodeUnknownEffect(Schema.Int);
const decodeEventRows = Schema.decodeUnknownEffect(Schema.Array(EventRow));

const encodeEventJson = Schema.encodeEffect(Schema.fromJsonString(WorldEvent));
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

  const loaded = yield* Effect.orDie(
    snapshotOfRows({
      entities: yield* run("SELECT id, prefab, x, y, components FROM entities"),
      meta: yield* run("SELECT spawned FROM meta WHERE id = 1"),
    })
  );

  const lastSeq = Effect.flatMap(
    run<{ head: number }>("SELECT COALESCE(MAX(seq), 0) AS head FROM events"),
    (rows) => Effect.orDie(decodeSeq(rows[0]?.head ?? 0))
  );

  const awake = fromSnapshot(loaded);
  const world = yield* Ref.make<World>(awake);
  const head = yield* Ref.make<typeof Seq.Type>(yield* lastSeq);
  const live = yield* PubSub.unbounded<Happened>();
  const serialised = Semaphore.withPermits(yield* Semaphore.make(1), 1);

  yield* Effect.logInfo(
    `World awake: ${cellCount(awake)} cells, ${entityCount(awake)} entities, ${yield* Ref.get(head)} events.`
  );

  const step = (sofar: Recorded, event: typeof WorldEvent.Type) =>
    Effect.gen(function* () {
      const rows = yield* run<{ seq: number }>(
        "INSERT INTO events (at, by, event) VALUES (?, ?, ?) RETURNING seq",
        event.at,
        event.by,
        yield* encodeEventJson(event)
      );

      const seq = yield* decodeSeq(rows[0]?.seq);
      const changes = changesOf(sofar.world, event);

      yield* Effect.forEach(
        yield* statementsOf(changes),
        ({ bindings, sql }) => run(sql, ...bindings),
        { discard: true }
      );

      const recorded: Recorded = {
        changeCount: sofar.changeCount + changes.length,
        edited: widen(
          sofar.edited,
          spanOfCells(
            Arr.flatMap(changes, (change) => touchedBy(sofar.world, change))
          )
        ),
        happened: [...sofar.happened, { event, seq }],
        tally: tallied(sofar.tally, sofar.world, event),
        world: applyAll(sofar.world, changes),
      };

      return recorded;
    });

  const record = (before: World, events: readonly (typeof WorldEvent.Type)[]) =>
    storage.transaction(
      Effect.reduce(
        events,
        () =>
          ({
            changeCount: 0,
            edited: Option.none<Span>(),
            happened: [],
            tally: noTally,
            world: before,
          }) satisfies Recorded,
        step
      ),
      { timeout: COMMIT_TIMEOUT }
    );

  const commit = (command: typeof Command.Type, by: typeof Editor.Type) =>
    serialised(
      Effect.gen(function* () {
        const now = yield* Clock.currentTimeMillis;
        const before = yield* Ref.get(world);
        const decision = decide(before, command, now, by);

        if (Result.isFailure(decision)) {
          return Verdict.cases.Rejected.make({ rejection: decision.failure });
        }

        const outcome = yield* record(before, decision.success);

        yield* Ref.set(world, outcome.world);
        yield* Option.match(Arr.last(outcome.happened), {
          onNone: () => Effect.void,
          onSome: ({ seq }) => Ref.set(head, seq),
        });
        yield* PubSub.publishAll(live, outcome.happened);

        return Verdict.cases.Accepted.make({
          changes: outcome.changeCount,
          sentences: Arr.map(outcome.happened, ({ event }) => eventText(event)),
          tally: outcome.tally,
          ...Option.match(outcome.edited, {
            onNone: () => ({}),
            onSome: (span) => ({ edited: areaOfSpan(span) }),
          }),
        });
      })
    );

  const reading = <A>(read: (current: World) => A) =>
    Effect.map(Ref.get(world), read);

  return {
    act: (command: typeof Command.Encoded, by: string) =>
      Effect.gen(function* () {
        const verdict = yield* commit(
          yield* decodeCommand(command),
          yield* decodeEditor(by)
        );

        return yield* encodeVerdict(verdict);
      }).pipe(Effect.orDie),
    agentView: (cell: typeof Cell.Encoded, radius: number) =>
      Effect.flatMap(Effect.orDie(decodeCell(cell)), (at) =>
        reading((current) => agentViewText(current, at, radius))
      ),
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
      region: typeof Region.Encoded | null,
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
          "SELECT seq, at, by, event FROM (SELECT seq, at, by, event FROM events ORDER BY seq DESC LIMIT ?) ORDER BY seq",
          clampedLimit(limit, HISTORY_MAX_LIMIT)
        );

        const counted = yield* run<{ total: number }>(
          "SELECT COUNT(*) AS total FROM events"
        );

        return historyText(
          yield* decodeEventRows(rows),
          yield* decodeCount(counted[0]?.total ?? 0)
        );
      }).pipe(Effect.orDie),
    inspect: (cell: typeof Cell.Encoded) =>
      Effect.flatMap(Effect.orDie(decodeCell(cell)), (at) =>
        reading((current) => inspectText(current, at))
      ),
    map: (area: typeof Area.Encoded | null) =>
      Effect.flatMap(Effect.orDie(decodeArea(area)), (shown) =>
        reading((current) => mapOf(current, Option.fromNullishOr(shown)))
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
