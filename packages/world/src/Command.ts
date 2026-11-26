import * as Components from "@agent-crossing/definitions/Components";
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
export const PLACE_MAX_ENTITIES = 4096;

const Prefab = Prefabs.Name.annotate({
  description: "The name of a prefab.",
});

const Own = Components.Components.annotate({
  description:
    'Components that differ from the prefab\'s, for example {"text":"Welcome to the glade"} for a sign or {"colors":{"body":"blue"}} for a block. Keys: label ({noun, plural?, glyph}), layer ("floor", "liquid", "cover" or "object"), habitat (["land"], ["water"] or both), obstacle (true), model, colors ({part: shade}), text, level.',
});

const Seed = Schema.Int.annotate({
  description:
    "Seed for the random choices; the same seed gives the same result.",
});

const Id = Entity.Id.annotate({ description: "An entity's id, like e12." });

const Placing = Schema.Struct({
  prefab: Prefab,
  cell: Cell.Cell,
  components: Schema.optionalKey(Own),
});

export const PlaceEntities = Schema.TaggedStruct("PlaceEntities", {
  entities: Schema.NonEmptyArray(Placing)
    .check(Schema.isMaxLength(PLACE_MAX_ENTITIES))
    .annotate({
      description: `1 to ${PLACE_MAX_ENTITIES} entities, each a prefab at a cell, with any components of its own, such as the text of a sign.`,
    }),
}).annotate({
  description:
    "Places entities, in order, each where the ones before it left the world. Refused as a whole, placing none, if any cell has no floor, is a place (land or water) outside that entity's habitat, or has its layer taken.",
});

export const FillRegion = Schema.TaggedStruct("FillRegion", {
  region: Region.Region,
  prefab: Prefab,
  components: Schema.optionalKey(Own),
}).annotate({
  description:
    "Puts the prefab in every cell of a region where it may be, by its layer. A floor is laid where there is none, at the level in components or 0, and replaces the floor already there, which keeps its level unless one is given and keeps what stands on it. A liquid goes over every floor without one, at the floor's level, and the floor sinks one level beneath it; floors already at the lowest level are skipped, and entities whose habitat is only land are removed. Anything else goes in each cell where it may be, and the rest are skipped.",
});

export const ScatterEntities = Schema.TaggedStruct("ScatterEntities", {
  prefabs: Schema.NonEmptyArray(Prefab)
    .check(Schema.isMaxLength(SCATTER_MAX_PREFABS))
    .annotate({
      description: `1 to ${SCATTER_MAX_PREFABS} prefabs, chosen at random for each entity.`,
    }),
  region: Region.Region,
  density: Schema.Finite.check(
    Schema.isBetween({ maximum: 1, minimum: 0 })
  ).annotate({
    description: "The share of the region's cells to try, 0 to 1.",
  }),
  seed: Seed,
  components: Schema.optionalKey(Own),
}).annotate({
  description:
    "Places entities of the given prefabs on a seeded random share (density) of a region's cells, skipping cells where they may not be. Good for forests, meadows and reed beds.",
});

export const MoveEntity = Schema.TaggedStruct("MoveEntity", {
  entity: Id,
  to: Cell.Cell,
}).annotate({
  description:
    "Moves an entity to another cell. Refused if the cell has no floor, is a place outside its habitat or has its layer taken.",
});

export const ChangeEntity = Schema.TaggedStruct("ChangeEntity", {
  entity: Id,
  components: Components.Components.annotate({
    description:
      'The entity\'s own components, replacing those it had; {} resets it to its prefab. Example: {"text":"Gone fishing","colors":{"board":"blue"}}.',
  }),
}).annotate({
  description:
    "Replaces an entity's own components, for example a sign's text or a block's colors; its prefab's components still apply beneath. Refused if the entity could not stay where it is with them.",
});

export const RemoveEntities = Schema.TaggedStruct("RemoveEntities", {
  entities: Schema.NonEmptyArray(Id)
    .check(Schema.isMaxLength(Region.MAX_AREA))
    .annotate({ description: 'The ids of the entities, like ["e3", "e7"].' }),
}).annotate({
  description:
    "Removes the listed entities. Refused if any of them does not exist.",
});

const ClearPrefab = Schema.TaggedStruct("Prefab", { prefab: Prefab }).annotate({
  description: "Only the entities of this prefab, floors and liquids included.",
});

const ClearTerrain = Schema.TaggedStruct("Terrain", {}).annotate({
  description:
    "Every entity, the terrain included, so that the cells leave the world.",
});

/** What a clearing removes beyond what stands on the terrain. */
export const Clearing = Schema.Union([ClearPrefab, ClearTerrain]).pipe(
  Schema.toTaggedUnion("_tag")
);

export const ClearRegion = Schema.TaggedStruct("ClearRegion", {
  region: Region.Region,
  removing: Schema.optionalKey(
    Clearing.annotate({
      description:
        'Left out, everything standing on the terrain goes and the terrain stays. {"_tag":"Prefab","prefab":"oak"} removes only the entities of that prefab; {"_tag":"Terrain"} removes the terrain too.',
    })
  ),
}).annotate({
  description:
    "Removes entities from a region: what stands on the terrain, the entities of one prefab, or everything with the terrain. Entities that may no longer stay where they are go too.",
});

const size = Schema.Int.check(
  Schema.isBetween({ maximum: GENERATE_MAX_SIZE, minimum: GENERATE_MIN_SIZE })
).annotate({
  description: `Cells a side, ${GENERATE_MIN_SIZE} to ${GENERATE_MAX_SIZE}.`,
});

export const GenerateWorld = Schema.TaggedStruct("GenerateWorld", {
  seed: Seed,
  width: size,
  height: size,
  origin: Cell.Cell.annotate({
    description: "The north-west corner of the rectangle.",
  }),
})
  .check(
    Schema.makeFilter(
      ({ height, origin, width }) =>
        (origin.x + width - 1 <= Cell.LIMIT &&
          origin.y + height - 1 <= Cell.LIMIT) ||
        "the landscape must fit inside the coordinate range"
    )
  )
  .annotate({
    description:
      "Lays a generated landscape of floors, water, hills and plants over the width by height rectangle from origin, replacing every entity already there.",
  });

/** What may be asked of the world. */
export const Command = Schema.Union([
  PlaceEntities,
  FillRegion,
  ScatterEntities,
  MoveEntity,
  ChangeEntity,
  RemoveEntities,
  ClearRegion,
  GenerateWorld,
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
      ChangeEntity: ({ components, entity }) =>
        Decide.change(world, edit, entity, components),
      ClearRegion: ({ region, removing }) =>
        Result.succeed(Decide.clear(world, region, removing)),
      FillRegion: (filling) =>
        Result.succeed(Decide.fill(world, edit, filling)),
      GenerateWorld: (generating) =>
        Result.succeed(Decide.generate(world, edit, generating)),
      MoveEntity: ({ entity, to }) => Decide.move(world, edit, entity, to),
      PlaceEntities: ({ entities }) => Decide.place(world, edit, entities),
      RemoveEntities: ({ entities }) => Decide.remove(world, entities),
      ScatterEntities: (scattering) =>
        Result.succeed(Decide.scatter(world, edit, scattering)),
    });

  const decision: Result.Result<
    readonly (typeof Event.Event.Type)[],
    typeof Refusal.Refusal.Type
  > = Result.map(decided, (done) => Decide.settled(world, edit, done));

  return decision;
};
