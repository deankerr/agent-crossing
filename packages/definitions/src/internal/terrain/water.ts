import * as Prefab from "../../Prefab.ts";

export const Water = Prefab.make("water", {
  label: { glyph: "~", noun: "water" },
  layer: "liquid",
  model: {
    parts: [
      {
        name: "water",
        shade: "water",
        forms: [{ solid: { fill: -0.18 } }],
        opacity: 0.8,
        variation: 0.04,
      },
    ],
    pose: "fixed",
  },
});
