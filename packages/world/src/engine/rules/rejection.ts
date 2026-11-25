import * as Schema from "effect/Schema";

import { Cell } from "../../schema/cell.ts";
import { Layer, Place } from "../../schema/components.ts";
import { Entity, EntityId } from "../state/entity.ts";

/** The cell has no floor, so it is not part of the world. */
export class NoFloor extends Schema.TaggedError<
  NoFloor,
  { readonly brand: unique symbol }
>()("NoFloor", { cell: Cell }) {}

/** The place in the cell is not one the entity's habitat allows. */
export class UnsuitablePlace extends Schema.TaggedError<
  UnsuitablePlace,
  { readonly brand: unique symbol }
>()("UnsuitablePlace", {
  cell: Cell,
  place: Place,
  habitat: Schema.NonEmptyArray(Place),
}) {}

/** Another entity already fills that layer of the cell. */
export class LayerTaken extends Schema.TaggedError<
  LayerTaken,
  { readonly brand: unique symbol }
>()("LayerTaken", { cell: Cell, layer: Layer, occupant: Entity }) {}

export class UnknownEntity extends Schema.TaggedError<
  UnknownEntity,
  { readonly brand: unique symbol }
>()("UnknownEntity", { entity: EntityId }) {}

export const Rejection = Schema.Union([
  NoFloor,
  UnsuitablePlace,
  LayerTaken,
  UnknownEntity,
]);
