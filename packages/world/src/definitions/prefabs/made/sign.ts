import { prefab } from "../../../schema/prefab.ts";

export const Sign = prefab("sign", {
  label: { glyph: "S", noun: "sign" },
  layer: "object",
  habitat: ["land"],
  obstacle: true,
  model: {
    parts: [
      {
        name: "post",
        shade: "brown",
        forms: [{ solid: { box: [0.08, 0.6, 0.08] }, at: [0, 0.3, 0] }],
      },
      {
        name: "board",
        shade: "plank",
        forms: [{ solid: { box: [0.6, 0.36, 0.06] }, at: [0, 0.55, 0.05] }],
      },
    ],
    pose: "facing",
  },
});
