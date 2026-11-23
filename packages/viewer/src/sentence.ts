import type { EntityId, Item } from "@agent-crossing/world/entity";
import { WorldEvent } from "@agent-crossing/world/event";
import type { Tile } from "@agent-crossing/world/grid";
import type { Username } from "@agent-crossing/world/values";
import { characterOf, entityOf } from "@agent-crossing/world/world";
import type { World } from "@agent-crossing/world/world";
import * as Arr from "effect/Array";
import * as Option from "effect/Option";

export const describeItem = (item: Item) => {
  const description: string =
    item._tag === "Sign"
      ? "a sign"
      : `a ${item.colour} ${item._tag === "Block" ? "block" : "flower"}`;

  return description;
};

export const tileLabel = (tile: Tile) => `${tile.x},${tile.y}`;

export const nameOf = (world: World, username: Username) =>
  Option.match(characterOf(world, username), {
    onNone: () => username,
    onSome: (character) => character.displayName,
  });

const entityDescription = (world: World, id: EntityId) =>
  Option.match(entityOf(world, id), {
    onNone: () => "something",
    onSome: (entity) => describeItem(entity.item),
  });

export const sentenceFor = (event: WorldEvent, before: World) => {
  const name = nameOf(before, event.actor);

  const sentence: string = WorldEvent.match(event, {
    Appeared: ({ tile }) => `${name} appeared at ${tileLabel(tile)}`,
    Created: ({ item, tile }) =>
      item._tag === "Sign"
        ? `${name} put up a sign at ${tileLabel(tile)}: “${item.text}”`
        : `${name} made ${describeItem(item)} at ${tileLabel(tile)}`,
    Destroyed: ({ entity, tile }) =>
      `${name} cleared away ${entityDescription(before, entity)} at ${tileLabel(tile)}`,
    PickedUp: ({ entity, tile }) =>
      `${name} picked up ${entityDescription(before, entity)} at ${tileLabel(tile)}`,
    PutDown: ({ entity, tile }) =>
      `${name} put down ${entityDescription(before, entity)} at ${tileLabel(tile)}`,
    Renamed: ({ displayName }) => `${name} is now called ${displayName}`,
    Said: ({ text }) => `${name} says: ${text}`,
    Vanished: ({ tile }) => `${name} vanished at ${tileLabel(tile)}`,
    WalkStarted: ({ path }) =>
      `${name} set off for ${tileLabel(Arr.lastNonEmpty(path))}`,
  });

  return sentence;
};

const clockFormat = new Intl.DateTimeFormat(undefined, {
  hour: "2-digit",
  hour12: false,
  minute: "2-digit",
  second: "2-digit",
});

export const clockTimeOf = (at: number) => clockFormat.format(at);
