import type * as Components from "@agent-crossing/definitions/Components";
import * as Arr from "effect/Array";
import * as HashMap from "effect/HashMap";
import * as HashSet from "effect/HashSet";
import * as Option from "effect/Option";
import * as Order from "effect/Order";

import * as Cell from "./Cell.ts";
import * as Entity from "./Entity.ts";
import * as Event from "./Event.ts";
import * as Region from "./Region.ts";

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

const put = (world: World, present: Present) =>
  ({
    ...world,
    entities: HashMap.set(world.entities, present.id, present),
    entitiesByCell: withIndexed(
      unindexed(world, present.id),
      Cell.key(present.cell),
      present.id
    ),
  }) satisfies World;

const drop = (world: World, id: Id) =>
  ({
    ...world,
    entities: HashMap.remove(world.entities, id),
    entitiesByCell: unindexed(world, id),
  }) satisfies World;

const putAll = (world: World, entities: Iterable<Present>) =>
  Arr.reduce(Arr.fromIterable(entities), world, put);

/** The only function that modifies a world: the world after the event. */
export const apply = (world: World, event: typeof Event.Event.Type) => {
  const next: World = Event.Event.match(event, {
    EntitiesChanged: ({ entities }) => putAll(world, entities),
    EntitiesPlaced: ({ entities }) => ({
      ...putAll(world, entities),
      spawned: Math.max(
        world.spawned,
        ...Arr.map(entities, (placed) => Entity.serial(placed.id))
      ),
    }),
    EntitiesRemoved: ({ entities }) =>
      Arr.reduce(entities, world, (sofar, removed) => drop(sofar, removed.id)),
    EntityMoved: ({ entity: moved }) => put(world, moved),
  });

  return next;
};

export const applyAll = (
  world: World,
  events: Iterable<typeof Event.Event.Type>
) => Arr.reduce(Arr.fromIterable(events), world, apply);

/** A world of these entities, with `spawned` entities ever placed. */
export const make = (entities: Iterable<Present>, spawned: number) =>
  putAll({ ...empty, spawned }, entities);

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

/** The smallest rectangle holding every floor, or none for an empty world. */
export const bounds = (world: World) =>
  Region.bounding(Arr.map(allFloors(world), ({ cell }) => cell));
