import * as Prefab from "../../Prefab.ts";

export const Stone = Prefab.make("stone", {
  label: { glyph: "^", noun: "stone" },
  layer: "floor",
  model: {
    parts: [
      {
        name: "top",
        shade: "stone",
        forms: [{ solid: { slab: [0, 0.12] } }],
        variation: 0.09,
      },
      {
        name: "earth",
        shade: "stone",
        forms: [{ solid: { fill: -0.12 }, tone: 0.78 }],
      },
    ],
    pose: "fixed",
  },
});
