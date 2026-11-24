import * as Arr from "effect/Array";
import * as Equal from "effect/Equal";
import * as HashMap from "effect/HashMap";
import * as Option from "effect/Option";
import * as Result from "effect/Result";

import { Cell, Coordinate, formatCell } from "../src/cell.ts";
import { Command } from "../src/command.ts";
import { layers } from "../src/components.ts";
import type { Components } from "../src/components.ts";
import { componentsOf, entitySerial } from "../src/entity.ts";
import { evolveAll } from "../src/event.ts";
import type { GroundKind, Height } from "../src/ground.ts";
import type { KindName } from "../src/kind.ts";
import { suits } from "../src/placement.ts";
import { rect } from "../src/region.ts";
import type { Region } from "../src/region.ts";
import { decide } from "../src/rules.ts";
import { Editor } from "../src/values.ts";
import {
  allEntities,
  emptyWorld,
  groundAt,
  indexEntities,
} from "../src/world.ts";
import type { World } from "../src/world.ts";

export const cell = (x: number, y: number) =>
  Cell.make({ x: Coordinate.make(x), y: Coordinate.make(y) });

export const dean = Editor.make("dean");

export const span = (x1: number, y1: number, x2: number, y2: number) =>
  rect(cell(x1, y1), cell(x2, y2));

export const paint = (region: Region, kind?: GroundKind, height?: Height) => {
  if (kind === undefined) {
    return Command.cases.Paint.make({ height: height ?? 0, region });
  }

  if (height === undefined) {
    return Command.cases.Paint.make({ kind, region });
  }

  return Command.cases.Paint.make({ height, kind, region });
};

export const spawn = (kind: KindName, at: Cell, components: Components = {}) =>
  Command.cases.Spawn.make({ cell: at, components, kind });

/** Applies the events of a successful decision, failing loudly otherwise. */
export const run = (world: World, command: Command, now = 0) => {
  const decision = decide(world, command, now, dean);

  if (Result.isFailure(decision)) {
    throw new Error(`rejected: ${decision.failure._tag}`);
  }

  return evolveAll(world, decision.success);
};

export const runAll = (commands: readonly Command[], world = emptyWorld) =>
  Arr.reduce(commands, world, (sofar, command) => run(sofar, command));

export const eventsOf = (world: World, command: Command, now = 0) =>
  Result.getOrThrow(decide(world, command, now, dean));

/** A 10 × 10 meadow of grass with a 3 × 3 pond in the south-east corner. */
export const garden = runAll([
  paint(span(0, 0, 9, 9), "grass", 1),
  paint(span(7, 7, 9, 9), "water", 0),
]);

/** Everything that must hold for any world reached through `decide`. */
export const invariantProblems = (world: World) => {
  const problems: string[] = [];

  if (!Equal.equals(world.entitiesByCell, indexEntities(world.entities))) {
    problems.push("the cell index differs from one rebuilt from scratch");
  }

  for (const entity of allEntities(world)) {
    const where = `${entity.id} at ${formatCell(entity.cell)}`;
    const ground = groundAt(world, entity.cell);

    if (Option.isNone(ground)) {
      problems.push(`${where} has no ground`);
    } else if (!suits(ground.value, componentsOf(entity))) {
      problems.push(`${where} is on unsuitable ${ground.value.kind}`);
    }

    if (entitySerial(entity.id) > world.spawned) {
      problems.push(`${where} is numbered beyond the spawn count`);
    }
  }

  for (const [key, ids] of HashMap.toEntries(world.entitiesByCell)) {
    for (const layer of layers) {
      const claiming = Arr.filter(
        Arr.getSomes(
          Arr.map(Arr.fromIterable(ids), (id) =>
            HashMap.get(world.entities, id)
          )
        ),
        (entity) => componentsOf(entity).layer === layer
      );

      if (claiming.length > 1) {
        problems.push(
          `${claiming.length} entities claim the ${layer} layer of ${key}`
        );
      }
    }
  }

  return problems;
};
