import * as Arr from "effect/Array";
import * as Option from "effect/Option";
import * as Order from "effect/Order";
import * as Record from "effect/Record";
import * as Result from "effect/Result";

import { Command } from "./command.ts";
import { WorldEvent } from "./event.ts";
import { evolveAll } from "./evolve.ts";
import type { Rejection } from "./rejection.ts";
import { decide } from "./rules.ts";
import type { Timestamp, Username } from "./values.ts";
import { positionAt } from "./walk.ts";
import { presentCharacters } from "./world.ts";
import type { Server, Session } from "./world.ts";

export const GRACE_MILLIS = 120_000;

export interface Outcome {
  readonly server: Server;
  readonly events: readonly WorldEvent[];
}

export const lapseAt = (server: Server, username: Username) =>
  Record.get(server.sessions, username).pipe(
    Option.filter((session) => session.openStreams === 0),
    Option.map((session) => session.activeAt + GRACE_MILLIS)
  );

const lapses = (server: Server) =>
  Arr.flatMap(presentCharacters(server.world), (character) =>
    Option.match(lapseAt(server, character.username), {
      onNone: () => [],
      onSome: (at) => [{ at, character }],
    })
  );

export const nextLapseAt = (server: Server) =>
  Arr.match(lapses(server), {
    onEmpty: () => Option.none<Timestamp>(),
    onNonEmpty: (due) =>
      Option.some(
        Arr.min(
          Arr.map(due, ({ at }) => at),
          Order.Number
        )
      ),
  });

const byTimeThenActor = Order.combine(
  Order.mapInput(Order.Number, (event: WorldEvent) => event.at),
  Order.mapInput(Order.String, (event: WorldEvent) => event.actor)
);

export const expire = (server: Server, now: Timestamp) => {
  const events = Arr.sort(
    Arr.map(
      Arr.filter(lapses(server), ({ at }) => at <= now),
      ({ at, character }) =>
        WorldEvent.cases.Vanished.make({
          actor: character.username,
          at,
          tile: positionAt(character.motion, at),
        })
    ),
    byTimeThenActor
  );

  return {
    events,
    server: { ...server, world: evolveAll(server.world, events) },
  } satisfies Outcome;
};

const sessionAfter = (session: Session, command: Command, now: Timestamp) =>
  Command.matchOrElse(
    command,
    {
      StreamClosed: () => ({
        activeAt: now,
        openStreams: Math.max(0, session.openStreams - 1),
      }),
      StreamOpened: () => ({
        ...session,
        openStreams: session.openStreams + 1,
      }),
    },
    () => ({ ...session, activeAt: now })
  ) satisfies Session;

const recordActivity = (
  sessions: Server["sessions"],
  command: Command,
  now: Timestamp
) =>
  Record.set(
    sessions,
    command.actor,
    sessionAfter(
      Record.get(sessions, command.actor).pipe(
        Option.getOrElse(() => ({ activeAt: now, openStreams: 0 }))
      ),
      command,
      now
    )
  );

export const execute = (server: Server, command: Command, now: Timestamp) => {
  const expired = expire(server, now);

  const outcome: Result.Result<Outcome, Rejection> = Result.map(
    decide(expired.server.world, command, now),
    (events) => ({
      events: Arr.appendAll(expired.events, events),
      server: {
        sessions: recordActivity(expired.server.sessions, command, now),
        world: evolveAll(expired.server.world, events),
      },
    })
  );

  return outcome;
};
