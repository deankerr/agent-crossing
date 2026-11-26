import { prefab } from "../../../schema/prefab.ts";

export const Block = prefab("block", {
  label: { glyph: "H", noun: "block" },
  layer: "object",
  obstacle: true,
  model: {
    parts: [
      {
        name: "body",
        shade: "red",
        forms: [{ solid: { box: [0.8, 0.8, 0.8] }, at: [0, 0.4, 0] }],
      },
    ],
    pose: "quarter",
  },
});
