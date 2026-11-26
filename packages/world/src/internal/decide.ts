import type * as Components from "@agent-crossing/definitions/Components";
import * as Level from "@agent-crossing/definitions/Level";
import type * as Prefabs from "@agent-crossing/definitions/Prefabs";
import * as Arr from "effect/Array";
import * as Option from "effect/Option";
import * as Result from "effect/Result";

import type * as Cell from "../Cell.ts";
import type * as Command from "../Command.ts";
import * as Entity from "../Entity.ts";
import * as Event from "../Event.ts";
import { generateLandscape } from "../generation/landscape.ts";
import type { NewEntity } from "../generation/landscape.ts";
import { seededRandom } from "../generation/random.ts";
import * as Refusal from "../Refusal.ts";
import * as Region from "../Region.ts";
import * as Span from "../Span.ts";
import * as World from "../World.ts";
import { ensurePlaceable, misfitsIn } from "./placement.ts";

type Present = typeof Entity.Entity.Type;

type Id = typeof Entity.Id.Type;

type At = typeof Cell.Cell.Type;

type Happened = typeof Event.Event.Type;

type Bag = typeof Components.Components.Type;

type Name = typeof Prefabs.Name.Type;

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

export const paint = (
  world: World.World,
  edit: Edit,
  region: typeof Region.Region.Type,
  floor: Name | undefined,
  level: typeof Level.Level.Type | undefined
) => {
  const laid: NewEntity[] = [];
  const repainted: Present[] = [];

  for (const cell of Region.cells(region)) {
    const current = World.floorAt(world, cell);

    if (Option.isSome(current)) {
      const before = current.value;
      const prefab = floor ?? before.prefab;
      const after = level ?? Entity.level(before);

      if (prefab !== before.prefab || after !== Entity.level(before)) {
        repainted.push({
          ...before,
          components: { ...before.components, level: after },
          prefab,
        });
      }
    } else if (floor !== undefined) {
      laid.push({ cell, components: { level: level ?? 0 }, prefab: floor });
    }
  }

  return outcome(
    [],
    [...spawned(edit, numbered(world, laid)), ...updated(edit, repainted)]
  );
};

export const pour = (
  world: World.World,
  edit: Edit,
  { bed, liquid, region }: typeof Command.Pour.Type
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
      liquids.push({ cell, components: { level }, prefab: liquid });
      beds.push({
        ...floor.value,
        components: { ...floor.value.components, level: level - 1 },
        prefab: bed ?? floor.value.prefab,
      });
    }
  }

  return outcome(
    [],
    [...spawned(edit, numbered(world, liquids)), ...updated(edit, beds)]
  );
};

export const erase = (world: World.World, region: typeof Region.Region.Type) =>
  outcome(entitiesIn(world, Region.cells(region)));

const nextEntity = (world: World.World, fresh: NewEntity) =>
  ({ ...fresh, id: Entity.idFor(world.spawned + 1) }) satisfies Present;

const counted = (world: World.World, edit: Edit, entity: Present) =>
  World.apply(
    world,
    Event.Event.cases.EntitiesPlaced.make({ ...edit, entities: [entity] })
  );

export const spawn = (
  world: World.World,
  edit: Edit,
  prefab: Name,
  cell: At,
  components: Bag
) =>
  Result.gen(function* () {
    const entity = nextEntity(world, { cell, components, prefab });
    yield* ensurePlaceable(world, cell, Entity.components(entity));

    return outcome([], spawned(edit, [entity]));
  });

export const scatter = (
  world: World.World,
  edit: Edit,
  command: typeof Command.Scatter.Type
) => {
  const random = seededRandom(command.seed);
  const components = command.components ?? {};
  let working = world;
  const placed: Present[] = [];

  for (const cell of Region.cells(command.region)) {
    if (random.chance(command.density)) {
      const prefab =
        command.prefabs[random.integer(command.prefabs.length)] ??
        command.prefabs[0];

      const entity = nextEntity(working, { cell, components, prefab });

      if (
        Result.isSuccess(
          ensurePlaceable(working, cell, Entity.components(entity))
        )
      ) {
        working = counted(working, edit, entity);
        placed.push(entity);
      }
    }
  }

  return outcome([], spawned(edit, placed));
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

export const removeIn = (
  world: World.World,
  region: typeof Region.Region.Type,
  prefab: Name | undefined
) =>
  outcome(
    Arr.filter(entitiesIn(world, Region.cells(region)), (entity) =>
      prefab === undefined
        ? !Entity.isFloor(entity) && !Entity.isLiquid(entity)
        : entity.prefab === prefab
    )
  );

export const generate = (
  world: World.World,
  edit: Edit,
  command: typeof Command.Generate.Type
) => {
  const cells = Span.cells({
    maxX: command.origin.x + command.width - 1,
    maxY: command.origin.y + command.height - 1,
    minX: command.origin.x,
    minY: command.origin.y,
  });

  return outcome(
    entitiesIn(world, cells),
    spawned(edit, numbered(world, generateLandscape(command)))
  );
};

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
