import * as Arr from "effect/Array";
import * as Option from "effect/Option";
import * as Result from "effect/Result";

import { cellKey } from "../../schema/cell.ts";
import type { Cell } from "../../schema/cell.ts";
import type { Components, Layer, Place } from "../../schema/components.ts";
import { componentsOf } from "../state/entity.ts";
import type { Entity, EntityId } from "../state/entity.ts";
import { entitiesAt } from "../state/world.ts";
import type { World } from "../state/world.ts";
import { LayerTaken, NoFloor, UnsuitablePlace } from "./rejection.ts";

type Habitat = readonly [typeof Place.Type, ...(typeof Place.Type)[]];

const LAND: Habitat = ["land"];

/** Where an entity can be. One that names no habitat lives on land. */
export const habitatOf = (components: typeof Components.Type) => {
  const habitat: Habitat = components.habitat ?? LAND;

  return habitat;
};

/**
 * Whether an entity with these effective components may be in the cell.
 * `self` is the entity being moved or changed, which never blocks itself.
 *
 * A floor needs only a free floor layer. Anything else needs a floor, and
 * anything but a liquid needs the place to be in its habitat.
 */
export const ensurePlaceable = (
  world: World,
  cell: typeof Cell.Type,
  components: typeof Components.Type,
  self: Option.Option<typeof EntityId.Type> = Option.none()
) =>
  Result.gen(function* () {
    const present = Arr.filter(
      entitiesAt(world, cell),
      (entity) => !Option.contains(self, entity.id)
    );

    const filling = (layer: typeof Layer.Type) =>
      Arr.findFirst(present, (entity) => componentsOf(entity).layer === layer);

    const { layer } = components;

    if (layer !== "floor") {
      if (Option.isNone(filling("floor"))) {
        return yield* Result.fail(new NoFloor({ cell }));
      }

      if (layer !== "liquid") {
        const place: typeof Place.Type = Option.isSome(filling("liquid"))
          ? "water"
          : "land";

        const habitat = habitatOf(components);

        if (!habitat.includes(place)) {
          return yield* Result.fail(
            new UnsuitablePlace({ cell, habitat, place })
          );
        }
      }
    }

    if (layer === undefined) {
      return;
    }

    const occupant = filling(layer);

    if (Option.isSome(occupant)) {
      return yield* Result.fail(
        new LayerTaken({ cell, layer, occupant: occupant.value })
      );
    }
  });

/** Whether an entity already in the world may stay where it is. */
export const fits = (world: World, entity: typeof Entity.Type) =>
  Result.isSuccess(
    ensurePlaceable(
      world,
      entity.cell,
      componentsOf(entity),
      Option.some(entity.id)
    )
  );

/** The entities in these cells that may no longer stay there. */
export const misfitsIn = (world: World, cells: Iterable<typeof Cell.Type>) => {
  const distinct = new Map<string, typeof Cell.Type>();

  for (const cell of cells) {
    distinct.set(cellKey(cell), cell);
  }

  return Arr.filter(
    Arr.flatMap(Arr.fromIterable(distinct.values()), (cell) =>
      entitiesAt(world, cell)
    ),
    (entity) => !fits(world, entity)
  );
};
