import * as Prefab from "../../Prefab.ts";

export const Grass = Prefab.make("grass", {
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
