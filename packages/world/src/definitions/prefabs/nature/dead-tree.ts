import { prefab } from "../../../schema/prefab.ts";

export const DeadTree = prefab("dead-tree", {
  label: { glyph: "Y", noun: "dead tree" },
  layer: "object",
  habitat: ["land"],
  obstacle: true,
  model: {
    parts: [
      {
        name: "trunk",
        shade: "dead-wood",
        forms: [{ solid: { cylinder: [0.05, 0.11, 1, 5] }, at: [0, 0.5, 0] }],
      },
      {
        name: "branches",
        shade: "dead-wood",
        forms: [
          {
            solid: { cylinder: [0.025, 0.045, 0.42, 4] },
            at: [0.15, 0.78, 0],
            turn: [0, 0, -0.8],
          },
          {
            solid: { cylinder: [0.02, 0.04, 0.34, 4] },
            at: [-0.13, 0.62, 0.05],
            turn: [0.2, 0, 0.9],
          },
          {
            solid: { cylinder: [0.012, 0.03, 0.22, 4] },
            at: [0.03, 1.08, -0.06],
            turn: [-0.4, 0, 0.2],
          },
        ],
      },
    ],
    pose: "nature",
  },
});
