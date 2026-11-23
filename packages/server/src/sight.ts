import { Item } from "@agent-crossing/world/entity";
import { MAP_SIZE, sameTile, tileAt } from "@agent-crossing/world/grid";
import type { Tile } from "@agent-crossing/world/grid";
import { PERCEPTION_RADIUS } from "@agent-crossing/world/perception";
import type {
  CarriedView,
  CharacterView,
  EntityView,
  Observation,
} from "@agent-crossing/world/perception";
import { heightAt } from "@agent-crossing/world/terrain";
import type { Username } from "@agent-crossing/world/values";
import { characterOf } from "@agent-crossing/world/world";
import type { World } from "@agent-crossing/world/world";
import * as Arr from "effect/Array";
import * as Option from "effect/Option";
import * as Str from "effect/String";

import {
  characterText,
  inTime,
  isUnchanged,
  itemText,
  quoted,
  tileText,
  writingOn,
} from "./narration.ts";

const MAP_RADIUS = PERCEPTION_RADIUS;

export const LEGEND =
  "Legend: 0-3 land at that height (a step between neighbouring tiles may change height by at most 1), ~ water, @ you, C another character, # block, * flower, ! sign, blank outside the world. Blocks and signs are solid; flowers are not, so a character may stand on a flower and is then shown instead of it.";

export const AXES = `Coordinates are x,y. x grows eastwards (left to right on the map) and y grows southwards (top to bottom); both run 0..${MAP_SIZE - 1}.`;

const entityGlyph = ({ item }: EntityView) =>
  Item.match(item, { Block: () => "#", Flower: () => "*", Sign: () => "!" });

const terrainGlyph = (tile: Tile) =>
  Option.match(heightAt(tile), {
    onNone: () => "~",
    onSome: (height) => `${height}`,
  });

const glyphAt = (observation: Observation, x: number, y: number) =>
  Option.match(tileAt(x, y), {
    onNone: () => " ",
    onSome: (tile) => {
      if (sameTile(observation.self.tile, tile)) {
        return "@";
      }

      if (
        Arr.some(observation.characters, (other) => sameTile(other.tile, tile))
      ) {
        return "C";
      }

      return Option.match(
        Arr.findFirst(observation.entities, (entity) =>
          sameTile(entity.tile, tile)
        ),
        { onNone: () => terrainGlyph(tile), onSome: entityGlyph }
      );
    },
  });

const span = (centre: number) =>
  Arr.makeBy(2 * MAP_RADIUS + 1, (offset) => centre - MAP_RADIUS + offset);

const digit = (value: number, place: number) =>
  value < 0 || value >= MAP_SIZE ? " " : `${Math.floor(value / place) % 10}`;

export const mapText = (observation: Observation) => {
  const columns = span(observation.self.tile.x);
  const rows = span(observation.self.tile.y);

  return Arr.join(
    [
      `Map of the ${columns.length}x${rows.length} tiles around you. The two header rows give x (tens digit above units digit); each row starts with its y.`,
      `   ${Arr.join(
        Arr.map(columns, (x) => digit(x, 10)),
        ""
      )}`,
      `   ${Arr.join(
        Arr.map(columns, (x) => digit(x, 1)),
        ""
      )}`,
      ...Arr.map(
        Arr.filter(rows, (y) => y >= 0 && y < MAP_SIZE),
        (y) =>
          `${Str.padStart(2)(`${y}`)} ${Arr.join(
            Arr.map(columns, (x) => glyphAt(observation, x, y)),
            ""
          )}`
      ),
      LEGEND,
    ],
    "\n"
  );
};

const carryingText = (carrying: CarriedView | null) =>
  carrying === null
    ? "nothing"
    : `${carrying.id}, a ${itemText(carrying.item)}${writingOn(carrying.item)}`;

const groundText = (tile: Tile) =>
  Option.match(heightAt(tile), {
    onNone: () => "in water",
    onSome: (height) => `on ground height ${height}`,
  });

const entityLine = ({ id, item, tile }: EntityView) =>
  `- ${id}: ${itemText(item)} at ${tileText(tile)}${writingOn(item)}`;

const characterLine =
  (world: World, now: number) =>
  ({ carrying, tile, username, walking }: CharacterView) =>
    `- ${characterText(world, username)} at ${tileText(tile)}, carrying ${carryingText(carrying)}${
      walking === null
        ? ""
        : `, walking to ${tileText(walking.destination)} (arrives ${inTime(now, walking.arrivesAt)})`
    }`;

const selfNameText = (world: World, username: Username) =>
  Option.match(characterOf(world, username), {
    onNone: () => `@${username}`,
    onSome: ({ displayName }) =>
      isUnchanged(displayName, username)
        ? `@${username} (you have not set a display name)`
        : `${quoted(displayName)} (username @${username})`,
  });

const listText = (title: string, lines: readonly string[]) =>
  Arr.join(
    [
      title,
      ...Arr.match(lines, {
        onEmpty: () => ["- none"],
        onNonEmpty: (some) => some,
      }),
    ],
    "\n"
  );

export const selfText = (world: World, observation: Observation) => {
  const { self } = observation;

  return Arr.join(
    [
      `You are ${selfNameText(world, self.username)}, at ${tileText(self.tile)} ${groundText(self.tile)}, carrying ${carryingText(self.carrying)}.`,
      ...(self.walking === null
        ? []
        : [
            `You are walking to ${tileText(self.walking.destination)} and arrive ${inTime(observation.at, self.walking.arrivesAt)}.`,
          ]),
    ],
    " "
  );
};

export const lookText = (world: World, observation: Observation) =>
  Arr.join(
    [
      selfText(world, observation),
      AXES,
      mapText(observation),
      listText(
        `Entities within ${PERCEPTION_RADIUS} tiles:`,
        Arr.map(observation.entities, entityLine)
      ),
      listText(
        `Characters within ${PERCEPTION_RADIUS} tiles:`,
        Arr.map(observation.characters, characterLine(world, observation.at))
      ),
    ],
    "\n\n"
  );
