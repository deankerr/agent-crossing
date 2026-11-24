import * as Arr from "effect/Array";

import { prefab } from "../../../schema/prefab.ts";

const STALKS_WITH_HEADS = [
  { x: -0.15, z: -0.1, tall: 0.6 },
  { x: 0.02, z: 0.12, tall: 0.55 },
  { x: 0.2, z: 0.08, tall: 0.62 },
] as const;

const BARE_STALKS = [
  { x: 0.1, z: -0.15, tall: 0.7 },
  { x: -0.2, z: 0.15, tall: 0.5 },
  { x: -0.04, z: -0.02, tall: 0.75 },
] as const;

export const Reeds = prefab("reeds", {
  label: { glyph: "|", noun: "clump of reeds", plural: "clumps of reeds" },
  layer: "cover",
  habitat: ["water"],
  model: {
    parts: [
      {
        name: "stalks",
        shade: "reed",
        forms: Arr.map(
          [...STALKS_WITH_HEADS, ...BARE_STALKS] as const,
          ({ tall, x, z }) => ({
            solid: { cylinder: [0.012, 0.02, tall, 4] },
            at: [x, tall / 2, z],
          })
        ),
      },
      {
        name: "heads",
        shade: "reed-head",
        forms: Arr.map(STALKS_WITH_HEADS, ({ tall, x, z }) => ({
          solid: { cylinder: [0.028, 0.028, 0.13, 5] },
          at: [x, tall - 0.06, z],
        })),
      },
    ],
    pose: "nature",
  },
});
