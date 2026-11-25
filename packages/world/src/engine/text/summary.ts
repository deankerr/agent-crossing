import * as Arr from "effect/Array";
import * as Option from "effect/Option";

import { labelOf, nounOf } from "../state/entity.ts";
import {
  allEntities,
  bounds,
  countsBy,
  isFloor,
  isLiquid,
} from "../state/world.ts";
import type { World } from "../state/world.ts";
import { cellsWord, counted, listed, spanText } from "./words.ts";

/**
 * The world's extent, its floors and water, and how many of each other
 * thing it holds by what an agent calls them.
 */
export const summaryText = (world: World) =>
  Option.match(bounds(world), {
    onNone: () => "The world is empty: no cell has a floor.",
    onSome: (span) => {
      const entities = allEntities(world);
      const floors = Arr.filter(entities, isFloor);
      const liquids = Arr.filter(entities, isLiquid);

      const others = Arr.filter(
        entities,
        (entity) => !isFloor(entity) && !isLiquid(entity)
      );

      const labels = new Map(
        Arr.map(others, (entity) => [nounOf(entity), labelOf(entity)] as const)
      );

      const things = Arr.getSomes(
        Arr.map(countsBy(others, nounOf), ({ count, key }) =>
          Option.map(Option.fromNullishOr(labels.get(key)), (label) =>
            counted(count, label)
          )
        )
      );

      return Arr.join(
        [
          `The world spans ${spanText(span)}, with ${floors.length} cells of floor.`,
          `Floors: ${listed(
            Arr.map(
              countsBy(floors, nounOf),
              ({ count, key }) => `${count} ${key}`
            )
          )}.`,
          `Water: ${cellsWord(liquids.length)}.`,
          things.length === 0
            ? "Entities: none."
            : `Entities (${others.length}): ${listed(things)}.`,
        ],
        "\n"
      );
    },
  });
