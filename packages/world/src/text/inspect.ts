import * as Arr from "effect/Array";
import * as Option from "effect/Option";
import * as Record from "effect/Record";

import { habitatOf } from "../rules/placement.ts";
import { formatCell } from "../schema/cell.ts";
import type { Cell } from "../schema/cell.ts";
import { componentsOf, nounOf, storedLevel } from "../state/entity.ts";
import type { Entity } from "../state/entity.ts";
import {
  entitiesAt,
  floorAt,
  isFloor,
  isLiquid,
  liquidAt,
} from "../state/world.ts";
import type { World } from "../state/world.ts";
import { listed, quoted } from "./words.ts";

const componentText = (entity: typeof Entity.Type) => {
  const components = componentsOf(entity);

  return listed([
    ...(components.layer === undefined ? [] : [`layer ${components.layer}`]),
    ...(components.layer === "floor" || components.layer === "liquid"
      ? []
      : [`habitat ${Arr.join(habitatOf(components), " and ")}`]),
    ...(components.obstacle === true ? ["obstacle"] : []),
    ...(components.level === undefined ? [] : [`level ${components.level}`]),
    `label "${components.label.noun}" (${components.label.glyph})`,
    `model of ${Arr.join(
      Arr.map(components.model.parts, (part) => part.name),
      " and "
    )}`,
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
};

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
      const present = entitiesAt(world, cell);

      const entities = Arr.filter(
        present,
        (entity) => !isFloor(entity) && !isLiquid(entity)
      );

      const obstructed = Arr.some(
        present,
        (entity) => componentsOf(entity).obstacle === true
      );

      const surface = Option.match(liquidAt(world, cell), {
        onNone: () =>
          `${at(floor)}, ${obstructed ? "land with an obstacle" : "land"}`,
        onSome: (liquid) => `${at(liquid)} over ${at(floor)}, water`,
      });

      return Arr.join(
        [
          `Cell ${formatCell(cell)}: ${surface}.`,
          ...(entities.length === 0
            ? ["Nothing stands here."]
            : Arr.map(
                entities,
                (entity) =>
                  `- ${entity.id} ${entity.prefab}: ${componentText(entity)}`
              )),
        ],
        "\n"
      );
    },
  });
