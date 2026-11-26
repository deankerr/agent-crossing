import * as Arr from "effect/Array";

import * as Prefab from "../../Prefab.ts";

const BLADES = [
  { x: -0.2, z: -0.15, tall: 0.5 },
  { x: 0.15, z: -0.2, tall: 0.42 },
  { x: 0.02, z: 0.05, tall: 0.55 },
  { x: -0.12, z: 0.2, tall: 0.44 },
  { x: 0.22, z: 0.14, tall: 0.48 },
  { x: -0.25, z: 0.05, tall: 0.38 },
  { x: 0.08, z: -0.05, tall: 0.46 },
  { x: 0.05, z: 0.25, tall: 0.4 },
] as const;

export const TallGrass = Prefab.make("tall-grass", {
  label: {
    glyph: "v",
    noun: "tuft of tall grass",
    plural: "tufts of tall grass",
  },
  layer: "cover",
  model: {
    parts: [
      {
        name: "blades",
        shade: "tall-grass",
        forms: Arr.map(BLADES, ({ tall, x, z }, index) => ({
          solid: { cone: [0.035, tall, 3] },
          at: [x, tall / 2, z],
          turn: [z * 0.6, 0, -x * 0.6],
          tone: index % 2 === 0 ? 1 : 0.85,
        })),
      },
    ],
    pose: "nature",
  },
});
