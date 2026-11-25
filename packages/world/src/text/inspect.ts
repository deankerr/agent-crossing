import * as Arr from "effect/Array";
import * as Option from "effect/Option";
import * as Record from "effect/Record";

import { formatCell } from "../schema/cell.ts";
import type { Cell } from "../schema/cell.ts";
import type { Components } from "../schema/components.ts";
import { componentsOf, nounOf, storedLevel } from "../state/entity.ts";
import type { Entity } from "../state/entity.ts";
import {
  entitiesAt,
  floorAt,
  isFloor,
  isLiquid,
  isWalkable,
  liquidAt,
} from "../state/world.ts";
import type { World } from "../state/world.ts";
import { listed, quoted } from "./words.ts";

const componentText = (components: typeof Components.Type) =>
  listed([
    ...(components.layer === undefined ? [] : [`layer ${components.layer}`]),
    ...(components.habitat === undefined
      ? []
      : [`habitat ${Arr.join(components.habitat, " and ")}`]),
    ...(components.obstacle === true ? ["obstacle"] : []),
    ...(components.level === undefined ? [] : [`level ${components.level}`]),
    ...(components.label === undefined
      ? []
      : [`label "${components.label.noun}" (${components.label.glyph})`]),
    ...(components.model === undefined
      ? []
      : [
          `model of ${Arr.join(
            Arr.map(components.model.parts, (part) => part.name),
            " and "
          )}`,
        ]),
    ...(components.colors === undefined
      ? []
      : [
          `colors ${Arr.join(
            Arr.map(
              Record.toEntries(components.colors),
              ([part, shade]) => `${part} ${shade}`
            ),
            " and "
          )}`,
        ]),
    ...(components.text === undefined
      ? []
      : [`text ${quoted(components.text)}`]),
  ]);

const named = (entity: typeof Entity.Type) => {
  const noun = nounOf(entity);

  return noun === entity.prefab ? noun : `${noun} (${entity.prefab})`;
};

const at = (entity: typeof Entity.Type) =>
  `${named(entity)} at level ${storedLevel(entity)}`;

/**
 * The floor and any liquid of one cell, and every other entity in it with
 * its effective components.
 */
export const inspectText = (world: World, cell: typeof Cell.Type) =>
  Option.match(floorAt(world, cell), {
    onNone: () =>
      `Cell ${formatCell(cell)} is outside the world: it has no floor.`,
    onSome: (floor) => {
      const entities = Arr.filter(
        entitiesAt(world, cell),
        (entity) => !isFloor(entity) && !isLiquid(entity)
      );

      const surface = Option.match(liquidAt(world, cell), {
        onNone: () => at(floor),
        onSome: (liquid) => `${at(liquid)} over ${at(floor)}`,
      });

      return Arr.join(
        [
          `Cell ${formatCell(cell)}: ${surface}, ${isWalkable(world, cell) ? "walkable" : "not walkable"}.`,
          ...(entities.length === 0
            ? ["Nothing stands here."]
            : Arr.map(
                entities,
                (entity) =>
                  `- ${entity.id} ${entity.prefab}: ${componentText(componentsOf(entity))}`
              )),
        ],
        "\n"
      );
    },
  });
