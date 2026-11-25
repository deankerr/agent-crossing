import * as Arr from "effect/Array";

import { cellAt } from "../schema/cell.ts";
import type { Cell } from "../schema/cell.ts";

/** An inclusive rectangle of cells by its edges. */
export interface Span {
  readonly minX: number;
  readonly maxX: number;
  readonly minY: number;
  readonly maxY: number;
}

export const spanOf = (from: typeof Cell.Type, to: typeof Cell.Type) =>
  ({
    maxX: Math.max(from.x, to.x),
    maxY: Math.max(from.y, to.y),
    minX: Math.min(from.x, to.x),
    minY: Math.min(from.y, to.y),
  }) satisfies Span;

export const spanWidth = (span: Span) => span.maxX - span.minX + 1;

export const spanHeight = (span: Span) => span.maxY - span.minY + 1;

/** Every cell of the span, row by row from the north-west corner. */
export const cellsOfSpan = (span: Span) =>
  Arr.getSomes(
    Arr.flatMap(Arr.range(span.minY, span.maxY), (y) =>
      Arr.map(Arr.range(span.minX, span.maxX), (x) => cellAt(x, y))
    )
  );
