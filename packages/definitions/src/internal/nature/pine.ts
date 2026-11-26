import * as Prefab from "../../Prefab.ts";

export const Pine = Prefab.make("pine", {
  label: { glyph: "A", noun: "pine tree" },
  layer: "object",
  obstacle: true,
  model: {
    parts: [
      {
        name: "trunk",
        shade: "bark",
        forms: [{ solid: { cylinder: [0.07, 0.09, 0.4, 6] }, at: [0, 0.2, 0] }],
      },
      {
        name: "crown",
        shade: "pine",
        forms: [
          { solid: { cone: [0.42, 0.7, 7] }, at: [0, 0.68, 0] },
          { solid: { cone: [0.33, 0.6, 7] }, at: [0, 1.04, 0], tone: 1.17 },
          { solid: { cone: [0.22, 0.5, 7] }, at: [0, 1.38, 0] },
        ],
      },
    ],
    pose: "nature",
  },
});
