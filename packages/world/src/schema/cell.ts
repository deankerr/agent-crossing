import * as Option from "effect/Option";
import * as Schema from "effect/Schema";

export const MIN_LEVEL = -2;
export const MAX_LEVEL = 7;

/**
 * The vertical step of a position. Generated land uses 0 to 7; levels below
 * 0 are for the beds of ponds.
 */
export const Level = Schema.Int.check(
  Schema.isBetween({ maximum: MAX_LEVEL, minimum: MIN_LEVEL })
);

/** Coordinates are bounded so that garbage is parsed out; the world itself has no fixed size. */
export const COORDINATE_LIMIT = 4096;

export const Coordinate = Schema.Int.check(
  Schema.isBetween({ maximum: COORDINATE_LIMIT, minimum: -COORDINATE_LIMIT })
).pipe(Schema.brand("Coordinate"));

/** A square of the grid. `x` grows east, `y` grows south. */
export const Cell = Schema.Struct({ x: Coordinate, y: Coordinate });

export const CellKey = Schema.String.pipe(Schema.brand("CellKey"));

const isCoordinate = Schema.is(Coordinate);

/** The cell at `x`, `y`, or none when either coordinate is out of range. */
export const cellAt = (x: number, y: number) =>
  isCoordinate(x) && isCoordinate(y)
    ? Option.some<typeof Cell.Type>({ x, y })
    : Option.none<typeof Cell.Type>();

export const cellKey = (cell: typeof Cell.Type) =>
  CellKey.make(`${cell.x},${cell.y}`);

export const sameCell = (a: typeof Cell.Type, b: typeof Cell.Type) =>
  a.x === b.x && a.y === b.y;

export const formatCell = (cell: typeof Cell.Type) => `${cell.x},${cell.y}`;
