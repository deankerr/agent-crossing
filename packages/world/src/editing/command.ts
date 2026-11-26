import * as Schema from "effect/Schema";

import { PrefabName } from "../definitions/prefabs/index.ts";
import { Cell, COORDINATE_LIMIT, Level } from "../schema/cell.ts";
import { Components } from "../schema/components.ts";
import type { Layer } from "../schema/components.ts";
import { EntityId, prefabComponents } from "../state/entity.ts";
import { Region, REGION_MAX_AREA } from "./region.ts";

export const GENERATE_MIN_SIZE = 8;
export const GENERATE_MAX_SIZE = 256;
export const SCATTER_MAX_PREFABS = 16;

const prefabIn = (layer: typeof Layer.Type) =>
  PrefabName.check(
    Schema.makeFilter(
      (name) =>
        prefabComponents(name).layer === layer || `must name a ${layer} prefab`
    )
  );

/** The name of a prefab whose layer is the floor. */
export const FloorName = prefabIn("floor");

/** The name of a prefab whose layer is the liquid. */
export const LiquidName = prefabIn("liquid");

/**
 * Lays a floor where there is none, at `level` or 0, and changes the prefab,
 * the level or both of floors already there, keeping what stands on them.
 * Cells without a floor join the world only when a floor is given.
 */
export const Paint = Schema.TaggedStruct("Paint", {
  region: Region,
  floor: Schema.optionalKey(FloorName),
  level: Schema.optionalKey(Level),
}).check(
  Schema.makeFilter(
    ({ floor, level }) =>
      floor !== undefined ||
      level !== undefined ||
      "give a floor, a level or both"
  )
);

/**
 * Puts a liquid over every floor of the region that has none, at the floor's
 * level, and lowers the floor one level beneath it, changing it to `bed`
 * when given. Floors already at the lowest level are skipped.
 */
export const Pour = Schema.TaggedStruct("Pour", {
  region: Region,
  liquid: LiquidName,
  bed: Schema.optionalKey(FloorName),
});

/** Removes every entity in a region, floors included. */
export const Erase = Schema.TaggedStruct("Erase", { region: Region });

export const Spawn = Schema.TaggedStruct("Spawn", {
  prefab: PrefabName,
  cell: Cell,
  components: Schema.optionalKey(Components),
});

/**
 * Spawns entities of the given prefabs on a seeded random share of a region.
 * Cells where one may not go are skipped.
 */
export const Scatter = Schema.TaggedStruct("Scatter", {
  prefabs: Schema.NonEmptyArray(PrefabName).check(
    Schema.isMaxLength(SCATTER_MAX_PREFABS)
  ),
  region: Region,
  density: Schema.Finite.check(Schema.isBetween({ maximum: 1, minimum: 0 })),
  seed: Schema.Int,
  components: Schema.optionalKey(Components),
});

export const Move = Schema.TaggedStruct("Move", { entity: EntityId, to: Cell });

/** Replaces an entity's own components; its prefab's still apply beneath. */
export const Change = Schema.TaggedStruct("Change", {
  entity: EntityId,
  components: Components,
});

export const Remove = Schema.TaggedStruct("Remove", {
  entities: Schema.NonEmptyArray(EntityId).check(
    Schema.isMaxLength(REGION_MAX_AREA)
  ),
});

/**
 * Removes the entities of one prefab in a region or, with no prefab, every
 * entity there but the floors and liquids.
 */
export const RemoveIn = Schema.TaggedStruct("RemoveIn", {
  region: Region,
  prefab: Schema.optionalKey(PrefabName),
});

const size = Schema.Int.check(
  Schema.isBetween({ maximum: GENERATE_MAX_SIZE, minimum: GENERATE_MIN_SIZE })
);

/**
 * Lays a generated landscape over the rectangle from `origin` (its
 * north-west corner), replacing every entity already there.
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

/** What may be asked of the world. */
export const Command = Schema.Union([
  Paint,
  Pour,
  Erase,
  Spawn,
  Scatter,
  Move,
  Change,
  Remove,
  RemoveIn,
  Generate,
]).pipe(Schema.toTaggedUnion("_tag"));
