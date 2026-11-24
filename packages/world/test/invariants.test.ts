import { describe, expect, it } from "@effect/vitest";
import * as Arr from "effect/Array";
import * as Option from "effect/Option";
import * as Result from "effect/Result";

import { Command } from "../src/command.ts";
import { entityIdFor } from "../src/entity.ts";
import { evolveAll } from "../src/event.ts";
import { groundKinds } from "../src/ground.ts";
import { kindNames } from "../src/kind.ts";
import { Region } from "../src/region.ts";
import { decide } from "../src/rules.ts";
import { seededRandom } from "../src/seeded-random.ts";
import type { SeededRandom } from "../src/seeded-random.ts";
import { emptyWorld } from "../src/world.ts";
import { cell, dean, invariantProblems, span } from "./world.fixture.ts";

const anyCell = (random: SeededRandom) =>
  cell(random.integer(14) - 2, random.integer(14) - 2);

const anyRegion = (random: SeededRandom) =>
  random.chance(0.5)
    ? span(
        random.integer(12) - 2,
        random.integer(12) - 2,
        random.integer(12) - 2,
        random.integer(12) - 2
      )
    : Region.cases.Disc.make({
        centre: anyCell(random),
        radius: random.integer(4),
      });

const anyKind = (random: SeededRandom) =>
  kindNames[random.integer(kindNames.length)] ?? "oak";

const anyId = (random: SeededRandom) => entityIdFor(1 + random.integer(40));

const anyCommand = (random: SeededRandom) => {
  const commands = [
    () =>
      Command.cases.Paint.make({
        height: random.integer(8),
        kind: groundKinds[random.integer(groundKinds.length)] ?? "grass",
        region: anyRegion(random),
      }),
    () =>
      Command.cases.Paint.make({
        height: random.integer(8),
        region: anyRegion(random),
      }),
    () => Command.cases.Erase.make({ region: anyRegion(random) }),
    () =>
      Command.cases.Spawn.make({
        cell: anyCell(random),
        kind: anyKind(random),
      }),
    () =>
      Command.cases.Scatter.make({
        density: random.next(),
        kinds: [anyKind(random), anyKind(random)],
        region: anyRegion(random),
        seed: random.integer(1000),
      }),
    () =>
      Command.cases.Move.make({ entity: anyId(random), to: anyCell(random) }),
    () =>
      Command.cases.Change.make({
        components: random.chance(0.5) ? { aquatic: true } : { layer: "cover" },
        entity: anyId(random),
      }),
    () => Command.cases.Remove.make({ entities: [anyId(random)] }),
    () => Command.cases.RemoveIn.make({ region: anyRegion(random) }),
    () =>
      Command.cases.Generate.make({
        height: 8,
        origin: anyCell(random),
        seed: random.integer(1000),
        width: 8,
      }),
  ];

  return Option.getOrThrow(
    Arr.get(commands, random.integer(commands.length))
  )();
};

describe("evolving the decisions of random commands", () => {
  it("keeps every invariant", () => {
    for (const seed of Arr.range(1, 30)) {
      const random = seededRandom(seed);
      let world = emptyWorld;

      for (let step = 0; step < 60; step += 1) {
        const decision = decide(world, anyCommand(random), step, dean);

        if (Result.isSuccess(decision)) {
          world = evolveAll(world, decision.success);
        }

        expect(invariantProblems(world)).toStrictEqual([]);
      }
    }
  });
});
