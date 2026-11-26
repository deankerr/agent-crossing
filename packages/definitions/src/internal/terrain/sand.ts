import * as Prefab from "../../Prefab.ts";

export const Sand = Prefab.make("sand", {
  label: { glyph: ":", noun: "sand" },
  layer: "floor",
  model: {
    parts: [
      {
        name: "top",
        shade: "sand",
        forms: [{ solid: { slab: [0, 0.12] } }],
        variation: 0.05,
      },
      {
        name: "earth",
        shade: "packed-sand",
        forms: [{ solid: { fill: -0.12 } }],
      },
    ],
    pose: "fixed",
  },
});
