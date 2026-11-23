import * as Rivet from "@alchemy.run/rivet";
import * as Clock from "effect/Clock";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";

import { Default } from "./cluster.ts";

const IDLE = Duration.hours(1);

const room = Effect.gen(function* () {
  const state = yield* Rivet.DurableObjectState;
  const { sql } = state.storage;

  yield* (yield* sql.exec(
    "CREATE TABLE IF NOT EXISTS messages (author TEXT NOT NULL, text TEXT NOT NULL)"
  )).toArray();

  return {
    alarm: () =>
      Effect.gen(function* () {
        yield* (yield* sql.exec("DELETE FROM messages")).toArray();
      }),
    join: () =>
      Effect.gen(function* () {
        const visitors =
          ((yield* state.storage.get<number>("visitors")) ?? 0) + 1;

        yield* state.storage.put("visitors", visitors);

        return visitors;
      }),
    messages: () =>
      Effect.gen(function* () {
        const rows = yield* sql.exec<{ author: string; text: string }>(
          "SELECT author, text FROM messages"
        );

        return yield* rows.toArray();
      }),
    post: (author: string, text: string) =>
      Effect.gen(function* () {
        yield* (yield* sql.exec(
          "INSERT INTO messages (author, text) VALUES (?, ?)",
          author,
          text
        )).toArray();

        const now = yield* Clock.currentTimeMillis;

        yield* state.storage.setAlarm(now + Duration.toMillis(IDLE));
      }),
  };
});

export default class Room extends Rivet.DurableObject<Room>()(
  "Room",
  { main: import.meta.url },
  Effect.succeed(room).pipe(Effect.provide(Default))
) {}
