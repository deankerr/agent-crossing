import * as Arr from "effect/Array";
import * as Option from "effect/Option";

import * as Entity from "../Entity.ts";
import * as World from "../World.ts";
import { cellsWord, counted, listed, spanText } from "./words.ts";

/**
 * The world's extent, its floors and water, and how many of each other
 * entity it holds by what an agent calls them.
 */
export const summaryText = (world: World.World) =>
  Option.match(World.bounds(world), {
    onNone: () => "The world is empty: no cell has a floor.",
    onSome: (span) => {
      const entities = World.entities(world);
      const floors = Arr.filter(entities, Entity.isFloor);
      const liquids = Arr.filter(entities, Entity.isLiquid);

      const others = Arr.filter(
        entities,
        (entity) => !Entity.isFloor(entity) && !Entity.isLiquid(entity)
      );

      const labels = new Map(
        Arr.map(
          others,
          (entity) => [Entity.nounOf(entity), Entity.labelOf(entity)] as const
        )
      );

      const tallies = Arr.getSomes(
        Arr.map(World.countsBy(others, Entity.nounOf), ({ count, key }) =>
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
              World.countsBy(floors, Entity.nounOf),
              ({ count, key }) => `${count} ${key}`
            )
          )}.`,
          `Water: ${cellsWord(liquids.length)}.`,
          tallies.length === 0
            ? "Entities: none."
            : `Entities (${others.length}): ${listed(tallies)}.`,
        ],
        "\n"
      );
    },
  });
