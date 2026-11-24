import * as Arr from "effect/Array";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";

import { Cell } from "./cell.ts";
import { Change } from "./change.ts";
import { Components } from "./components.ts";
import { Entity, EntityId, entitySerial } from "./entity.ts";
import { Tile } from "./ground.ts";
import { Editor, Timestamp } from "./values.ts";
import { applyAll, entityOf } from "./world.ts";
import type { World } from "./world.ts";

/** No event carries more tiles, cells or entities than this; `decide` splits bigger edits. */
export const EVENT_MAX_ITEMS = 1000;

const upToLimit = <S extends Schema.Top>(item: S) =>
  Schema.NonEmptyArray(item).check(Schema.isMaxLength(EVENT_MAX_ITEMS));

const edit = { at: Timestamp, by: Editor };

/** What happened to the world, kept as its history. */
export const WorldEvent = Schema.TaggedUnion({
  GroundPainted: { ...edit, tiles: upToLimit(Tile) },
  GroundErased: { ...edit, cells: upToLimit(Cell) },
  Spawned: { ...edit, entities: upToLimit(Entity) },
  Moved: { ...edit, entity: EntityId, to: Cell },
  /** Replaces the entity's own components. */
  Changed: { ...edit, entity: EntityId, components: Components },
  Removed: { ...edit, entities: upToLimit(EntityId) },
});

export type WorldEvent = typeof WorldEvent.Type;

const putChanged = (
  world: World,
  id: EntityId,
  update: (entity: Entity) => Entity
) =>
  Arr.fromOption(
    Option.map(entityOf(world, id), (entity) =>
      Change.cases.EntityPut.make({ entity: update(entity) })
    )
  );

/** The state writes an event amounts to, given the world it happens to. */
export const changesOf = (world: World, event: WorldEvent) => {
  const changes: readonly Change[] = WorldEvent.match(event, {
    Changed: ({ components, entity }) =>
      putChanged(world, entity, (current) => ({ ...current, components })),
    GroundErased: ({ cells }) =>
      Arr.map(cells, (cell) => Change.cases.GroundCleared.make({ cell })),
    GroundPainted: ({ tiles }) =>
      Arr.map(tiles, ({ cell, ground }) =>
        Change.cases.GroundSet.make({ cell, ground })
      ),
    Moved: ({ entity, to }) =>
      putChanged(world, entity, (current) => ({ ...current, cell: to })),
    Removed: ({ entities }) =>
      Arr.map(entities, (id) => Change.cases.EntityDropped.make({ id })),
    Spawned: ({ entities }) =>
      Arr.append(
        Arr.map(entities, (entity) => Change.cases.EntityPut.make({ entity })),
        Change.cases.SpawnCounted.make({
          spawned: Math.max(
            ...Arr.map(entities, (entity) => entitySerial(entity.id))
          ),
        })
      ),
  });

  return changes;
};

export const evolve = (world: World, event: WorldEvent) =>
  applyAll(world, changesOf(world, event));

export const evolveAll = (world: World, events: Iterable<WorldEvent>) =>
  Arr.reduce(Arr.fromIterable(events), world, evolve);
