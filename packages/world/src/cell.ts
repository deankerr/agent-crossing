import * as Arr from "effect/Array";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";

/** Coordinates are bounded so that garbage is parsed out; the world itself has no fixed size. */
export const COORDINATE_LIMIT = 4096;

export const Coordinate = Schema.Int.check(
  Schema.isBetween({ maximum: COORDINATE_LIMIT, minimum: -COORDINATE_LIMIT })
).pipe(Schema.brand("Coordinate"));

export type Coordinate = typeof Coordinate.Type;

/** A square of the grid. `x` grows east, `y` grows south. */
export const Cell = Schema.Struct({ x: Coordinate, y: Coordinate });

export type Cell = typeof Cell.Type;

export const CellKey = Schema.String.pipe(Schema.brand("CellKey"));

export type CellKey = typeof CellKey.Type;

const isCoordinate = Schema.is(Coordinate);

/** The cell at `x`, `y`, or none when either coordinate is out of range. */
export const cellAt = (x: number, y: number) =>
  isCoordinate(x) && isCoordinate(y)
    ? Option.some<Cell>({ x, y })
    : Option.none<Cell>();

export const cellKey = (cell: Cell) => CellKey.make(`${cell.x},${cell.y}`);

export const sameCell = (a: Cell, b: Cell) => a.x === b.x && a.y === b.y;

const STEPS = [
  [0, -1],
  [1, 0],
  [0, 1],
  [-1, 0],
] as const;

/** The four cells sharing an edge with `cell`: north, east, south, west. */
export const neighbours = (cell: Cell) =>
  Arr.getSomes(Arr.map(STEPS, ([dx, dy]) => cellAt(cell.x + dx, cell.y + dy)));

export const chebyshevDistance = (a: Cell, b: Cell) =>
  Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));

export const formatCell = (cell: Cell) => `${cell.x},${cell.y}`;
