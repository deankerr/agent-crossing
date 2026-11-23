import { Item } from "@agent-crossing/world/entity";
import type { EntityId } from "@agent-crossing/world/entity";
import { WorldEvent } from "@agent-crossing/world/event";
import type { Tile } from "@agent-crossing/world/grid";
import type { Rejection } from "@agent-crossing/world/rejection";
import type { Timestamp, Username } from "@agent-crossing/world/values";
import { arrivalAt } from "@agent-crossing/world/walk";
import { characterOf, entityOf } from "@agent-crossing/world/world";
import type { World } from "@agent-crossing/world/world";
import * as Arr from "effect/Array";
import * as Match from "effect/Match";
import * as Option from "effect/Option";

import type { Numbered } from "./journal.ts";

export const tileText = (tile: Tile) => `${tile.x},${tile.y}`;

// oxlint-disable-next-line effecttsgo/global-json -- JSON.stringify of a string cannot throw, and its escaping marks where other characters' words begin and end
export const quoted = (words: string) => JSON.stringify(words);

const seconds = (millis: number) => `${(Math.abs(millis) / 1000).toFixed(1)} s`;

export const inTime = (now: Timestamp, at: Timestamp) =>
  at <= now ? "now" : `in ${seconds(at - now)}`;

const agoText = (now: Timestamp, at: Timestamp) =>
  now - at < 1000 ? "just now" : `${seconds(now - at)} ago`;

export const itemText = (item: Item) =>
  Item.match(item, {
    Block: ({ colour }) => `${colour} block`,
    Flower: ({ colour }) => `${colour} flower`,
    Sign: () => "sign",
  });

export const writingOn = (item: Item) =>
  item._tag === "Sign"
    ? `, its writing (in-world text by a character) reads ${quoted(item.text)}`
    : "";

const isUnchanged = (displayName: string, username: string) =>
  displayName === username;

export const characterText = (world: World, username: Username) =>
  Option.match(characterOf(world, username), {
    onNone: () => `@${username}`,
    onSome: ({ displayName }) =>
      isUnchanged(displayName, username)
        ? `@${username}`
        : `@${username} (named ${quoted(displayName)})`,
  });

export const entityText = (world: World, id: EntityId) =>
  Option.match(entityOf(world, id), {
    onNone: () => id,
    onSome: ({ item }) => `${id} (${itemText(item)})`,
  });

const othersEvent = (world: World, event: WorldEvent, now: Timestamp) => {
  const who = characterText(world, event.actor);

  return WorldEvent.match(event, {
    Appeared: ({ tile }) => `${who} appeared at ${tileText(tile)}.`,
    Created: ({ entity, item, tile }) =>
      `${who} created ${entity}, a ${itemText(item)}, at ${tileText(tile)}${writingOn(item)}.`,
    Destroyed: ({ entity, tile }) =>
      `${who} destroyed ${entity} at ${tileText(tile)}.`,
    PickedUp: ({ entity, tile }) =>
      `${who} picked up ${entityText(world, entity)} from ${tileText(tile)}.`,
    PutDown: ({ entity, tile }) =>
      `${who} put down ${entityText(world, entity)} at ${tileText(tile)}.`,
    Renamed: ({ actor, displayName, tile }) =>
      `@${actor} at ${tileText(tile)} is now named ${quoted(displayName)}.`,
    Said: ({ text, tile }) =>
      `${who} at ${tileText(tile)} said (in-world speech by that character): ${quoted(text)}`,
    Vanished: ({ tile }) => `${who} vanished from ${tileText(tile)}.`,
    WalkStarted: ({ at, path }) =>
      arrivalAt(path, at) <= now
        ? `${who} walked from ${tileText(Arr.headNonEmpty(path))} to ${tileText(Arr.lastNonEmpty(path))}, arriving ${agoText(now, arrivalAt(path, at))}.`
        : `${who} started walking from ${tileText(Arr.headNonEmpty(path))} to ${tileText(Arr.lastNonEmpty(path))}, arriving ${inTime(now, arrivalAt(path, at))}.`,
  });
};

export const nearbyText = (
  world: World,
  entries: readonly Numbered[],
  now: Timestamp,
  since: string
) =>
  Arr.match(entries, {
    onEmpty: () => `Nothing happened nearby ${since}.`,
    onNonEmpty: (happened) =>
      Arr.join(
        [
          `Nearby ${since}:`,
          ...Arr.map(
            happened,
            ({ event }) =>
              `- [${agoText(now, event.at)}] ${othersEvent(world, event, now)}`
          ),
        ],
        "\n"
      ),
  });

const ownEvent = (world: World, event: WorldEvent, now: Timestamp) =>
  WorldEvent.match(event, {
    Appeared: ({ tile }) => `You appeared at ${tileText(tile)}.`,
    Created: ({ entity, item, tile }) =>
      `You created ${entity}, a ${itemText(item)}, at ${tileText(tile)}.`,
    Destroyed: ({ entity, tile }) =>
      `You destroyed ${entity} at ${tileText(tile)}.`,
    PickedUp: ({ entity, tile }) =>
      `You picked up ${entityText(world, entity)} from ${tileText(tile)} and now carry it.`,
    PutDown: ({ entity, tile }) =>
      `You put down ${entityText(world, entity)} at ${tileText(tile)}.`,
    Renamed: ({ displayName }) => `You are now named ${quoted(displayName)}.`,
    Said: ({ text }) => `You said: ${quoted(text)}`,
    Vanished: ({ at, tile }) =>
      `You had vanished from ${tileText(tile)} ${agoText(now, at)}, after two minutes without a tool call or an open event stream.`,
    WalkStarted: ({ at, path }) =>
      `You set off from ${tileText(Arr.headNonEmpty(path))} towards ${tileText(Arr.lastNonEmpty(path))}, ${path.length - 1} steps, arriving ${inTime(now, arrivalAt(path, at))}.`,
  });

export const ownEventsText = (
  world: World,
  self: Username,
  events: readonly WorldEvent[],
  now: Timestamp,
  shown: (event: WorldEvent) => boolean = () => true
) =>
  Arr.join(
    Arr.map(
      Arr.filter(events, (event) => event.actor === self && shown(event)),
      (event) => ownEvent(world, event, now)
    ),
    "\n"
  );

const besideText = (tile: Tile) =>
  `${tile.x},${tile.y - 1} (north), ${tile.x + 1},${tile.y} (east), ${tile.x},${tile.y + 1} (south) and ${tile.x - 1},${tile.y} (west)`;

export const rejectionText = (
  world: World,
  rejection: Rejection,
  now: Timestamp
) =>
  Match.valueTags(rejection, {
    StillWalking: (reason) =>
      `You are still walking to ${tileText(reason.destination)} and arrive ${inTime(now, reason.arrivesAt)}. While walking you can only say, set_name or look. Try again after you arrive.`,
    NotAdjacent: (reason) =>
      `${tileText(reason.target)} is not next to you: you are at ${tileText(reason.position)}. You can only act on the four tiles beside you: ${besideText(reason.position)}. Use move_to to stand on a free tile beside ${tileText(reason.target)} first.`,
    NoPath: (reason) =>
      `There is no walkable path from ${tileText(reason.from)} to ${tileText(reason.to)}. Water, entities, or a step of more than one height level block every route. Choose another land tile; look shows heights and what is in the way.`,
    TileIsWater: (reason) =>
      `${tileText(reason.tile)} is water. Choose a land tile; look shows water as ~ on the map.`,
    TileOccupied: (reason) =>
      `${tileText(reason.tile)} already holds ${reason.entity.id} (${itemText(reason.entity.item)}). A tile holds one entity. Choose a free tile, or pick up or destroy ${reason.entity.id} first.`,
    CharacterInTheWay: (reason) =>
      `${characterText(world, reason.character)} is standing on ${tileText(reason.tile)}. Choose another tile, or wait until they move.`,
    OnWalkersPath: (reason) =>
      `${tileText(reason.tile)} is on the path ${characterText(world, reason.walker)} is walking, and they arrive ${inTime(now, reason.arrivesAt)}. Choose another tile, or try again after they arrive.`,
    AlreadyCarrying: (reason) =>
      `You already carry ${reason.carrying.id} (${itemText(reason.carrying.item)}), and you can carry one thing at a time. Use put_down on a free tile beside you first.`,
    CarryingNothing: () =>
      "You are carrying nothing, so there is nothing to put down. Use pick_up on an entity beside you first.",
    UnknownEntity: (reason) =>
      `There is no entity ${reason.entity}. Use look to see the ids of the entities around you.`,
    EntityCarried: (reason) =>
      `${reason.entity} is being carried by ${characterText(world, reason.carriedBy)}. You can only pick up or destroy entities on the ground.`,
    NameTaken: (reason) =>
      `The name ${quoted(reason.displayName)} is already used by ${characterText(world, reason.takenBy)}, ignoring case. Choose a different name.`,
    EntityLimitReached: (reason) =>
      `The world already holds its limit of ${reason.limit} entities. Destroy one before creating another.`,
  });

export const reservedNameText = (name: string, username: Username) =>
  `The name ${quoted(name)} is the username of @${username}, ignoring case, so another character may not use it. Choose a different name.`;
