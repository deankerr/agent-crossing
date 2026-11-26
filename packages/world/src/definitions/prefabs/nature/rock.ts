import { prefab } from "../../../schema/prefab.ts";

export const Rock = prefab("rock", {
  label: { glyph: "R", noun: "rock" },
  layer: "object",
  obstacle: true,
  model: {
    parts: [
      {
        name: "stone",
        shade: "gray",
        forms: [
          {
            solid: { ball: [0.24, 0] },
            at: [0, 0.13, 0],
            scale: [1, 0.7, 0.9],
          },
          {
            solid: { ball: [0.12, 0] },
            at: [0.18, 0.07, 0.1],
            scale: [1, 0.7, 1],
            tone: 0.84,
          },
        ],
      },
    ],
    pose: "nature",
  },
});
