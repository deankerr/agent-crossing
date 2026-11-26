import * as Components from "@agent-crossing/definitions/Components";
import * as Prefabs from "@agent-crossing/definitions/Prefabs";
import { describe, expect, it } from "@effect/vitest";
import * as Arr from "effect/Array";
import * as Equal from "effect/Equal";
import * as Option from "effect/Option";
import * as Result from "effect/Result";

import * as Cell from "../src/Cell.ts";
import * as Command from "../src/Command.ts";
import * as Entity from "../src/Entity.ts";
import { seededRandom } from "../src/internal/random.ts";
import type { SeededRandom } from "../src/internal/random.ts";
import * as Region from "../src/Region.ts";
import * as World from "../src/World.ts";

const cell = (x: number, y: number) =>
  Cell.Cell.make({ x: Cell.Coordinate.make(x), y: Cell.Coordinate.make(y) });

const one = <A>(random: SeededRandom, options: readonly A[]) =>
  Option.getOrThrow(Arr.get(options, random.integer(options.length)));

const floors = Arr.filter(
  Prefabs.Name.literals,
  (name) => Entity.prefabComponents(name).layer === "floor"
);

const anyCell = (random: SeededRandom) =>
  cell(random.integer(14) - 2, random.integer(14) - 2);

const anyRegion = (random: SeededRandom) =>
  random.chance(0.5)
    ? Region.Region.cases.Rect.make({
        from: anyCell(random),
        to: anyCell(random),
      })
    : Region.Region.cases.Disc.make({
        center: anyCell(random),
        radius: random.integer(4),
      });

const anyCommand = (random: SeededRandom) =>
  one(random, [
    () =>
      Command.Command.cases.FillRegion.make({
        components: { level: random.integer(8) },
        prefab: one(random, floors),
        region: anyRegion(random),
      }),
    () =>
      Command.Command.cases.FillRegion.make({
        prefab: one(random, floors),
        region: anyRegion(random),
      }),
    () =>
      Command.Command.cases.FillRegion.make({
        prefab: Prefabs.Name.make("water"),
        region: anyRegion(random),
      }),
    () =>
      Command.Command.cases.FillRegion.make({
        prefab: one(random, Prefabs.Name.literals),
        region: anyRegion(random),
      }),
    () =>
      Command.Command.cases.ClearRegion.make({
        region: anyRegion(random),
        removing: Command.Clearing.cases.Terrain.make({}),
      }),
    () =>
      Command.Command.cases.PlaceEntities.make({
        entities: [
          { cell: anyCell(random), prefab: one(random, Prefabs.Name.literals) },
          { cell: anyCell(random), prefab: one(random, Prefabs.Name.literals) },
        ],
      }),
    () =>
      Command.Command.cases.ScatterEntities.make({
        density: random.next(),
        prefabs: [
          one(random, Prefabs.Name.literals),
          one(random, Prefabs.Name.literals),
        ],
        region: anyRegion(random),
        seed: random.integer(1000),
      }),
    () =>
      Command.Command.cases.MoveEntity.make({
        entity: Entity.idFor(1 + random.integer(200)),
        to: anyCell(random),
      }),
    () =>
      Command.Command.cases.ChangeEntity.make({
        components: random.chance(0.5)
          ? { habitat: ["water"] }
          : { layer: one(random, Components.Layer.literals) },
        entity: Entity.idFor(1 + random.integer(200)),
      }),
    () =>
      Command.Command.cases.RemoveEntities.make({
        entities: [Entity.idFor(1 + random.integer(200))],
      }),
    () => Command.Command.cases.ClearRegion.make({ region: anyRegion(random) }),
    () =>
      Command.Command.cases.ClearRegion.make({
        region: anyRegion(random),
        removing: Command.Clearing.cases.Prefab.make({
          prefab: one(random, Prefabs.Name.literals),
        }),
      }),
  ])();

const problemsOf = (world: World.World) => {
  const problems: string[] = [];

  if (
    !Equal.equals(world.entitiesByCell, World.indexEntities(world.entities))
  ) {
    problems.push("the cell index differs from one rebuilt from scratch");
  }

  for (const entity of World.entities(world)) {
    const where = `${entity.id} at ${Cell.format(entity.cell)}`;
    const place = World.placeAt(world, entity.cell);

    if (
      !Entity.isFloor(entity) &&
      Option.isNone(World.floorAt(world, entity.cell))
    ) {
      problems.push(`${where} has no floor`);
    }

    if (
      !Entity.isFloor(entity) &&
      !Entity.isLiquid(entity) &&
      Option.isSome(place) &&
      !Entity.habitat(Entity.components(entity)).includes(place.value)
    ) {
      problems.push(`${where} is out of its habitat`);
    }

    if (Entity.serial(entity.id) > world.spawned) {
      problems.push(`${where} is numbered beyond the spawn count`);
    }

    for (const layer of Components.Layer.literals) {
      const filling = Arr.filter(
        World.entitiesAt(world, entity.cell),
        (other) => Entity.components(other).layer === layer
      );

      if (filling.length > 1) {
        problems.push(
          `${filling.length} entities fill the ${layer} of ${where}`
        );
      }
    }
  }

  return problems;
};

describe("evolving the decisions of random commands", () => {
  it("keeps every invariant", () => {
    for (const seed of Arr.range(1, 10)) {
      const random = seededRandom(seed);
      let world = World.empty;

      for (let step = 0; step < 50; step += 1) {
        const decision = Command.decide(world, anyCommand(random), step);

        if (Result.isSuccess(decision)) {
          world = World.applyAll(world, decision.success);
        }

        expect(problemsOf(world)).toStrictEqual([]);
      }
    }
  });
});
