import * as Arr from "effect/Array";
import * as Schema from "effect/Schema";

import { Cell, cellAt, cellKey } from "./cell.ts";

/** No region may cover more cells than this. */
export const REGION_MAX_AREA = 65_536;

/** The largest disc radius whose area stays under {@link REGION_MAX_AREA}. */
export const DISC_MAX_RADIUS = 144;

export interface Span {
  readonly minX: number;
  readonly maxX: number;
  readonly minY: number;
  readonly maxY: number;
}

export const spanOf = (from: Cell, to: Cell) =>
  ({
    maxX: Math.max(from.x, to.x),
    maxY: Math.max(from.y, to.y),
    minX: Math.min(from.x, to.x),
    minY: Math.min(from.y, to.y),
  }) satisfies Span;

export const spanWidth = (span: Span) => span.maxX - span.minX + 1;

export const spanHeight = (span: Span) => span.maxY - span.minY + 1;

const spanArea = (span: Span) => spanWidth(span) * spanHeight(span);

/** Every cell of the span, row by row from the north-west corner. */
export const cellsOfSpan = (span: Span) =>
  Arr.getSomes(
    Arr.flatMap(Arr.range(span.minY, span.maxY), (y) =>
      Arr.map(Arr.range(span.minX, span.maxX), (x) => cellAt(x, y))
    )
  );

/** An inclusive rectangle between two corners given in any order. */
export const Rect = Schema.TaggedStruct("Rect", {
  from: Cell,
  to: Cell,
}).check(
  Schema.makeFilter(
    ({ from, to }) =>
      spanArea(spanOf(from, to)) <= REGION_MAX_AREA ||
      `a rectangle may cover at most ${REGION_MAX_AREA} cells`
  )
);

export type Rect = typeof Rect.Type;

/** The cells within `radius` steps of `centre`, by straight-line distance. */
export const Disc = Schema.TaggedStruct("Disc", {
  centre: Cell,
  radius: Schema.Int.check(
    Schema.isBetween({ maximum: DISC_MAX_RADIUS, minimum: 0 })
  ),
});

export type Disc = typeof Disc.Type;

/** A list of cells; repeats count once. */
export const Cells = Schema.TaggedStruct("Cells", {
  cells: Schema.NonEmptyArray(Cell).check(Schema.isMaxLength(REGION_MAX_AREA)),
});

export type Cells = typeof Cells.Type;

export const Region = Schema.Union([Rect, Disc, Cells]).pipe(
  Schema.toTaggedUnion("_tag")
);

export type Region = typeof Region.Type;

export const rect = (from: Cell, to: Cell) => {
  const region: Region = Rect.make({ from, to });

  return region;
};

const discCells = ({ centre, radius }: Disc) =>
  Arr.filter(
    cellsOfSpan({
      maxX: centre.x + radius,
      maxY: centre.y + radius,
      minX: centre.x - radius,
      minY: centre.y - radius,
    }),
    (cell) => (cell.x - centre.x) ** 2 + (cell.y - centre.y) ** 2 <= radius ** 2
  );

const distinctCells = (cells: readonly Cell[]) => {
  const seen = new Set<string>();

  return Arr.filter(cells, (cell) => {
    const key = cellKey(cell);
    const fresh = !seen.has(key);
    seen.add(key);

    return fresh;
  });
};

/** The distinct cells of a region, in a stable order. */
export const cellsOf = (region: Region) => {
  const cells: readonly Cell[] = Region.match(region, {
    Cells: (listed) => distinctCells(listed.cells),
    Disc: discCells,
    Rect: ({ from, to }) => cellsOfSpan(spanOf(from, to)),
  });

  return cells;
};
