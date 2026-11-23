import { MAP_SIZE } from "@agent-crossing/world/grid";
import type { Tile } from "@agent-crossing/world/grid";
import { heightAt } from "@agent-crossing/world/terrain";
import * as Option from "effect/Option";

export const LEVEL_HEIGHT = 0.75;
export const LAND_SURFACE = 0.45;
export const WATER_SURFACE = 0.22;
export const COLUMN_BOTTOM = -1.2;

export const sceneX = (x: number) => x - (MAP_SIZE - 1) / 2;
export const sceneZ = (y: number) => y - (MAP_SIZE - 1) / 2;

export const landSurface = (level: number) =>
  LAND_SURFACE + level * LEVEL_HEIGHT;

export const levelAt = (tile: Tile) =>
  Option.getOrElse(heightAt(tile), () => 0);

export const surfaceAt = (tile: Tile) =>
  Option.match(heightAt(tile), {
    onNone: () => WATER_SURFACE,
    onSome: landSurface,
  });
