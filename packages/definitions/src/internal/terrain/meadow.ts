import * as Prefab from "../../Prefab.ts";

export const Meadow = Prefab.make("meadow", {
  label: { glyph: ",", noun: "meadow" },
  layer: "floor",
  model: {
    parts: [
      {
        name: "top",
        shade: "meadow",
        forms: [{ solid: { slab: [0, 0.12] } }],
        variation: 0.08,
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
