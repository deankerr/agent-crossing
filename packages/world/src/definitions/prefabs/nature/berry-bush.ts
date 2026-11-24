import * as Arr from "effect/Array";

import { prefab } from "../../../schema/prefab.ts";

const BERRIES = [
  [0.2, 0.35, 0.2],
  [-0.25, 0.3, 0.14],
  [0.05, 0.5, 0.15],
  [0.28, 0.25, -0.1],
  [-0.1, 0.42, -0.22],
  [-0.05, 0.2, 0.28],
] as const;

export const BerryBush = prefab("berry-bush", {
  label: { glyph: "Q", noun: "berry bush", plural: "berry bushes" },
  layer: "object",
  habitat: ["land"],
  obstacle: true,
  model: {
    parts: [
      {
        name: "leaves",
        shade: "leaf",
        forms: [
          { solid: { ball: [0.3, 0] }, at: [0, 0.25, 0] },
          { solid: { ball: [0.22, 0] }, at: [0.16, 0.3, 0.1], tone: 0.8 },
          { solid: { ball: [0.2, 0] }, at: [-0.16, 0.22, -0.05], tone: 1.12 },
        ],
      },
      {
        name: "berries",
        shade: "berry",
        forms: Arr.map(BERRIES, (at) => ({ solid: { ball: [0.05, 0] }, at })),
      },
    ],
    pose: "nature",
  },
});
