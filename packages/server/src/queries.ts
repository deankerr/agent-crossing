import { cellAt, cellKey, formatCell } from "@agent-crossing/world/cell";
import { componentsOf, nounOf } from "@agent-crossing/world/entity";
import type { Entity } from "@agent-crossing/world/entity";
import { WorldEvent } from "@agent-crossing/world/event";
import { Seq } from "@agent-crossing/world/feed";
import { groundCatalogue, groundKinds } from "@agent-crossing/world/ground";
import { kindDefaults, kindNames } from "@agent-crossing/world/kind";
import type { KindName } from "@agent-crossing/world/kind";
import { cellsOf } from "@agent-crossing/world/region";
import type { Region } from "@agent-crossing/world/region";
import { eventText, mapText } from "@agent-crossing/world/text";
import { Editor, Timestamp } from "@agent-crossing/world/values";
import { allEntities, bounds } from "@agent-crossing/world/world";
import type { World } from "@agent-crossing/world/world";
import * as Arr from "effect/Array";
import * as DateTime from "effect/DateTime";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";
import * as Str from "effect/String";

import type { Area } from "./affected.ts";

/** find_entities lists at most this many entities. */
export const FIND_MAX_LIMIT = 500;
export const FIND_DEFAULT_LIMIT = 100;

/** history shows at most this many events. */
export const HISTORY_MAX_LIMIT = 200;
export const HISTORY_DEFAULT_LIMIT = 20;

const quoted = (text: string) => `"${Str.replaceAll('"', "'")(text)}"`;

const entityLine = (entity: Entity) => {
  const { text } = componentsOf(entity);

  const own = Arr.filter(
    [
      entity.components.colour === undefined
        ? ""
        : `colour ${entity.components.colour}`,
      text === undefined ? "" : `text ${quoted(text)}`,
    ],
    (part) => part !== ""
  );

  return `${entity.id} ${entity.kind} (${nounOf(entity)}) at ${formatCell(entity.cell)}${own.length === 0 ? "" : `: ${Arr.join(own, ", ")}`}`;
};

const inRegion = (region: Option.Option<Region>) =>
  Option.match(region, {
    onNone: () => () => true,
    onSome: (chosen) => {
      const keys = new Set<string>(Arr.map(cellsOf(chosen), cellKey));

      return (entity: Entity) => keys.has(cellKey(entity.cell));
    },
  });

/** The entities in a region, or the whole world, optionally of one kind, oldest first, capped at `limit`. */
export const findText = (
  world: World,
  region: Option.Option<Region>,
  kind: Option.Option<KindName>,
  limit: number
) => {
  const cap = Math.max(1, Math.min(FIND_MAX_LIMIT, Math.trunc(limit)));
  const isIn = inRegion(region);

  const found = Arr.filter(
    allEntities(world),
    (entity) =>
      isIn(entity) &&
      Option.getOrElse(
        Option.map(kind, (wanted) => wanted === entity.kind),
        () => true
      )
  );

  const where = Option.isSome(region) ? "in that region" : "in the world";

  const what = (count: number) =>
    `${Option.match(kind, { onNone: () => "", onSome: (wanted) => `${wanted} ` })}${count === 1 ? "entity" : "entities"}`;

  if (found.length === 0) {
    return `No ${what(0)} ${where}.`;
  }

  const shown = Arr.take(found, cap);

  return Arr.join(
    [
      found.length > cap
        ? `${found.length} ${what(found.length)} ${where}; showing the first ${cap} (the limit is ${cap}, at most ${FIND_MAX_LIMIT}). Narrow the region or kind to see the rest.`
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

export type EventRow = typeof EventRow.Type;

const timeOf = (at: number) =>
  Option.match(DateTime.make(at), {
    onNone: () => `${at}`,
    onSome: (time) => Str.replace(/\.\d{3}Z$/u, "Z")(DateTime.formatIso(time)),
  });

/** The latest events, oldest first, one line each. */
export const historyText = (rows: readonly EventRow[], total: number) =>
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

const yesNo = (value: boolean) => (value ? "yes" : "no");

const kindLine = (kind: KindName) => {
  const defaults = kindDefaults(kind);
  const { label } = defaults;

  const parts = Arr.filter(
    [
      label === undefined ? "" : `"${label.noun}"`,
      defaults.layer === undefined ? "no layer" : `layer ${defaults.layer}`,
      defaults.obstacle === true ? "obstacle" : "",
      defaults.aquatic === true ? "aquatic (water only)" : "",
      defaults.colour === undefined ? "" : `colour ${defaults.colour}`,
      defaults.appearance === undefined
        ? ""
        : `model ${defaults.appearance.model}`,
    ],
    (part) => part !== ""
  );

  return `${label?.glyph ?? "?"} ${kind}: ${Arr.join(parts, ", ")}`;
};

/** Every ground kind with its traits and every entity kind with its default components. */
export const kindsText = () =>
  Arr.join(
    [
      "Ground kinds (glyph, name: noun, walkable, wet):",
      ...Arr.map(groundKinds, (kind) => {
        const traits = groundCatalogue[kind];

        return `${traits.glyph} ${kind}: ${traits.noun}, walkable ${yesNo(traits.walkable)}, wet ${yesNo(traits.wet)}`;
      }),
      "",
      "Entity kinds (glyph, name: default components). A cell holds at most one thing per layer (object, cover); things with no layer share freely. Aquatic things go only on water, everything else only on dry ground. Any component can be overridden per entity, for example colour or text.",
      ...Arr.map(kindNames, kindLine),
    ],
    "\n"
  );

/** A map of the area, or of the whole world when none is given. */
export const mapOf = (world: World, area: Option.Option<Area>) =>
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
        "The world is empty: no cell has ground. Start with generate_world or paint_ground.",
      onSome: (shown) => mapText(world, shown),
    }
  );
