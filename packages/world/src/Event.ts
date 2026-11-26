import * as Components from "@agent-crossing/definitions/Components";
import * as Arr from "effect/Array";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";

import * as Cell from "./Cell.ts";
import * as Change from "./Change.ts";
import * as Entity from "./Entity.ts";
import * as World from "./World.ts";

/** Epoch milliseconds, always passed in, never read from a clock. */
export const Timestamp = Schema.Int;

/** The position of an event in the world's history. */
export const Seq = Schema.Int.check(Schema.isGreaterThanOrEqualTo(0));

/** No event carries more entities than this; `decide` splits bigger edits. */
export const MAX_ITEMS = 1000;

const upToLimit = <S extends Schema.Top>(item: S) =>
  Schema.NonEmptyArray(item).check(Schema.isMaxLength(MAX_ITEMS));

const edit = { at: Timestamp };

/** What happened to the world, kept as its history. */
export const Event = Schema.TaggedUnion({
  /** New entities, floors and liquids among them. */
  Spawned: { ...edit, entities: upToLimit(Entity.Entity) },
  /** Entities given a new prefab or new components, each keeping its id and cell. */
  Updated: { ...edit, entities: upToLimit(Entity.Entity) },
  Moved: { ...edit, entity: Entity.Id, to: Cell.Cell },
  /** Replaces the entity's own components. */
  Changed: { ...edit, entity: Entity.Id, components: Components.Components },
  Removed: { ...edit, entities: upToLimit(Entity.Id) },
});

type Present = typeof Entity.Entity.Type;

const putChanged = (
  world: World.World,
  id: typeof Entity.Id.Type,
  update: (present: Present) => Present
) =>
  Arr.fromOption(
    Option.map(World.entity(world, id), (present) =>
      Change.Change.cases.EntityPut.make({ entity: update(present) })
    )
  );

const put = (entities: readonly Present[]) =>
  Arr.map(entities, (present) =>
    Change.Change.cases.EntityPut.make({ entity: present })
  );

/** The state writes an event amounts to, given the world it happens to. */
export const changes = (world: World.World, event: typeof Event.Type) => {
  const writes: readonly (typeof Change.Change.Type)[] = Event.match(event, {
    Changed: ({ components, entity }) =>
      putChanged(world, entity, (current) => ({ ...current, components })),
    Moved: ({ entity, to }) =>
      putChanged(world, entity, (current) => ({ ...current, cell: to })),
    Removed: ({ entities }) =>
      Arr.map(entities, (id) => Change.Change.cases.EntityDropped.make({ id })),
    Spawned: ({ entities }) =>
      Arr.append(
        put(entities),
        Change.Change.cases.SpawnCounted.make({
          spawned: Math.max(
            ...Arr.map(entities, (spawned) => Entity.serial(spawned.id))
          ),
        })
      ),
    Updated: ({ entities }) => put(entities),
  });

  return writes;
};

export const evolve = (world: World.World, event: typeof Event.Type) =>
  World.applyAll(world, changes(world, event));

export const evolveAll = (
  world: World.World,
  events: Iterable<typeof Event.Type>
) => Arr.reduce(Arr.fromIterable(events), world, evolve);
