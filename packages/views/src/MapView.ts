import type * as Components from "@agent-crossing/definitions/Components";
import * as Prefabs from "@agent-crossing/definitions/Prefabs";
import * as Cell from "@agent-crossing/world/Cell";
import * as Entity from "@agent-crossing/world/Entity";
import type * as Region from "@agent-crossing/world/Region";
import * as Span from "@agent-crossing/world/Span";
import * as World from "@agent-crossing/world/World";
import * as Arr from "effect/Array";
import * as Option from "effect/Option";
import * as Order from "effect/Order";
import * as Str from "effect/String";

import { labelOf, listed, spanText } from "./internal/words.ts";

const MAP_MAX_SIDE = 128;

const BLANK = " ";

const DRAWN_ORDER: readonly (typeof Components.Layer.Type | undefined)[] = [
  "object",
  "cover",
  undefined,
  "liquid",
  "floor",
];

const shown = (entities: readonly (typeof Entity.Entity.Type)[]) =>
  Arr.findFirst(DRAWN_ORDER, (layer) =>
    Arr.findFirst(
      entities,
      (entity) => Entity.components(entity).layer === layer
    )
  );

interface Drawn {
  readonly glyph: string;
  readonly noun: string;
}

const drawnAt = (world: World.World, cell: typeof Cell.Cell.Type) =>
  Option.map(World.floorAt(world, cell), (floor) =>
    Option.match(shown(World.entitiesAt(world, cell)), {
      onNone: () => labelOf(floor),
      onSome: labelOf,
    })
  );

const levelAt = (world: World.World, cell: typeof Cell.Cell.Type) =>
  Option.match(World.floorAt(world, cell), {
    onNone: () => BLANK,
    onSome: (floor) => {
      if (Option.isSome(World.liquidAt(world, cell))) {
        return "~";
      }

      const level = Entity.level(floor);

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

const columnHeaders = (span: Span.Span, margin: string) => {
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

const grid = (
  span: Span.Span,
  characterAt: (cell: typeof Cell.Cell.Type) => string
) => {
  const width = Math.max(`${span.minY}`.length, `${span.maxY}`.length);
  const margin = Str.repeat(width + 1)(BLANK);

  const rows = Arr.map(Arr.range(span.minY, span.maxY), (y) => {
    const line = Arr.join(
      Arr.map(Arr.range(span.minX, span.maxX), (x) =>
        Option.match(Cell.at(x, y), {
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

const terrainGlyphs: readonly string[] = Arr.flatMap(Prefabs.all, (prefab) => {
  const { label, layer } = prefab.components;

  return layer === "floor" || layer === "liquid" ? [label.glyph] : [];
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

const rendered = (world: World.World, span: Span.Span) => {
  const drawn: Drawn[] = [];

  const glyphs = grid(span, (cell) =>
    Option.match(drawnAt(world, cell), {
      onNone: () => BLANK,
      onSome: (seen) => {
        drawn.push(seen);

        return seen.glyph;
      },
    })
  );

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

const AXES =
  "x grows east (right) and y grows south (down). The first header row labels x every 10 columns, the second gives the last digit of each column's x, and each row starts with its y. One character per cell; blank cells are outside the world.";

const clamped = (span: Span.Span) =>
  ({
    maxX: Math.min(span.maxX, span.minX + MAP_MAX_SIDE - 1),
    maxY: Math.min(span.maxY, span.minY + MAP_MAX_SIDE - 1),
    minX: span.minX,
    minY: span.minY,
  }) satisfies Span.Span;

/**
 * The map of a rectangle: how to read it, the glyph map, the level map of the
 * same cells and a legend of the glyphs that appear. At most
 * 128 × 128 cells, cut from the north-west corner.
 */
export const text = (
  world: World.World,
  rect: Pick<typeof Region.Rect.Type, "from" | "to">
) => {
  const asked = Span.of(rect.from, rect.to);
  const span = clamped(asked);

  const cut =
    span.maxX === asked.maxX && span.maxY === asked.maxY
      ? []
      : [
          `The request covered ${spanText(asked)}; maps are at most ${MAP_MAX_SIDE} × ${MAP_MAX_SIDE} cells, so this shows ${spanText(span)}.`,
        ];

  return Arr.join(
    [`Map of ${spanText(span)}. ${AXES}`, ...cut, ...rendered(world, span)],
    "\n"
  );
};

/**
 * A map of the area, or of the whole world when none is given; none when
 * no area is given and no cell has a floor.
 */
export const ifAny = (
  world: World.World,
  area: Option.Option<typeof Span.Area.Type>
) =>
  Option.map(
    Option.orElse(area, () =>
      Option.flatMap(World.bounds(world), (span) =>
        Option.all({
          from: Cell.at(span.minX, span.minY),
          to: Cell.at(span.maxX, span.maxY),
        })
      )
    ),
    (rect) => text(world, rect)
  );
