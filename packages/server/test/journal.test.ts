import { WorldEvent } from "@agent-crossing/world/event";
import { Coordinate, Tile } from "@agent-crossing/world/grid";
import { Text, Username } from "@agent-crossing/world/values";
import { emptyWorld } from "@agent-crossing/world/world";
import { describe, expect, it } from "@effect/vitest";
import * as Arr from "effect/Array";

import {
  characterAudience,
  heardIn,
  isFor,
  spectator,
  toldTo,
} from "../src/journal.ts";

const alice = Username.make("alice");
const bob = Username.make("bob");
const carol = Username.make("carol");

const tile = (x: number, y: number) =>
  Tile.make({ x: Coordinate.make(x), y: Coordinate.make(y) });

const appeared = (actor: Username, where: Tile) =>
  WorldEvent.cases.Appeared.make({ actor, at: 0, tile: where });

const said = (actor: Username, where: Tile) =>
  WorldEvent.cases.Said.make({
    actor,
    at: 1,
    text: Text.make("hi"),
    tile: where,
  });

describe("journal", () => {
  it("hears each event in the world just after it", () => {
    const heard = heardIn(emptyWorld, [
      appeared(alice, tile(10, 10)),
      appeared(bob, tile(18, 10)),
      appeared(carol, tile(19, 10)),
      said(alice, tile(10, 10)),
      WorldEvent.cases.Vanished.make({ actor: bob, at: 2, tile: tile(18, 10) }),
    ]);

    expect(Arr.map(heard, ({ audience }) => audience)).toStrictEqual([
      [alice],
      [alice, bob],
      [bob, carol],
      [alice, bob],
      [alice, carol],
    ]);
  });

  it("tells a character what it heard, except its own doing, and a spectator everything", () => {
    const entry = {
      audience: [alice, bob],
      event: said(alice, tile(1, 1)),
      seq: 1,
      text: "@alice at 1,1 said",
    };

    expect(isFor(spectator, entry)).toBeTruthy();
    expect(isFor(characterAudience(bob), entry)).toBeTruthy();
    expect(isFor(characterAudience(alice), entry)).toBeFalsy();
    expect(isFor(characterAudience(carol), entry)).toBeFalsy();
  });

  it("gives a character the told text and a spectator only the event", () => {
    const entry = {
      audience: [bob],
      event: said(alice, tile(1, 1)),
      seq: 2,
      text: "told",
    };

    expect(toldTo(characterAudience(bob), entry)).toStrictEqual({
      event: entry.event,
      seq: 2,
      text: "told",
    });
    expect(toldTo(spectator, entry)).toStrictEqual({
      event: entry.event,
      seq: 2,
    });
  });
});
