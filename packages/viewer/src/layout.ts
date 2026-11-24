import type { Cell } from "@agent-crossing/world/cell";
import { traitsOf } from "@agent-crossing/world/ground";
import type { Ground } from "@agent-crossing/world/ground";
import type { Span } from "@agent-crossing/world/region";

/**
 * Scene units: one cell is one unit, cell `x` sits at scene `x` and cell `y`
 * at scene `z`, so south is towards the camera. Heights step by
 * {@link LEVEL_HEIGHT}.
 */
export const LEVEL_HEIGHT = 0.4;

/** The top of dry ground at height 0. */
export const GROUND_BASE = 0.3;

/** How far a water surface sits below dry ground of the same height. */
export const WATER_DROP = 0.18;

/** Where every column of ground starts. */
export const COLUMN_BOTTOM = -1.2;

/** The coloured top layer of dry ground; the rest of the column is its side. */
export const CAP_THICKNESS = 0.12;

export const landSurface = (height: number) =>
  GROUND_BASE + height * LEVEL_HEIGHT;

/** Where things stand on the ground: the water surface for wet ground. */
export const surfaceOf = (ground: Ground) =>
  traitsOf(ground.kind).wet
    ? landSurface(ground.height) - WATER_DROP
    : landSurface(ground.height);

export const sceneX = (cell: Cell) => cell.x;
export const sceneZ = (cell: Cell) => cell.y;

/** The centre of a span on the ground plane, as scene `x` and `z`. */
export const centreOf = (span: Span) =>
  ({
    x: (span.minX + span.maxX) / 2,
    z: (span.minY + span.maxY) / 2,
  }) as const;

/** The diagonal of a span in cells, at least one. */
export const diagonalOf = (span: Span) =>
  Math.hypot(span.maxX - span.minX + 1, span.maxY - span.minY + 1);
