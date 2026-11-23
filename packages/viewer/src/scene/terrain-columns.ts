import { allTiles } from "@agent-crossing/world/grid";
import type { Tile } from "@agent-crossing/world/grid";
import { groundAt } from "@agent-crossing/world/terrain";
import * as Arr from "effect/Array";

import {
  COLUMN_BOTTOM,
  landSurface,
  sceneX,
  sceneZ,
  WATER_SURFACE,
} from "../layout.ts";

export const GRASS_THICKNESS = 0.14;

export interface Column {
  readonly x: number;
  readonly z: number;
  readonly bottom: number;
  readonly top: number;
  readonly colour: string;
}

const grassByLevel = ["#8fd16b", "#9ad874", "#a6de80", "#b2e48d"] as const;
const grassChecker = ["#89ca66", "#94d16f", "#9fd77a", "#abdd87"] as const;
const soilByLevel = ["#c9a27b", "#c29a72", "#ba926b", "#b38a64"] as const;
const WATER = "#7ccfe9";

const isEven = (tile: Tile) => (tile.x + tile.y) % 2 === 0;

const column = (tile: Tile, bottom: number, top: number, colour: string) =>
  ({
    bottom,
    colour,
    top,
    x: sceneX(tile.x),
    z: sceneZ(tile.y),
  }) satisfies Column;

const landTiles = Arr.flatMap(allTiles, (tile) => {
  const ground = groundAt(tile);

  return ground._tag === "Land" ? [{ level: ground.height, tile }] : [];
});

export const soilColumns: readonly Column[] = Arr.map(
  landTiles,
  ({ level, tile }) =>
    column(
      tile,
      COLUMN_BOTTOM,
      landSurface(level) - GRASS_THICKNESS,
      soilByLevel[level] ?? soilByLevel[0]
    )
);

export const grassColumns: readonly Column[] = Arr.map(
  landTiles,
  ({ level, tile }) =>
    column(
      tile,
      landSurface(level) - GRASS_THICKNESS,
      landSurface(level),
      (isEven(tile) ? grassByLevel : grassChecker)[level] ?? grassByLevel[0]
    )
);

export const waterColumns: readonly Column[] = Arr.map(
  Arr.filter(allTiles, (tile) => groundAt(tile)._tag === "Water"),
  (tile) => column(tile, COLUMN_BOTTOM, WATER_SURFACE, WATER)
);
