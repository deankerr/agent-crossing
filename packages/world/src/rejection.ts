import * as Schema from "effect/Schema";

import { Cell } from "./cell.ts";
import { Layer } from "./components.ts";
import { Entity, EntityId } from "./entity.ts";
import { GroundKind } from "./ground.ts";

/** The cell has no ground, so it is not part of the world. */
export class NoGround extends Schema.TaggedError<
  NoGround,
  { readonly brand: unique symbol }
>()("NoGround", { cell: Cell }) {}

/** Aquatic things go on wet ground and everything else on dry ground. */
export class UnsuitableGround extends Schema.TaggedError<
  UnsuitableGround,
  { readonly brand: unique symbol }
>()("UnsuitableGround", {
  cell: Cell,
  ground: GroundKind,
  needsWater: Schema.Boolean,
}) {}

/** Another entity already claims that layer of the cell. */
export class LayerTaken extends Schema.TaggedError<
  LayerTaken,
  { readonly brand: unique symbol }
>()("LayerTaken", { cell: Cell, layer: Layer, occupant: Entity }) {}

export class UnknownEntity extends Schema.TaggedError<
  UnknownEntity,
  { readonly brand: unique symbol }
>()("UnknownEntity", { entity: EntityId }) {}

export const Rejection = Schema.Union([
  NoGround,
  UnsuitableGround,
  LayerTaken,
  UnknownEntity,
]);

export type Rejection = typeof Rejection.Type;
