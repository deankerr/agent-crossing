import { prefab } from "../../../schema/prefab.ts";

export const LilyPad = prefab("lily-pad", {
  label: { glyph: "o", noun: "lily pad" },
  layer: "cover",
  habitat: ["water"],
  model: {
    parts: [
      {
        name: "pad",
        shade: "lily",
        forms: [
          { solid: { cylinder: [0.26, 0.26, 0.02, 10] }, at: [0, 0.015, 0] },
        ],
      },
      {
        name: "bloom",
        shade: "pink",
        forms: [
          {
            solid: { ball: [0.06, 0] },
            at: [0.06, 0.05, 0.04],
            scale: [1, 0.7, 1],
          },
        ],
      },
    ],
    pose: "nature",
  },
});
