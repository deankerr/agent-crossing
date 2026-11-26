import * as Arr from "effect/Array";

import * as Prefab from "../../Prefab.ts";
import { ring } from "../ring.ts";

export const Fern = Prefab.make("fern", {
  label: { glyph: "f", noun: "fern" },
  layer: "cover",
  model: {
    parts: [
      {
        name: "fronds",
        shade: "fern",
        forms: Arr.map(ring(6, 0.16, 0.3), ([x, z], index) => ({
          solid: { box: [0.38, 0.02, 0.08] },
          at: [x, 0.11, z],
          turn: [0, -Math.atan2(z, x), 0.5],
          tone: index % 2 === 0 ? 1 : 0.85,
        })),
      },
    ],
    pose: "nature",
  },
});
