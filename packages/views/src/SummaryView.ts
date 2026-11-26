import * as Entity from "@agent-crossing/world/Entity";
import * as World from "@agent-crossing/world/World";
import * as Arr from "effect/Array";
import * as Option from "effect/Option";

import {
  cellsWord,
  counted,
  countsBy,
  labelOf,
  listed,
  nounOf,
  spanText,
} from "./internal/words.ts";

/**
 * The world's extent, its floors and water, and how many of each other
 * entity it holds by what an agent calls them.
 */
export const text = (world: World.World) =>
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
        Arr.map(others, (entity) => [nounOf(entity), labelOf(entity)] as const)
      );

      const tallies = Arr.getSomes(
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
          tallies.length === 0
            ? "Entities: none."
            : `Entities (${others.length}): ${listed(tallies)}.`,
        ],
        "\n"
      );
    },
  });
