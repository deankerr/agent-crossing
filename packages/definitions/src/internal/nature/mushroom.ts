import * as Prefab from "../../Prefab.ts";

export const Mushroom = Prefab.make("mushroom", {
  label: { glyph: "m", noun: "mushroom" },
  model: {
    parts: [
      {
        name: "stem",
        shade: "cream",
        forms: [
          { solid: { cylinder: [0.04, 0.05, 0.14, 6] }, at: [0, 0.07, 0] },
          {
            solid: { cylinder: [0.025, 0.03, 0.08, 6] },
            at: [0.11, 0.04, 0.07],
          },
        ],
      },
      {
        name: "cap",
        shade: "red",
        forms: [
          { solid: { ball: [0.1, 1] }, at: [0, 0.16, 0], scale: [1, 0.6, 1] },
          {
            solid: { ball: [0.06, 1] },
            at: [0.11, 0.09, 0.07],
            scale: [1, 0.6, 1],
          },
        ],
      },
    ],
    pose: "nature",
  },
});
