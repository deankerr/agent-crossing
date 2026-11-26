import * as Arr from "effect/Array";
import * as HashMap from "effect/HashMap";
import * as HashSet from "effect/HashSet";
import * as Option from "effect/Option";
import * as Order from "effect/Order";

import { cellKey } from "../schema/cell.ts";
import type { Cell, CellKey } from "../schema/cell.ts";
import type { Layer, Place } from "../schema/components.ts";
import { Change } from "./change.ts";
import { componentsOf, entitySerial, storedLevel } from "./entity.ts";
import type { Entity, EntityId } from "./entity.ts";
import type { Span } from "./span.ts";

type Id = typeof EntityId.Type;

type Key = typeof CellKey.Type;

type At = typeof Cell.Type;

/**
 * The world in memory: its entities and how many were ever spawned.
 * `entitiesByCell` is derived from `entities` and is only ever maintained by
 * {@link apply}.
 */
export interface World {
  readonly entities: HashMap.HashMap<Id, typeof Entity.Type>;
  readonly entitiesByCell: HashMap.HashMap<Key, HashSet.HashSet<Id>>;
  /** How many entities were ever spawned; the next id is one more. */
  readonly spawned: number;
}

export const emptyWorld: World = {
  entities: HashMap.empty(),
  entitiesByCell: HashMap.empty(),
  spawned: 0,
};

const withoutIndexed = (index: World["entitiesByCell"], key: Key, id: Id) =>
  Option.match(HashMap.get(index, key), {
    onNone: () => index,
    onSome: (ids) => {
      const rest = HashSet.remove(ids, id);

      return HashSet.size(rest) === 0
        ? HashMap.remove(index, key)
        : HashMap.set(index, key, rest);
    },
  });

const withIndexed = (index: World["entitiesByCell"], key: Key, id: Id) =>
  HashMap.set(
    index,
    key,
    HashSet.add(
      Option.getOrElse(HashMap.get(index, key), () => HashSet.empty<Id>()),
      id
    )
  );

const unindexed = (world: World, id: Id) =>
  Option.match(HashMap.get(world.entities, id), {
    onNone: () => world.entitiesByCell,
    onSome: (entity) =>
      withoutIndexed(world.entitiesByCell, cellKey(entity.cell), id),
  });

/** The only function that modifies a world. */
export const apply = (world: World, change: typeof Change.Type) => {
  const next: World = Change.match(change, {
    EntityDropped: ({ id }) => ({
      ...world,
      entities: HashMap.remove(world.entities, id),
      entitiesByCell: unindexed(world, id),
    }),
    EntityPut: ({ entity }) => ({
      ...world,
      entities: HashMap.set(world.entities, entity.id, entity),
      entitiesByCell: withIndexed(
        unindexed(world, entity.id),
        cellKey(entity.cell),
        entity.id
      ),
    }),
    SpawnCounted: ({ spawned }) => ({
      ...world,
      spawned: Math.max(world.spawned, spawned),
    }),
  });

  return next;
};

export const applyAll = (world: World, changes: Iterable<typeof Change.Type>) =>
  Arr.reduce(Arr.fromIterable(changes), world, apply);

/** Rebuilds the cell index from the entities alone. */
export const indexEntities = (entities: World["entities"]) =>
  HashMap.reduce(
    entities,
    HashMap.empty<Key, HashSet.HashSet<Id>>(),
    (index, entity) => withIndexed(index, cellKey(entity.cell), entity.id)
  );

export const entityOf = (world: World, id: Id) =>
  HashMap.get(world.entities, id);

const bySerial = Order.mapInput(Order.Number, (entity: typeof Entity.Type) =>
  entitySerial(entity.id)
);

/** The entities in a cell, oldest first. */
export const entitiesAt = (world: World, cell: At) =>
  Option.match(HashMap.get(world.entitiesByCell, cellKey(cell)), {
    onNone: () => Arr.empty<typeof Entity.Type>(),
    onSome: (ids) =>
      Arr.sort(
        Arr.getSomes(
          Arr.map(Arr.fromIterable(ids), (id) => entityOf(world, id))
        ),
        bySerial
      ),
  });

const occupantOf = (world: World, cell: At, layer: typeof Layer.Type) =>
  Arr.findFirst(
    entitiesAt(world, cell),
    (entity) => componentsOf(entity).layer === layer
  );

export const floorAt = (world: World, cell: At) =>
  occupantOf(world, cell, "floor");

export const liquidAt = (world: World, cell: At) =>
  occupantOf(world, cell, "liquid");

/** Land when the cell has a floor and no liquid, water with both, none without a floor. */
export const placeAt = (world: World, cell: At) =>
  Option.map(floorAt(world, cell), () => {
    const place: typeof Place.Type = Option.isSome(liquidAt(world, cell))
      ? "water"
      : "land";

    return place;
  });

/** The level entities stand at in the cell: the liquid's when there is one, otherwise the floor's. */
export const standingLevelAt = (world: World, cell: At) =>
  Option.map(
    Option.orElse(liquidAt(world, cell), () => floorAt(world, cell)),
    storedLevel
  );

/** Every entity, oldest first. */
export const allEntities = (world: World) =>
  Arr.sort(Arr.fromIterable(HashMap.values(world.entities)), bySerial);

export const isFloor = (entity: typeof Entity.Type) =>
  componentsOf(entity).layer === "floor";

export const isLiquid = (entity: typeof Entity.Type) =>
  componentsOf(entity).layer === "liquid";

const allFloors = (world: World) => Arr.filter(allEntities(world), isFloor);

/** How many cells are in the world. */
export const cellCount = (world: World) => allFloors(world).length;

export const entityCount = (world: World) => HashMap.size(world.entities);

/** The smallest span holding every floor, or none for an empty world. */
export const bounds = (world: World) =>
  Arr.reduce(allFloors(world), Option.none<Span>(), (span, { cell }) =>
    Option.some(
      Option.match(span, {
        onNone: () => ({
          maxX: cell.x,
          maxY: cell.y,
          minX: cell.x,
          minY: cell.y,
        }),
        onSome: (sofar) => ({
          maxX: Math.max(sofar.maxX, cell.x),
          maxY: Math.max(sofar.maxY, cell.y),
          minX: Math.min(sofar.minX, cell.x),
          minY: Math.min(sofar.minY, cell.y),
        }),
      })
    )
  );

/** How many of something there are under one key. */
export interface Count {
  readonly key: string;
  readonly count: number;
}

/** How many entities share each key, most first, then by key. */
export const countsBy = (
  entities: Iterable<typeof Entity.Type>,
  keyOf: (entity: typeof Entity.Type) => string
) => {
  const counts = new Map<string, number>();

  for (const entity of entities) {
    const key = keyOf(entity);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  return Arr.sort(
    Arr.map(Arr.fromIterable(counts), ([key, count]) => ({ count, key })),
    Order.combine(
      Order.mapInput(Order.flip(Order.Number), (entry: Count) => entry.count),
      Order.mapInput(Order.String, (entry: Count) => entry.key)
    )
  );
};

const oldCell = (world: World, id: Id) =>
  Arr.fromOption(Option.map(entityOf(world, id), (entity) => entity.cell));

/** The cells a change touches, given the world it applies to: where entities were and where they are now. */
export const touchedBy = (world: World, change: typeof Change.Type) => {
  const cells: readonly (typeof Cell.Type)[] = Change.match(change, {
    EntityDropped: ({ id }) => oldCell(world, id),
    EntityPut: ({ entity }) => [entity.cell, ...oldCell(world, entity.id)],
    SpawnCounted: () => [],
  });

  return cells;
};
