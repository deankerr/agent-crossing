import type * as Prefabs from "@agent-crossing/definitions/Prefabs";
import * as Arr from "effect/Array";
import * as Option from "effect/Option";
import * as Record from "effect/Record";

import * as Cell from "../Cell.ts";
import * as Entity from "../Entity.ts";
import * as Region from "../Region.ts";
import * as World from "../World.ts";
import { quoted } from "./words.ts";

/** {@link findText} lists at most this many entities. */
export const FIND_MAX_LIMIT = 500;
export const FIND_DEFAULT_LIMIT = 100;

type Present = typeof Entity.Entity.Type;

const entityLine = (entity: Present) => {
  const { colors, level, text } = entity.components;

  const own = Arr.filter(
    [
      level === undefined ? "" : `level ${level}`,
      colors === undefined
        ? ""
        : `colors ${Arr.join(
            Arr.map(
              Record.toEntries(colors),
              ([part, shade]) => `${part} ${shade}`
            ),
            " and "
          )}`,
      text === undefined ? "" : `text ${quoted(text)}`,
    ],
    (part) => part !== ""
  );

  return `${entity.id} ${entity.prefab} (${Entity.nounOf(entity)}) at ${Cell.format(entity.cell)}${own.length === 0 ? "" : `: ${Arr.join(own, ", ")}`}`;
};

const inRegion = (region: Option.Option<typeof Region.Region.Type>) =>
  Option.match(region, {
    onNone: () => () => true,
    onSome: (chosen) => {
      const keys = new Set<string>(Arr.map(Region.cells(chosen), Cell.key));

      return (entity: Present) => keys.has(Cell.key(entity.cell));
    },
  });

/**
 * The entities in a region, or the whole world, oldest first, capped at
 * `limit`. With a prefab, only entities of that prefab; without one, every
 * entity but the floors and liquids.
 */
export const findText = (
  world: World.World,
  region: Option.Option<typeof Region.Region.Type>,
  prefab: Option.Option<typeof Prefabs.Name.Type>,
  limit: number
) => {
  const cap = Math.max(1, Math.min(FIND_MAX_LIMIT, Math.trunc(limit)));
  const isIn = inRegion(region);

  const found = Arr.filter(
    World.entities(world),
    (entity) =>
      isIn(entity) &&
      Option.match(prefab, {
        onNone: () => !Entity.isFloor(entity) && !Entity.isLiquid(entity),
        onSome: (wanted) => wanted === entity.prefab,
      })
  );

  const where = Option.isSome(region) ? "in that region" : "in the world";

  const what = (count: number) =>
    `${Option.match(prefab, { onNone: () => "", onSome: (wanted) => `${wanted} ` })}${count === 1 ? "entity" : "entities"}`;

  if (found.length === 0) {
    return `No ${what(0)} ${where}.`;
  }

  const shown = Arr.take(found, cap);

  return Arr.join(
    [
      found.length > cap
        ? `${found.length} ${what(found.length)} ${where}; showing the first ${cap} (the limit is ${cap}, at most ${FIND_MAX_LIMIT}). Narrow the region or prefab to see the rest.`
        : `${found.length} ${what(found.length)} ${where}:`,
      ...Arr.map(shown, entityLine),
    ],
    "\n"
  );
};
