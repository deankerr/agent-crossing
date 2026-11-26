import { prefab } from "../../../schema/prefab.ts";

export const Oak = prefab("oak", {
  label: { glyph: "T", noun: "oak tree" },
  layer: "object",
  obstacle: true,
  model: {
    parts: [
      {
        name: "trunk",
        shade: "bark",
        forms: [
          { solid: { cylinder: [0.08, 0.12, 0.7, 6] }, at: [0, 0.35, 0] },
        ],
      },
      {
        name: "crown",
        shade: "leaf",
        forms: [
          { solid: { ball: [0.42, 0] }, at: [0, 1, 0] },
          { solid: { ball: [0.28, 0] }, at: [0.14, 1.3, 0.06], tone: 1.12 },
          { solid: { ball: [0.26, 0] }, at: [-0.17, 1.18, -0.1], tone: 0.8 },
        ],
      },
    ],
    pose: "nature",
  },
});
