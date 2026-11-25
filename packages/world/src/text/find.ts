import * as Arr from "effect/Array";
import * as Option from "effect/Option";
import * as Record from "effect/Record";

import type { PrefabName } from "../definitions/prefabs/index.ts";
import { cellsOf } from "../editing/region.ts";
import type { Region } from "../editing/region.ts";
import { cellKey, formatCell } from "../schema/cell.ts";
import { nounOf } from "../state/entity.ts";
import type { Entity } from "../state/entity.ts";
import { allEntities, isFloor, isLiquid } from "../state/world.ts";
import type { World } from "../state/world.ts";
import { quoted } from "./words.ts";

/** {@link findText} lists at most this many entities. */
export const FIND_MAX_LIMIT = 500;
export const FIND_DEFAULT_LIMIT = 100;

type Present = typeof Entity.Type;

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

  return `${entity.id} ${entity.prefab} (${nounOf(entity)}) at ${formatCell(entity.cell)}${own.length === 0 ? "" : `: ${Arr.join(own, ", ")}`}`;
};

const inRegion = (region: Option.Option<typeof Region.Type>) =>
  Option.match(region, {
    onNone: () => () => true,
    onSome: (chosen) => {
      const keys = new Set<string>(Arr.map(cellsOf(chosen), cellKey));

      return (entity: Present) => keys.has(cellKey(entity.cell));
    },
  });

/**
 * The entities in a region, or the whole world, oldest first, capped at
 * `limit`. With a prefab, only entities of that prefab; without one, every
 * entity but the floors and liquids.
 */
export const findText = (
  world: World,
  region: Option.Option<typeof Region.Type>,
  prefab: Option.Option<typeof PrefabName.Type>,
  limit: number
) => {
  const cap = Math.max(1, Math.min(FIND_MAX_LIMIT, Math.trunc(limit)));
  const isIn = inRegion(region);

  const found = Arr.filter(
    allEntities(world),
    (entity) =>
      isIn(entity) &&
      Option.match(prefab, {
        onNone: () => !isFloor(entity) && !isLiquid(entity),
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
