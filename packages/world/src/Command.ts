import * as Components from "@agent-crossing/definitions/Components";
import * as Level from "@agent-crossing/definitions/Level";
import * as Prefabs from "@agent-crossing/definitions/Prefabs";
import * as Result from "effect/Result";
import * as Schema from "effect/Schema";

import * as Cell from "./Cell.ts";
import * as Entity from "./Entity.ts";
import type * as Event from "./Event.ts";
import * as Decide from "./internal/decide.ts";
import type * as Refusal from "./Refusal.ts";
import * as Region from "./Region.ts";
import type * as World from "./World.ts";

export const GENERATE_MIN_SIZE = 8;
export const GENERATE_MAX_SIZE = 256;
export const SCATTER_MAX_PREFABS = 16;

const prefabIn = (layer: typeof Components.Layer.Type) =>
  Prefabs.Name.check(
    Schema.makeFilter(
      (name) =>
        Entity.prefabComponents(name).layer === layer ||
        `must name a ${layer} prefab`
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
  region: Region.Region,
  floor: Schema.optionalKey(FloorName),
  level: Schema.optionalKey(Level.Level),
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
  region: Region.Region,
  liquid: LiquidName,
  bed: Schema.optionalKey(FloorName),
});

/** Removes every entity in a region, floors included. */
export const Erase = Schema.TaggedStruct("Erase", { region: Region.Region });

export const Spawn = Schema.TaggedStruct("Spawn", {
  prefab: Prefabs.Name,
  cell: Cell.Cell,
  components: Schema.optionalKey(Components.Components),
});

/**
 * Spawns entities of the given prefabs on a seeded random share of a region.
 * Cells where one may not go are skipped.
 */
export const Scatter = Schema.TaggedStruct("Scatter", {
  prefabs: Schema.NonEmptyArray(Prefabs.Name).check(
    Schema.isMaxLength(SCATTER_MAX_PREFABS)
  ),
  region: Region.Region,
  density: Schema.Finite.check(Schema.isBetween({ maximum: 1, minimum: 0 })),
  seed: Schema.Int,
  components: Schema.optionalKey(Components.Components),
});

export const Move = Schema.TaggedStruct("Move", {
  entity: Entity.Id,
  to: Cell.Cell,
});

/** Replaces an entity's own components; its prefab's still apply beneath. */
export const Change = Schema.TaggedStruct("Change", {
  entity: Entity.Id,
  components: Components.Components,
});

export const Remove = Schema.TaggedStruct("Remove", {
  entities: Schema.NonEmptyArray(Entity.Id).check(
    Schema.isMaxLength(Region.MAX_AREA)
  ),
});

/**
 * Removes the entities of one prefab in a region or, with no prefab, every
 * entity there but the floors and liquids.
 */
export const RemoveIn = Schema.TaggedStruct("RemoveIn", {
  region: Region.Region,
  prefab: Schema.optionalKey(Prefabs.Name),
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
  origin: Cell.Cell,
}).check(
  Schema.makeFilter(
    ({ height, origin, width }) =>
      (origin.x + width - 1 <= Cell.LIMIT &&
        origin.y + height - 1 <= Cell.LIMIT) ||
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

/**
 * Decides what a command does to the world: the events to record, or
 * why nothing happens. Every event of one decision happens at `now`.
 */
export const decide = (
  world: World.World,
  command: typeof Command.Type,
  now: typeof Event.Timestamp.Type
) => {
  const edit: Decide.Edit = { at: now };

  const decided: Result.Result<Decide.Outcome, typeof Refusal.Refusal.Type> =
    Command.match(command, {
      Change: ({ components, entity }) =>
        Decide.change(world, edit, entity, components),
      Erase: ({ region }) => Result.succeed(Decide.erase(world, region)),
      Generate: (generating) =>
        Result.succeed(Decide.generate(world, edit, generating)),
      Move: ({ entity, to }) => Decide.move(world, edit, entity, to),
      Paint: ({ floor, level, region }) =>
        Result.succeed(Decide.paint(world, edit, region, floor, level)),
      Pour: (pouring) => Result.succeed(Decide.pour(world, edit, pouring)),
      Remove: ({ entities }) => Decide.remove(world, entities),
      RemoveIn: ({ prefab, region }) =>
        Result.succeed(Decide.removeIn(world, region, prefab)),
      Scatter: (scattering) =>
        Result.succeed(Decide.scatter(world, edit, scattering)),
      Spawn: ({ cell, components, prefab }) =>
        Decide.spawn(world, edit, prefab, cell, components ?? {}),
    });

  const decision: Result.Result<
    readonly (typeof Event.Event.Type)[],
    typeof Refusal.Refusal.Type
  > = Result.map(decided, (done) => Decide.settled(world, edit, done));

  return decision;
};
