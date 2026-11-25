import { prefabs } from "@agent-crossing/world/definitions/prefabs";
import type { PrefabName } from "@agent-crossing/world/definitions/prefabs";
import { cellsOf } from "@agent-crossing/world/editing/region";
import type { Region } from "@agent-crossing/world/editing/region";
import { Seq } from "@agent-crossing/world/feed/frame";
import { Editor, Timestamp } from "@agent-crossing/world/history/edit";
import { WorldEvent } from "@agent-crossing/world/history/event";
import { habitatOf } from "@agent-crossing/world/rules/placement";
import { cellAt, cellKey, formatCell } from "@agent-crossing/world/schema/cell";
import { nounOf } from "@agent-crossing/world/state/entity";
import type { Entity } from "@agent-crossing/world/state/entity";
import {
  allEntities,
  bounds,
  isFloor,
  isLiquid,
} from "@agent-crossing/world/state/world";
import type { World } from "@agent-crossing/world/state/world";
import { eventText } from "@agent-crossing/world/text/event";
import { mapText } from "@agent-crossing/world/text/map";
import * as Arr from "effect/Array";
import * as DateTime from "effect/DateTime";
import * as Option from "effect/Option";
import * as Record from "effect/Record";
import * as Schema from "effect/Schema";
import * as Str from "effect/String";

import type { Area } from "./affected.ts";

/** find_entities lists at most this many entities. */
export const FIND_MAX_LIMIT = 500;
export const FIND_DEFAULT_LIMIT = 100;

/** history shows at most this many events. */
export const HISTORY_MAX_LIMIT = 200;
export const HISTORY_DEFAULT_LIMIT = 20;

type Present = typeof Entity.Type;

const quoted = (text: string) => `"${Str.replaceAll('"', "'")(text)}"`;

const entityLine = (entity: Present) => {
  const { colors, level, text } = entity.components;

  const own = Arr.filter(
    [
      level === undefined ? "" : `level ${level}`,
      colors === undefined
        ? ""
        : `colors ${Arr.join(
            Arr.map(
              Record.toEntries(colors),
              ([part, shade]) => `${part} ${shade}`
            ),
            " and "
          )}`,
      text === undefined ? "" : `text ${quoted(text)}`,
    ],
    (part) => part !== ""
  );

  return `${entity.id} ${entity.prefab} (${nounOf(entity)}) at ${formatCell(entity.cell)}${own.length === 0 ? "" : `: ${Arr.join(own, ", ")}`}`;
};

const inRegion = (region: Option.Option<typeof Region.Type>) =>
  Option.match(region, {
    onNone: () => () => true,
    onSome: (chosen) => {
      const keys = new Set<string>(Arr.map(cellsOf(chosen), cellKey));

      return (entity: Present) => keys.has(cellKey(entity.cell));
    },
  });

/**
 * The entities in a region, or the whole world, oldest first, capped at
 * `limit`. With a prefab, only entities of that prefab; without one, every
 * entity but the floors and liquids.
 */
export const findText = (
  world: World,
  region: Option.Option<typeof Region.Type>,
  prefab: Option.Option<typeof PrefabName.Type>,
  limit: number
) => {
  const cap = Math.max(1, Math.min(FIND_MAX_LIMIT, Math.trunc(limit)));
  const isIn = inRegion(region);

  const found = Arr.filter(
    allEntities(world),
    (entity) =>
      isIn(entity) &&
      Option.match(prefab, {
        onNone: () => !isFloor(entity) && !isLiquid(entity),
        onSome: (wanted) => wanted === entity.prefab,
      })
  );

  const where = Option.isSome(region) ? "in that region" : "in the world";

  const what = (count: number) =>
    `${Option.match(prefab, { onNone: () => "", onSome: (wanted) => `${wanted} ` })}${count === 1 ? "entity" : "entities"}`;

  if (found.length === 0) {
    return `No ${what(0)} ${where}.`;
  }

  const shown = Arr.take(found, cap);

  return Arr.join(
    [
      found.length > cap
        ? `${found.length} ${what(found.length)} ${where}; showing the first ${cap} (the limit is ${cap}, at most ${FIND_MAX_LIMIT}). Narrow the region or prefab to see the rest.`
        : `${found.length} ${what(found.length)} ${where}:`,
      ...Arr.map(shown, entityLine),
    ],
    "\n"
  );
};

/** A stored event, as `history` reads it back. */
export const EventRow = Schema.Struct({
  seq: Seq,
  at: Timestamp,
  by: Editor,
  event: Schema.fromJsonString(WorldEvent),
});

const timeOf = (at: number) =>
  Option.match(DateTime.make(at), {
    onNone: () => `${at}`,
    onSome: (time) => Str.replace(/\.\d{3}Z$/u, "Z")(DateTime.formatIso(time)),
  });

/** The latest events, oldest first, one line each. */
export const historyText = (
  rows: readonly (typeof EventRow.Type)[],
  total: number
) =>
  rows.length === 0
    ? "Nothing has happened yet."
    : Arr.join(
        [
          `The last ${rows.length} of ${total} events, oldest first (UTC):`,
          ...Arr.map(
            rows,
            ({ at, event, seq }) => `#${seq} ${timeOf(at)} ${eventText(event)}`
          ),
        ],
        "\n"
      );

const prefabLine = ({ components, name }: (typeof prefabs)[number]) => {
  const { label, layer } = components;

  const parts = Arr.filter(
    [
      label === undefined ? "" : `"${label.noun}"`,
      layer === undefined ? "no layer" : `layer ${layer}`,
      layer === "floor" || layer === "liquid"
        ? ""
        : `habitat ${Arr.join(habitatOf(components), " and ")}`,
      components.obstacle === true ? "obstacle" : "",
    ],
    (part) => part !== ""
  );

  return `${label?.glyph ?? "?"} ${name}: ${Arr.join(parts, ", ")}`;
};

/** Every prefab with its glyph, label, layer and habitat. */
export const prefabsText = () =>
  Arr.join(
    [
      "Prefabs (glyph, name: label, layer, habitat). A cell holds at most one entity per layer (floor, liquid, cover, object); entities with no layer share freely. A floor puts a cell in the world, and a liquid over it makes the place water instead of land. An entity may be only where its habitat allows. Any component can be overridden per entity, for example colors or text.",
      ...Arr.map(prefabs, prefabLine),
    ],
    "\n"
  );

/** A map of the area, or of the whole world when none is given. */
export const mapOf = (world: World, area: Option.Option<typeof Area.Type>) =>
  Option.match(
    Option.orElse(area, () =>
      Option.flatMap(bounds(world), (span) =>
        Option.all({
          from: cellAt(span.minX, span.minY),
          to: cellAt(span.maxX, span.maxY),
        })
      )
    ),
    {
      onNone: () =>
        "The world is empty: no cell has a floor. Start with generate_world or paint_floor.",
      onSome: (shown) => mapText(world, shown),
    }
  );
