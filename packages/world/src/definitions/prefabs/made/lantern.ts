import { prefab } from "../../../schema/prefab.ts";

export const Lantern = prefab("lantern", {
  label: { glyph: "!", noun: "lantern" },
  layer: "object",
  obstacle: true,
  model: {
    parts: [
      {
        name: "frame",
        shade: "iron",
        forms: [
          { solid: { box: [0.2, 0.06, 0.2] }, at: [0, 0.03, 0] },
          { solid: { cylinder: [0.03, 0.045, 0.66, 6] }, at: [0, 0.37, 0] },
          { solid: { box: [0.18, 0.03, 0.18] }, at: [0, 0.7, 0] },
          {
            solid: { cone: [0.15, 0.12, 4] },
            at: [0, 0.94, 0],
            turn: [0, Math.PI / 4, 0],
          },
        ],
      },
      {
        name: "lamp",
        shade: "lamp",
        forms: [{ solid: { box: [0.13, 0.17, 0.13] }, at: [0, 0.8, 0] }],
        glow: true,
      },
    ],
    pose: "quarter",
  },
});
