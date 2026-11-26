import * as Prefab from "../../Prefab.ts";

export const Fence = Prefab.make("fence", {
  label: { glyph: "#", noun: "fence" },
  layer: "object",
  obstacle: true,
  model: {
    parts: [
      {
        name: "posts",
        shade: "brown",
        forms: [
          { solid: { box: [0.1, 0.54, 0.1] }, at: [-0.4, 0.27, 0] },
          { solid: { box: [0.1, 0.54, 0.1] }, at: [0.4, 0.27, 0] },
        ],
      },
      {
        name: "rails",
        shade: "plank",
        forms: [
          { solid: { box: [1, 0.07, 0.05] }, at: [0, 0.2, 0] },
          { solid: { box: [1, 0.07, 0.05] }, at: [0, 0.4, 0] },
        ],
      },
    ],
    pose: "fence",
  },
});
