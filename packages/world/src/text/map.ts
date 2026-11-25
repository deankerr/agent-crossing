import * as Arr from "effect/Array";
import * as Option from "effect/Option";
import * as Order from "effect/Order";
import * as Str from "effect/String";

import { prefabs } from "../definitions/prefabs/index.ts";
import type { Rect } from "../editing/region.ts";
import { cellAt, sameCell } from "../schema/cell.ts";
import type { Cell } from "../schema/cell.ts";
import type { Layer } from "../schema/components.ts";
import type { Area } from "../state/area.ts";
import { componentsOf, labelOf, storedLevel } from "../state/entity.ts";
import type { Entity } from "../state/entity.ts";
import { spanOf } from "../state/span.ts";
import type { Span } from "../state/span.ts";
import { bounds, entitiesAt, floorAt, liquidAt } from "../state/world.ts";
import type { World } from "../state/world.ts";
import { listed, spanText } from "./words.ts";

/** Maps wider or taller than this are cut down, and the text says so. */
export const MAP_MAX_SIDE = 128;

const BLANK = " ";

const DRAWN_ORDER: readonly (typeof Layer.Type | undefined)[] = [
  "object",
  "cover",
  undefined,
  "liquid",
  "floor",
];

const shown = (entities: readonly (typeof Entity.Type)[]) =>
  Arr.findFirst(DRAWN_ORDER, (layer) =>
    Arr.findFirst(entities, (entity) => {
      const components = componentsOf(entity);

      return components.layer === layer && components.label !== undefined;
    })
  );

interface Drawn {
  readonly glyph: string;
  readonly noun: string;
}

const drawnAt = (world: World, cell: typeof Cell.Type) =>
  Option.map(floorAt(world, cell), (floor) =>
    Option.match(shown(entitiesAt(world, cell)), {
      onNone: () => labelOf(floor),
      onSome: labelOf,
    })
  );

const levelAt = (world: World, cell: typeof Cell.Type) =>
  Option.match(floorAt(world, cell), {
    onNone: () => BLANK,
    onSome: (floor) => {
      if (Option.isSome(liquidAt(world, cell))) {
        return "~";
      }

      const level = storedLevel(floor);

      return level < 0 ? "_" : `${level}`;
    },
  });

const placeLabel = (row: string[], column: number, label: string) => {
  const free = Arr.every(
    Arr.range(column - 1, column + label.length),
    (at) => (row[at] ?? BLANK) === BLANK
  );

  if (free && column + label.length <= row.length) {
    Arr.forEach(Arr.fromIterable(label), (character, offset) => {
      row[column + offset] = character;
    });
  }
};

const columnHeaders = (span: Span, margin: string) => {
  const xs = Arr.range(span.minX, span.maxX);
  const labels = Arr.makeBy(xs.length, () => BLANK);

  Arr.forEach(xs, (x, column) => {
    if (x % 10 === 0) {
      placeLabel(labels, column, `${x}`);
    }
  });
  placeLabel(labels, 0, `${span.minX}`);

  return [
    Str.trimEnd(`${margin}${Arr.join(labels, "")}`),
    `${margin}${Arr.join(
      Arr.map(xs, (x) => `${Math.abs(x) % 10}`),
      ""
    )}`,
  ];
};

const grid = (span: Span, characterAt: (cell: typeof Cell.Type) => string) => {
  const width = Math.max(`${span.minY}`.length, `${span.maxY}`.length);
  const margin = Str.repeat(width + 1)(BLANK);

  const rows = Arr.map(Arr.range(span.minY, span.maxY), (y) => {
    const line = Arr.join(
      Arr.map(Arr.range(span.minX, span.maxX), (x) =>
        Option.match(cellAt(x, y), {
          onNone: () => BLANK,
          onSome: characterAt,
        })
      ),
      ""
    );

    return Str.trimEnd(`${Str.padStart(width, BLANK)(`${y}`)} ${line}`);
  });

  return [...columnHeaders(span, margin), ...rows];
};

const terrainGlyphs: readonly string[] = Arr.flatMap(prefabs, (prefab) => {
  const { label, layer } = prefab.components;

  return label !== undefined && (layer === "floor" || layer === "liquid")
    ? [label.glyph]
    : [];
});

const legendOf = (drawn: readonly Drawn[]) => {
  const nouns = new Map<string, string>();

  for (const { glyph, noun } of drawn) {
    if (!nouns.has(glyph)) {
      nouns.set(glyph, noun);
    }
  }

  const order = Order.mapInput(
    Order.Number,
    ([glyph]: readonly [string, string]) => {
      const position = terrainGlyphs.indexOf(glyph);

      return position === -1 ? terrainGlyphs.length : position;
    }
  );

  return `Legend: ${listed(
    Arr.map(
      Arr.sort(Arr.fromIterable(nouns), order),
      ([glyph, noun]) => `${glyph} ${noun}`
    )
  )}`;
};

/**
 * The glyph map of the span, the level map of the same cells and a legend of
 * the glyphs that appear, with `@` drawn at `you` when given.
 */
export const renderMap = (
  world: World,
  span: Span,
  you: Option.Option<typeof Cell.Type>
) => {
  const drawn: Drawn[] = [];

  const glyphs = grid(span, (cell) => {
    if (Option.exists(you, (at) => sameCell(at, cell))) {
      drawn.push({ glyph: "@", noun: "you" });

      return "@";
    }

    return Option.match(drawnAt(world, cell), {
      onNone: () => BLANK,
      onSome: (seen) => {
        drawn.push(seen);

        return seen.glyph;
      },
    });
  });

  const levels = grid(span, (cell) => levelAt(world, cell));

  return [
    ...glyphs,
    "",
    "Levels (0 low to 7 high, _ below 0, ~ water):",
    ...levels,
    "",
    legendOf(drawn),
  ];
};

/** How to read a map, told before each one. */
export const AXES =
  "x grows east (right) and y grows south (down). The first header row labels x every 10 columns, the second gives the last digit of each column's x, and each row starts with its y. One character per cell; blank cells are outside the world.";

const clamped = (span: Span) =>
  ({
    maxX: Math.min(span.maxX, span.minX + MAP_MAX_SIDE - 1),
    maxY: Math.min(span.maxY, span.minY + MAP_MAX_SIDE - 1),
    minX: span.minX,
    minY: span.minY,
  }) satisfies Span;

/**
 * A character map of the rectangle, a level map of the same cells and a
 * legend of the glyphs that appear. Larger than 128 × 128 is cut down from
 * the north-west corner, and the text says so.
 */
export const mapText = (
  world: World,
  rect: Pick<typeof Rect.Type, "from" | "to">
) => {
  const asked = spanOf(rect.from, rect.to);
  const span = clamped(asked);

  const cut =
    span.maxX === asked.maxX && span.maxY === asked.maxY
      ? []
      : [
          `The request covered ${spanText(asked)}; maps are at most ${MAP_MAX_SIDE} × ${MAP_MAX_SIDE} cells, so this shows ${spanText(span)}.`,
        ];

  return Arr.join(
    [
      `Map of ${spanText(span)}. ${AXES}`,
      ...cut,
      ...renderMap(world, span, Option.none()),
    ],
    "\n"
  );
};

/**
 * A map of the area, or of the whole world when none is given; none when
 * no area is given and no cell has a floor.
 */
export const mapIfAny = (world: World, area: Option.Option<typeof Area.Type>) =>
  Option.map(
    Option.orElse(area, () =>
      Option.flatMap(bounds(world), (span) =>
        Option.all({
          from: cellAt(span.minX, span.minY),
          to: cellAt(span.maxX, span.maxY),
        })
      )
    ),
    (rect) => mapText(world, rect)
  );
