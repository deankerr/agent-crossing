import { describe, expect, it } from "@effect/vitest";
import * as Option from "effect/Option";
import * as Result from "effect/Result";

import { Command } from "../src/command.ts";
import { entityIdFor } from "../src/entity.ts";
import { WorldEvent } from "../src/event.ts";
import { centre } from "../src/grid.ts";
import {
  execute,
  expire,
  GRACE_MILLIS,
  nextLapseAt,
  streamsLost,
} from "../src/presence.ts";
import { decide } from "../src/rules.ts";
import { carriedBy, characterOf } from "../src/world.ts";
import type { Server } from "../src/world.ts";
import {
  alice,
  appeared,
  bob,
  createAt,
  created,
  look,
  moveTo,
  play,
  tile,
  worldOf,
} from "./world.fixture.ts";

const opened = (actor = alice) => Command.cases.StreamOpened.make({ actor });
const closed = (actor = alice) => Command.cases.StreamClosed.make({ actor });

const vanished = (actor = alice, at = GRACE_MILLIS, where = centre) =>
  WorldEvent.cases.Vanished.make({ actor, at, tile: where });

describe("presence", () => {
  it("lapses 120 seconds after the last action", () => {
    const { server } = play([[look(alice), 1000]]);
    expect(nextLapseAt(server)).toStrictEqual(Option.some(1000 + GRACE_MILLIS));
    expect(expire(server, GRACE_MILLIS + 999).events).toStrictEqual([]);
    expect(expire(server, 500_000).events).toStrictEqual([
      vanished(alice, GRACE_MILLIS + 1000),
    ]);
  });

  it("keeps a vanished character's position, name and burden", () => {
    const { server } = play([
      [createAt(alice, tile(17, 16)), 0],
      [Command.cases.PickUp.make({ actor: alice, entity: entityIdFor(1) }), 1],
    ]);

    const after = expire(server, 999_999).server.world;
    expect(
      Option.map(characterOf(after, alice), (character) => character.present)
    ).toStrictEqual(Option.some(false));
    expect(Option.isSome(carriedBy(after, alice))).toBeTruthy();
  });

  it("stays present while listening and starts the grace when the stream closes", () => {
    const listening = play([
      [opened(), 0],
      [look(alice), 10],
    ]).server;

    const afterClose = play([[closed(), 500_000]], listening).server;
    expect(nextLapseAt(listening)).toStrictEqual(Option.none());
    expect(expire(listening, 10_000_000).events).toStrictEqual([]);
    expect(nextLapseAt(afterClose)).toStrictEqual(
      Option.some(500_000 + GRACE_MILLIS)
    );
  });

  it("counts open streams so closing one of two keeps the character present", () => {
    const { server } = play([
      [opened(), 0],
      [opened(), 1],
      [closed(), 2],
    ]);

    expect(nextLapseAt(server)).toStrictEqual(Option.none());
  });

  it("brings a vanished character back where it was when its stream opens", () => {
    const { events } = play([
      [look(alice), 0],
      [opened(), 500_000],
    ]);

    expect(events).toStrictEqual([
      appeared(alice, centre, 0),
      vanished(),
      appeared(alice, centre, 500_000),
    ]);
  });

  it("brings a vanished character back beside an entity that took its tile", () => {
    const { events } = play([
      [look(alice), 0],
      [moveTo(bob, tile(16, 15)), 200_000],
      [createAt(bob, centre), 201_000],
      [look(alice), 202_000],
    ]);

    expect(events.at(-1)).toStrictEqual(appeared(alice, tile(16, 15), 202_000));
  });

  it("does not let a vanished character block placement", () => {
    const world = worldOf([
      appeared(alice, centre),
      vanished(),
      appeared(bob, tile(17, 16)),
    ]);

    expect(
      Result.isSuccess(decide(world, createAt(bob, centre), 0))
    ).toBeTruthy();
  });

  it("leaves a walker that lapses mid-walk where it was at the lapse", () => {
    const walking: Server = {
      sessions: { alice: { activeAt: 500 - GRACE_MILLIS, openStreams: 0 } },
      world: worldOf([
        appeared(alice, centre),
        WorldEvent.cases.WalkStarted.make({
          actor: alice,
          at: 0,
          path: [centre, tile(17, 16), tile(18, 16), tile(19, 16)],
        }),
      ]),
    };

    const expired = expire(walking, 600);
    expect(expired.events).toStrictEqual([vanished(alice, 500, tile(17, 16))]);
    expect(
      Result.isSuccess(
        decide(
          worldOf([appeared(bob, tile(18, 17))], expired.server.world),
          createAt(bob, tile(18, 16)),
          600
        )
      )
    ).toBeTruthy();
  });

  it("expires lapsed characters before deciding an action", () => {
    const { server } = play([[look(alice), 0]]);
    const outcome = Result.getOrThrow(execute(server, look(bob), 300_000));
    expect(outcome.events).toStrictEqual([
      vanished(),
      appeared(bob, centre, 300_000),
    ]);
  });

  it("orders simultaneous lapses by time then username", () => {
    const { server } = play([
      [look(bob), 0],
      [look(alice), 0],
      [moveTo(alice, tile(17, 16)), 0],
    ]);

    expect(expire(server, 999_999).events).toStrictEqual([
      vanished(alice, GRACE_MILLIS, tile(17, 16)),
      vanished(bob, GRACE_MILLIS, centre),
    ]);
  });

  it("closes a stream without any event", () => {
    const world = worldOf([created(tile(3, 3), 1)]);

    const outcome = Result.getOrThrow(
      execute({ sessions: {}, world }, closed(), 0)
    );

    expect(outcome.events).toStrictEqual([]);
  });

  it("gives listeners whose streams were lost the grace from now and leaves the others alone", () => {
    const { server } = play([
      [opened(alice), 0],
      [opened(alice), 1],
      [look(bob), 2],
    ]);

    const reconciled = streamsLost(server, 1_000_000);
    expect(reconciled.sessions).toStrictEqual({
      alice: { activeAt: 1_000_000, openStreams: 0 },
      bob: { activeAt: 2, openStreams: 0 },
    });
    expect(nextLapseAt(reconciled)).toStrictEqual(
      Option.some(2 + GRACE_MILLIS)
    );
    expect(expire(reconciled, 1_000_000 + GRACE_MILLIS).events).toStrictEqual([
      vanished(bob, 2 + GRACE_MILLIS),
      vanished(alice, 1_000_000 + GRACE_MILLIS),
    ]);
  });
});
