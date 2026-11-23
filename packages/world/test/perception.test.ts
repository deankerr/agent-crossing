import { describe, expect, it } from "@effect/vitest";
import * as Option from "effect/Option";

import { entityIdFor } from "../src/entity.ts";
import { WorldEvent } from "../src/event.ts";
import { centre } from "../src/grid.ts";
import { isPerceivable, observe } from "../src/perception.ts";
import { Username } from "../src/values.ts";
import {
  alice,
  appeared,
  block,
  bob,
  carol,
  created,
  text,
  tile,
  worldOf,
} from "./world.fixture.ts";

const dave = Username.make("dave");

const scene = worldOf([
  appeared(alice, centre),
  appeared(bob, tile(24, 24)),
  appeared(carol, tile(25, 16)),
  appeared(dave, tile(17, 17)),
  WorldEvent.cases.Vanished.make({ actor: dave, at: 0, tile: tile(17, 17) }),
  created(tile(17, 16), 1),
  created(tile(16, 25), 2),
  created(tile(23, 24), 3),
  WorldEvent.cases.PickedUp.make({
    actor: bob,
    at: 0,
    entity: entityIdFor(3),
    tile: tile(23, 24),
  }),
  WorldEvent.cases.WalkStarted.make({
    actor: bob,
    at: 0,
    path: [tile(24, 24), tile(24, 23), tile(24, 22)],
  }),
]);

const said = (actor: Username, where: ReturnType<typeof tile>, at = 0) =>
  WorldEvent.cases.Said.make({ actor, at, text: text("hi"), tile: where });

describe(observe, () => {
  const observation = Option.getOrThrow(observe(scene, alice, 100));

  it("describes the observer", () => {
    expect(observation.self).toStrictEqual({
      carrying: null,
      displayName: "alice",
      present: true,
      tile: centre,
      username: alice,
      walking: null,
    });
  });

  it("sees present characters within eight tiles, with their burdens and walks", () => {
    expect(observation.characters).toStrictEqual([
      {
        carrying: { id: entityIdFor(3), item: block() },
        displayName: "bob",
        tile: tile(24, 24),
        username: bob,
        walking: { arrivesAt: 667, destination: tile(24, 22) },
      },
    ]);
  });

  it("sees entities on the ground within eight tiles", () => {
    expect(observation.entities).toStrictEqual([
      { id: entityIdFor(1), item: block(), tile: tile(17, 16) },
    ]);
  });

  it("sees nothing while vanished, and nobody it does not know", () => {
    const vanished = Option.getOrThrow(observe(scene, dave, 100));
    expect(vanished.characters).toStrictEqual([]);
    expect(vanished.entities).toStrictEqual([]);
    expect(observe(scene, Username.make("nobody"), 100)).toStrictEqual(
      Option.none()
    );
  });
});

describe(isPerceivable, () => {
  it("reaches present characters within eight tiles", () => {
    expect(isPerceivable(scene, alice, said(bob, tile(24, 24)))).toBeTruthy();
    expect(isPerceivable(scene, alice, said(carol, tile(25, 16)))).toBeFalsy();
  });

  it("counts every tile of a walk", () => {
    const passing = WorldEvent.cases.WalkStarted.make({
      actor: carol,
      at: 0,
      path: [tile(25, 16), tile(24, 16), tile(25, 16)],
    });

    expect(isPerceivable(scene, alice, passing)).toBeTruthy();
  });

  it("never reaches vanished or unknown characters", () => {
    expect(isPerceivable(scene, dave, said(alice, centre))).toBeFalsy();
    expect(
      isPerceivable(scene, Username.make("nobody"), said(alice, centre))
    ).toBeFalsy();
  });

  it("uses where the observer was when the event happened", () => {
    expect(isPerceivable(scene, bob, said(carol, tile(25, 15), 0))).toBeFalsy();
    expect(
      isPerceivable(scene, bob, said(carol, tile(25, 14), 700))
    ).toBeTruthy();
  });
});
