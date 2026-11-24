import * as Arr from "effect/Array";
import * as Option from "effect/Option";
import * as Result from "effect/Result";

import type { Cell } from "./cell.ts";
import { isAquatic } from "./components.ts";
import type { Components } from "./components.ts";
import { componentsOf } from "./entity.ts";
import type { EntityId } from "./entity.ts";
import { traitsOf } from "./ground.ts";
import type { Ground } from "./ground.ts";
import { LayerTaken, NoGround, UnsuitableGround } from "./rejection.ts";
import { entitiesAt, groundAt } from "./world.ts";
import type { World } from "./world.ts";

/** Aquatic things belong on wet ground, everything else on dry ground. */
export const suits = (ground: Ground, components: Components) =>
  traitsOf(ground.kind).wet === isAquatic(components);

/**
 * Whether an entity with these effective components may stand on the cell.
 * `self` is the entity being moved or changed, which never blocks itself.
 */
export const ensurePlaceable = (
  world: World,
  cell: Cell,
  components: Components,
  self: Option.Option<EntityId> = Option.none()
) =>
  Result.gen(function* () {
    const ground = yield* Option.match(groundAt(world, cell), {
      onNone: () => Result.fail(new NoGround({ cell })),
      onSome: Result.succeed,
    });

    if (!suits(ground, components)) {
      return yield* Result.fail(
        new UnsuitableGround({
          cell,
          ground: ground.kind,
          needsWater: isAquatic(components),
        })
      );
    }

    const { layer } = components;

    if (layer === undefined) {
      return;
    }

    const occupant = Arr.findFirst(
      entitiesAt(world, cell),
      (entity) =>
        !Option.contains(self, entity.id) &&
        componentsOf(entity).layer === layer
    );

    if (Option.isSome(occupant)) {
      return yield* Result.fail(
        new LayerTaken({ cell, layer, occupant: occupant.value })
      );
    }
  });
