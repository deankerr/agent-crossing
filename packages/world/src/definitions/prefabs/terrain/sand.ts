import { prefab } from "../../../schema/prefab.ts";

export const Sand = prefab("sand", {
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
