import * as Arr from "effect/Array";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";

import * as Cell from "./Cell.ts";

/** An inclusive rectangle of cells by its edges. */
export interface Span {
  readonly minX: number;
  readonly maxX: number;
  readonly minY: number;
  readonly maxY: number;
}

export const of = (from: typeof Cell.Cell.Type, to: typeof Cell.Cell.Type) =>
  ({
    maxX: Math.max(from.x, to.x),
    maxY: Math.max(from.y, to.y),
    minX: Math.min(from.x, to.x),
    minY: Math.min(from.y, to.y),
  }) satisfies Span;

export const width = (span: Span) => span.maxX - span.minX + 1;

export const height = (span: Span) => span.maxY - span.minY + 1;

/** Every cell of the span, row by row from the north-west corner. */
export const cells = (span: Span) =>
  Arr.getSomes(
    Arr.flatMap(Arr.range(span.minY, span.maxY), (y) =>
      Arr.map(Arr.range(span.minX, span.maxX), (x) => Cell.at(x, y))
    )
  );

const spanOfCell = (cell: typeof Cell.Cell.Type) =>
  ({ maxX: cell.x, maxY: cell.y, minX: cell.x, minY: cell.y }) satisfies Span;

const union = (a: Span, b: Span) =>
  ({
    maxX: Math.max(a.maxX, b.maxX),
    maxY: Math.max(a.maxY, b.maxY),
    minX: Math.min(a.minX, b.minX),
    minY: Math.min(a.minY, b.minY),
  }) satisfies Span;

/** The smallest span holding every cell, if there are any. */
export const ofCells = (given: Iterable<typeof Cell.Cell.Type>) =>
  Arr.reduce(Arr.fromIterable(given), Option.none<Span>(), (sofar, cell) =>
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

/** An inclusive rectangle of cells, as it crosses the wire. */
export const Area = Schema.Struct({ from: Cell.Cell, to: Cell.Cell });

const clamped = (value: number) =>
  Cell.Coordinate.make(Math.max(-Cell.LIMIT, Math.min(Cell.LIMIT, value)));

const corner = (x: number, y: number) =>
  ({ x: clamped(x), y: clamped(y) }) satisfies typeof Cell.Cell.Type;

/** The span as an area, clamped to the coordinate range. */
export const toArea = (span: Span) =>
  ({
    from: corner(span.minX, span.minY),
    to: corner(span.maxX, span.maxY),
  }) satisfies typeof Area.Type;
