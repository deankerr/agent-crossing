import { prefab } from "../../../schema/prefab.ts";

export const Path = prefab("path", {
  label: { glyph: "=", noun: "path" },
  layer: "floor",
  model: {
    parts: [
      {
        name: "top",
        shade: "path",
        forms: [{ solid: { slab: [0, 0.12] } }],
        variation: 0.05,
      },
      {
        name: "earth",
        shade: "earth",
        forms: [{ solid: { fill: -0.12 }, tone: 0.95 }],
      },
    ],
    pose: "fixed",
  },
});
