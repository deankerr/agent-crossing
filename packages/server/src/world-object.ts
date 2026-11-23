import { Command } from "@agent-crossing/world/command";
import { WorldEvent } from "@agent-crossing/world/event";
import {
  execute,
  expire,
  nextLapseAt,
  streamsLost,
} from "@agent-crossing/world/presence";
import type { Outcome } from "@agent-crossing/world/presence";
import { Username } from "@agent-crossing/world/values";
import type { Timestamp } from "@agent-crossing/world/values";
import { emptyServer, Server, World } from "@agent-crossing/world/world";
import * as Rivet from "@alchemy.run/rivet";
import * as Arr from "effect/Array";
import * as Clock from "effect/Clock";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as PubSub from "effect/PubSub";
import * as Record from "effect/Record";
import * as Result from "effect/Result";
import * as Schema from "effect/Schema";
import * as Semaphore from "effect/Semaphore";
import * as Stream from "effect/Stream";

import { Default } from "./cluster.ts";
import { Audience, heardIn, isFor, numbered, Seq } from "./journal.ts";
import type { Entry, Heard } from "./journal.ts";
import {
  CatchUp,
  heartbeat,
  Report,
  StoredRow,
  StreamItem,
  Verdict,
} from "./wire.ts";

export const WORLD_NAME = "main";

export const HEARTBEAT_INTERVAL = Duration.seconds(15);

const decodeServer = Schema.decodeUnknownEffect(Server);

const encodeServer = (server: Server) =>
  Effect.orDie(Schema.encodeEffect(Server)(server));

const encodeWorld = (world: World) =>
  Effect.orDie(Schema.encodeEffect(World)(world));

const decodeUsername = Schema.decodeUnknownEffect(Username);
const decodeCommand = Schema.decodeUnknownEffect(Command);
const decodeAudience = Schema.decodeUnknownEffect(Audience);
const decodeRows = Schema.decodeUnknownEffect(Schema.Array(StoredRow));

const encodeEventJson = (event: WorldEvent) =>
  Effect.orDie(Schema.encodeEffect(Schema.fromJsonString(WorldEvent))(event));

const encodeReport = (report: Report) =>
  Effect.orDie(Schema.encodeEffect(Report)(report));

const encodeCatchUp = (caught: CatchUp) =>
  Effect.orDie(Schema.encodeEffect(CatchUp)(caught));

const encodeStreamItem = (item: StreamItem) =>
  Effect.orDie(Schema.encodeEffect(StreamItem)(item));

const SCHEMA = [
  "CREATE TABLE IF NOT EXISTS events (seq INTEGER PRIMARY KEY AUTOINCREMENT, actor TEXT NOT NULL, event TEXT NOT NULL)",
  "CREATE TABLE IF NOT EXISTS audiences (username TEXT NOT NULL, seq INTEGER NOT NULL, PRIMARY KEY (username, seq)) WITHOUT ROWID",
  "CREATE TABLE IF NOT EXISTS cursors (username TEXT PRIMARY KEY, seq INTEGER NOT NULL) WITHOUT ROWID",
] as const;

interface Step<A> {
  readonly outcome: Outcome;
  readonly finish: (server: Server) => Effect.Effect<A>;
}

const unchanged = (server: Server) =>
  ({ events: [], server }) satisfies Outcome;

const lookAfterRejection = (server: Server, actor: Username, now: Timestamp) =>
  Result.getOrElse(
    execute(server, Command.cases.Look.make({ actor }), now),
    () => unchanged(server)
  );

const instance = Effect.gen(function* () {
  const { storage } = yield* Rivet.DurableObjectState;

  const run = <Row extends Record<string, unknown>>(
    query: string,
    ...bindings: unknown[]
  ) =>
    Effect.flatMap(storage.sql.exec<Row>(query, ...bindings), (cursor) =>
      cursor.toArray()
    );

  yield* Effect.forEach(SCHEMA, (statement) => run(statement), {
    discard: true,
  });

  const serialised = Semaphore.withPermits(yield* Semaphore.make(1), 1);
  const live = yield* PubSub.unbounded<Entry>();

  const readServer = Effect.flatMap(storage.get<unknown>("server"), (stored) =>
    stored === undefined
      ? Effect.succeed(emptyServer)
      : Effect.orDie(decodeServer(stored))
  );

  const head = Effect.map(
    run<{ head: number }>("SELECT COALESCE(MAX(seq), 0) AS head FROM events"),
    (rows) => rows[0]?.head ?? 0
  );

  const appendOne = ({ audience, event }: Heard) =>
    Effect.gen(function* () {
      const rows = yield* run<{ seq: number }>(
        "INSERT INTO events (actor, event) VALUES (?, ?) RETURNING seq",
        event.actor,
        yield* encodeEventJson(event)
      );

      const seq = yield* Effect.orDie(
        Schema.decodeUnknownEffect(Seq)(rows[0]?.seq)
      );

      yield* Effect.forEach(
        audience,
        (username) =>
          run(
            "INSERT INTO audiences (username, seq) VALUES (?, ?)",
            username,
            seq
          ),
        { discard: true }
      );

      const entry: Entry = { audience, event, seq };

      return entry;
    });

  const settle = (server: Server) =>
    Effect.andThen(
      Effect.flatMap(encodeServer(server), (encoded) =>
        storage.put("server", encoded)
      ),
      Option.match(nextLapseAt(server), {
        onNone: () => storage.deleteAlarm(),
        onSome: (at) => storage.setAlarm(at),
      })
    );

  const commit = <A>(step: (before: Server, now: Timestamp) => Step<A>) =>
    serialised(
      storage
        .transaction(
          Effect.gen(function* () {
            const now = yield* Clock.currentTimeMillis;
            const before = yield* readServer;
            const { finish, outcome } = step(before, now);

            const entries = yield* Effect.forEach(
              heardIn(before.world, outcome.events),
              appendOne
            );

            yield* settle(outcome.server);

            return { entries, result: yield* finish(outcome.server) };
          })
        )
        .pipe(
          Effect.tap(({ entries }) => PubSub.publishAll(live, entries)),
          Effect.map(({ result }) => result)
        )
    );

  const rowsFor = (audience: Audience, after: number, upTo: number) =>
    Effect.flatMap(
      Audience.match(audience, {
        Character: ({ username }) =>
          run(
            "SELECT e.seq AS seq, e.event AS event FROM audiences a JOIN events e ON e.seq = a.seq WHERE a.username = ? AND e.actor <> ? AND a.seq > ? AND a.seq <= ? ORDER BY a.seq",
            username,
            username,
            after,
            upTo
          ),
        Spectator: () =>
          run(
            "SELECT seq, event FROM events WHERE seq > ? AND seq <= ? ORDER BY seq",
            after,
            upTo
          ),
      }),
      (rows) => Effect.orDie(decodeRows(rows))
    );

  const catchUpOf = (username: Username, server: Server, now: Timestamp) =>
    Effect.gen(function* () {
      const upTo = yield* head;

      const since = yield* Effect.map(
        run<{ seq: number }>(
          "SELECT seq FROM cursors WHERE username = ?",
          username
        ),
        (rows) => Option.fromNullishOr(rows[0]?.seq)
      );

      yield* run(
        "INSERT INTO cursors (username, seq) VALUES (?, ?) ON CONFLICT (username) DO UPDATE SET seq = excluded.seq",
        username,
        upTo
      );

      const nearby = yield* Option.match(since, {
        onNone: () => Effect.succeed([]),
        onSome: (after) =>
          rowsFor(Audience.cases.Character.make({ username }), after, upTo),
      });

      const caught: CatchUp = { nearby, now, world: server.world };

      return caught;
    });

  const presence = (command: Command) =>
    commit((before, now) => ({
      finish: () => Effect.void,
      outcome: Result.getOrElse(execute(before, command, now), () =>
        unchanged(before)
      ),
    }));

  yield* commit((before, now) => ({
    finish: () =>
      Effect.logInfo(
        `World awake; streams lost by ${
          Arr.join(
            Arr.filter(
              Record.keys(before.sessions),
              (username) => (before.sessions[username]?.openStreams ?? 0) > 0
            ),
            ", "
          ) || "nobody"
        }`
      ),
    outcome: unchanged(streamsLost(before, now)),
  }));

  return {
    act: (encoded: typeof Command.Encoded) =>
      Effect.gen(function* () {
        const command = yield* Effect.orDie(decodeCommand(encoded));

        const report = yield* commit((before, now) => {
          const decided = Result.match(execute(before, command, now), {
            onFailure: (rejection) => ({
              outcome: lookAfterRejection(before, command.actor, now),
              verdict: Verdict.cases.Rejected.make({ rejection }),
            }),
            onSuccess: (outcome) => ({
              outcome,
              verdict: Verdict.cases.Accepted.make({ events: outcome.events }),
            }),
          });

          const verdict: Verdict = decided.verdict;

          return {
            finish: (server: Server) =>
              Effect.map(
                catchUpOf(command.actor, server, now),
                (caught) => ({ ...caught, verdict }) satisfies Report
              ),
            outcome: decided.outcome,
          };
        });

        return yield* encodeReport(report);
      }),
    alarm: () =>
      commit((before, now) => ({
        finish: () => Effect.void,
        outcome: expire(before, now),
      })).pipe(Effect.orDie),
    catchUp: (encoded: string) =>
      Effect.gen(function* () {
        const username = yield* Effect.orDie(decodeUsername(encoded));

        const caught = yield* commit((before, now) => ({
          finish: (server: Server) => catchUpOf(username, server, now),
          outcome: unchanged(before),
        }));

        return yield* encodeCatchUp(caught);
      }),
    events: (encoded: typeof Audience.Encoded, cursor: number | null) =>
      Stream.unwrap(
        Effect.gen(function* () {
          const audience = yield* Effect.orDie(decodeAudience(encoded));

          const listener = Audience.match(audience, {
            Character: ({ username }) => Option.some(username),
            Spectator: () => Option.none<Username>(),
          });

          const opened = yield* Option.match(listener, {
            onNone: () => Effect.void,
            onSome: (actor) =>
              presence(Command.cases.StreamOpened.make({ actor })),
          }).pipe(
            Effect.andThen(
              serialised(
                Effect.all({
                  subscription: PubSub.subscribe(live),
                  upTo: head,
                })
              )
            )
          );

          const replay = Stream.fromIterableEffect(
            rowsFor(audience, cursor ?? opened.upTo, opened.upTo)
          );

          const fresh = Stream.fromSubscription(opened.subscription).pipe(
            Stream.filter((entry) => isFor(audience, entry)),
            Stream.map(numbered)
          );

          const happenings = Stream.map(
            Stream.concat(replay, fresh),
            ({ event, seq }) => StreamItem.cases.Happened.make({ event, seq })
          );

          const beats = Stream.map(
            Stream.tick(HEARTBEAT_INTERVAL),
            () => heartbeat
          );

          return Stream.merge(beats, happenings).pipe(
            Stream.mapEffect(encodeStreamItem),
            Stream.ensuring(
              Option.match(listener, {
                onNone: () => Effect.void,
                onSome: (actor) =>
                  Effect.uninterruptible(
                    presence(Command.cases.StreamClosed.make({ actor }))
                  ),
              })
            )
          );
        })
      ),
    snapshot: () =>
      serialised(
        Effect.gen(function* () {
          const server = yield* readServer;

          return {
            cursor: yield* head,
            now: yield* Clock.currentTimeMillis,
            world: yield* encodeWorld(server.world),
          };
        })
      ),
  };
});

export default class WorldObject extends Rivet.DurableObject<WorldObject>()(
  "World",
  { main: import.meta.url },
  Effect.succeed(instance).pipe(Effect.provide(Default))
) {}
