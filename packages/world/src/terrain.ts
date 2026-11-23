import * as Arr from "effect/Array";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";

import {
  allTiles,
  centre,
  chebyshevDistance,
  MAP_SIZE,
  neighbours,
  tileAt,
  tileIndex,
} from "./grid.ts";
import type { Tile } from "./grid.ts";
import { seededRandom } from "./seeded-random.ts";
import type { SeededRandom } from "./seeded-random.ts";

export const WORLD_SEED = 20_261_124;

export const MAX_HEIGHT = 3;

export const Height = Schema.Int.check(
  Schema.isBetween({ maximum: MAX_HEIGHT, minimum: 0 })
);

export type Height = typeof Height.Type;

export const Ground = Schema.TaggedUnion({
  Land: { height: Height },
  Water: {},
});

export type Ground = typeof Ground.Type;

export type Terrain = readonly Ground[];

const LATTICE_SPACING = 8;
const LATTICE_POINTS = MAP_SIZE / LATTICE_SPACING + 1;
const POND_SIZES = [52, 24] as const;
const POND_CANDIDATES = 40;
const DRY_RADIUS_AROUND_CENTRE = 3;
const POND_MARGIN = 2;
const GROWTH_ATTEMPTS_PER_TILE = 50;

const smoothstep = (t: number) => t * t * (3 - 2 * t);

const lerp = (from: number, to: number, t: number) => from + (to - from) * t;

const hillField = (random: SeededRandom) => {
  const lattice = Arr.makeBy(
    LATTICE_POINTS * LATTICE_POINTS,
    () => random.next() * (MAX_HEIGHT + 1)
  );

  const latticeAt = (column: number, row: number) =>
    lattice[row * LATTICE_POINTS + column] ?? 0;

  return Arr.map(allTiles, (tile) => {
    const column = Math.floor(tile.x / LATTICE_SPACING);
    const row = Math.floor(tile.y / LATTICE_SPACING);
    const across = smoothstep((tile.x % LATTICE_SPACING) / LATTICE_SPACING);
    const down = smoothstep((tile.y % LATTICE_SPACING) / LATTICE_SPACING);

    const top = lerp(
      latticeAt(column, row),
      latticeAt(column + 1, row),
      across
    );

    const bottom = lerp(
      latticeAt(column, row + 1),
      latticeAt(column + 1, row + 1),
      across
    );

    return lerp(top, bottom, down);
  });
};

const mayHoldWater = (tile: Tile) =>
  chebyshevDistance(tile, centre) > DRY_RADIUS_AROUND_CENTRE;

const randomTile = (random: SeededRandom, margin: number) =>
  tileAt(
    margin + random.integer(MAP_SIZE - 2 * margin),
    margin + random.integer(MAP_SIZE - 2 * margin)
  ).pipe(Option.getOrElse(() => centre));

const pondSource = (random: SeededRandom, field: readonly number[]) => {
  const candidates = Arr.filter(
    Arr.makeBy(POND_CANDIDATES, () => randomTile(random, POND_MARGIN)),
    mayHoldWater
  );

  const fieldAt = (tile: Tile) => field[tileIndex(tile)] ?? 0;

  return Arr.reduce(
    candidates,
    randomTile(random, POND_MARGIN),
    (lowest, tile) => (fieldAt(tile) < fieldAt(lowest) ? tile : lowest)
  );
};

const growPond = (
  random: SeededRandom,
  water: ReadonlySet<number>,
  source: Tile,
  size: number
) => {
  const grown = new Set(water);
  const pond: Tile[] = [source];
  grown.add(tileIndex(source));

  for (
    let attempt = 0;
    pond.length < size && attempt < size * GROWTH_ATTEMPTS_PER_TILE;
    attempt += 1
  ) {
    const from = pond[random.integer(pond.length)] ?? source;
    const around = neighbours(from);
    const next = around[random.integer(around.length)];

    if (
      next !== undefined &&
      mayHoldWater(next) &&
      !grown.has(tileIndex(next))
    ) {
      grown.add(tileIndex(next));
      pond.push(next);
    }
  }

  return grown;
};

const slopeLimited = (heights: readonly number[]) => {
  const limited = [...heights];
  let changed = true;

  while (changed) {
    changed = false;

    for (const tile of allTiles) {
      const index = tileIndex(tile);
      const own = limited[index] ?? 0;

      const lowestNeighbour = Math.min(
        ...Arr.map(neighbours(tile), (next) => limited[tileIndex(next)] ?? 0)
      );

      if (own > lowestNeighbour + 1) {
        limited[index] = lowestNeighbour + 1;
        changed = true;
      }
    }
  }

  return limited;
};

const reachableFromCentre = (water: ReadonlySet<number>) => {
  const reached = new Set([tileIndex(centre)]);
  const queue: Tile[] = [centre];

  for (const tile of queue) {
    for (const next of neighbours(tile)) {
      const index = tileIndex(next);

      if (!water.has(index) && !reached.has(index)) {
        reached.add(index);
        queue.push(next);
      }
    }
  }

  return reached;
};

const noWater: ReadonlySet<number> = new Set();

export const generateTerrain = (seed: number) => {
  const random = seededRandom(seed);
  const field = hillField(random);

  const water = Arr.reduce(POND_SIZES, noWater, (sofar, size) =>
    growPond(random, sofar, pondSource(random, field), size)
  );

  const heights = slopeLimited(
    Arr.map(allTiles, (tile) =>
      water.has(tileIndex(tile))
        ? 0
        : Math.min(MAX_HEIGHT, Math.floor(field[tileIndex(tile)] ?? 0))
    )
  );

  const dry = reachableFromCentre(water);

  const generated: Terrain = Arr.map(allTiles, (tile) =>
    dry.has(tileIndex(tile))
      ? Ground.cases.Land.make({
          height: Height.make(heights[tileIndex(tile)] ?? 0),
        })
      : Ground.cases.Water.make({})
  );

  return generated;
};

export const terrain: Terrain = generateTerrain(WORLD_SEED);

export const groundAt = (tile: Tile) =>
  terrain[tileIndex(tile)] ?? Ground.cases.Water.make({});

export const isLand = (tile: Tile) => groundAt(tile)._tag === "Land";

export const heightAt = (tile: Tile) => {
  const ground = groundAt(tile);

  return ground._tag === "Land"
    ? Option.some(ground.height)
    : Option.none<Height>();
};

export const canStep = (from: Tile, to: Tile) =>
  Option.match(Option.all([heightAt(from), heightAt(to)]), {
    onNone: () => false,
    onSome: ([fromHeight, toHeight]) => Math.abs(fromHeight - toHeight) <= 1,
  });
