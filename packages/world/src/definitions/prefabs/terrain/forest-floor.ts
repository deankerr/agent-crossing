import { prefab } from "../../../schema/prefab.ts";

export const ForestFloor = prefab("forest-floor", {
  label: { glyph: ";", noun: "forest floor" },
  layer: "floor",
  model: {
    parts: [
      {
        name: "top",
        shade: "forest-floor",
        forms: [{ solid: { slab: [0, 0.12] } }],
        variation: 0.1,
      },
      {
        name: "earth",
        shade: "dark-earth",
        forms: [{ solid: { fill: -0.12 }, tone: 0.93 }],
      },
    ],
    pose: "fixed",
  },
});
