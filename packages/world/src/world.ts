import * as Arr from "effect/Array";
import * as HashMap from "effect/HashMap";
import * as HashSet from "effect/HashSet";
import * as Option from "effect/Option";
import * as Order from "effect/Order";

import { cellKey } from "./cell.ts";
import type { Cell, CellKey } from "./cell.ts";
import { Change } from "./change.ts";
import type { Layer } from "./components.ts";
import { isObstacle } from "./components.ts";
import { componentsOf, entitySerial } from "./entity.ts";
import type { Entity, EntityId } from "./entity.ts";
import { traitsOf } from "./ground.ts";
import type { Tile } from "./ground.ts";
import type { Span } from "./region.ts";

/**
 * The world in memory. `entitiesByCell` is derived from `entities` and is
 * only ever maintained by {@link apply}.
 */
export interface World {
  readonly ground: HashMap.HashMap<CellKey, Tile>;
  readonly entities: HashMap.HashMap<EntityId, Entity>;
  readonly entitiesByCell: HashMap.HashMap<CellKey, HashSet.HashSet<EntityId>>;
  /** How many entities were ever spawned; the next id is one more. */
  readonly spawned: number;
}

export const emptyWorld: World = {
  entities: HashMap.empty(),
  entitiesByCell: HashMap.empty(),
  ground: HashMap.empty(),
  spawned: 0,
};

const withoutIndexed = (
  index: World["entitiesByCell"],
  key: CellKey,
  id: EntityId
) =>
  Option.match(HashMap.get(index, key), {
    onNone: () => index,
    onSome: (ids) => {
      const rest = HashSet.remove(ids, id);

      return HashSet.size(rest) === 0
        ? HashMap.remove(index, key)
        : HashMap.set(index, key, rest);
    },
  });

const withIndexed = (
  index: World["entitiesByCell"],
  key: CellKey,
  id: EntityId
) =>
  HashMap.set(
    index,
    key,
    HashSet.add(
      Option.getOrElse(HashMap.get(index, key), () =>
        HashSet.empty<EntityId>()
      ),
      id
    )
  );

const unindexed = (world: World, id: EntityId) =>
  Option.match(HashMap.get(world.entities, id), {
    onNone: () => world.entitiesByCell,
    onSome: (entity) =>
      withoutIndexed(world.entitiesByCell, cellKey(entity.cell), id),
  });

/** The only function that modifies a world. */
export const apply = (world: World, change: Change) => {
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
    GroundCleared: ({ cell }) => ({
      ...world,
      ground: HashMap.remove(world.ground, cellKey(cell)),
    }),
    GroundSet: ({ cell, ground }) => ({
      ...world,
      ground: HashMap.set(world.ground, cellKey(cell), { cell, ground }),
    }),
    SpawnCounted: ({ spawned }) => ({
      ...world,
      spawned: Math.max(world.spawned, spawned),
    }),
  });

  return next;
};

export const applyAll = (world: World, changes: Iterable<Change>) =>
  Arr.reduce(Arr.fromIterable(changes), world, apply);

/** Rebuilds the cell index from the entities alone. */
export const indexEntities = (entities: World["entities"]) =>
  HashMap.reduce(
    entities,
    HashMap.empty<CellKey, HashSet.HashSet<EntityId>>(),
    (index, entity) => withIndexed(index, cellKey(entity.cell), entity.id)
  );

export const groundAt = (world: World, cell: Cell) =>
  Option.map(HashMap.get(world.ground, cellKey(cell)), (tile) => tile.ground);

export const isInWorld = (world: World, cell: Cell) =>
  HashMap.has(world.ground, cellKey(cell));

export const entityOf = (world: World, id: EntityId) =>
  HashMap.get(world.entities, id);

const bySerial = Order.mapInput(Order.Number, (entity: Entity) =>
  entitySerial(entity.id)
);

/** The entities on a cell, oldest first. */
export const entitiesAt = (world: World, cell: Cell) =>
  Option.match(HashMap.get(world.entitiesByCell, cellKey(cell)), {
    onNone: () => Arr.empty<Entity>(),
    onSome: (ids) =>
      Arr.sort(
        Arr.getSomes(
          Arr.map(Arr.fromIterable(ids), (id) => entityOf(world, id))
        ),
        bySerial
      ),
  });

/** The entity claiming `layer` of the cell, if any. */
export const occupantOf = (world: World, cell: Cell, layer: Layer) =>
  Arr.findFirst(
    entitiesAt(world, cell),
    (entity) => componentsOf(entity).layer === layer
  );

/** Walkable ground with no obstacle on it. */
export const isWalkable = (world: World, cell: Cell) =>
  Option.exists(
    groundAt(world, cell),
    (ground) => traitsOf(ground.kind).walkable
  ) &&
  !Arr.some(entitiesAt(world, cell), (entity) =>
    isObstacle(componentsOf(entity))
  );

export const allTiles = (world: World) =>
  Arr.fromIterable(HashMap.values(world.ground));

/** Every entity, oldest first. */
export const allEntities = (world: World) =>
  Arr.sort(Arr.fromIterable(HashMap.values(world.entities)), bySerial);

export const cellCount = (world: World) => HashMap.size(world.ground);

export const entityCount = (world: World) => HashMap.size(world.entities);

/** The smallest span holding all ground, or none for an empty world. */
export const bounds = (world: World) =>
  HashMap.reduce(world.ground, Option.none<Span>(), (span, { cell }) =>
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

export interface Count<K> {
  readonly kind: K;
  readonly count: number;
}

const countsOf = <K extends string>(kinds: Iterable<K>) => {
  const counts = new Map<K, number>();

  for (const kind of kinds) {
    counts.set(kind, (counts.get(kind) ?? 0) + 1);
  }

  return Arr.sort(
    Arr.map(Arr.fromIterable(counts), ([kind, count]) => ({ count, kind })),
    Order.combine(
      Order.mapInput(
        Order.flip(Order.Number),
        (entry: Count<K>) => entry.count
      ),
      Order.mapInput(Order.String, (entry: Count<K>) => entry.kind)
    )
  );
};

/** How many cells have each kind of ground, most first. */
export const groundCounts = (world: World) =>
  countsOf(Arr.map(allTiles(world), (tile) => tile.ground.kind));

/** How many entities there are of each kind, most first. */
export const entityCounts = (world: World) =>
  countsOf(
    Arr.map(
      Arr.fromIterable(HashMap.values(world.entities)),
      (entity) => entity.kind
    )
  );
