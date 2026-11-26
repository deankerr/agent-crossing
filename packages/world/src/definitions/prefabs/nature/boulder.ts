import { prefab } from "../../../schema/prefab.ts";

export const Boulder = prefab("boulder", {
  label: { glyph: "O", noun: "boulder" },
  layer: "object",
  obstacle: true,
  model: {
    parts: [
      {
        name: "stone",
        shade: "gray",
        forms: [
          {
            solid: { ball: [0.42, 0] },
            at: [0, 0.3, 0],
            scale: [1, 0.8, 0.95],
          },
          { solid: { ball: [0.2, 0] }, at: [-0.24, 0.18, 0.2], tone: 0.84 },
        ],
      },
      {
        name: "moss",
        shade: "leaf",
        forms: [
          {
            solid: { ball: [0.12, 0] },
            at: [0.1, 0.55, 0.05],
            scale: [1.4, 0.35, 1.2],
            tone: 0.8,
          },
        ],
      },
    ],
    pose: "nature",
  },
});
