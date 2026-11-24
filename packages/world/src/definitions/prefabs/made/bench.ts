import { prefab } from "../../../schema/prefab.ts";

export const Bench = prefab("bench", {
  label: { glyph: "n", noun: "bench", plural: "benches" },
  layer: "object",
  habitat: ["land"],
  obstacle: true,
  model: {
    parts: [
      {
        name: "seat",
        shade: "plank",
        forms: [{ solid: { box: [0.8, 0.06, 0.3] }, at: [0, 0.3, 0.02] }],
      },
      {
        name: "back",
        shade: "plank",
        forms: [{ solid: { box: [0.8, 0.22, 0.05] }, at: [0, 0.5, -0.13] }],
      },
      {
        name: "legs",
        shade: "brown",
        forms: [
          { solid: { box: [0.06, 0.28, 0.28] }, at: [-0.34, 0.14, 0] },
          { solid: { box: [0.06, 0.28, 0.28] }, at: [0.34, 0.14, 0] },
        ],
      },
    ],
    pose: "quarter",
  },
});
