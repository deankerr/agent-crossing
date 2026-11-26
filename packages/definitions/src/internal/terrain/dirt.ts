import * as Prefab from "../../Prefab.ts";

export const Dirt = Prefab.make("dirt", {
  label: { glyph: "-", noun: "dirt" },
  layer: "floor",
  model: {
    parts: [
      {
        name: "top",
        shade: "dirt",
        forms: [{ solid: { slab: [0, 0.12] } }],
        variation: 0.08,
      },
      {
        name: "earth",
        shade: "dark-earth",
        forms: [{ solid: { fill: -0.12 } }],
      },
    ],
    pose: "fixed",
  },
});
