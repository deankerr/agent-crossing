import * as Arr from "effect/Array";
import * as Option from "effect/Option";
import * as Result from "effect/Result";

import type { Cell } from "./cell.ts";
import { Change } from "./change.ts";
import { Command } from "./command.ts";
import { overlay } from "./components.ts";
import type { Components } from "./components.ts";
import { componentsOf, entityIdFor } from "./entity.ts";
import type { Entity, EntityId } from "./entity.ts";
import { EVENT_MAX_ITEMS, WorldEvent } from "./event.ts";
import { generateLandscape } from "./generate.ts";
import type { Thing } from "./generate.ts";
import { sameGround } from "./ground.ts";
import type { Ground, GroundKind, Height, Tile } from "./ground.ts";
import { kindDefaults } from "./kind.ts";
import type { KindName } from "./kind.ts";
import { ensurePlaceable, suits } from "./placement.ts";
import { cellsOf, cellsOfSpan } from "./region.ts";
import type { Region } from "./region.ts";
import { UnknownEntity } from "./rejection.ts";
import type { Rejection } from "./rejection.ts";
import { seededRandom } from "./seeded-random.ts";
import type { Editor, Timestamp } from "./values.ts";
import { apply, entitiesAt, entityOf, groundAt } from "./world.ts";
import type { World } from "./world.ts";

export type Decision = Result.Result<readonly WorldEvent[], Rejection>;

interface Edit {
  readonly at: Timestamp;
  readonly by: Editor;
}

const removed = (edit: Edit, ids: readonly EntityId[]) =>
  Arr.map(Arr.chunksOf(ids, EVENT_MAX_ITEMS), (entities) =>
    WorldEvent.cases.Removed.make({ ...edit, entities })
  );

const painted = (edit: Edit, tiles: readonly Tile[]) =>
  Arr.map(Arr.chunksOf(tiles, EVENT_MAX_ITEMS), (chunk) =>
    WorldEvent.cases.GroundPainted.make({ ...edit, tiles: chunk })
  );

const erased = (edit: Edit, cells: readonly Cell[]) =>
  Arr.map(Arr.chunksOf(cells, EVENT_MAX_ITEMS), (chunk) =>
    WorldEvent.cases.GroundErased.make({ ...edit, cells: chunk })
  );

const spawned = (edit: Edit, entities: readonly Entity[]) =>
  Arr.map(Arr.chunksOf(entities, EVENT_MAX_ITEMS), (chunk) =>
    WorldEvent.cases.Spawned.make({ ...edit, entities: chunk })
  );

const idsOf = (entities: readonly Entity[]) =>
  Arr.map(entities, (entity) => entity.id);

const entitiesIn = (world: World, cells: readonly Cell[]) =>
  Arr.flatMap(cells, (cell) => entitiesAt(world, cell));

const repainted = (
  current: Option.Option<Ground>,
  kind: GroundKind | undefined,
  height: Height | undefined
) =>
  Option.match(current, {
    onNone: () =>
      kind === undefined
        ? Option.none<Ground>()
        : Option.some<Ground>({ height: height ?? 0, kind }),
    onSome: (ground) =>
      Option.some<Ground>({
        height: height ?? ground.height,
        kind: kind ?? ground.kind,
      }),
  });

const paint = (
  world: World,
  edit: Edit,
  region: Region,
  kind: GroundKind | undefined,
  height: Height | undefined
) => {
  const tiles = Arr.getSomes(
    Arr.map(cellsOf(region), (cell) => {
      const current = groundAt(world, cell);

      return Option.map(
        Option.filter(
          repainted(current, kind, height),
          (ground) =>
            !Option.exists(current, (before) => sameGround(before, ground))
        ),
        (ground) => ({ cell, ground }) satisfies Tile
      );
    })
  );

  const unsuited = Arr.flatMap(tiles, ({ cell, ground }) =>
    Arr.filter(
      entitiesAt(world, cell),
      (entity) => !suits(ground, componentsOf(entity))
    )
  );

  return [...removed(edit, idsOf(unsuited)), ...painted(edit, tiles)];
};

const erase = (world: World, edit: Edit, region: Region) => {
  const cells = Arr.filter(cellsOf(region), (cell) =>
    Option.isSome(groundAt(world, cell))
  );

  return [
    ...removed(edit, idsOf(entitiesIn(world, cells))),
    ...erased(edit, cells),
  ];
};

const nextEntity = (world: World, thing: Thing) =>
  ({ ...thing, id: entityIdFor(world.spawned + 1) }) satisfies Entity;

const counted = (world: World, entity: Entity) =>
  apply(
    apply(world, Change.cases.EntityPut.make({ entity })),
    Change.cases.SpawnCounted.make({ spawned: world.spawned + 1 })
  );

const spawn = (
  world: World,
  edit: Edit,
  kind: KindName,
  cell: Cell,
  components: Components
) =>
  Result.gen(function* () {
    const entity = nextEntity(world, { cell, components, kind });
    yield* ensurePlaceable(world, cell, componentsOf(entity));

    return spawned(edit, [entity]);
  });

const scatter = (
  world: World,
  edit: Edit,
  command: typeof Command.cases.Scatter.Type
) => {
  const random = seededRandom(command.seed);
  const components = command.components ?? {};
  let working = world;
  const placed: Entity[] = [];

  for (const cell of cellsOf(command.region)) {
    if (random.chance(command.density)) {
      const kind =
        command.kinds[random.integer(command.kinds.length)] ?? command.kinds[0];

      const entity = nextEntity(working, { cell, components, kind });

      if (
        Result.isSuccess(ensurePlaceable(working, cell, componentsOf(entity)))
      ) {
        working = counted(working, entity);
        placed.push(entity);
      }
    }
  }

  return spawned(edit, placed);
};

const existing = (world: World, id: EntityId) =>
  Option.match(entityOf(world, id), {
    onNone: () => Result.fail(new UnknownEntity({ entity: id })),
    onSome: Result.succeed,
  });

const move = (world: World, edit: Edit, id: EntityId, to: Cell) =>
  Result.gen(function* () {
    const entity = yield* existing(world, id);
    yield* ensurePlaceable(world, to, componentsOf(entity), Option.some(id));

    return [WorldEvent.cases.Moved.make({ ...edit, entity: id, to })];
  });

const change = (
  world: World,
  edit: Edit,
  id: EntityId,
  components: Components
) =>
  Result.gen(function* () {
    const entity = yield* existing(world, id);
    yield* ensurePlaceable(
      world,
      entity.cell,
      overlay(kindDefaults(entity.kind), components),
      Option.some(id)
    );

    return [WorldEvent.cases.Changed.make({ ...edit, components, entity: id })];
  });

const remove = (world: World, edit: Edit, ids: readonly EntityId[]) =>
  Result.gen(function* () {
    const distinct = Arr.dedupe(ids);

    for (const id of distinct) {
      yield* existing(world, id);
    }

    return removed(edit, distinct);
  });

const removeIn = (
  world: World,
  edit: Edit,
  region: Region,
  kind: KindName | undefined
) =>
  removed(
    edit,
    idsOf(
      Arr.filter(
        entitiesIn(world, cellsOf(region)),
        (entity) => kind === undefined || entity.kind === kind
      )
    )
  );

const generate = (
  world: World,
  edit: Edit,
  command: typeof Command.cases.Generate.Type
) => {
  const landscape = generateLandscape(command);

  const cells = cellsOfSpan({
    maxX: command.origin.x + command.width - 1,
    maxY: command.origin.y + command.height - 1,
    minX: command.origin.x,
    minY: command.origin.y,
  });

  const entities = Arr.map(
    landscape.things,
    (thing, index) =>
      ({
        ...thing,
        id: entityIdFor(world.spawned + index + 1),
      }) satisfies Entity
  );

  return [
    ...removed(edit, idsOf(entitiesIn(world, cells))),
    ...painted(edit, landscape.tiles),
    ...spawned(edit, entities),
  ];
};

/**
 * Decides what an admin command does to the world: the events to record, or
 * why nothing happens. Every event of one decision shares `now` and `by`.
 */
export const decide = (
  world: World,
  command: Command,
  now: Timestamp,
  by: Editor
) => {
  const edit: Edit = { at: now, by };

  const decision: Decision = Command.match(command, {
    Change: ({ components, entity }) => change(world, edit, entity, components),
    Erase: ({ region }) => Result.succeed(erase(world, edit, region)),
    Generate: (generating) => Result.succeed(generate(world, edit, generating)),
    Move: ({ entity, to }) => move(world, edit, entity, to),
    Paint: ({ height, kind, region }) =>
      Result.succeed(paint(world, edit, region, kind, height)),
    Remove: ({ entities }) => remove(world, edit, entities),
    RemoveIn: ({ kind, region }) =>
      Result.succeed(removeIn(world, edit, region, kind)),
    Scatter: (scattering) => Result.succeed(scatter(world, edit, scattering)),
    Spawn: ({ cell, components, kind }) =>
      spawn(world, edit, kind, cell, components ?? {}),
  });

  return decision;
};
