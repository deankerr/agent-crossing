import * as Arr from "effect/Array";
import * as Schema from "effect/Schema";

import { Cell, cellKey } from "../schema/cell.ts";
import { cellsOfSpan, spanHeight, spanOf, spanWidth } from "../state/span.ts";
import type { Span } from "../state/span.ts";

/** No region may cover more cells than this. */
export const REGION_MAX_AREA = 65_536;

/** The largest disc radius whose area stays under {@link REGION_MAX_AREA}. */
export const DISC_MAX_RADIUS = 144;

const spanArea = (span: Span) => spanWidth(span) * spanHeight(span);

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

/** The cells within `radius` steps of `center`, by straight-line distance. */
export const Disc = Schema.TaggedStruct("Disc", {
  center: Cell,
  radius: Schema.Int.check(
    Schema.isBetween({ maximum: DISC_MAX_RADIUS, minimum: 0 })
  ),
});

const Cells = Schema.TaggedStruct("Cells", {
  cells: Schema.NonEmptyArray(Cell).check(Schema.isMaxLength(REGION_MAX_AREA)),
});

export const Region = Schema.Union([Rect, Disc, Cells]).pipe(
  Schema.toTaggedUnion("_tag")
);

const discCells = ({ center, radius }: typeof Disc.Type) =>
  Arr.filter(
    cellsOfSpan({
      maxX: center.x + radius,
      maxY: center.y + radius,
      minX: center.x - radius,
      minY: center.y - radius,
    }),
    (cell) => (cell.x - center.x) ** 2 + (cell.y - center.y) ** 2 <= radius ** 2
  );

const distinctCells = (cells: readonly (typeof Cell.Type)[]) => {
  const seen = new Set<string>();

  return Arr.filter(cells, (cell) => {
    const key = cellKey(cell);
    const fresh = !seen.has(key);
    seen.add(key);

    return fresh;
  });
};

/** The distinct cells of a region, in a stable order. */
export const cellsOf = (region: typeof Region.Type) => {
  const cells: readonly (typeof Cell.Type)[] = Region.match(region, {
    Cells: (listed) => distinctCells(listed.cells),
    Disc: discCells,
    Rect: ({ from, to }) => cellsOfSpan(spanOf(from, to)),
  });

  return cells;
};
