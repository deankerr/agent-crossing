import * as Schema from "effect/Schema";

import { Cell, COORDINATE_LIMIT } from "./cell.ts";
import { Components } from "./components.ts";
import { EntityId } from "./entity.ts";
import { GroundKind, Height } from "./ground.ts";
import { KindName } from "./kind.ts";
import { Region, REGION_MAX_AREA } from "./region.ts";

export const GENERATE_MIN_SIZE = 8;
export const GENERATE_MAX_SIZE = 256;
export const SCATTER_MAX_KINDS = 16;

/**
 * Sets the ground kind, the height or both across a region. Cells without
 * ground join the world only when a kind is given; their height defaults to 0.
 */
export const Paint = Schema.TaggedStruct("Paint", {
  region: Region,
  kind: Schema.optionalKey(GroundKind),
  height: Schema.optionalKey(Height),
}).check(
  Schema.makeFilter(
    ({ height, kind }) =>
      kind !== undefined ||
      height !== undefined ||
      "give a ground kind, a height or both"
  )
);

/** Removes the ground of a region, and everything standing on it. */
export const Erase = Schema.TaggedStruct("Erase", { region: Region });

export const Spawn = Schema.TaggedStruct("Spawn", {
  kind: KindName,
  cell: Cell,
  components: Schema.optionalKey(Components),
});

/**
 * Spawns things of the given kinds on a seeded random share of a region.
 * Cells where a thing may not go are skipped.
 */
export const Scatter = Schema.TaggedStruct("Scatter", {
  kinds: Schema.NonEmptyArray(KindName).check(
    Schema.isMaxLength(SCATTER_MAX_KINDS)
  ),
  region: Region,
  density: Schema.Finite.check(Schema.isBetween({ maximum: 1, minimum: 0 })),
  seed: Schema.Int,
  components: Schema.optionalKey(Components),
});

export const Move = Schema.TaggedStruct("Move", { entity: EntityId, to: Cell });

/** Replaces an entity's own components; its kind's defaults still apply beneath. */
export const Change = Schema.TaggedStruct("Change", {
  entity: EntityId,
  components: Components,
});

export const Remove = Schema.TaggedStruct("Remove", {
  entities: Schema.NonEmptyArray(EntityId).check(
    Schema.isMaxLength(REGION_MAX_AREA)
  ),
});

/** Removes every entity in a region, or only those of one kind. */
export const RemoveIn = Schema.TaggedStruct("RemoveIn", {
  region: Region,
  kind: Schema.optionalKey(KindName),
});

const size = Schema.Int.check(
  Schema.isBetween({ maximum: GENERATE_MAX_SIZE, minimum: GENERATE_MIN_SIZE })
);

/**
 * Paints a generated landscape over the rectangle from `origin` (its
 * north-west corner), replacing the ground and entities already there.
 */
export const Generate = Schema.TaggedStruct("Generate", {
  seed: Schema.Int,
  width: size,
  height: size,
  origin: Cell,
}).check(
  Schema.makeFilter(
    ({ height, origin, width }) =>
      (origin.x + width - 1 <= COORDINATE_LIMIT &&
        origin.y + height - 1 <= COORDINATE_LIMIT) ||
      "the landscape must fit inside the coordinate range"
  )
);

/** What an admin may ask of the world. */
export const Command = Schema.Union([
  Paint,
  Erase,
  Spawn,
  Scatter,
  Move,
  Change,
  Remove,
  RemoveIn,
  Generate,
]).pipe(Schema.toTaggedUnion("_tag"));

export type Command = typeof Command.Type;

export const decodeCommand = Schema.decodeUnknownResult(Command);
