import { prefab } from "../../../schema/prefab.ts";

export const Bush = prefab("bush", {
  label: { glyph: "B", noun: "bush", plural: "bushes" },
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
    ],
    pose: "nature",
  },
});
