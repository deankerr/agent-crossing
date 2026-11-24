import { prefab } from "../../../schema/prefab.ts";

export const Meadow = prefab("meadow", {
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
