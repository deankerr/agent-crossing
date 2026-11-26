import type * as Components from "@agent-crossing/definitions/Components";
import * as Level from "@agent-crossing/definitions/Level";
import * as Arr from "effect/Array";
import * as Equal from "effect/Equal";
import * as Option from "effect/Option";
import * as Result from "effect/Result";

import type * as Cell from "../Cell.ts";
import type * as Command from "../Command.ts";
import * as Entity from "../Entity.ts";
import * as Event from "../Event.ts";
import * as Refusal from "../Refusal.ts";
import * as Region from "../Region.ts";
import * as World from "../World.ts";
import { ensurePlaceable, misfitsIn } from "./placement.ts";
import { seededRandom } from "./random.ts";

type Present = typeof Entity.Entity.Type;

type NewEntity = Omit<Present, "id">;

type Id = typeof Entity.Id.Type;

type At = typeof Cell.Cell.Type;

type Happened = typeof Event.Event.Type;

type Bag = typeof Components.Components.Type;

export interface Edit {
  readonly at: typeof Event.Timestamp.Type;
}

export interface Outcome {
  readonly dropped: readonly Present[];
  readonly events: readonly Happened[];
}

const outcome = (
  dropped: readonly Present[],
  events: readonly Happened[] = []
) => ({ dropped, events }) satisfies Outcome;

const removed = (edit: Edit, entities: readonly Present[]) =>
  Arr.map(Arr.chunksOf(entities, Event.MAX_ITEMS), (chunk) =>
    Event.Event.cases.EntitiesRemoved.make({ ...edit, entities: chunk })
  );

const spawned = (edit: Edit, entities: readonly Present[]) =>
  Arr.map(Arr.chunksOf(entities, Event.MAX_ITEMS), (chunk) =>
    Event.Event.cases.EntitiesPlaced.make({ ...edit, entities: chunk })
  );

const updated = (edit: Edit, entities: readonly Present[]) =>
  Arr.map(Arr.chunksOf(entities, Event.MAX_ITEMS), (chunk) =>
    Event.Event.cases.EntitiesChanged.make({ ...edit, entities: chunk })
  );

const entitiesIn = (world: World.World, cells: readonly At[]) =>
  Arr.flatMap(cells, (cell) => World.entitiesAt(world, cell));

const numbered = (world: World.World, fresh: readonly NewEntity[]) =>
  Arr.map(
    fresh,
    (entity, index) =>
      ({
        ...entity,
        id: Entity.idFor(world.spawned + index + 1),
      }) satisfies Present
  );

const fitsHere = (world: World.World, entity: Present) =>
  ensurePlaceable(world, entity.cell, Entity.components(entity));

const placedWhereFits = (
  world: World.World,
  edit: Edit,
  fresh: Iterable<NewEntity>
) => {
  let working = world;
  const placed: Present[] = [];

  for (const one of fresh) {
    const entity = nextEntity(working, one);

    if (Result.isSuccess(fitsHere(working, entity))) {
      working = counted(working, edit, entity);
      placed.push(entity);
    }
  }

  return outcome([], spawned(edit, placed));
};

const layFloors = (
  world: World.World,
  edit: Edit,
  { components = {}, prefab, region }: typeof Command.FillRegion.Type
) => {
  const laid: NewEntity[] = [];
  const replaced: Present[] = [];

  for (const cell of Region.cells(region)) {
    const current = World.floorAt(world, cell);

    if (Option.isSome(current)) {
      const before = current.value;

      const after: Present = {
        ...before,
        components: {
          ...before.components,
          ...components,
          level: components.level ?? Entity.level(before),
        },
        prefab,
      };

      if (!Equal.equals(after, before)) {
        replaced.push(after);
      }
    } else {
      laid.push({
        cell,
        components: { ...components, level: components.level ?? 0 },
        prefab,
      });
    }
  }

  return outcome(
    [],
    [...spawned(edit, numbered(world, laid)), ...updated(edit, replaced)]
  );
};

const pourLiquid = (
  world: World.World,
  edit: Edit,
  { components = {}, prefab, region }: typeof Command.FillRegion.Type
) => {
  const liquids: NewEntity[] = [];
  const beds: Present[] = [];

  for (const cell of Region.cells(region)) {
    const floor = World.floorAt(world, cell);

    if (
      Option.isSome(floor) &&
      Option.isNone(World.liquidAt(world, cell)) &&
      Entity.level(floor.value) > Level.MIN
    ) {
      const level = Entity.level(floor.value);
      liquids.push({ cell, components: { ...components, level }, prefab });
      beds.push({
        ...floor.value,
        components: { ...floor.value.components, level: level - 1 },
      });
    }
  }

  return outcome(
    [],
    [...spawned(edit, numbered(world, liquids)), ...updated(edit, beds)]
  );
};

export const fill = (
  world: World.World,
  edit: Edit,
  filling: typeof Command.FillRegion.Type
) => {
  const { components = {}, prefab, region } = filling;
  const { layer } = Entity.overlay(Entity.prefabComponents(prefab), components);

  if (layer === "floor") {
    return layFloors(world, edit, filling);
  }

  if (layer === "liquid") {
    return pourLiquid(world, edit, filling);
  }

  return placedWhereFits(
    world,
    edit,
    Arr.map(Region.cells(region), (cell) => ({ cell, components, prefab }))
  );
};

const nextEntity = (world: World.World, fresh: NewEntity) =>
  ({ ...fresh, id: Entity.idFor(world.spawned + 1) }) satisfies Present;

const counted = (world: World.World, edit: Edit, entity: Present) =>
  World.apply(
    world,
    Event.Event.cases.EntitiesPlaced.make({ ...edit, entities: [entity] })
  );

export const place = (
  world: World.World,
  edit: Edit,
  entities: typeof Command.PlaceEntities.Type.entities
) =>
  Result.gen(function* () {
    let working = world;
    const placed: Present[] = [];

    for (const { cell, components = {}, prefab } of entities) {
      const entity = nextEntity(working, { cell, components, prefab });
      yield* fitsHere(working, entity);
      working = counted(working, edit, entity);
      placed.push(entity);
    }

    return outcome([], spawned(edit, placed));
  });

export const scatter = (
  world: World.World,
  edit: Edit,
  command: typeof Command.ScatterEntities.Type
) => {
  const random = seededRandom(command.seed);
  const components = command.components ?? {};

  return placedWhereFits(
    world,
    edit,
    Arr.filterMap(Region.cells(command.region), (cell) =>
      random.chance(command.density)
        ? Result.succeed({
            cell,
            components,
            prefab:
              command.prefabs[random.integer(command.prefabs.length)] ??
              command.prefabs[0],
          })
        : Result.failVoid
    )
  );
};

const existing = (world: World.World, id: Id) =>
  Option.match(World.entity(world, id), {
    onNone: () => Result.fail(new Refusal.UnknownEntity({ entity: id })),
    onSome: Result.succeed,
  });

export const move = (world: World.World, edit: Edit, id: Id, to: At) =>
  Result.gen(function* () {
    const entity = yield* existing(world, id);
    yield* ensurePlaceable(
      world,
      to,
      Entity.components(entity),
      Option.some(id)
    );

    return outcome(
      [],
      [
        Event.Event.cases.EntityMoved.make({
          ...edit,
          entity: { ...entity, cell: to },
          from: entity.cell,
        }),
      ]
    );
  });

export const change = (
  world: World.World,
  edit: Edit,
  id: Id,
  components: Bag
) =>
  Result.gen(function* () {
    const entity = yield* existing(world, id);
    yield* ensurePlaceable(
      world,
      entity.cell,
      Entity.overlay(Entity.prefabComponents(entity.prefab), components),
      Option.some(id)
    );

    return outcome(
      [],
      [
        Event.Event.cases.EntitiesChanged.make({
          ...edit,
          entities: [{ ...entity, components }],
        }),
      ]
    );
  });

export const remove = (world: World.World, ids: readonly Id[]) =>
  Result.gen(function* () {
    const entities = yield* Result.all(
      Arr.map(Arr.dedupe(ids), (id) => existing(world, id))
    );

    return outcome(entities);
  });

export const clear = (
  world: World.World,
  region: typeof Region.Region.Type,
  removing: typeof Command.Clearing.Type | undefined
) =>
  outcome(
    Arr.filter(entitiesIn(world, Region.cells(region)), (entity) =>
      removing === undefined
        ? !Entity.isFloor(entity) && !Entity.isLiquid(entity)
        : removing._tag === "Terrain" || entity.prefab === removing.prefab
    )
  );

export const settled = (
  world: World.World,
  edit: Edit,
  { dropped, events }: Outcome
) => {
  const after = World.applyAll(world, [...removed(edit, dropped), ...events]);

  const touched = [
    ...Arr.map(dropped, (entity) => entity.cell),
    ...Arr.flatMap(events, Event.cells),
  ];

  return [
    ...removed(edit, [...dropped, ...misfitsIn(after, touched)]),
    ...events,
  ];
};
