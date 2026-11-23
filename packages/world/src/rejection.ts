import * as Schema from "effect/Schema";

import { Entity, EntityId } from "./entity.ts";
import { Tile } from "./grid.ts";
import { DisplayName, Timestamp, Username } from "./values.ts";

export class StillWalking extends Schema.TaggedError<
  StillWalking,
  { readonly brand: unique symbol }
>()("StillWalking", { destination: Tile, arrivesAt: Timestamp }) {}

export class NotAdjacent extends Schema.TaggedError<
  NotAdjacent,
  { readonly brand: unique symbol }
>()("NotAdjacent", { position: Tile, target: Tile }) {}

export class NoPath extends Schema.TaggedError<
  NoPath,
  { readonly brand: unique symbol }
>()("NoPath", { from: Tile, to: Tile }) {}

export class TileIsWater extends Schema.TaggedError<
  TileIsWater,
  { readonly brand: unique symbol }
>()("TileIsWater", { tile: Tile }) {}

export class TileOccupied extends Schema.TaggedError<
  TileOccupied,
  { readonly brand: unique symbol }
>()("TileOccupied", { tile: Tile, entity: Entity }) {}

export class CharacterInTheWay extends Schema.TaggedError<
  CharacterInTheWay,
  { readonly brand: unique symbol }
>()("CharacterInTheWay", { tile: Tile, character: Username }) {}

export class OnWalkersPath extends Schema.TaggedError<
  OnWalkersPath,
  { readonly brand: unique symbol }
>()("OnWalkersPath", { tile: Tile, walker: Username, arrivesAt: Timestamp }) {}

export class AlreadyCarrying extends Schema.TaggedError<
  AlreadyCarrying,
  { readonly brand: unique symbol }
>()("AlreadyCarrying", { carrying: Entity }) {}

export class CarryingNothing extends Schema.TaggedError<
  CarryingNothing,
  { readonly brand: unique symbol }
>()("CarryingNothing", {}) {}

export class UnknownEntity extends Schema.TaggedError<
  UnknownEntity,
  { readonly brand: unique symbol }
>()("UnknownEntity", { entity: EntityId }) {}

export class EntityCarried extends Schema.TaggedError<
  EntityCarried,
  { readonly brand: unique symbol }
>()("EntityCarried", { entity: EntityId, carriedBy: Username }) {}

export class NameTaken extends Schema.TaggedError<
  NameTaken,
  { readonly brand: unique symbol }
>()("NameTaken", { displayName: DisplayName, takenBy: Username }) {}

export class EntityLimitReached extends Schema.TaggedError<
  EntityLimitReached,
  { readonly brand: unique symbol }
>()("EntityLimitReached", { limit: Schema.Int }) {}

export const Rejection = Schema.Union([
  StillWalking,
  NotAdjacent,
  NoPath,
  TileIsWater,
  TileOccupied,
  CharacterInTheWay,
  OnWalkersPath,
  AlreadyCarrying,
  CarryingNothing,
  UnknownEntity,
  EntityCarried,
  NameTaken,
  EntityLimitReached,
]);

export type Rejection = typeof Rejection.Type;
