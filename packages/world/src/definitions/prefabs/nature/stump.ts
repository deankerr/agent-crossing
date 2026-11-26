import { prefab } from "../../../schema/prefab.ts";

export const Stump = prefab("stump", {
  label: { glyph: "U", noun: "tree stump" },
  layer: "object",
  obstacle: true,
  model: {
    parts: [
      {
        name: "trunk",
        shade: "bark",
        forms: [
          { solid: { cylinder: [0.2, 0.25, 0.25, 8] }, at: [0, 0.125, 0] },
        ],
      },
      {
        name: "rings",
        shade: "heartwood",
        forms: [
          { solid: { cylinder: [0.18, 0.2, 0.015, 8] }, at: [0, 0.255, 0] },
        ],
      },
    ],
    pose: "nature",
  },
});
