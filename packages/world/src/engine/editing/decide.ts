import * as Arr from "effect/Array";
import * as Option from "effect/Option";
import * as Result from "effect/Result";

import type { PrefabName } from "../../definitions/prefabs/index.ts";
import { MIN_LEVEL } from "../../schema/cell.ts";
import type { Cell, Level } from "../../schema/cell.ts";
import type { Components } from "../../schema/components.ts";
import { generateLandscape } from "../generation/landscape.ts";
import type { NewEntity } from "../generation/landscape.ts";
import { seededRandom } from "../generation/random.ts";
import { ensurePlaceable, misfitsIn } from "../rules/placement.ts";
import { UnknownEntity } from "../rules/rejection.ts";
import type { Rejection } from "../rules/rejection.ts";
import { Change } from "../state/change.ts";
import {
  componentsOf,
  entityIdFor,
  overlay,
  prefabComponents,
  storedLevel,
} from "../state/entity.ts";
import type { Entity, EntityId } from "../state/entity.ts";
import { cellsOfSpan } from "../state/span.ts";
import {
  apply,
  applyAll,
  entitiesAt,
  entityOf,
  floorAt,
  isFloor,
  isLiquid,
  liquidAt,
} from "../state/world.ts";
import type { World } from "../state/world.ts";
import { Command } from "./command.ts";
import type { Editor, Timestamp } from "./edit.ts";
import { EVENT_MAX_ITEMS, evolveAll, WorldEvent } from "./event.ts";
import { cellsOf } from "./region.ts";
import type { Region } from "./region.ts";

type Present = typeof Entity.Type;

type Id = typeof EntityId.Type;

type At = typeof Cell.Type;

type Event = typeof WorldEvent.Type;

type Bag = typeof Components.Type;

type Name = typeof PrefabName.Type;

export type Decision = Result.Result<readonly Event[], typeof Rejection.Type>;

interface Edit {
  readonly at: typeof Timestamp.Type;
  readonly by: typeof Editor.Type;
}

interface Outcome {
  readonly dropped: readonly Id[];
  readonly events: readonly Event[];
}

const outcome = (dropped: readonly Id[], events: readonly Event[] = []) =>
  ({ dropped, events }) satisfies Outcome;

const removed = (edit: Edit, ids: readonly Id[]) =>
  Arr.map(Arr.chunksOf(ids, EVENT_MAX_ITEMS), (entities) =>
    WorldEvent.cases.Removed.make({ ...edit, entities })
  );

const spawned = (edit: Edit, entities: readonly Present[]) =>
  Arr.map(Arr.chunksOf(entities, EVENT_MAX_ITEMS), (chunk) =>
    WorldEvent.cases.Spawned.make({ ...edit, entities: chunk })
  );

const updated = (edit: Edit, entities: readonly Present[]) =>
  Arr.map(Arr.chunksOf(entities, EVENT_MAX_ITEMS), (chunk) =>
    WorldEvent.cases.Updated.make({ ...edit, entities: chunk })
  );

const idsOf = (entities: readonly Present[]) =>
  Arr.map(entities, (entity) => entity.id);

const entitiesIn = (world: World, cells: readonly At[]) =>
  Arr.flatMap(cells, (cell) => entitiesAt(world, cell));

const numbered = (world: World, fresh: readonly NewEntity[]) =>
  Arr.map(
    fresh,
    (entity, index) =>
      ({
        ...entity,
        id: entityIdFor(world.spawned + index + 1),
      }) satisfies Present
  );

const paint = (
  world: World,
  edit: Edit,
  region: typeof Region.Type,
  floor: Name | undefined,
  level: typeof Level.Type | undefined
) => {
  const laid: NewEntity[] = [];
  const repainted: Present[] = [];

  for (const cell of cellsOf(region)) {
    const current = floorAt(world, cell);

    if (Option.isSome(current)) {
      const before = current.value;
      const prefab = floor ?? before.prefab;
      const after = level ?? storedLevel(before);

      if (prefab !== before.prefab || after !== storedLevel(before)) {
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

const pour = (
  world: World,
  edit: Edit,
  { bed, liquid, region }: typeof Command.cases.Pour.Type
) => {
  const liquids: NewEntity[] = [];
  const beds: Present[] = [];

  for (const cell of cellsOf(region)) {
    const floor = floorAt(world, cell);

    if (
      Option.isSome(floor) &&
      Option.isNone(liquidAt(world, cell)) &&
      storedLevel(floor.value) > MIN_LEVEL
    ) {
      const level = storedLevel(floor.value);
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

const erase = (world: World, region: typeof Region.Type) =>
  outcome(idsOf(entitiesIn(world, cellsOf(region))));

const nextEntity = (world: World, fresh: NewEntity) =>
  ({ ...fresh, id: entityIdFor(world.spawned + 1) }) satisfies Present;

const counted = (world: World, entity: Present) =>
  apply(
    apply(world, Change.cases.EntityPut.make({ entity })),
    Change.cases.SpawnCounted.make({ spawned: world.spawned + 1 })
  );

const spawn = (
  world: World,
  edit: Edit,
  prefab: Name,
  cell: At,
  components: Bag
) =>
  Result.gen(function* () {
    const entity = nextEntity(world, { cell, components, prefab });
    yield* ensurePlaceable(world, cell, componentsOf(entity));

    return outcome([], spawned(edit, [entity]));
  });

const scatter = (
  world: World,
  edit: Edit,
  command: typeof Command.cases.Scatter.Type
) => {
  const random = seededRandom(command.seed);
  const components = command.components ?? {};
  let working = world;
  const placed: Present[] = [];

  for (const cell of cellsOf(command.region)) {
    if (random.chance(command.density)) {
      const prefab =
        command.prefabs[random.integer(command.prefabs.length)] ??
        command.prefabs[0];

      const entity = nextEntity(working, { cell, components, prefab });

      if (
        Result.isSuccess(ensurePlaceable(working, cell, componentsOf(entity)))
      ) {
        working = counted(working, entity);
        placed.push(entity);
      }
    }
  }

  return outcome([], spawned(edit, placed));
};

const existing = (world: World, id: Id) =>
  Option.match(entityOf(world, id), {
    onNone: () => Result.fail(new UnknownEntity({ entity: id })),
    onSome: Result.succeed,
  });

const move = (world: World, edit: Edit, id: Id, to: At) =>
  Result.gen(function* () {
    const entity = yield* existing(world, id);
    yield* ensurePlaceable(world, to, componentsOf(entity), Option.some(id));

    return outcome(
      [],
      [WorldEvent.cases.Moved.make({ ...edit, entity: id, to })]
    );
  });

const change = (world: World, edit: Edit, id: Id, components: Bag) =>
  Result.gen(function* () {
    const entity = yield* existing(world, id);
    yield* ensurePlaceable(
      world,
      entity.cell,
      overlay(prefabComponents(entity.prefab), components),
      Option.some(id)
    );

    return outcome(
      [],
      [WorldEvent.cases.Changed.make({ ...edit, components, entity: id })]
    );
  });

const remove = (world: World, ids: readonly Id[]) =>
  Result.gen(function* () {
    const distinct = Arr.dedupe(ids);

    for (const id of distinct) {
      yield* existing(world, id);
    }

    return outcome(distinct);
  });

const removeIn = (
  world: World,
  region: typeof Region.Type,
  prefab: Name | undefined
) =>
  outcome(
    idsOf(
      Arr.filter(entitiesIn(world, cellsOf(region)), (entity) =>
        prefab === undefined
          ? !isFloor(entity) && !isLiquid(entity)
          : entity.prefab === prefab
      )
    )
  );

const generate = (
  world: World,
  edit: Edit,
  command: typeof Command.cases.Generate.Type
) => {
  const cells = cellsOfSpan({
    maxX: command.origin.x + command.width - 1,
    maxY: command.origin.y + command.height - 1,
    minX: command.origin.x,
    minY: command.origin.y,
  });

  return outcome(
    idsOf(entitiesIn(world, cells)),
    spawned(edit, numbered(world, generateLandscape(command)))
  );
};

const touchedBy = (world: World, event: Event) => {
  const cellOf = (id: Id) =>
    Arr.fromOption(Option.map(entityOf(world, id), (entity) => entity.cell));

  const cells: readonly At[] = WorldEvent.match(event, {
    Changed: ({ entity }) => cellOf(entity),
    Moved: ({ entity, to }) => [...cellOf(entity), to],
    Removed: ({ entities }) => Arr.flatMap(entities, cellOf),
    Spawned: ({ entities }) => Arr.map(entities, (entity) => entity.cell),
    Updated: ({ entities }) => Arr.map(entities, (entity) => entity.cell),
  });

  return cells;
};

const settled = (world: World, edit: Edit, { dropped, events }: Outcome) => {
  const afterDropping = applyAll(
    world,
    Arr.map(dropped, (id) => Change.cases.EntityDropped.make({ id }))
  );

  const after = evolveAll(afterDropping, events);

  const touched = [
    ...Arr.flatMap(dropped, (id) =>
      Arr.fromOption(Option.map(entityOf(world, id), (entity) => entity.cell))
    ),
    ...Arr.flatMap(events, (event) => touchedBy(world, event)),
  ];

  const misfits = idsOf(misfitsIn(after, touched));

  return [...removed(edit, [...dropped, ...misfits]), ...events];
};

/**
 * Decides what an admin command does to the world: the events to record, or
 * why nothing happens. Every event of one decision shares `now` and `by`.
 */
export const decide = (
  world: World,
  command: typeof Command.Type,
  now: typeof Timestamp.Type,
  by: typeof Editor.Type
) => {
  const edit: Edit = { at: now, by };

  const decided: Result.Result<Outcome, typeof Rejection.Type> = Command.match(
    command,
    {
      Change: ({ components, entity }) =>
        change(world, edit, entity, components),
      Erase: ({ region }) => Result.succeed(erase(world, region)),
      Generate: (generating) =>
        Result.succeed(generate(world, edit, generating)),
      Move: ({ entity, to }) => move(world, edit, entity, to),
      Paint: ({ floor, level, region }) =>
        Result.succeed(paint(world, edit, region, floor, level)),
      Pour: (pouring) => Result.succeed(pour(world, edit, pouring)),
      Remove: ({ entities }) => remove(world, entities),
      RemoveIn: ({ prefab, region }) =>
        Result.succeed(removeIn(world, region, prefab)),
      Scatter: (scattering) => Result.succeed(scatter(world, edit, scattering)),
      Spawn: ({ cell, components, prefab }) =>
        spawn(world, edit, prefab, cell, components ?? {}),
    }
  );

  const decision: Decision = Result.map(decided, (done) =>
    settled(world, edit, done)
  );

  return decision;
};
