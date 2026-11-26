import * as Arr from "effect/Array";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";

import * as Cell from "./Cell.ts";

/** No region may cover more cells than this. */
export const MAX_AREA = 65_536;

/** The largest disc radius whose area stays under {@link MAX_AREA}. */
export const DISC_MAX_RADIUS = 144;

const sideOf = (a: number, b: number) => Math.abs(a - b) + 1;

/** An inclusive rectangle between two corners given in any order. */
export const Rect = Schema.TaggedStruct("Rect", {
  from: Cell.Cell,
  to: Cell.Cell,
}).check(
  Schema.makeFilter(
    ({ from, to }) =>
      sideOf(from.x, to.x) * sideOf(from.y, to.y) <= MAX_AREA ||
      `a rectangle may cover at most ${MAX_AREA} cells`
  )
);

/** The cells within `radius` steps of `center`, by straight-line distance. */
export const Disc = Schema.TaggedStruct("Disc", {
  center: Cell.Cell,
  radius: Schema.Int.check(
    Schema.isBetween({ maximum: DISC_MAX_RADIUS, minimum: 0 })
  ),
});

const Cells = Schema.TaggedStruct("Cells", {
  cells: Schema.NonEmptyArray(Cell.Cell).check(Schema.isMaxLength(MAX_AREA)),
});

export const Region = Schema.Union([Rect, Disc, Cells])
  .annotate({
    description: `A region of at most ${MAX_AREA} cells: a rectangle between two corners, {"_tag":"Rect","from":{"x":0,"y":0},"to":{"x":9,"y":9}}; a disc, {"_tag":"Disc","center":{"x":5,"y":5},"radius":3}, of radius 0 to ${DISC_MAX_RADIUS}; or a list, {"_tag":"Cells","cells":[{"x":1,"y":2}]}.`,
  })
  .pipe(Schema.toTaggedUnion("_tag"));

const clamped = (value: number) =>
  Cell.Coordinate.make(Math.max(-Cell.LIMIT, Math.min(Cell.LIMIT, value)));

const corner = (x: number, y: number) =>
  ({ x: clamped(x), y: clamped(y) }) satisfies typeof Cell.Cell.Type;

/**
 * The rectangle between two opposite corners given in any order, as its
 * north-west corner `from` and its south-east corner `to`.
 */
export const rect = (a: typeof Cell.Cell.Type, b: typeof Cell.Cell.Type) =>
  ({
    _tag: "Rect",
    from: corner(Math.min(a.x, b.x), Math.min(a.y, b.y)),
    to: corner(Math.max(a.x, b.x), Math.max(a.y, b.y)),
  }) satisfies typeof Rect.Type;

/**
 * The rectangle of `width` × `height` cells from its north-west corner,
 * clamped to the coordinate range.
 */
export const sized = (
  northWest: typeof Cell.Cell.Type,
  width: number,
  height: number
) => rect(northWest, corner(northWest.x + width - 1, northWest.y + height - 1));

export const width = ({ from, to }: typeof Rect.Type) => sideOf(from.x, to.x);

export const height = ({ from, to }: typeof Rect.Type) => sideOf(from.y, to.y);

/** The smallest rectangle holding every cell, if there are any. */
export const bounding = (given: Iterable<typeof Cell.Cell.Type>) =>
  Arr.reduce(
    Arr.fromIterable(given),
    Option.none<typeof Rect.Type>(),
    (sofar, cell) =>
      Option.some(
        Option.match(sofar, {
          onNone: () => rect(cell, cell),
          onSome: ({ from, to }) =>
            rect(
              corner(Math.min(from.x, cell.x), Math.min(from.y, cell.y)),
              corner(Math.max(to.x, cell.x), Math.max(to.y, cell.y))
            ),
        })
      )
  );

/**
 * The rectangle grown by `by` cells on every side, clamped to the coordinate
 * range.
 */
export const padded = (given: typeof Rect.Type, by: number) => {
  const { from, to } = rect(given.from, given.to);

  return rect(corner(from.x - by, from.y - by), corner(to.x + by, to.y + by));
};

/** The rectangle cut to at most `side` × `side` cells from its north-west corner. */
export const cut = (given: typeof Rect.Type, side: number) => {
  const whole = rect(given.from, given.to);

  return sized(
    whole.from,
    Math.min(width(whole), side),
    Math.min(height(whole), side)
  );
};

/** Whether two rectangles cover the same cells. */
export const same = (a: typeof Rect.Type, b: typeof Rect.Type) => {
  const first = rect(a.from, a.to);
  const second = rect(b.from, b.to);

  return Cell.same(first.from, second.from) && Cell.same(first.to, second.to);
};

const rectCells = (given: typeof Rect.Type) => {
  const { from, to } = rect(given.from, given.to);

  return Arr.flatMap(Arr.range(from.y, to.y), (y) =>
    Arr.map(Arr.range(from.x, to.x), (x) => corner(x, y))
  );
};

const discCells = ({ center, radius }: typeof Disc.Type) =>
  Arr.filter(
    rectCells(padded(rect(center, center), radius)),
    (cell) => (cell.x - center.x) ** 2 + (cell.y - center.y) ** 2 <= radius ** 2
  );

const distinctCells = (listed: readonly (typeof Cell.Cell.Type)[]) => {
  const seen = new Set<string>();

  return Arr.filter(listed, (cell) => {
    const key = Cell.key(cell);
    const fresh = !seen.has(key);
    seen.add(key);

    return fresh;
  });
};

/** The distinct cells of a region, in a stable order. */
export const cells = (region: typeof Region.Type) => {
  const found: readonly (typeof Cell.Cell.Type)[] = Region.match(region, {
    Cells: (listed) => distinctCells(listed.cells),
    Disc: discCells,
    Rect: rectCells,
  });

  return found;
};
