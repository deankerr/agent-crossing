import { groundKinds } from "@agent-crossing/world/ground";
import { allTiles } from "@agent-crossing/world/world";
import { describe, expect, it } from "@effect/vitest";
import * as Arr from "effect/Array";
import * as Option from "effect/Option";
import * as Order from "effect/Order";
import * as Record from "effect/Record";

import {
  CAP_THICKNESS,
  COLUMN_BOTTOM,
  landSurface,
  WATER_DROP,
} from "../src/layout.ts";
import { groundStyles } from "../src/palette.ts";
import { cellShade, terrainColumns } from "../src/terrain-columns.ts";
import type { Column } from "../src/terrain-columns.ts";
import { cell, paintCells, paintRect, runAll } from "./world.fixture.ts";

const sparse = runAll([
  paintCells([cell(-40, -3), cell(-39, -3), cell(5, 17)], "meadow", 2),
  paintCells([cell(0, 0)], "stone", 7),
  paintCells([cell(-1, 0), cell(-2, 0)], "water", 0),
]);

const atOrigin = (column: Column) => column.cell.x === 0;

describe(terrainColumns, () => {
  const columns = terrainColumns(allTiles(sparse));

  it("draws one side and one cap per dry cell and one column per wet cell", () => {
    expect(columns.sides).toHaveLength(4);
    expect(columns.caps).toHaveLength(4);
    expect(columns.water).toHaveLength(2);
  });

  it("places each column on its own cell, holes and negatives included", () => {
    expect(
      Arr.sort(
        Arr.map(columns.caps, (column) => `${column.cell.x},${column.cell.y}`),
        Order.String
      )
    ).toStrictEqual(["-39,-3", "-40,-3", "0,0", "5,17"]);
  });

  it("stacks the cap on the side up to the cell's height", () => {
    const stone = Option.getOrThrow(Arr.findFirst(columns.caps, atOrigin));
    const side = Option.getOrThrow(Arr.findFirst(columns.sides, atOrigin));

    expect(stone.top).toBeCloseTo(landSurface(7));
    expect(stone.bottom).toBeCloseTo(landSurface(7) - CAP_THICKNESS);
    expect(side.top).toBeCloseTo(landSurface(7) - CAP_THICKNESS);
    expect(side.bottom).toBe(COLUMN_BOTTOM);
  });

  it("keeps water below dry ground of the same height", () => {
    for (const column of columns.water) {
      expect(column.top).toBeCloseTo(landSurface(0) - WATER_DROP);
      expect(column.top).toBeGreaterThan(COLUMN_BOTTOM);
    }
  });

  it("is empty for the empty world", () => {
    expect(terrainColumns([])).toStrictEqual({
      caps: [],
      sides: [],
      water: [],
    });
  });

  it("derives the same colours from the same cells", () => {
    expect(terrainColumns(allTiles(sparse))).toStrictEqual(columns);
  });
});

describe(cellShade, () => {
  it("stays near one and depends only on the cell", () => {
    const shades = Arr.flatMap(Arr.range(-20, 20), (x) =>
      Arr.map(Arr.range(-20, 20), (y) => cellShade(cell(x, y), 0.1))
    );

    expect(Math.min(...shades)).toBeGreaterThan(0.8);
    expect(Math.max(...shades)).toBeLessThan(1.2);
    expect(new Set(shades).size).toBeGreaterThan(100);
    expect(cellShade(cell(3, -4), 0.1)).toBe(cellShade(cell(3, -4), 0.1));
  });
});

describe("the ground styles", () => {
  it("styles every kind of ground", () => {
    expect(Arr.sort(Record.keys(groundStyles), Order.String)).toStrictEqual(
      Arr.sort(groundKinds, Order.String)
    );
  });
});

describe("a generated world", () => {
  it("draws every cell", () => {
    const world = runAll([paintRect(cell(-3, -3), cell(3, 3), "grass", 1)]);
    const columns = terrainColumns(allTiles(world));

    expect(columns.caps.length + columns.water.length).toBe(49);
  });
});
