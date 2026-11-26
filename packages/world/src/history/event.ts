import * as Components from "@agent-crossing/definitions/Components";
import * as Arr from "effect/Array";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";

import { Cell } from "../schema/cell.ts";
import { Change } from "../state/change.ts";
import { Entity, EntityId, entitySerial } from "../state/entity.ts";
import { applyAll, entityOf } from "../state/world.ts";
import type { World } from "../state/world.ts";

/** Epoch milliseconds, always passed in, never read from a clock. */
export const Timestamp = Schema.Int;

/** The position of an event in the world's history. */
export const Seq = Schema.Int.check(Schema.isGreaterThanOrEqualTo(0));

/** No event carries more entities than this; `decide` splits bigger edits. */
export const EVENT_MAX_ITEMS = 1000;

const upToLimit = <S extends Schema.Top>(item: S) =>
  Schema.NonEmptyArray(item).check(Schema.isMaxLength(EVENT_MAX_ITEMS));

const edit = { at: Timestamp };

/** What happened to the world, kept as its history. */
export const WorldEvent = Schema.TaggedUnion({
  /** New entities, floors and liquids among them. */
  Spawned: { ...edit, entities: upToLimit(Entity) },
  /** Entities given a new prefab or new components, each keeping its id and cell. */
  Updated: { ...edit, entities: upToLimit(Entity) },
  Moved: { ...edit, entity: EntityId, to: Cell },
  /** Replaces the entity's own components. */
  Changed: { ...edit, entity: EntityId, components: Components.Components },
  Removed: { ...edit, entities: upToLimit(EntityId) },
});

const putChanged = (
  world: World,
  id: typeof EntityId.Type,
  update: (entity: typeof Entity.Type) => typeof Entity.Type
) =>
  Arr.fromOption(
    Option.map(entityOf(world, id), (entity) =>
      Change.cases.EntityPut.make({ entity: update(entity) })
    )
  );

const put = (entities: readonly (typeof Entity.Type)[]) =>
  Arr.map(entities, (entity) => Change.cases.EntityPut.make({ entity }));

/** The state writes an event amounts to, given the world it happens to. */
export const changesOf = (world: World, event: typeof WorldEvent.Type) => {
  const changes: readonly (typeof Change.Type)[] = WorldEvent.match(event, {
    Changed: ({ components, entity }) =>
      putChanged(world, entity, (current) => ({ ...current, components })),
    Moved: ({ entity, to }) =>
      putChanged(world, entity, (current) => ({ ...current, cell: to })),
    Removed: ({ entities }) =>
      Arr.map(entities, (id) => Change.cases.EntityDropped.make({ id })),
    Spawned: ({ entities }) =>
      Arr.append(
        put(entities),
        Change.cases.SpawnCounted.make({
          spawned: Math.max(
            ...Arr.map(entities, (entity) => entitySerial(entity.id))
          ),
        })
      ),
    Updated: ({ entities }) => put(entities),
  });

  return changes;
};

export const evolve = (world: World, event: typeof WorldEvent.Type) =>
  applyAll(world, changesOf(world, event));

export const evolveAll = (
  world: World,
  events: Iterable<typeof WorldEvent.Type>
) => Arr.reduce(Arr.fromIterable(events), world, evolve);
