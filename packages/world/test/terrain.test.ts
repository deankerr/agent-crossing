import { assert, describe, expect, it } from "@effect/vitest";
import * as Arr from "effect/Array";
import * as Schema from "effect/Schema";

import { allTiles, centre, neighbours, tileIndex } from "../src/grid.ts";
import type { Tile } from "../src/grid.ts";
import {
  canStep,
  generateTerrain,
  heightAt,
  isLand,
  terrain,
  WORLD_SEED,
} from "../src/terrain.ts";
import type { Terrain } from "../src/terrain.ts";

const landAt = (map: Terrain, tile: Tile) =>
  map[tileIndex(tile)]?._tag === "Land";

const regionFrom = (start: Tile, joins: (from: Tile, to: Tile) => boolean) => {
  const reached = new Set([tileIndex(start)]);
  const queue = [start];

  for (const tile of queue) {
    for (const next of neighbours(tile)) {
      if (!reached.has(tileIndex(next)) && joins(tile, next)) {
        reached.add(tileIndex(next));
        queue.push(next);
      }
    }
  }

  return reached;
};

const waterBodies = (map: Terrain) => {
  const seen = new Set<number>();
  let bodies = 0;

  for (const tile of allTiles) {
    if (!landAt(map, tile) && !seen.has(tileIndex(tile))) {
      bodies += 1;

      for (const index of regionFrom(tile, (_, next) => !landAt(map, next))) {
        seen.add(index);
      }
    }
  }

  return bodies;
};

const landPairs = Arr.flatMap(allTiles, (tile) =>
  Arr.map(
    Arr.filter(
      neighbours(tile),
      (next) =>
        tileIndex(next) > tileIndex(tile) && isLand(tile) && isLand(next)
    ),
    (next) => [tile, next] as const
  )
);

describe("the generated map", () => {
  it("is a pure function of the seed", () => {
    expect(generateTerrain(WORLD_SEED)).toStrictEqual(terrain);
    expect(generateTerrain(WORLD_SEED + 1)).not.toStrictEqual(terrain);
  });

  it("keeps the centre tile dry", () => {
    expect(isLand(centre)).toBeTruthy();
  });

  it("covers five to ten percent of the map with water", () => {
    const water = Arr.filter(allTiles, (tile) => !isLand(tile)).length;
    expect(water / allTiles.length).toBeGreaterThanOrEqual(0.05);
    expect(water / allTiles.length).toBeLessThanOrEqual(0.1);
  });

  it("gathers the water into one or two bodies", () => {
    expect([1, 2]).toContain(waterBodies(terrain));
  });

  it("keeps heights between zero and three", () => {
    const heights = Arr.map(Arr.filter(allTiles, isLand), heightAt);
    expect(
      Arr.every(heights, (height) =>
        Schema.is(
          Schema.Int.check(Schema.isBetween({ maximum: 3, minimum: 0 }))
        )(height._tag === "Some" ? height.value : -1)
      )
    ).toBeTruthy();
  });

  it("joins every land tile into one walkable region", () => {
    const walkable = regionFrom(centre, canStep);
    expect(walkable.size).toBe(Arr.filter(allTiles, isLand).length);
  });

  it("lets nearly all neighbouring land tiles be walked between", () => {
    const gentle = Arr.filter(landPairs, ([from, to]) => canStep(from, to));
    expect(gentle.length / landPairs.length).toBeGreaterThanOrEqual(0.95);
  });

  it.prop(
    "keeps its guarantees for other seeds",
    {
      seed: Schema.Int.check(
        Schema.isBetween({ maximum: 2 ** 31, minimum: 1 })
      ),
    },
    ({ seed }) => {
      const map = generateTerrain(seed);
      const land = Arr.filter(allTiles, (tile) => landAt(map, tile));

      const walkable = regionFrom(centre, (from, to) => {
        const a = map[tileIndex(from)];
        const b = map[tileIndex(to)];

        return (
          a?._tag === "Land" &&
          b?._tag === "Land" &&
          Math.abs(a.height - b.height) <= 1
        );
      });

      assert.isTrue(landAt(map, centre));
      assert.strictEqual(walkable.size, land.length);
      assert.isAbove(land.length / allTiles.length, 0.85);
    },
    { arbitrary: { runs: 25 } }
  );
});
