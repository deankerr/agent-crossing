import * as Arr from "effect/Array";
import * as Option from "effect/Option";

import { cellAt } from "./cell.ts";
import type { Cell } from "./cell.ts";
import type { Components } from "./components.ts";
import type { GroundKind, Height, Tile } from "./ground.ts";
import { MAX_HEIGHT } from "./ground.ts";
import { kindDefaults } from "./kind.ts";
import type { KindName } from "./kind.ts";
import { pickWeighted, seededRandom } from "./seeded-random.ts";
import type { SeededRandom } from "./seeded-random.ts";
import type { Colour } from "./values.ts";

/** Something the landscape puts on a cell: a kind and its own components. */
export interface Thing {
  readonly kind: KindName;
  readonly cell: Cell;
  readonly components: Components;
}

export interface Landscape {
  readonly tiles: readonly Tile[];
  readonly things: readonly Thing[];
}

export interface LandscapeSpec {
  readonly seed: number;
  readonly width: number;
  readonly height: number;
  readonly origin: Cell;
}

type Point = readonly [number, number];

const STEPS = [
  [0, -1],
  [1, 0],
  [0, 1],
  [-1, 0],
] as const;

const DIAGONALS = [
  [1, -1],
  [1, 1],
  [-1, 1],
  [-1, -1],
] as const;

const smoothstep = (t: number) => t * t * (3 - 2 * t);

const lerp = (from: number, to: number, t: number) => from + (to - from) * t;

const clamp = (value: number, minimum: number, maximum: number) =>
  Math.min(maximum, Math.max(minimum, value));

const valueNoise = (
  random: SeededRandom,
  width: number,
  height: number,
  spacing: number
) => {
  const columns = Math.ceil(width / spacing) + 2;
  const rows = Math.ceil(height / spacing) + 2;
  const lattice = Arr.makeBy(columns * rows, () => random.next());
  const shiftX = random.next() * spacing;
  const shiftY = random.next() * spacing;

  const latticeAt = (column: number, row: number) =>
    lattice[row * columns + column] ?? 0;

  return (x: number, y: number) => {
    const u = (x + shiftX) / spacing;
    const v = (y + shiftY) / spacing;
    const column = Math.floor(u);
    const row = Math.floor(v);
    const across = smoothstep(u - column);
    const down = smoothstep(v - row);

    return lerp(
      lerp(latticeAt(column, row), latticeAt(column + 1, row), across),
      lerp(latticeAt(column, row + 1), latticeAt(column + 1, row + 1), across),
      down
    );
  };
};

const field = (
  random: SeededRandom,
  width: number,
  height: number,
  spacing: number
) => {
  const broad = valueNoise(random, width, height, spacing);
  const fine = valueNoise(random, width, height, Math.max(2, spacing / 2.5));

  const raw = Arr.makeBy(width * height, (index) => {
    const x = index % width;
    const y = Math.floor(index / width);

    return 0.7 * broad(x, y) + 0.3 * fine(x, y);
  });

  const lowest = Math.min(...raw);
  const range = Math.max(...raw) - lowest || 1;

  return Arr.map(raw, (value) => (value - lowest) / range);
};

interface Plan {
  readonly random: SeededRandom;
  readonly width: number;
  readonly height: number;
  readonly centreX: number;
  readonly centreY: number;
  readonly clearing: number;
}

const indexOf = (plan: Plan, x: number, y: number) => y * plan.width + x;

const inside = (plan: Plan, x: number, y: number) =>
  x >= 0 && x < plan.width && y >= 0 && y < plan.height;

const fromCentre = (plan: Plan, x: number, y: number) =>
  Math.max(Math.abs(x - plan.centreX), Math.abs(y - plan.centreY));

const mayHoldWater = (plan: Plan, x: number, y: number) =>
  inside(plan, x, y) && fromCentre(plan, x, y) > plan.clearing + 1;

const growPond = (
  plan: Plan,
  water: Set<number>,
  source: Point,
  size: number
) => {
  const pond: Point[] = [source];
  water.add(indexOf(plan, ...source));

  for (
    let attempt = 0;
    pond.length < size && attempt < size * 40;
    attempt += 1
  ) {
    const [fromX, fromY] = pond[plan.random.integer(pond.length)] ?? source;
    const [dx, dy] = STEPS[plan.random.integer(STEPS.length)] ?? STEPS[0];
    const x = fromX + dx;
    const y = fromY + dy;

    if (
      x > 0 &&
      y > 0 &&
      x < plan.width - 1 &&
      y < plan.height - 1 &&
      mayHoldWater(plan, x, y) &&
      !water.has(indexOf(plan, x, y))
    ) {
      water.add(indexOf(plan, x, y));
      pond.push([x, y]);
    }
  }
};

const pondSources = (plan: Plan, elevation: readonly number[]) => {
  const area = plan.width * plan.height;
  const count = clamp(Math.round(area / 1400), 1, 10);
  const sources: Point[] = [];

  for (let pond = 0; pond < count; pond += 1) {
    let best = Option.none<Point>();

    for (let candidate = 0; candidate < 24; candidate += 1) {
      const x = 1 + plan.random.integer(Math.max(1, plan.width - 2));
      const y = 1 + plan.random.integer(Math.max(1, plan.height - 2));

      const spaced = Arr.every(
        sources,
        ([sx, sy]) =>
          Math.max(Math.abs(sx - x), Math.abs(sy - y)) >
          Math.min(plan.width, plan.height) / 4
      );

      const lower = Option.match(best, {
        onNone: () => true,
        onSome: ([bx, by]) =>
          (elevation[indexOf(plan, x, y)] ?? 1) <
          (elevation[indexOf(plan, bx, by)] ?? 1),
      });

      if (mayHoldWater(plan, x, y) && spaced && lower) {
        best = Option.some([x, y] as const);
      }
    }

    if (Option.isSome(best)) {
      sources.push(best.value);
    }
  }

  return sources;
};

const streamStep = (
  plan: Plan,
  elevation: readonly number[],
  heading: number,
  [x, y]: Point
) =>
  pickWeighted(
    plan.random,
    Arr.map(STEPS, ([dx, dy], direction) => {
      const next: Point = [x + dx, y + dy];
      const backward = direction === (heading + 2) % 4;
      const blocked = inside(plan, ...next) && !mayHoldWater(plan, ...next);

      const downhill =
        (elevation[indexOf(plan, ...next)] ?? 0) <
        (elevation[indexOf(plan, x, y)] ?? 0);

      const ahead = direction === heading ? 3 : 1.2;

      const weight = backward || blocked ? 0 : ahead * (downhill ? 1.5 : 1);

      return [next, weight] as const;
    }),
    [x + 1, y] satisfies Point
  );

const runStream = (
  plan: Plan,
  water: Set<number>,
  elevation: readonly number[],
  start: Point
) => {
  const [startX, startY] = start;

  const toEdge = [
    startY,
    plan.width - 1 - startX,
    plan.height - 1 - startY,
    startX,
  ];

  const heading = toEdge.indexOf(Math.min(...toEdge));
  let at = start;

  for (let step = 0; step < 4 * (plan.width + plan.height); step += 1) {
    if (!inside(plan, ...at)) {
      return;
    }

    if (mayHoldWater(plan, ...at)) {
      water.add(indexOf(plan, ...at));
    }

    at = streamStep(plan, elevation, heading, at);
  }
};

const levelOf = (elevation: number) =>
  clamp(Math.floor(elevation ** 1.15 * (MAX_HEIGHT + 0.99)), 0, MAX_HEIGHT);

const waterLevels = (plan: Plan, water: ReadonlySet<number>, raw: number[]) => {
  const seen = new Set<number>();

  for (const start of water) {
    if (!seen.has(start)) {
      const body = [start];
      seen.add(start);

      for (const index of body) {
        const x = index % plan.width;
        const y = Math.floor(index / plan.width);

        for (const [dx, dy] of STEPS) {
          const next = indexOf(plan, x + dx, y + dy);

          if (
            inside(plan, x + dx, y + dy) &&
            water.has(next) &&
            !seen.has(next)
          ) {
            seen.add(next);
            body.push(next);
          }
        }
      }

      const level = Math.max(
        0,
        Math.min(...Arr.map(body, (index) => raw[index] ?? 0)) - 1
      );

      for (const index of body) {
        raw[index] = level;
      }
    }
  }
};

const slopeLimit = (plan: Plan, heights: number[]) => {
  const relax = (x: number, y: number, dx: number, dy: number) => {
    if (inside(plan, x + dx, y + dy)) {
      const index = indexOf(plan, x, y);
      const limit = (heights[indexOf(plan, x + dx, y + dy)] ?? 0) + 1;
      heights[index] = Math.min(heights[index] ?? 0, limit);
    }
  };

  for (let y = 0; y < plan.height; y += 1) {
    for (let x = 0; x < plan.width; x += 1) {
      relax(x, y, -1, 0);
      relax(x, y, 0, -1);
    }
  }

  for (let y = plan.height - 1; y >= 0; y -= 1) {
    for (let x = plan.width - 1; x >= 0; x -= 1) {
      relax(x, y, 1, 0);
      relax(x, y, 0, 1);
    }
  }
};

const pathWeight = (open: boolean, closer: boolean) => {
  if (!open) {
    return 0;
  }

  return closer ? 4 : 0.6;
};

const pathStep = (
  plan: Plan,
  water: ReadonlySet<number>,
  path: ReadonlySet<number>,
  [targetX, targetY]: Point,
  [x, y]: Point
) =>
  pickWeighted(
    plan.random,
    Arr.map(STEPS, ([dx, dy]) => {
      const next: Point = [x + dx, y + dy];

      const closer =
        Math.abs(targetX - next[0]) + Math.abs(targetY - next[1]) <
        Math.abs(targetX - x) + Math.abs(targetY - y);

      const open =
        inside(plan, ...next) &&
        !water.has(indexOf(plan, ...next)) &&
        !path.has(indexOf(plan, ...next));

      return [next, pathWeight(open, closer)] as const;
    }),
    [x, y] satisfies Point
  );

const touches = (plan: Plan, cells: ReadonlySet<number>, [x, y]: Point) =>
  Arr.some(
    STEPS,
    ([dx, dy]) =>
      inside(plan, x + dx, y + dy) && cells.has(indexOf(plan, x + dx, y + dy))
  );

const layPath = (plan: Plan, water: ReadonlySet<number>, target: Point) => {
  const path = new Set<number>();
  let at: Point = [plan.centreX, plan.centreY];

  for (let step = 0; step < 2 * (plan.width + plan.height); step += 1) {
    if (touches(plan, water, at)) {
      return path;
    }

    path.add(indexOf(plan, ...at));
    at = pathStep(plan, water, path, target, at);
  }

  return path;
};

const flowerColours: readonly (readonly [Colour, number])[] = [
  ["pink", 3],
  ["yellow", 3],
  ["white", 2],
  ["purple", 2],
  ["red", 1],
  ["orange", 1],
  ["blue", 1],
];

const coloured = (kind: KindName, colour: Colour) =>
  kindDefaults(kind).colour === colour ? {} : { colour };

type Biome = GroundKind | "clearing" | "shore-water" | "open-water";

const choices = {
  clearing: [],
  dirt: [
    ["pebbles", 0.06],
    ["stump", 0.02],
  ],
  forest: [
    ["tree", 0.42],
    ["fern", 0.1],
    ["log", 0.025],
    ["stump", 0.02],
    ["bush", 0.02],
    ["berry-bush", 0.015],
  ],
  grass: [
    ["flowers", 0.035],
    ["tall-grass", 0.045],
    ["bush", 0.012],
    ["oak", 0.01],
    ["birch", 0.006],
    ["rock", 0.006],
  ],
  meadow: [
    ["flowers", 0.16],
    ["tall-grass", 0.12],
    ["bush", 0.03],
    ["berry-bush", 0.015],
    ["oak", 0.01],
    ["birch", 0.005],
  ],
  "open-water": [["lily-pad", 0.14]],
  path: [],
  sand: [
    ["pebbles", 0.04],
    ["rock", 0.01],
  ],
  "shore-water": [
    ["reeds", 0.32],
    ["lily-pad", 0.03],
  ],
  stone: [
    ["rock", 0.1],
    ["boulder", 0.05],
    ["pebbles", 0.07],
    ["pine", 0.03],
    ["dead-tree", 0.02],
  ],
  water: [],
} as const satisfies Record<
  Biome,
  readonly (readonly [KindName | "tree", number])[]
>;

const treeOn = (random: SeededRandom, height: number) =>
  pickWeighted<KindName>(
    random,
    height >= 5
      ? [
          ["pine", 0.55],
          ["oak", 0.2],
          ["birch", 0.15],
          ["dead-tree", 0.1],
        ]
      : [
          ["oak", 0.42],
          ["pine", 0.25],
          ["birch", 0.25],
          ["dead-tree", 0.08],
        ],
    "oak"
  );

const thingsOn = (random: SeededRandom, biome: Biome, height: number) => {
  const roll = random.next();
  let sofar = 0;
  const found: { kind: KindName; components: Components }[] = [];

  for (const [choice, share] of choices[biome]) {
    if (found.length === 0 && roll >= sofar && roll < sofar + share) {
      const kind = choice === "tree" ? treeOn(random, height) : choice;

      const components =
        kind === "flowers"
          ? coloured(kind, pickWeighted(random, flowerColours, "pink"))
          : {};

      found.push({ components, kind });
    }

    sofar += share;
  }

  if (biome === "forest" && random.chance(0.04)) {
    found.push({ components: {}, kind: "mushroom" });
  }

  return found;
};

interface Terrain {
  readonly plan: Plan;
  readonly water: ReadonlySet<number>;
  readonly path: ReadonlySet<number>;
  readonly elevation: readonly number[];
  readonly moisture: readonly number[];
  readonly patches: readonly number[];
}

const groundOfBiome = {
  clearing: "grass",
  dirt: "dirt",
  forest: "forest",
  grass: "grass",
  meadow: "meadow",
  "open-water": "water",
  path: "path",
  sand: "sand",
  "shore-water": "water",
  stone: "stone",
  water: "water",
} as const satisfies Record<Biome, GroundKind>;

const isLandAt = (terrain: Terrain, [x, y]: Point) =>
  inside(terrain.plan, x, y) && !terrain.water.has(indexOf(terrain.plan, x, y));

const nearWater = (terrain: Terrain, [x, y]: Point) =>
  Arr.some(
    DIAGONALS,
    ([dx, dy]) =>
      inside(terrain.plan, x + dx, y + dy) &&
      terrain.water.has(indexOf(terrain.plan, x + dx, y + dy))
  );

const landBiome = (terrain: Terrain, index: number) => {
  const wet = terrain.moisture[index] ?? 0;

  if ((terrain.elevation[index] ?? 0) > 0.85) {
    return "stone";
  }

  if (wet > 0.56) {
    return "forest";
  }

  if (wet < 0.4) {
    return "meadow";
  }

  return (terrain.patches[index] ?? 0) > 0.85 ? "dirt" : "grass";
};

const biomeAt = (terrain: Terrain, at: Point, index: number) => {
  const { plan } = terrain;
  let biome: Biome = landBiome(terrain, index);

  if (terrain.water.has(index)) {
    const shore = Arr.some(STEPS, ([dx, dy]) =>
      isLandAt(terrain, [at[0] + dx, at[1] + dy])
    );

    biome = shore ? "shore-water" : "open-water";
  } else if (fromCentre(plan, ...at) <= plan.clearing) {
    biome = "clearing";
  } else if (terrain.path.has(index)) {
    biome = "path";
  } else if (
    touches(plan, terrain.water, at) ||
    (nearWater(terrain, at) && plan.random.chance(0.5))
  ) {
    biome = "sand";
  }

  return biome;
};

/**
 * A landscape for the rectangle: rolling hills, ponds joined to the edge by
 * a stream, sandy shores, forests, meadows, rocky heights and a clear walkable
 * area in the middle with a path towards the water. Pure in the seed.
 */
export const generateLandscape = (spec: LandscapeSpec) => {
  const { height, width } = spec;
  const random = seededRandom(spec.seed);
  const short = Math.min(width, height);

  const plan: Plan = {
    centreX: Math.floor(width / 2),
    centreY: Math.floor(height / 2),
    clearing: Math.max(1, Math.round(short / 12)),
    height,
    random,
    width,
  };

  const elevation = field(random, width, height, clamp(short / 3, 4, 28));
  const moisture = field(random, width, height, clamp(short / 3.5, 4, 20));
  const patches = field(random, width, height, 3);

  const water = new Set<number>();
  const sources = pondSources(plan, elevation);
  const pondArea = (width * height) / 32 / Math.max(1, sources.length);

  for (const source of sources) {
    growPond(
      plan,
      water,
      source,
      Math.max(3, Math.round(pondArea * (0.6 + random.next() * 0.8)))
    );
  }

  const firstSource = Arr.head(sources);

  if (short >= 20 && Option.isSome(firstSource)) {
    runStream(plan, water, elevation, firstSource.value);
  }

  const heights = Arr.map(elevation, levelOf);
  waterLevels(plan, water, heights);
  slopeLimit(plan, heights);

  const path = Option.match(firstSource, {
    onNone: () => new Set<number>(),
    onSome: (source) => layPath(plan, water, source),
  });

  const terrain: Terrain = { elevation, moisture, patches, path, plan, water };
  const tiles: Tile[] = [];
  const things: Thing[] = [];

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const cell = cellAt(spec.origin.x + x, spec.origin.y + y);

      if (Option.isSome(cell)) {
        const index = y * width + x;
        const biome = biomeAt(terrain, [x, y], index);
        const level: Height = heights[index] ?? 0;
        tiles.push({
          cell: cell.value,
          ground: { height: level, kind: groundOfBiome[biome] },
        });

        for (const thing of thingsOn(random, biome, level)) {
          things.push({ ...thing, cell: cell.value });
        }
      }
    }
  }

  return { things, tiles } satisfies Landscape;
};
