import { prefab } from "../../../schema/prefab.ts";

export const Grass = prefab("grass", {
  label: { glyph: ".", noun: "grass" },
  layer: "floor",
  model: {
    parts: [
      {
        name: "top",
        shade: "grass",
        forms: [{ solid: { slab: [0, 0.12] } }],
        variation: 0.07,
      },
      {
        name: "earth",
        shade: "earth",
        forms: [{ solid: { fill: -0.12 } }],
      },
    ],
    pose: "fixed",
  },
});
