import { Change } from "@agent-crossing/world/engine/state/change";
import type { EntityId } from "@agent-crossing/world/engine/state/entity";
import { spanHeight, spanWidth } from "@agent-crossing/world/engine/state/span";
import type { Span } from "@agent-crossing/world/engine/state/span";
import { entityOf } from "@agent-crossing/world/engine/state/world";
import type { World } from "@agent-crossing/world/engine/state/world";
import {
  Cell,
  Coordinate,
  COORDINATE_LIMIT,
} from "@agent-crossing/world/schema/cell";
import * as Arr from "effect/Array";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";

/** An inclusive rectangle of cells, as it crosses the wire. */
export const Area = Schema.Struct({ from: Cell, to: Cell });

const oldCell = (world: World, id: typeof EntityId.Type) =>
  Arr.fromOption(Option.map(entityOf(world, id), (entity) => entity.cell));

/** The cells a change touches, given the world it applies to: where entities were and where they are now. */
export const touchedBy = (world: World, change: typeof Change.Type) => {
  const cells: readonly (typeof Cell.Type)[] = Change.match(change, {
    EntityDropped: ({ id }) => oldCell(world, id),
    EntityPut: ({ entity }) => [entity.cell, ...oldCell(world, entity.id)],
    SpawnCounted: () => [],
  });

  return cells;
};

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

/** Cells of margin drawn around an edit. */
export const EDIT_MAP_PADDING = 2;

/** The largest side of the map shown after an edit. */
export const EDIT_MAP_MAX_SIDE = 48;

export interface Framed {
  readonly area: typeof Area.Type;
  /** Whether the edit reached beyond the area shown. */
  readonly cut: boolean;
  readonly edited: Span;
}

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

/**
 * The area to show after an edit: its span padded by a margin, cut down from
 * the north-west corner to at most 48 × 48 cells.
 */
export const framedEdit = (edited: Span) => {
  const padded: Span = {
    maxX: edited.maxX + EDIT_MAP_PADDING,
    maxY: edited.maxY + EDIT_MAP_PADDING,
    minX: edited.minX - EDIT_MAP_PADDING,
    minY: edited.minY - EDIT_MAP_PADDING,
  };

  const cut =
    spanWidth(padded) > EDIT_MAP_MAX_SIDE ||
    spanHeight(padded) > EDIT_MAP_MAX_SIDE;

  const maxX = Math.min(padded.maxX, padded.minX + EDIT_MAP_MAX_SIDE - 1);
  const maxY = Math.min(padded.maxY, padded.minY + EDIT_MAP_MAX_SIDE - 1);

  const framed: Framed = {
    area: {
      from: corner(padded.minX, padded.minY),
      to: corner(maxX, maxY),
    },
    cut,
    edited,
  };

  return framed;
};
