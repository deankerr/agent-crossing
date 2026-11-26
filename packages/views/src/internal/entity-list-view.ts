import type * as Prefabs from "@agent-crossing/definitions/Prefabs";
import * as Cell from "@agent-crossing/world/Cell";
import * as Entity from "@agent-crossing/world/Entity";
import * as Region from "@agent-crossing/world/Region";
import * as World from "@agent-crossing/world/World";
import * as Arr from "effect/Array";
import * as Option from "effect/Option";
import * as Record from "effect/Record";

import { nounOf, quoted } from "./words.ts";

/** {@link text} lists at most this many entities. */
export const MAX_LIMIT = 500;
export const DEFAULT_LIMIT = 100;

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

  return `${entity.id} ${entity.prefab} (${nounOf(entity)}) at ${Cell.format(entity.cell)}${own.length === 0 ? "" : `: ${Arr.join(own, ", ")}`}`;
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
export const text = (
  world: World.World,
  region: Option.Option<typeof Region.Region.Type>,
  prefab: Option.Option<typeof Prefabs.Name.Type>,
  limit: number
) => {
  const cap = Math.max(1, Math.min(MAX_LIMIT, Math.trunc(limit)));
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
        ? `${found.length} ${what(found.length)} ${where}; showing the first ${cap} (the limit is ${cap}, at most ${MAX_LIMIT}). Narrow the region or prefab to see the rest.`
        : `${found.length} ${what(found.length)} ${where}:`,
      ...Arr.map(shown, entityLine),
    ],
    "\n"
  );
};
