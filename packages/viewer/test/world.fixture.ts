import { entityIdFor, Item } from "@agent-crossing/world/entity";
import { WorldEvent } from "@agent-crossing/world/event";
import { evolveAll } from "@agent-crossing/world/evolve";
import { Coordinate, Tile } from "@agent-crossing/world/grid";
import { DisplayName, Text, Username } from "@agent-crossing/world/values";
import { emptyWorld } from "@agent-crossing/world/world";

export const tile = (x: number, y: number) =>
  Tile.make({ x: Coordinate.make(x), y: Coordinate.make(y) });

export const alice = Username.make("alice");
export const bob = Username.make("bob");

export const appeared = (actor: Username, x: number, y: number, at = 0) =>
  WorldEvent.cases.Appeared.make({ actor, at, tile: tile(x, y) });

export const renamed = (actor: Username, name: string, at = 0) =>
  WorldEvent.cases.Renamed.make({
    actor,
    at,
    displayName: DisplayName.make(name),
    tile: tile(16, 16),
  });

export const createdBlock = (serial: number, x: number, y: number, at = 0) =>
  WorldEvent.cases.Created.make({
    actor: alice,
    at,
    entity: entityIdFor(serial),
    item: Item.cases.Block.make({ colour: "red" }),
    tile: tile(x, y),
  });

export const said = (actor: Username, words: string, at = 0) =>
  WorldEvent.cases.Said.make({
    actor,
    at,
    text: Text.make(words),
    tile: tile(16, 16),
  });

export const vanished = (actor: Username, at = 0) =>
  WorldEvent.cases.Vanished.make({ actor, at, tile: tile(16, 16) });

export const meadow = evolveAll(emptyWorld, [
  appeared(alice, 16, 16),
  renamed(alice, "Mossy"),
  appeared(bob, 17, 16),
  createdBlock(1, 12, 9),
]);
