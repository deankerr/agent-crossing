import * as Option from "effect/Option";
import * as Schema from "effect/Schema";

/** Coordinates are bounded so that garbage is parsed out; the world itself has no fixed size. */
export const LIMIT = 4096;

export const Coordinate = Schema.Int.check(
  Schema.isBetween({ maximum: LIMIT, minimum: -LIMIT })
).pipe(Schema.brand("Coordinate"));

/** A square of the grid. `x` grows east, `y` grows south. */
export const Cell = Schema.Struct({ x: Coordinate, y: Coordinate }).annotate({
  description: `A cell, like {"x":1,"y":2}: x grows east and y grows south, each from -${LIMIT} to ${LIMIT}.`,
});

export const Key = Schema.String.pipe(Schema.brand("CellKey"));

const isCoordinate = Schema.is(Coordinate);

/** The cell at `x`, `y`, or none when either coordinate is out of range. */
export const at = (x: number, y: number) =>
  isCoordinate(x) && isCoordinate(y)
    ? Option.some<typeof Cell.Type>({ x, y })
    : Option.none<typeof Cell.Type>();

export const key = (cell: typeof Cell.Type) => Key.make(`${cell.x},${cell.y}`);

export const same = (a: typeof Cell.Type, b: typeof Cell.Type) =>
  a.x === b.x && a.y === b.y;

export const format = (cell: typeof Cell.Type) => `${cell.x},${cell.y}`;
