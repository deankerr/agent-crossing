import * as Prefab from "../../Prefab.ts";

export const Birch = Prefab.make("birch", {
  label: { glyph: "I", noun: "birch tree" },
  layer: "object",
  obstacle: true,
  model: {
    parts: [
      {
        name: "trunk",
        shade: "birch-bark",
        forms: [
          { solid: { cylinder: [0.055, 0.075, 1.1, 6] }, at: [0, 0.55, 0] },
        ],
      },
      {
        name: "bands",
        shade: "birch-band",
        forms: [
          { solid: { cylinder: [0.074, 0.076, 0.04, 6] }, at: [0, 0.3, 0] },
          { solid: { cylinder: [0.067, 0.069, 0.03, 6] }, at: [0, 0.62, 0] },
        ],
      },
      {
        name: "crown",
        shade: "birch-leaf",
        forms: [{ solid: { ball: [0.3, 0] }, at: [0, 1.18, 0] }],
      },
      {
        name: "tuft",
        shade: "leaf",
        forms: [
          {
            solid: { ball: [0.2, 0] },
            at: [0.1, 1.42, -0.04],
            scale: [1, 1.2, 1],
            tone: 1.12,
          },
        ],
      },
    ],
    pose: "nature",
  },
});
