import * as Arr from "effect/Array";
import * as Option from "effect/Option";
import * as Order from "effect/Order";

import { formatCell } from "../../schema/cell.ts";
import type { Cell } from "../../schema/cell.ts";
import type { Label } from "../../schema/components.ts";
import { componentsOf, labelOf, nounOf } from "../state/entity.ts";
import type { Entity } from "../state/entity.ts";
import { cellsOfSpan } from "../state/span.ts";
import type { Span } from "../state/span.ts";
import {
  entitiesAt,
  floorAt,
  isFloor,
  isLiquid,
  liquidAt,
  standingLevelAt,
} from "../state/world.ts";
import type { World } from "../state/world.ts";
import { AXES, renderMap } from "./map.ts";
import { counted, listed, quoted, spanText } from "./words.ts";

export const VIEW_MAX_RADIUS = 32;

const SUMMARY_MAX_NOUNS = 12;
const WRITING_MAX_LINES = 10;

interface NounCount {
  readonly label: typeof Label.Type;
  readonly count: number;
}

const nearbyCounts = (entities: readonly (typeof Entity.Type)[]) => {
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
    Arr.take(sorted, SUMMARY_MAX_NOUNS),
    ({ count, label }) => counted(count, label)
  );

  const others = sorted.length - SUMMARY_MAX_NOUNS;

  return others > 0
    ? [...named, `${others} other ${others === 1 ? "sort" : "sorts"} of entity`]
    : named;
};

const writingLines = (entities: readonly (typeof Entity.Type)[]) => {
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

const standing = (world: World, at: typeof Cell.Type) =>
  Option.match(floorAt(world, at), {
    onNone: () =>
      `You are at ${formatCell(at)}, which is outside the world: there is no floor there.`,
    onSome: (floor) => {
      const surface = Option.getOrElse(liquidAt(world, at), () => floor);
      const level = Option.getOrElse(standingLevelAt(world, at), () => 0);

      return `You are at ${formatCell(at)}, on ${nounOf(surface)} at level ${level}.`;
    },
  });

/**
 * What a character standing at `at` would be told: where it stands, the map
 * of the square around it with `@` at its own cell, how many entities of each
 * sort are nearby and any writing among them. Provisional: change it here.
 */
export const agentViewText = (
  world: World,
  at: typeof Cell.Type,
  radius = 8
) => {
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

  const counts = nearbyCounts(
    Arr.filter(nearby, (entity) => !isFloor(entity) && !isLiquid(entity))
  );

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
