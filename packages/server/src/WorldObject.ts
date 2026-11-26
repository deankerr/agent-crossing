import * as ReplyView from "@agent-crossing/views/ReplyView";
import * as View from "@agent-crossing/views/View";
import * as Command from "@agent-crossing/world/Command";
import * as Event from "@agent-crossing/world/Event";
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

import * as Cluster from "./Cluster.ts";
import {
  EventRow,
  SCHEMA,
  statementsOf,
  worldOfRows,
} from "./internal/world-object/rows.ts";
import { StreamItem, Verdict } from "./internal/world-object/wire.ts";
import * as StreamFrame from "./StreamFrame.ts";

/** The one world every caller shares. */
export const WORLD_NAME = "world-5";

const HEARTBEAT_INTERVAL = Duration.seconds(15);

const COMMIT_TIMEOUT = Duration.minutes(5);

interface Happened {
  readonly seq: typeof Event.Seq.Type;
  readonly event: typeof Event.Event.Type;
}

const decodeCommand = Schema.decodeUnknownEffect(Command.Command);
const decodeView = Schema.decodeUnknownEffect(View.View);
const decodeSeq = Schema.decodeUnknownEffect(Event.Seq);
const decodeEventRows = Schema.decodeUnknownEffect(Schema.Array(EventRow));

const encodeEventJson = Schema.encodeEffect(Schema.fromJsonString(Event.Event));
const encodeVerdict = Schema.encodeEffect(Verdict);
const encodeStreamItem = Schema.encodeEffect(StreamItem);

const heartbeat = StreamItem.cases.Heartbeat.make({});

const framed = (frame: typeof StreamFrame.StreamFrame.Type) =>
  StreamItem.cases.Frame.make({ frame });

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
          return Verdict.cases.Refused.make({ refusal: decision.failure });
        }

        const events = decision.success;
        const happened = yield* record(events);

        const after = World.applyAll(before, events);

        yield* Ref.set(world, after);
        yield* Option.match(Arr.last(happened), {
          onNone: () => Effect.void,
          onSome: ({ seq }) => Ref.set(head, seq),
        });
        yield* PubSub.publishAll(live, happened);

        return Verdict.cases.Accepted.make({
          text: ReplyView.text(events, after),
        });
      })
    );

  return {
    act: (command: typeof Command.Command.Encoded) =>
      Effect.gen(function* () {
        const verdict = yield* commit(yield* decodeCommand(command));

        return yield* encodeVerdict(verdict);
      }).pipe(Effect.orDie),
    follow: () =>
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
            Arr.map(StreamFrame.opening(opened.world, opened.cursor), framed)
          );

          const happenings = Stream.map(
            Stream.fromSubscription(opened.subscription),
            ({ event, seq }) =>
              framed(
                StreamFrame.StreamFrame.cases.Happened.make({ event, seq })
              )
          );

          const beats = Stream.map(
            Stream.tick(HEARTBEAT_INTERVAL),
            () => heartbeat
          );

          return Stream.merge(beats, Stream.concat(opening, happenings)).pipe(
            Stream.mapEffect((item) => Effect.orDie(encodeStreamItem(item)))
          );
        })
      ),
    view: (view: typeof View.View.Encoded) =>
      Effect.gen(function* () {
        const asked = yield* decodeView(view);

        const rows = yield* run(
          "SELECT seq, event FROM (SELECT seq, event FROM events ORDER BY seq DESC LIMIT ?) ORDER BY seq",
          View.eventsNeeded(asked)
        );

        return View.text(
          asked,
          yield* Ref.get(world),
          yield* decodeEventRows(rows),
          yield* Ref.get(head)
        );
      }).pipe(Effect.orDie),
  };
});

export default class WorldObject extends Rivet.DurableObject<WorldObject>()(
  "World",
  { main: import.meta.url },
  Effect.succeed(instance).pipe(Effect.provide(Cluster.Default))
) {}
