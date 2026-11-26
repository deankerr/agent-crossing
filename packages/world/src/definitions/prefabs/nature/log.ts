import { prefab } from "../../../schema/prefab.ts";

const QUARTER = Math.PI / 2;

export const Log = prefab("log", {
  label: { glyph: "L", noun: "fallen log" },
  layer: "object",
  obstacle: true,
  model: {
    parts: [
      {
        name: "bark",
        shade: "bark",
        forms: [
          {
            solid: { cylinder: [0.16, 0.16, 0.84, 8] },
            at: [0, 0.16, 0],
            turn: [0, 0, QUARTER],
          },
        ],
      },
      {
        name: "ends",
        shade: "heartwood",
        forms: [
          {
            solid: { cylinder: [0.145, 0.145, 0.015, 8] },
            at: [0.425, 0.16, 0],
            turn: [0, 0, QUARTER],
          },
          {
            solid: { cylinder: [0.145, 0.145, 0.015, 8] },
            at: [-0.425, 0.16, 0],
            turn: [0, 0, QUARTER],
          },
        ],
      },
      {
        name: "moss",
        shade: "leaf",
        forms: [
          {
            solid: { ball: [0.08, 0] },
            at: [0.1, 0.3, 0.04],
            scale: [1.6, 0.5, 1],
            tone: 0.8,
          },
        ],
      },
    ],
    pose: "nature",
  },
});
