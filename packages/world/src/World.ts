import type * as Components from "@agent-crossing/definitions/Components";
import * as Arr from "effect/Array";
import * as HashMap from "effect/HashMap";
import * as HashSet from "effect/HashSet";
import * as Option from "effect/Option";
import * as Order from "effect/Order";
import * as Schema from "effect/Schema";

import * as Cell from "./Cell.ts";
import * as Change from "./Change.ts";
import * as Entity from "./Entity.ts";
import type * as Span from "./Span.ts";

type Id = typeof Entity.Id.Type;

type Key = typeof Cell.Key.Type;

type At = typeof Cell.Cell.Type;

type Present = typeof Entity.Entity.Type;

/**
 * The world in memory: its entities and how many were ever spawned.
 * `entitiesByCell` is derived from `entities` and is only ever maintained by
 * {@link apply}.
 */
export interface World {
  readonly entities: HashMap.HashMap<Id, Present>;
  readonly entitiesByCell: HashMap.HashMap<Key, HashSet.HashSet<Id>>;
  /** How many entities were ever spawned; the next id is one more. */
  readonly spawned: number;
}

export const empty: World = {
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
    onSome: (present) =>
      withoutIndexed(world.entitiesByCell, Cell.key(present.cell), id),
  });

/** The only function that modifies a world. */
export const apply = (world: World, change: typeof Change.Change.Type) => {
  const next: World = Change.Change.match(change, {
    EntityDropped: ({ id }) => ({
      ...world,
      entities: HashMap.remove(world.entities, id),
      entitiesByCell: unindexed(world, id),
    }),
    EntityPut: ({ entity: put }) => ({
      ...world,
      entities: HashMap.set(world.entities, put.id, put),
      entitiesByCell: withIndexed(
        unindexed(world, put.id),
        Cell.key(put.cell),
        put.id
      ),
    }),
    SpawnCounted: ({ spawned }) => ({
      ...world,
      spawned: Math.max(world.spawned, spawned),
    }),
  });

  return next;
};

export const applyAll = (
  world: World,
  changes: Iterable<typeof Change.Change.Type>
) => Arr.reduce(Arr.fromIterable(changes), world, apply);

/** Rebuilds the cell index from the entities alone. */
export const indexEntities = (all: World["entities"]) =>
  HashMap.reduce(
    all,
    HashMap.empty<Key, HashSet.HashSet<Id>>(),
    (index, present) => withIndexed(index, Cell.key(present.cell), present.id)
  );

export const entity = (world: World, id: Id) => HashMap.get(world.entities, id);

const bySerial = Order.mapInput(Order.Number, (present: Present) =>
  Entity.serial(present.id)
);

/** The entities in a cell, oldest first. */
export const entitiesAt = (world: World, cell: At) =>
  Option.match(HashMap.get(world.entitiesByCell, Cell.key(cell)), {
    onNone: () => Arr.empty<Present>(),
    onSome: (ids) =>
      Arr.sort(
        Arr.getSomes(Arr.map(Arr.fromIterable(ids), (id) => entity(world, id))),
        bySerial
      ),
  });

const occupantOf = (
  world: World,
  cell: At,
  layer: typeof Components.Layer.Type
) =>
  Arr.findFirst(
    entitiesAt(world, cell),
    (present) => Entity.components(present).layer === layer
  );

export const floorAt = (world: World, cell: At) =>
  occupantOf(world, cell, "floor");

export const liquidAt = (world: World, cell: At) =>
  occupantOf(world, cell, "liquid");

/** Land when the cell has a floor and no liquid, water with both, none without a floor. */
export const placeAt = (world: World, cell: At) =>
  Option.map(floorAt(world, cell), () => {
    const place: typeof Components.Place.Type = Option.isSome(
      liquidAt(world, cell)
    )
      ? "water"
      : "land";

    return place;
  });

/** Every entity, oldest first. */
export const entities = (world: World) =>
  Arr.sort(Arr.fromIterable(HashMap.values(world.entities)), bySerial);

const allFloors = (world: World) => Arr.filter(entities(world), Entity.isFloor);

/** How many cells are in the world. */
export const cellCount = (world: World) => allFloors(world).length;

export const entityCount = (world: World) => HashMap.size(world.entities);

/** The smallest span holding every floor, or none for an empty world. */
export const bounds = (world: World) =>
  Arr.reduce(allFloors(world), Option.none<Span.Span>(), (span, { cell }) =>
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
  counted: Iterable<Present>,
  keyOf: (present: Present) => string
) => {
  const counts = new Map<string, number>();

  for (const present of counted) {
    const key = keyOf(present);
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
  Arr.fromOption(Option.map(entity(world, id), (present) => present.cell));

/** The cells a change touches, given the world it applies to: where entities were and where they are now. */
export const touchedBy = (world: World, change: typeof Change.Change.Type) => {
  const cells: readonly At[] = Change.Change.match(change, {
    EntityDropped: ({ id }) => oldCell(world, id),
    EntityPut: ({ entity: put }) => [put.cell, ...oldCell(world, put.id)],
    SpawnCounted: () => [],
  });

  return cells;
};

/** The whole world as JSON-ready data. */
export const Snapshot = Schema.Struct({
  entities: Schema.Array(Entity.Entity),
  spawned: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
});

const toSnapshot = (world: World) =>
  ({
    entities: entities(world),
    spawned: world.spawned,
  }) satisfies typeof Snapshot.Type;

const snapshotChanges = (snapshot: typeof Snapshot.Type) => {
  const changes: readonly (typeof Change.Change.Type)[] = [
    ...Arr.map(snapshot.entities, (present) =>
      Change.Change.cases.EntityPut.make({ entity: present })
    ),
    Change.Change.cases.SpawnCounted.make({ spawned: snapshot.spawned }),
  ];

  return changes;
};

/** The changes that rebuild `world` from the empty world: entities oldest first, then the spawn count. */
export const changesFor = (world: World) => snapshotChanges(toSnapshot(world));

export const fromSnapshot = (snapshot: typeof Snapshot.Type) =>
  applyAll(empty, snapshotChanges(snapshot));
