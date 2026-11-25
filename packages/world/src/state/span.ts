import * as Arr from "effect/Array";
import * as Option from "effect/Option";

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

const spanOfCell = (cell: typeof Cell.Type) =>
  ({ maxX: cell.x, maxY: cell.y, minX: cell.x, minY: cell.y }) satisfies Span;

const union = (a: Span, b: Span) =>
  ({
    maxX: Math.max(a.maxX, b.maxX),
    maxY: Math.max(a.maxY, b.maxY),
    minX: Math.min(a.minX, b.minX),
    minY: Math.min(a.minY, b.minY),
  }) satisfies Span;

/** The smallest span holding every cell, if there are any. */
export const spanOfCells = (cells: Iterable<typeof Cell.Type>) =>
  Arr.reduce(Arr.fromIterable(cells), Option.none<Span>(), (sofar, cell) =>
    Option.some(
      Option.match(sofar, {
        onNone: () => spanOfCell(cell),
        onSome: (span) => union(span, spanOfCell(cell)),
      })
    )
  );

export const widen = (a: Option.Option<Span>, b: Option.Option<Span>) =>
  Option.match(a, {
    onNone: () => b,
    onSome: (left) =>
      Option.some(
        Option.match(b, {
          onNone: () => left,
          onSome: (right) => union(left, right),
        })
      ),
  });
