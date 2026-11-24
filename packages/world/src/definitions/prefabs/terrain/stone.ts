import { prefab } from "../../../schema/prefab.ts";

export const Stone = prefab("stone", {
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
