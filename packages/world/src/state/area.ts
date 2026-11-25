import * as Schema from "effect/Schema";

import { Cell, Coordinate, COORDINATE_LIMIT } from "../schema/cell.ts";
import type { Span } from "./span.ts";

/** An inclusive rectangle of cells, as it crosses the wire. */
export const Area = Schema.Struct({ from: Cell, to: Cell });

const clamped = (value: number) =>
  Coordinate.make(
    Math.max(-COORDINATE_LIMIT, Math.min(COORDINATE_LIMIT, value))
  );

const corner = (x: number, y: number) =>
  ({ x: clamped(x), y: clamped(y) }) satisfies typeof Cell.Type;

/** The span as an area, clamped to the coordinate range. */
export const areaOfSpan = (span: Span) =>
  ({
    from: corner(span.minX, span.minY),
    to: corner(span.maxX, span.maxY),
  }) satisfies typeof Area.Type;
