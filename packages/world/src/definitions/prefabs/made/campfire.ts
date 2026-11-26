import * as Arr from "effect/Array";

import { prefab } from "../../../schema/prefab.ts";
import { ring } from "../ring.ts";

const QUARTER = Math.PI / 2;

export const Campfire = prefab("campfire", {
  label: { glyph: "x", noun: "campfire" },
  layer: "object",
  obstacle: true,
  model: {
    parts: [
      {
        name: "stones",
        shade: "gray",
        forms: Arr.map(ring(8, 0.27), ([x, z], index) => ({
          solid: { ball: [0.075, 0] },
          at: [x, 0.05, z],
          scale: [1, 0.75, 1],
          tone: index % 2 === 0 ? 1 : 0.84,
        })),
      },
      {
        name: "logs",
        shade: "bark",
        forms: Arr.map([0, 1, 2] as const, (index) => ({
          solid: { cylinder: [0.04, 0.04, 0.38, 5] },
          at: [0, 0.06, 0],
          turn: [0, (index * Math.PI) / 3, QUARTER],
        })),
      },
      {
        name: "flame",
        shade: "flame",
        forms: [{ solid: { cone: [0.13, 0.34, 5] }, at: [0, 0.24, 0] }],
        glow: true,
      },
      {
        name: "ember",
        shade: "ember",
        forms: [{ solid: { cone: [0.07, 0.24, 5] }, at: [0.03, 0.22, 0.03] }],
        glow: true,
      },
    ],
    pose: "nature",
  },
});
