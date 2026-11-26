import * as Arr from "effect/Array";

import * as Prefab from "../../Prefab.ts";

const PEBBLES = [
  { x: -0.2, z: -0.12, radius: 0.06, tone: 1 },
  { x: 0.15, z: -0.22, radius: 0.05, tone: 0.84 },
  { x: 0.05, z: 0.08, radius: 0.07, tone: 1.16 },
  { x: -0.12, z: 0.22, radius: 0.045, tone: 1 },
  { x: 0.25, z: 0.15, radius: 0.055, tone: 0.84 },
  { x: -0.28, z: 0.05, radius: 0.04, tone: 1.16 },
  { x: 0.18, z: -0.02, radius: 0.04, tone: 1 },
] as const;

export const Pebbles = Prefab.make("pebbles", {
  label: {
    glyph: "'",
    noun: "patch of pebbles",
    plural: "patches of pebbles",
  },
  layer: "cover",
  model: {
    parts: [
      {
        name: "pebbles",
        shade: "gray",
        forms: Arr.map(PEBBLES, ({ radius, tone, x, z }) => ({
          solid: { ball: [radius, 0] },
          at: [x, radius * 0.5, z],
          scale: [1, 0.6, 1],
          tone,
        })),
      },
    ],
    pose: "nature",
  },
});
