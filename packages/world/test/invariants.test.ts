import { describe, expect, it } from "@effect/vitest";
import * as Arr from "effect/Array";
import * as Equal from "effect/Equal";
import * as Option from "effect/Option";
import * as Result from "effect/Result";

import { PrefabName } from "../src/definitions/prefabs/index.ts";
import { Command, LiquidName } from "../src/editing/command.ts";
import { decide } from "../src/editing/decide.ts";
import { Region } from "../src/editing/region.ts";
import { seededRandom } from "../src/generation/random.ts";
import type { SeededRandom } from "../src/generation/random.ts";
import { Editor } from "../src/history/edit.ts";
import { evolveAll } from "../src/history/event.ts";
import { habitatOf } from "../src/rules/placement.ts";
import { Cell, Coordinate, formatCell } from "../src/schema/cell.ts";
import { Layer } from "../src/schema/components.ts";
import {
  componentsOf,
  entityIdFor,
  entitySerial,
  prefabComponents,
} from "../src/state/entity.ts";
import {
  allEntities,
  emptyWorld,
  entitiesAt,
  floorAt,
  indexEntities,
  isFloor,
  isLiquid,
  placeAt,
} from "../src/state/world.ts";
import type { World } from "../src/state/world.ts";

const cell = (x: number, y: number) =>
  Cell.make({ x: Coordinate.make(x), y: Coordinate.make(y) });

const one = <A>(random: SeededRandom, options: readonly A[]) =>
  Option.getOrThrow(Arr.get(options, random.integer(options.length)));

const floors = Arr.filter(
  PrefabName.literals,
  (name) => prefabComponents(name).layer === "floor"
);

const anyCell = (random: SeededRandom) =>
  cell(random.integer(14) - 2, random.integer(14) - 2);

const anyRegion = (random: SeededRandom) =>
  random.chance(0.5)
    ? Region.cases.Rect.make({ from: anyCell(random), to: anyCell(random) })
    : Region.cases.Disc.make({
        center: anyCell(random),
        radius: random.integer(4),
      });

const anyCommand = (random: SeededRandom) =>
  one(random, [
    () =>
      Command.cases.Paint.make({
        floor: one(random, floors),
        level: random.integer(8),
        region: anyRegion(random),
      }),
    () =>
      Command.cases.Paint.make({
        level: random.integer(8),
        region: anyRegion(random),
      }),
    () =>
      Command.cases.Pour.make({
        liquid: LiquidName.make("water"),
        region: anyRegion(random),
      }),
    () => Command.cases.Erase.make({ region: anyRegion(random) }),
    () =>
      Command.cases.Spawn.make({
        cell: anyCell(random),
        prefab: one(random, PrefabName.literals),
      }),
    () =>
      Command.cases.Scatter.make({
        density: random.next(),
        prefabs: [
          one(random, PrefabName.literals),
          one(random, PrefabName.literals),
        ],
        region: anyRegion(random),
        seed: random.integer(1000),
      }),
    () =>
      Command.cases.Move.make({
        entity: entityIdFor(1 + random.integer(200)),
        to: anyCell(random),
      }),
    () =>
      Command.cases.Change.make({
        components: random.chance(0.5)
          ? { habitat: ["water"] }
          : { layer: one(random, Layer.literals) },
        entity: entityIdFor(1 + random.integer(200)),
      }),
    () =>
      Command.cases.Remove.make({
        entities: [entityIdFor(1 + random.integer(200))],
      }),
    () => Command.cases.RemoveIn.make({ region: anyRegion(random) }),
    () =>
      Command.cases.Generate.make({
        height: 8,
        origin: anyCell(random),
        seed: random.integer(1000),
        width: 8,
      }),
  ])();

const problemsOf = (world: World) => {
  const problems: string[] = [];

  if (!Equal.equals(world.entitiesByCell, indexEntities(world.entities))) {
    problems.push("the cell index differs from one rebuilt from scratch");
  }

  for (const entity of allEntities(world)) {
    const where = `${entity.id} at ${formatCell(entity.cell)}`;
    const place = placeAt(world, entity.cell);

    if (!isFloor(entity) && Option.isNone(floorAt(world, entity.cell))) {
      problems.push(`${where} has no floor`);
    }

    if (
      !isFloor(entity) &&
      !isLiquid(entity) &&
      Option.isSome(place) &&
      !habitatOf(componentsOf(entity)).includes(place.value)
    ) {
      problems.push(`${where} is out of its habitat`);
    }

    if (entitySerial(entity.id) > world.spawned) {
      problems.push(`${where} is numbered beyond the spawn count`);
    }

    for (const layer of Layer.literals) {
      const filling = Arr.filter(
        entitiesAt(world, entity.cell),
        (other) => componentsOf(other).layer === layer
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
      let world = emptyWorld;

      for (let step = 0; step < 50; step += 1) {
        const decision = decide(
          world,
          anyCommand(random),
          step,
          Editor.make("dean")
        );

        if (Result.isSuccess(decision)) {
          world = evolveAll(world, decision.success);
        }

        expect(problemsOf(world)).toStrictEqual([]);
      }
    }
  });
});
