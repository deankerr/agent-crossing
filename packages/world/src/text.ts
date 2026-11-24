import * as Arr from "effect/Array";
import * as Option from "effect/Option";
import * as Order from "effect/Order";
import * as Str from "effect/String";

import { cellAt, formatCell } from "./cell.ts";
import type { Cell } from "./cell.ts";
import type { Components, Label } from "./components.ts";
import { isObstacle } from "./components.ts";
import { componentsOf, labelOf, nounOf, pluralOf } from "./entity.ts";
import type { Entity } from "./entity.ts";
import { WorldEvent } from "./event.ts";
import { groundCatalogue, groundKinds, traitsOf } from "./ground.ts";
import type { GroundKind } from "./ground.ts";
import { cellsOfSpan, spanOf } from "./region.ts";
import type { Rect, Span } from "./region.ts";
import {
  bounds,
  cellCount,
  entitiesAt,
  entityCount,
  entityCounts,
  groundAt,
  groundCounts,
  isWalkable,
} from "./world.ts";
import type { World } from "./world.ts";

/** Maps wider or taller than this are cut down, and the text says so. */
export const MAP_MAX_SIDE = 128;

export const VIEW_MAX_RADIUS = 32;

const SUMMARY_MAX_KINDS = 12;
const WRITING_MAX_LINES = 10;
const BLANK = " ";

const counted = (count: number, label: Label) =>
  `${count} ${count === 1 ? label.noun : pluralOf(label)}`;

const article = (noun: string) =>
  /^[aeiou]/u.test(noun) ? `an ${noun}` : `a ${noun}`;

const listed = (parts: readonly string[]) => Arr.join(parts, ", ");

const spanText = (span: Span) =>
  `x ${span.minX} to ${span.maxX}, y ${span.minY} to ${span.maxY}`;

const shown = (entities: readonly Entity[]) => {
  const layered = (layer: "object" | "cover") =>
    Arr.findFirst(entities, (entity) => componentsOf(entity).layer === layer);

  return Option.orElse(
    Option.orElse(layered("object"), () => layered("cover")),
    () =>
      Arr.findFirst(
        entities,
        (entity) => componentsOf(entity).layer === undefined
      )
  );
};

interface Drawn {
  readonly glyph: string;
  readonly noun: string;
}

const drawnAt = (world: World, cell: Cell) =>
  Option.map(groundAt(world, cell), (ground) =>
    Option.match(shown(entitiesAt(world, cell)), {
      onNone: () => traitsOf(ground.kind),
      onSome: (entity) => labelOf(entity),
    })
  );

const heightAt = (world: World, cell: Cell) =>
  Option.match(groundAt(world, cell), {
    onNone: () => BLANK,
    onSome: (ground) => (traitsOf(ground.kind).wet ? "~" : `${ground.height}`),
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

const grid = (span: Span, characterAt: (cell: Cell) => string) => {
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

const legendOf = (drawn: readonly Drawn[]) => {
  const nouns = new Map<string, string>();

  for (const { glyph, noun } of drawn) {
    if (!nouns.has(glyph)) {
      nouns.set(glyph, noun);
    }
  }

  const groundGlyphs: readonly string[] = Arr.map(
    groundKinds,
    (kind) => groundCatalogue[kind].glyph
  );

  const order = Order.mapInput(
    Order.Number,
    ([glyph]: readonly [string, string]) => {
      const position = groundGlyphs.indexOf(glyph);

      return position === -1 ? groundGlyphs.length : position;
    }
  );

  return `Legend: ${listed(
    Arr.map(
      Arr.sort(Arr.fromIterable(nouns), order),
      ([glyph, noun]) => `${glyph} ${noun}`
    )
  )}`;
};

const clamped = (span: Span) =>
  ({
    maxX: Math.min(span.maxX, span.minX + MAP_MAX_SIDE - 1),
    maxY: Math.min(span.maxY, span.minY + MAP_MAX_SIDE - 1),
    minX: span.minX,
    minY: span.minY,
  }) satisfies Span;

const renderMap = (world: World, span: Span, you: Option.Option<Cell>) => {
  const isYou = (cell: Cell) =>
    Option.exists(you, (at) => at.x === cell.x && at.y === cell.y);

  const drawn: Drawn[] = [];

  const glyphs = grid(span, (cell) => {
    if (isYou(cell)) {
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

  const heights = grid(span, (cell) => heightAt(world, cell));

  return [
    ...glyphs,
    "",
    "Heights (0 low to 7 high, ~ water):",
    ...heights,
    "",
    legendOf(drawn),
  ];
};

const AXES =
  "x grows east (right) and y grows south (down). The first header row labels x every 10 columns, the second gives the last digit of each column's x, and each row starts with its y. One character per cell; blank cells are outside the world.";

/**
 * A character map of the rectangle, a height map of the same cells and a
 * legend of the glyphs that appear. Larger than 128 × 128 is cut down from
 * the north-west corner, and the text says so.
 */
export const mapText = (world: World, rect: Pick<Rect, "from" | "to">) => {
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

interface NounCount {
  readonly label: Label;
  readonly count: number;
}

const nearbyCounts = (entities: readonly Entity[]) => {
  const counts = new Map<string, NounCount>();

  for (const entity of entities) {
    const label = labelOf(entity);
    const sofar = counts.get(label.noun);
    counts.set(label.noun, { count: (sofar?.count ?? 0) + 1, label });
  }

  const sorted = Arr.sort(
    Arr.fromIterable(counts.values()),
    Order.combine(
      Order.mapInput(
        Order.flip(Order.Number),
        (entry: NounCount) => entry.count
      ),
      Order.mapInput(Order.String, (entry: NounCount) => entry.label.noun)
    )
  );

  const named = Arr.map(
    Arr.take(sorted, SUMMARY_MAX_KINDS),
    ({ count, label }) => counted(count, label)
  );

  const others = sorted.length - SUMMARY_MAX_KINDS;

  return others > 0
    ? [...named, `${others} other ${others === 1 ? "kind" : "kinds"} of thing`]
    : named;
};

const quoted = (text: string) => `"${Str.replaceAll('"', "'")(text)}"`;

const writingLines = (entities: readonly Entity[]) => {
  const written = Arr.filter(
    entities,
    (entity) => componentsOf(entity).text !== undefined
  );

  const lines = Arr.map(
    Arr.take(written, WRITING_MAX_LINES),
    (entity) =>
      `- ${entity.id} ${nounOf(entity)} at ${formatCell(entity.cell)}: ${quoted(componentsOf(entity).text ?? "")}`
  );

  const more = written.length - WRITING_MAX_LINES;

  return more > 0 ? [...lines, `- and ${more} more with writing`] : lines;
};

const standing = (world: World, at: Cell) =>
  Option.match(groundAt(world, at), {
    onNone: () =>
      `You are at ${formatCell(at)}, which is outside the world: there is no ground there.`,
    onSome: (ground) =>
      `You are at ${formatCell(at)}, on ${traitsOf(ground.kind).noun} at height ${ground.height}.`,
  });

/**
 * What a character standing at `at` would be told: where it stands, the map
 * of the square around it with `@` at its own cell, how many things of each
 * sort are nearby and any writing among them. Provisional: change it here.
 */
export const agentViewText = (world: World, at: Cell, radius = 8) => {
  const reach = Math.max(0, Math.min(VIEW_MAX_RADIUS, Math.trunc(radius)));

  const span: Span = {
    maxX: at.x + reach,
    maxY: at.y + reach,
    minX: at.x - reach,
    minY: at.y - reach,
  };

  const nearby = Arr.flatMap(cellsOfSpan(span), (cell) =>
    entitiesAt(world, cell)
  );

  const counts = nearbyCounts(nearby);
  const writing = writingLines(nearby);

  return Arr.join(
    [
      standing(world, at),
      `Within ${reach} cells (${spanText(span)}). ${AXES} @ is you.`,
      ...renderMap(world, span, Option.some(at)),
      "",
      counts.length === 0
        ? "Nothing stands nearby."
        : `Nearby: ${listed(counts)}.`,
      ...(writing.length === 0 ? [] : ["Writing nearby:", ...writing]),
    ],
    "\n"
  );
};

const componentText = (components: Components) =>
  listed([
    ...(components.layer === undefined ? [] : [`layer ${components.layer}`]),
    ...(isObstacle(components) ? ["obstacle"] : []),
    ...(components.aquatic === true ? ["aquatic"] : []),
    ...(components.label === undefined
      ? []
      : [`label "${components.label.noun}" (${components.label.glyph})`]),
    ...(components.appearance === undefined
      ? []
      : [`model ${components.appearance.model}`]),
    ...(components.colour === undefined ? [] : [`colour ${components.colour}`]),
    ...(components.text === undefined
      ? []
      : [`text ${quoted(components.text)}`]),
  ]);

const groundName = (kind: GroundKind) => {
  const { noun } = traitsOf(kind);

  return noun === kind ? noun : `${noun} (${kind})`;
};

/** The ground of one cell and every entity on it with its effective components. */
export const inspectText = (world: World, cell: Cell) =>
  Option.match(groundAt(world, cell), {
    onNone: () =>
      `Cell ${formatCell(cell)} is outside the world: it has no ground.`,
    onSome: (ground) => {
      const entities = entitiesAt(world, cell);

      return Arr.join(
        [
          `Cell ${formatCell(cell)}: ${groundName(ground.kind)} at height ${ground.height}, ${isWalkable(world, cell) ? "walkable" : "not walkable"}.`,
          ...(entities.length === 0
            ? ["Nothing stands here."]
            : Arr.map(
                entities,
                (entity) =>
                  `- ${entity.id} ${entity.kind}: ${componentText(componentsOf(entity))}`
              )),
        ],
        "\n"
      );
    },
  });

/** The world's extent and how much of each ground and entity kind it holds. */
export const summaryText = (world: World) =>
  Option.match(bounds(world), {
    onNone: () => "The world is empty: no cell has ground.",
    onSome: (span) => {
      const things = entityCounts(world);

      return Arr.join(
        [
          `The world spans ${spanText(span)}, with ${cellCount(world)} cells of ground.`,
          `Ground: ${listed(
            Arr.map(
              groundCounts(world),
              ({ count, kind }) => `${count} ${kind}`
            )
          )}.`,
          things.length === 0
            ? "Entities: none."
            : `Entities (${entityCount(world)}): ${listed(
                Arr.map(things, ({ count, kind }) => `${count} ${kind}`)
              )}.`,
        ],
        "\n"
      );
    },
  });

const cellsWord = (count: number) =>
  count === 1 ? "1 cell" : `${count} cells`;

const thingsWord = (count: number) =>
  count === 1 ? "1 thing" : `${count} things`;

/** One sentence for the history log. */
export const eventText = (event: WorldEvent) =>
  WorldEvent.match(event, {
    Changed: ({ by, entity }) => `${by} changed ${entity}`,
    GroundErased: ({ by, cells }) => `${by} erased ${cellsWord(cells.length)}`,
    GroundPainted: ({ by, tiles }) => {
      const kinds = Arr.dedupe(Arr.map(tiles, (tile) => tile.ground.kind));

      return kinds.length === 1
        ? `${by} painted ${cellsWord(tiles.length)} with ${traitsOf(kinds[0]).noun}`
        : `${by} painted ${cellsWord(tiles.length)}`;
    },
    Moved: ({ by, entity, to }) => `${by} moved ${entity} to ${formatCell(to)}`,
    Removed: ({ by, entities }) =>
      entities.length === 1
        ? `${by} removed ${entities[0]}`
        : `${by} removed ${thingsWord(entities.length)}`,
    Spawned: ({ by, entities }) =>
      entities.length === 1
        ? `${by} put ${article(nounOf(entities[0]))} at ${formatCell(entities[0].cell)}`
        : `${by} placed ${thingsWord(entities.length)}`,
  });
