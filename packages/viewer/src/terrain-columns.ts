import type { Cell } from "@agent-crossing/world/cell";
import { traitsOf } from "@agent-crossing/world/ground";
import type { Tile } from "@agent-crossing/world/ground";
import { Color } from "three";

import { cellNoise } from "./hash.ts";
import {
  CAP_THICKNESS,
  COLUMN_BOTTOM,
  landSurface,
  surfaceOf,
} from "./layout.ts";
import { groundStyles } from "./palette.ts";

/** Linear RGB, as instance colours want it. */
export type Rgb = readonly [number, number, number];

/** A box standing on one cell, from `bottom` to `top` in scene units. */
export interface Column {
  readonly cell: Cell;
  readonly bottom: number;
  readonly top: number;
  readonly colour: Rgb;
}

export interface TerrainColumns {
  /** The side of each dry cell's column, below its cap. */
  readonly sides: readonly Column[];
  /** The coloured top layer of each dry cell. */
  readonly caps: readonly Column[];
  /** One column per wet cell, up to its water surface. */
  readonly water: readonly Column[];
}

const CHECKER = 0.025;
const BRIGHTER_PER_LEVEL = 0.025;
const DARKER_SIDE_PER_LEVEL = 0.02;

const scratch = new Color();

const shaded = (hex: string, factor: number) => {
  scratch.set(hex).multiplyScalar(factor);
  const rgb: Rgb = [scratch.r, scratch.g, scratch.b];

  return rgb;
};

/** Each cell's own brightness: noise and a faint checker, from its coordinates alone. */
export const cellShade = (cell: Cell, variation: number) =>
  1 +
  (cellNoise(cell.x, cell.y) * 2 - 1) * variation +
  ((cell.x + cell.y) % 2 === 0 ? CHECKER : -CHECKER) * variation * 4;

/** The boxes that draw the ground, derived from the tiles alone. */
export const terrainColumns = (tiles: Iterable<Tile>) => {
  const sides: Column[] = [];
  const caps: Column[] = [];
  const water: Column[] = [];

  for (const { cell, ground } of tiles) {
    const style = groundStyles[ground.kind];
    const shade = cellShade(cell, style.variation);

    if (traitsOf(ground.kind).wet) {
      water.push({
        bottom: COLUMN_BOTTOM,
        cell,
        colour: shaded(style.top, shade),
        top: surfaceOf(ground),
      });
    } else {
      const top = landSurface(ground.height);

      sides.push({
        bottom: COLUMN_BOTTOM,
        cell,
        colour: shaded(style.side, 1 - ground.height * DARKER_SIDE_PER_LEVEL),
        top: top - CAP_THICKNESS,
      });
      caps.push({
        bottom: top - CAP_THICKNESS,
        cell,
        colour: shaded(
          style.top,
          shade * (1 + ground.height * BRIGHTER_PER_LEVEL)
        ),
        top,
      });
    }
  }

  return { caps, sides, water } satisfies TerrainColumns;
};
