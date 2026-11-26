import * as Arr from "effect/Array";

import { prefab } from "../../../schema/prefab.ts";

const FLOWERS = [
  { x: -0.2, z: -0.15, stem: 0.16 },
  { x: 0.18, z: -0.2, stem: 0.2 },
  { x: 0.04, z: 0.1, stem: 0.24 },
  { x: -0.16, z: 0.22, stem: 0.16 },
  { x: 0.25, z: 0.18, stem: 0.2 },
  { x: -0.02, z: -0.3, stem: 0.24 },
] as const;

type Bloom = "pink" | "yellow" | "white" | "purple" | "red" | "orange" | "blue";

const flowerPatch = <const Shade extends Bloom>(bloom: Shade) =>
  prefab(`flower-patch-${bloom}`, {
    label: { glyph: "*", noun: "flower patch", plural: "flower patches" },
    layer: "cover",
    model: {
      parts: [
        {
          name: "leaves",
          shade: "leaf",
          forms: [
            {
              solid: { ball: [0.3, 0] },
              at: [0, 0.06, 0],
              scale: [1, 0.25, 1],
              tone: 0.8,
            },
          ],
        },
        {
          name: "stems",
          shade: "leaf",
          forms: Arr.map(FLOWERS, ({ stem, x, z }) => ({
            solid: { cylinder: [0.012, 0.016, stem, 4] },
            at: [x, stem / 2, z],
          })),
        },
        {
          name: "blooms",
          shade: bloom,
          forms: Arr.map(FLOWERS, ({ stem, x, z }) => ({
            solid: { ball: [0.07, 0] },
            at: [x, stem + 0.02, z],
            scale: [1, 0.6, 1],
          })),
        },
        {
          name: "centers",
          shade: "yellow",
          forms: Arr.map(FLOWERS, ({ stem, x, z }) => ({
            solid: { ball: [0.025, 0] },
            at: [x, stem + 0.055, z],
          })),
        },
      ],
      pose: "nature",
    },
  });

/** A flower patch for each bloom color, each its own prefab. */
export const FlowerPatches = {
  pink: flowerPatch("pink"),
  yellow: flowerPatch("yellow"),
  white: flowerPatch("white"),
  purple: flowerPatch("purple"),
  red: flowerPatch("red"),
  orange: flowerPatch("orange"),
  blue: flowerPatch("blue"),
};
