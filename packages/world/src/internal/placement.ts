import type * as Components from "@agent-crossing/definitions/Components";
import * as Arr from "effect/Array";
import * as Option from "effect/Option";
import * as Result from "effect/Result";

import * as Cell from "../Cell.ts";
import * as Entity from "../Entity.ts";
import * as Refusal from "../Refusal.ts";
import * as World from "../World.ts";

/**
 * Whether an entity with these effective components may be in the cell.
 * `self` is the entity being moved or changed, which never blocks itself.
 *
 * A floor needs only a free floor layer. Anything else needs a floor, and
 * anything but a liquid needs the place to be in its habitat.
 */
export const ensurePlaceable = (
  world: World.World,
  cell: typeof Cell.Cell.Type,
  components: typeof Components.Components.Type,
  self: Option.Option<typeof Entity.Id.Type> = Option.none()
) =>
  Result.gen(function* () {
    const present = Arr.filter(
      World.entitiesAt(world, cell),
      (entity) => !Option.contains(self, entity.id)
    );

    const filling = (layer: typeof Components.Layer.Type) =>
      Arr.findFirst(
        present,
        (entity) => Entity.components(entity).layer === layer
      );

    const { layer } = components;

    if (layer !== "floor") {
      if (Option.isNone(filling("floor"))) {
        return yield* Result.fail(new Refusal.NoFloor({ cell }));
      }

      if (layer !== "liquid") {
        const place: typeof Components.Place.Type = Option.isSome(
          filling("liquid")
        )
          ? "water"
          : "land";

        const habitat = Entity.habitat(components);

        if (!habitat.includes(place)) {
          return yield* Result.fail(
            new Refusal.UnsuitablePlace({ cell, habitat, place })
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
        new Refusal.LayerTaken({ cell, layer, occupant: occupant.value })
      );
    }
  });

const fits = (world: World.World, entity: typeof Entity.Entity.Type) =>
  Result.isSuccess(
    ensurePlaceable(
      world,
      entity.cell,
      Entity.components(entity),
      Option.some(entity.id)
    )
  );

/** The entities in these cells that may no longer stay there. */
export const misfitsIn = (
  world: World.World,
  cells: Iterable<typeof Cell.Cell.Type>
) => {
  const distinct = new Map<string, typeof Cell.Cell.Type>();

  for (const cell of cells) {
    distinct.set(Cell.key(cell), cell);
  }

  return Arr.filter(
    Arr.flatMap(Arr.fromIterable(distinct.values()), (cell) =>
      World.entitiesAt(world, cell)
    ),
    (entity) => !fits(world, entity)
  );
};
