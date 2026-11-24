import { describe, expect, it } from "@effect/vitest";
import * as Arr from "effect/Array";
import * as Option from "effect/Option";

import { neighbours } from "../src/cell.ts";
import { Command } from "../src/command.ts";
import { generateLandscape } from "../src/generate.ts";
import { traitsOf } from "../src/ground.ts";
import { cellsOfSpan } from "../src/region.ts";
import {
  allTiles,
  bounds,
  cellCount,
  emptyWorld,
  entitiesAt,
  entityCount,
  groundAt,
  groundCounts,
  isWalkable,
} from "../src/world.ts";
import type { World } from "../src/world.ts";
import {
  cell,
  garden,
  invariantProblems,
  run,
  spawn,
} from "./world.fixture.ts";

const generate = (seed: number, width: number, height: number, x = 0, y = 0) =>
  Command.cases.Generate.make({ height, origin: cell(x, y), seed, width });

const steepLandPairs = (world: World) =>
  Arr.filter(
    Arr.flatMap(allTiles(world), ({ cell: here, ground }) =>
      Arr.map(
        neighbours(here),
        (next) => [ground, groundAt(world, next)] as const
      )
    ),
    ([here, next]) =>
      Option.exists(
        next,
        (there) =>
          !traitsOf(here.kind).wet &&
          !traitsOf(there.kind).wet &&
          Math.abs(here.height - there.height) > 1
      )
  );

describe("Generate", () => {
  it("is a pure function of its seed", () => {
    const spec = { height: 32, origin: cell(0, 0), seed: 5, width: 48 };
    expect(generateLandscape(spec)).toStrictEqual(generateLandscape(spec));
    expect(generateLandscape(spec)).not.toStrictEqual(
      generateLandscape({ ...spec, seed: 6 })
    );
  });

  it.each([
    [1, 8, 8],
    [2, 13, 9],
    [3, 40, 24],
    [20_261_124, 64, 64],
    [99, 100, 40],
    [7, 256, 256],
  ])("keeps every invariant for seed %i at %i × %i", (seed, width, height) => {
    const overlapping = run(garden, generate(seed, width, height, -3, -2));
    expect(invariantProblems(overlapping)).toStrictEqual([]);

    const alone = run(emptyWorld, generate(seed, width, height));
    expect(invariantProblems(alone)).toStrictEqual([]);
    expect(steepLandPairs(alone)).toStrictEqual([]);
  });

  it("fills its rectangle with ground, water, shores, forest and meadow", () => {
    const world = run(garden, generate(20_261_124, 64, 64));
    expect(cellCount(world)).toBe(64 * 64);
    expect(bounds(world)).toStrictEqual(
      Option.some({ maxX: 63, maxY: 63, minX: 0, minY: 0 })
    );

    const kinds = Arr.map(groundCounts(world), ({ kind }) => kind);
    expect(kinds).toStrictEqual(
      expect.arrayContaining(["water", "sand", "forest", "meadow", "grass"])
    );
    expect(entityCount(world)).toBeGreaterThan(500);
  });

  it("leaves a clear walkable area in the middle", () => {
    const world = run(garden, generate(3, 40, 24));
    const middle = cellsOfSpan({ maxX: 21, maxY: 13, minX: 19, minY: 11 });
    expect(Arr.every(middle, (here) => isWalkable(world, here))).toBeTruthy();
    expect(
      Arr.every(middle, (here) => entitiesAt(world, here).length === 0)
    ).toBeTruthy();
  });

  it("replaces whatever stood in the rectangle and keeps ids unique", () => {
    const built = run(garden, spawn("sign", cell(1, 1), { text: "old" }));
    const world = run(built, generate(1, 8, 8));
    expect(
      Arr.some(
        entitiesAt(world, cell(1, 1)),
        (entity) => entity.kind === "sign"
      )
    ).toBeFalsy();
    expect(
      invariantProblems(run(world, generate(2, 16, 16, 4, 4)))
    ).toStrictEqual([]);
  });
});
