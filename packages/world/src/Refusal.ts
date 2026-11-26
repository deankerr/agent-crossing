import * as Components from "@agent-crossing/definitions/Components";
import * as Schema from "effect/Schema";

import * as Cell from "./Cell.ts";
import * as Entity from "./Entity.ts";

/** The cell has no floor, so it is not part of the world. */
export class NoFloor extends Schema.TaggedError<
  NoFloor,
  { readonly brand: unique symbol }
>()("NoFloor", { cell: Cell.Cell }) {}

/** The place in the cell is not one the entity's habitat allows. */
export class UnsuitablePlace extends Schema.TaggedError<
  UnsuitablePlace,
  { readonly brand: unique symbol }
>()("UnsuitablePlace", {
  cell: Cell.Cell,
  place: Components.Place,
  habitat: Schema.NonEmptyArray(Components.Place),
}) {}

/** Another entity already fills that layer of the cell. */
export class LayerTaken extends Schema.TaggedError<
  LayerTaken,
  { readonly brand: unique symbol }
>()("LayerTaken", {
  cell: Cell.Cell,
  layer: Components.Layer,
  occupant: Entity.Entity,
}) {}

export class UnknownEntity extends Schema.TaggedError<
  UnknownEntity,
  { readonly brand: unique symbol }
>()("UnknownEntity", { entity: Entity.Id }) {}

export const Refusal = Schema.Union([
  NoFloor,
  UnsuitablePlace,
  LayerTaken,
  UnknownEntity,
]);
