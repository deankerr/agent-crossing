import type { Colour } from "@agent-crossing/world/values";
import * as Arr from "effect/Array";
import * as Record from "effect/Record";

type Vec3 = readonly [number, number, number];

/**
 * A primitive solid centred on its own origin: a box by its sides, a
 * cylinder by top radius, bottom radius, height and segments, a cone by
 * radius, height and segments, or a low-poly ball by radius and detail.
 */
export type Solid =
  | { readonly box: Vec3 }
  | { readonly cylinder: readonly [number, number, number, number] }
  | { readonly cone: readonly [number, number, number] }
  | { readonly ball: readonly [number, number] };

/**
 * How a part is coloured: a fixed colour, the entity's `colour` (or the
 * model's default tint), or a fixed colour that glows (drawn unlit).
 */
export type Paint =
  | { readonly fixed: string }
  | { readonly tint: true }
  | { readonly glow: string };

export interface Part {
  readonly solid: Solid;
  /** Where the solid's centre sits, with the cell's surface centre at the origin. */
  readonly at: Vec3;
  /** Euler angles in radians, applied before moving to `at`. */
  readonly turn?: Vec3;
  readonly scale?: Vec3;
  readonly paint: Paint;
}

/**
 * How an entity is turned and sized on its cell:
 * - `nature` any heading and a little bigger or smaller, from its id;
 * - `quarter` a quarter turn from its id, at full size;
 * - `facing` towards the default camera, give or take a little;
 * - `fence` along the neighbouring entities of the same model.
 */
export type Pose = "nature" | "quarter" | "facing" | "fence";

export interface ModelSpec {
  readonly parts: readonly Part[];
  readonly pose: Pose;
  /** The colour of tinted parts when the entity has no `colour`. */
  readonly tint: Colour;
  /** Roughly how tall the model stands, for labels above it. */
  readonly height: number;
}

const ink = {
  bark: { fixed: "#8a5a3b" },
  berry: { fixed: "#d8434f" },
  birchBark: { fixed: "#efe9dc" },
  birchBand: { fixed: "#4a423b" },
  birchLeaf: { fixed: "#a8d35f" },
  cream: { fixed: "#f3ead8" },
  deadWood: { fixed: "#8c7a66" },
  ember: { glow: "#ffd25a" },
  fern: { fixed: "#5aa35a" },
  flame: { glow: "#ff9a3c" },
  heartwood: { fixed: "#e3c18c" },
  iron: { fixed: "#4f4c57" },
  lamp: { glow: "#ffe08f" },
  leaf: { fixed: "#5fae5a" },
  leafDark: { fixed: "#468f4b" },
  leafLight: { fixed: "#79c065" },
  lily: { fixed: "#4f9e4f" },
  pine: { fixed: "#3e7d4f" },
  pineLight: { fixed: "#4c9159" },
  placeholder: { fixed: "#e05cd0" },
  plank: { fixed: "#d9a873" },
  reed: { fixed: "#9db86a" },
  reedHead: { fixed: "#7a5a3a" },
  stem: { fixed: "#5fae5a" },
  stone: { fixed: "#a9a6a0" },
  stoneDark: { fixed: "#8e8a84" },
  stonePale: { fixed: "#c4c0b8" },
  tallGrass: { fixed: "#8cc463" },
  tallGrassDark: { fixed: "#74ad52" },
  tint: { tint: true },
  wood: { fixed: "#a0754c" },
  yellow: { fixed: "#ffd84d" },
} as const satisfies Record.ReadonlyRecord<string, Paint>;

const QUARTER = Math.PI / 2;
const TURN = Math.PI * 2;

const ring = (count: number, radius: number, phase = 0) =>
  Arr.makeBy(count, (index) => {
    const angle = phase + (index / count) * TURN;

    return [Math.cos(angle) * radius, Math.sin(angle) * radius] as const;
  });

const oak: ModelSpec = {
  height: 1.6,
  parts: [
    {
      at: [0, 0.35, 0],
      paint: ink.bark,
      solid: { cylinder: [0.08, 0.12, 0.7, 6] },
    },
    { at: [0, 1, 0], paint: ink.leaf, solid: { ball: [0.42, 0] } },
    { at: [0.14, 1.3, 0.06], paint: ink.leafLight, solid: { ball: [0.28, 0] } },
    {
      at: [-0.17, 1.18, -0.1],
      paint: ink.leafDark,
      solid: { ball: [0.26, 0] },
    },
  ],
  pose: "nature",
  tint: "green",
};

const pine: ModelSpec = {
  height: 1.75,
  parts: [
    {
      at: [0, 0.2, 0],
      paint: ink.bark,
      solid: { cylinder: [0.07, 0.09, 0.4, 6] },
    },
    { at: [0, 0.68, 0], paint: ink.pine, solid: { cone: [0.42, 0.7, 7] } },
    { at: [0, 1.04, 0], paint: ink.pineLight, solid: { cone: [0.33, 0.6, 7] } },
    { at: [0, 1.38, 0], paint: ink.pine, solid: { cone: [0.22, 0.5, 7] } },
  ],
  pose: "nature",
  tint: "green",
};

const birch: ModelSpec = {
  height: 1.7,
  parts: [
    {
      at: [0, 0.55, 0],
      paint: ink.birchBark,
      solid: { cylinder: [0.055, 0.075, 1.1, 6] },
    },
    {
      at: [0, 0.3, 0],
      paint: ink.birchBand,
      solid: { cylinder: [0.074, 0.076, 0.04, 6] },
    },
    {
      at: [0, 0.62, 0],
      paint: ink.birchBand,
      solid: { cylinder: [0.067, 0.069, 0.03, 6] },
    },
    { at: [0, 1.18, 0], paint: ink.birchLeaf, solid: { ball: [0.3, 0] } },
    {
      at: [0.1, 1.42, -0.04],
      paint: ink.leafLight,
      scale: [1, 1.2, 1],
      solid: { ball: [0.2, 0] },
    },
  ],
  pose: "nature",
  tint: "green",
};

const deadTree: ModelSpec = {
  height: 1.2,
  parts: [
    {
      at: [0, 0.5, 0],
      paint: ink.deadWood,
      solid: { cylinder: [0.05, 0.11, 1, 5] },
    },
    {
      at: [0.15, 0.78, 0],
      paint: ink.deadWood,
      solid: { cylinder: [0.025, 0.045, 0.42, 4] },
      turn: [0, 0, -0.8],
    },
    {
      at: [-0.13, 0.62, 0.05],
      paint: ink.deadWood,
      solid: { cylinder: [0.02, 0.04, 0.34, 4] },
      turn: [0.2, 0, 0.9],
    },
    {
      at: [0.03, 1.08, -0.06],
      paint: ink.deadWood,
      solid: { cylinder: [0.012, 0.03, 0.22, 4] },
      turn: [-0.4, 0, 0.2],
    },
  ],
  pose: "nature",
  tint: "brown",
};

const stump: ModelSpec = {
  height: 0.3,
  parts: [
    {
      at: [0, 0.125, 0],
      paint: ink.bark,
      solid: { cylinder: [0.2, 0.25, 0.25, 8] },
    },
    {
      at: [0, 0.255, 0],
      paint: ink.heartwood,
      solid: { cylinder: [0.18, 0.2, 0.015, 8] },
    },
  ],
  pose: "nature",
  tint: "brown",
};

const fallenLog: ModelSpec = {
  height: 0.35,
  parts: [
    {
      at: [0, 0.16, 0],
      paint: ink.bark,
      solid: { cylinder: [0.16, 0.16, 0.84, 8] },
      turn: [0, 0, QUARTER],
    },
    {
      at: [0.425, 0.16, 0],
      paint: ink.heartwood,
      solid: { cylinder: [0.145, 0.145, 0.015, 8] },
      turn: [0, 0, QUARTER],
    },
    {
      at: [-0.425, 0.16, 0],
      paint: ink.heartwood,
      solid: { cylinder: [0.145, 0.145, 0.015, 8] },
      turn: [0, 0, QUARTER],
    },
    {
      at: [0.1, 0.3, 0.04],
      paint: ink.leafDark,
      scale: [1.6, 0.5, 1],
      solid: { ball: [0.08, 0] },
    },
  ],
  pose: "nature",
  tint: "brown",
};

const bushParts: readonly Part[] = [
  { at: [0, 0.25, 0], paint: ink.leaf, solid: { ball: [0.3, 0] } },
  { at: [0.16, 0.3, 0.1], paint: ink.leafDark, solid: { ball: [0.22, 0] } },
  { at: [-0.16, 0.22, -0.05], paint: ink.leafLight, solid: { ball: [0.2, 0] } },
];

const bush: ModelSpec = {
  height: 0.6,
  parts: bushParts,
  pose: "nature",
  tint: "green",
};

const BERRIES: readonly Vec3[] = [
  [0.2, 0.35, 0.2],
  [-0.25, 0.3, 0.14],
  [0.05, 0.5, 0.15],
  [0.28, 0.25, -0.1],
  [-0.1, 0.42, -0.22],
  [-0.05, 0.2, 0.28],
];

const berryBush: ModelSpec = {
  height: 0.6,
  parts: [
    ...bushParts,
    ...Arr.map(
      BERRIES,
      (at) =>
        ({ at, paint: ink.berry, solid: { ball: [0.05, 0] } }) satisfies Part
    ),
  ],
  pose: "nature",
  tint: "red",
};

const fern: ModelSpec = {
  height: 0.3,
  parts: Arr.map(
    ring(6, 0.16, 0.3),
    ([x, z], index) =>
      ({
        at: [x, 0.11, z],
        paint: index % 2 === 0 ? ink.fern : ink.leafDark,
        solid: { box: [0.38, 0.02, 0.08] },
        turn: [0, -Math.atan2(z, x), 0.5],
      }) satisfies Part
  ),
  pose: "nature",
  tint: "green",
};

const BLADES: readonly (readonly [number, number, number])[] = [
  [-0.2, -0.15, 0.5],
  [0.15, -0.2, 0.42],
  [0.02, 0.05, 0.55],
  [-0.12, 0.2, 0.44],
  [0.22, 0.14, 0.48],
  [-0.25, 0.05, 0.38],
  [0.08, -0.05, 0.46],
  [0.05, 0.25, 0.4],
];

const tallGrass: ModelSpec = {
  height: 0.5,
  parts: Arr.map(
    BLADES,
    ([x, z, tall], index) =>
      ({
        at: [x, tall / 2, z],
        paint: index % 2 === 0 ? ink.tallGrass : ink.tallGrassDark,
        solid: { cone: [0.035, tall, 3] },
        turn: [z * 0.6, 0, -x * 0.6],
      }) satisfies Part
  ),
  pose: "nature",
  tint: "green",
};

const BLOOMS: readonly (readonly [number, number])[] = [
  [-0.2, -0.15],
  [0.18, -0.2],
  [0.04, 0.1],
  [-0.16, 0.22],
  [0.25, 0.18],
  [-0.02, -0.3],
];

const flowerPatch: ModelSpec = {
  height: 0.35,
  parts: [
    {
      at: [0, 0.06, 0],
      paint: ink.leafDark,
      scale: [1, 0.25, 1],
      solid: { ball: [0.3, 0] },
    },
    ...Arr.flatMap(BLOOMS, ([x, z], index) => {
      const stem = 0.16 + (index % 3) * 0.04;

      return [
        {
          at: [x, stem / 2, z],
          paint: ink.stem,
          solid: { cylinder: [0.012, 0.016, stem, 4] },
        },
        {
          at: [x, stem + 0.02, z],
          paint: ink.tint,
          scale: [1, 0.6, 1],
          solid: { ball: [0.07, 0] },
        },
        {
          at: [x, stem + 0.055, z],
          paint: ink.yellow,
          solid: { ball: [0.025, 0] },
        },
      ] satisfies readonly Part[];
    }),
  ],
  pose: "nature",
  tint: "pink",
};

const mushroom: ModelSpec = {
  height: 0.25,
  parts: [
    {
      at: [0, 0.07, 0],
      paint: ink.cream,
      solid: { cylinder: [0.04, 0.05, 0.14, 6] },
    },
    {
      at: [0, 0.16, 0],
      paint: ink.tint,
      scale: [1, 0.6, 1],
      solid: { ball: [0.1, 1] },
    },
    {
      at: [0.11, 0.04, 0.07],
      paint: ink.cream,
      solid: { cylinder: [0.025, 0.03, 0.08, 6] },
    },
    {
      at: [0.11, 0.09, 0.07],
      paint: ink.tint,
      scale: [1, 0.6, 1],
      solid: { ball: [0.06, 1] },
    },
  ],
  pose: "nature",
  tint: "red",
};

const rock: ModelSpec = {
  height: 0.3,
  parts: [
    {
      at: [0, 0.13, 0],
      paint: ink.stone,
      scale: [1, 0.7, 0.9],
      solid: { ball: [0.24, 0] },
    },
    {
      at: [0.18, 0.07, 0.1],
      paint: ink.stoneDark,
      scale: [1, 0.7, 1],
      solid: { ball: [0.12, 0] },
    },
  ],
  pose: "nature",
  tint: "grey",
};

const boulder: ModelSpec = {
  height: 0.7,
  parts: [
    {
      at: [0, 0.3, 0],
      paint: ink.stone,
      scale: [1, 0.8, 0.95],
      solid: { ball: [0.42, 0] },
    },
    {
      at: [-0.24, 0.18, 0.2],
      paint: ink.stoneDark,
      solid: { ball: [0.2, 0] },
    },
    {
      at: [0.1, 0.55, 0.05],
      paint: ink.leafDark,
      scale: [1.4, 0.35, 1.2],
      solid: { ball: [0.12, 0] },
    },
  ],
  pose: "nature",
  tint: "grey",
};

const PEBBLES: readonly (readonly [number, number, number])[] = [
  [-0.2, -0.12, 0.06],
  [0.15, -0.22, 0.05],
  [0.05, 0.08, 0.07],
  [-0.12, 0.22, 0.045],
  [0.25, 0.15, 0.055],
  [-0.28, 0.05, 0.04],
  [0.18, -0.02, 0.04],
];

const pebbles: ModelSpec = {
  height: 0.1,
  parts: Arr.map(
    PEBBLES,
    ([x, z, radius], index) =>
      ({
        at: [x, radius * 0.5, z],
        paint:
          [ink.stone, ink.stoneDark, ink.stonePale][index % 3] ?? ink.stone,
        scale: [1, 0.6, 1],
        solid: { ball: [radius, 0] },
      }) satisfies Part
  ),
  pose: "nature",
  tint: "grey",
};

const STALKS: readonly (readonly [number, number, number])[] = [
  [-0.15, -0.1, 0.6],
  [0.1, -0.15, 0.7],
  [0.02, 0.12, 0.55],
  [-0.2, 0.15, 0.5],
  [0.2, 0.08, 0.62],
  [-0.04, -0.02, 0.75],
];

const reeds: ModelSpec = {
  height: 0.8,
  parts: Arr.flatMap(
    STALKS,
    ([x, z, tall], index) =>
      [
        {
          at: [x, tall / 2, z],
          paint: ink.reed,
          solid: { cylinder: [0.012, 0.02, tall, 4] },
        },
        ...(index % 2 === 0
          ? [
              {
                at: [x, tall - 0.06, z],
                paint: ink.reedHead,
                solid: { cylinder: [0.028, 0.028, 0.13, 5] },
              } satisfies Part,
            ]
          : []),
      ] satisfies readonly Part[]
  ),
  pose: "nature",
  tint: "green",
};

const lilyPad: ModelSpec = {
  height: 0.15,
  parts: [
    {
      at: [0, 0.015, 0],
      paint: ink.lily,
      solid: { cylinder: [0.26, 0.26, 0.02, 10] },
    },
    {
      at: [0.06, 0.05, 0.04],
      paint: ink.tint,
      scale: [1, 0.7, 1],
      solid: { ball: [0.06, 0] },
    },
  ],
  pose: "nature",
  tint: "pink",
};

const block: ModelSpec = {
  height: 0.8,
  parts: [
    { at: [0, 0.4, 0], paint: ink.tint, solid: { box: [0.8, 0.8, 0.8] } },
  ],
  pose: "quarter",
  tint: "red",
};

const sign: ModelSpec = {
  height: 0.75,
  parts: [
    { at: [0, 0.3, 0], paint: ink.wood, solid: { box: [0.08, 0.6, 0.08] } },
    {
      at: [0, 0.55, 0.05],
      paint: ink.plank,
      solid: { box: [0.6, 0.36, 0.06] },
    },
  ],
  pose: "facing",
  tint: "brown",
};

const fence: ModelSpec = {
  height: 0.55,
  parts: [
    { at: [-0.4, 0.27, 0], paint: ink.wood, solid: { box: [0.1, 0.54, 0.1] } },
    { at: [0.4, 0.27, 0], paint: ink.wood, solid: { box: [0.1, 0.54, 0.1] } },
    { at: [0, 0.2, 0], paint: ink.plank, solid: { box: [1, 0.07, 0.05] } },
    { at: [0, 0.4, 0], paint: ink.plank, solid: { box: [1, 0.07, 0.05] } },
  ],
  pose: "fence",
  tint: "brown",
};

const lantern: ModelSpec = {
  height: 1.05,
  parts: [
    { at: [0, 0.03, 0], paint: ink.iron, solid: { box: [0.2, 0.06, 0.2] } },
    {
      at: [0, 0.37, 0],
      paint: ink.iron,
      solid: { cylinder: [0.03, 0.045, 0.66, 6] },
    },
    { at: [0, 0.7, 0], paint: ink.iron, solid: { box: [0.18, 0.03, 0.18] } },
    { at: [0, 0.8, 0], paint: ink.lamp, solid: { box: [0.13, 0.17, 0.13] } },
    {
      at: [0, 0.94, 0],
      paint: ink.iron,
      solid: { cone: [0.15, 0.12, 4] },
      turn: [0, Math.PI / 4, 0],
    },
  ],
  pose: "quarter",
  tint: "yellow",
};

const bench: ModelSpec = {
  height: 0.65,
  parts: [
    { at: [0, 0.3, 0.02], paint: ink.plank, solid: { box: [0.8, 0.06, 0.3] } },
    {
      at: [0, 0.5, -0.13],
      paint: ink.plank,
      solid: { box: [0.8, 0.22, 0.05] },
    },
    {
      at: [-0.34, 0.14, 0],
      paint: ink.wood,
      solid: { box: [0.06, 0.28, 0.28] },
    },
    {
      at: [0.34, 0.14, 0],
      paint: ink.wood,
      solid: { box: [0.06, 0.28, 0.28] },
    },
  ],
  pose: "quarter",
  tint: "brown",
};

const campfire: ModelSpec = {
  height: 0.45,
  parts: [
    ...Arr.map(
      ring(8, 0.27),
      ([x, z], index) =>
        ({
          at: [x, 0.05, z],
          paint: index % 2 === 0 ? ink.stone : ink.stoneDark,
          scale: [1, 0.75, 1],
          solid: { ball: [0.075, 0] },
        }) satisfies Part
    ),
    ...Arr.map(
      [0, 1, 2],
      (index) =>
        ({
          at: [0, 0.06, 0],
          paint: ink.bark,
          solid: { cylinder: [0.04, 0.04, 0.38, 5] },
          turn: [0, (index * Math.PI) / 3, QUARTER],
        }) satisfies Part
    ),
    { at: [0, 0.24, 0], paint: ink.flame, solid: { cone: [0.13, 0.34, 5] } },
    {
      at: [0.03, 0.22, 0.03],
      paint: ink.ember,
      solid: { cone: [0.07, 0.24, 5] },
    },
  ],
  pose: "nature",
  tint: "orange",
};

/** Drawn for any model name the library does not know. */
export const placeholderModel: ModelSpec = {
  height: 0.7,
  parts: [
    {
      at: [0, 0.22, 0],
      paint: ink.placeholder,
      solid: { box: [0.44, 0.44, 0.44] },
    },
    { at: [0, 0.56, 0], paint: ink.placeholder, solid: { ball: [0.12, 0] } },
  ],
  pose: "quarter",
  tint: "purple",
};

/** Every model the viewer can draw, keyed by an entity's `appearance.model`. */
export const modelLibrary = {
  bench,
  "berry-bush": berryBush,
  "birch-tree": birch,
  block,
  boulder,
  bush,
  campfire,
  "dead-tree": deadTree,
  "fallen-log": fallenLog,
  fence,
  fern,
  "flower-patch": flowerPatch,
  lantern,
  "lily-pad": lilyPad,
  mushroom,
  "oak-tree": oak,
  pebbles,
  "pine-tree": pine,
  reeds,
  rock,
  sign,
  stump,
  "tall-grass": tallGrass,
} satisfies Record.ReadonlyRecord<string, ModelSpec>;

const byName = new Map<string, ModelSpec>(Record.toEntries(modelLibrary));

export const PLACEHOLDER = "placeholder";

/** The library's name for a model, or the placeholder's when it has none. */
export const modelNameOf = (model: string | undefined) =>
  model !== undefined && byName.has(model) ? model : PLACEHOLDER;

/** The spec of a library model, or the placeholder for any other name. */
export const modelSpecOf = (name: string) =>
  byName.get(name) ?? placeholderModel;
