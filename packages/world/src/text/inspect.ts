import * as Arr from "effect/Array";
import * as Option from "effect/Option";
import * as Record from "effect/Record";

import * as Cell from "../Cell.ts";
import * as Entity from "../Entity.ts";
import * as World from "../World.ts";
import { listed, quoted } from "./words.ts";

const componentText = (entity: typeof Entity.Entity.Type) => {
  const components = Entity.components(entity);

  return listed([
    ...(components.layer === undefined ? [] : [`layer ${components.layer}`]),
    ...(components.layer === "floor" || components.layer === "liquid"
      ? []
      : [`habitat ${Arr.join(Entity.habitat(components), " and ")}`]),
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

const named = (entity: typeof Entity.Entity.Type) => {
  const noun = Entity.nounOf(entity);

  return noun === entity.prefab ? noun : `${noun} (${entity.prefab})`;
};

const at = (entity: typeof Entity.Entity.Type) =>
  `${named(entity)} at level ${Entity.level(entity)}`;

/**
 * The floor and any liquid of one cell, and every other entity in it with
 * its effective components.
 */
export const inspectText = (world: World.World, cell: typeof Cell.Cell.Type) =>
  Option.match(World.floorAt(world, cell), {
    onNone: () =>
      `Cell ${Cell.format(cell)} is outside the world: it has no floor.`,
    onSome: (floor) => {
      const present = World.entitiesAt(world, cell);

      const entities = Arr.filter(
        present,
        (entity) => !Entity.isFloor(entity) && !Entity.isLiquid(entity)
      );

      const obstructed = Arr.some(
        present,
        (entity) => Entity.components(entity).obstacle === true
      );

      const surface = Option.match(World.liquidAt(world, cell), {
        onNone: () =>
          `${at(floor)}, ${obstructed ? "land with an obstacle" : "land"}`,
        onSome: (liquid) => `${at(liquid)} over ${at(floor)}, water`,
      });

      return Arr.join(
        [
          `Cell ${Cell.format(cell)}: ${surface}.`,
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
