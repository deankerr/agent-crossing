import * as Arr from "effect/Array";
import * as Schema from "effect/Schema";

import * as Cell from "./Cell.ts";
import * as Span from "./Span.ts";

/** No region may cover more cells than this. */
export const MAX_AREA = 65_536;

/** The largest disc radius whose area stays under {@link MAX_AREA}. */
export const DISC_MAX_RADIUS = 144;

const spanArea = (span: Span.Span) => Span.width(span) * Span.height(span);

/** An inclusive rectangle between two corners given in any order. */
export const Rect = Schema.TaggedStruct("Rect", {
  from: Cell.Cell,
  to: Cell.Cell,
}).check(
  Schema.makeFilter(
    ({ from, to }) =>
      spanArea(Span.of(from, to)) <= MAX_AREA ||
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

export const Region = Schema.Union([Rect, Disc, Cells]).pipe(
  Schema.toTaggedUnion("_tag")
);

const discCells = ({ center, radius }: typeof Disc.Type) =>
  Arr.filter(
    Span.cells({
      maxX: center.x + radius,
      maxY: center.y + radius,
      minX: center.x - radius,
      minY: center.y - radius,
    }),
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
    Rect: ({ from, to }) => Span.cells(Span.of(from, to)),
  });

  return found;
};
