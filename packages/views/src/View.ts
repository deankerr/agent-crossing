import * as Prefabs from "@agent-crossing/definitions/Prefabs";
import * as Cell from "@agent-crossing/world/Cell";
import * as Region from "@agent-crossing/world/Region";
import type * as World from "@agent-crossing/world/World";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";

import * as CellView from "./CellView.ts";
import * as EntityListView from "./EntityListView.ts";
import * as HistoryView from "./HistoryView.ts";
import * as MapView from "./MapView.ts";
import * as PrefabListView from "./PrefabListView.ts";
import * as SummaryView from "./SummaryView.ts";

export const ViewSummary = Schema.TaggedStruct("ViewSummary", {}).annotate({
  description:
    "The world's extent (the bounding box of its floors), how many cells of each floor and of water it has, how many entities of each sort it holds, and how many events its history has. Start here.",
});

export const ViewMap = Schema.TaggedStruct("ViewMap", {
  rect: Schema.optionalKey(
    Region.Rect.annotate({
      description:
        'The rectangle to map, {"_tag":"Rect","from":{"x":0,"y":0},"to":{"x":20,"y":10}}; the whole world when left out.',
    })
  ),
}).annotate({
  description:
    "A character map of a rectangle of the world, a level map of the same cells and a legend. Give a rectangle, or none for the whole world. Maps are at most 128 x 128 cells; a larger request is cut down from its north-west corner and the text says so.",
});

export const ViewCell = Schema.TaggedStruct("ViewCell", {
  cell: Cell.Cell.annotate({ description: "The cell to look at." }),
}).annotate({
  description:
    "One cell in detail: its floor and any liquid with their levels, whether it is land or water, and every other entity on it with its id and effective components.",
});

export const ViewEntities = Schema.TaggedStruct("ViewEntities", {
  region: Schema.optionalKey(
    Region.Region.annotate({
      description: "The region to look in; the whole world when left out.",
    })
  ),
  prefab: Schema.optionalKey(
    Prefabs.Name.annotate({
      description:
        "Only entities of this prefab, floors and liquids included; every entity but the floors and liquids when left out.",
    })
  ),
  limit: Schema.optionalKey(
    Schema.Int.annotate({
      description: `The most entities to list, default ${EntityListView.DEFAULT_LIMIT}, at most ${EntityListView.MAX_LIMIT}.`,
    })
  ),
}).annotate({
  description: `Lists entities with their ids, prefabs and cells, oldest first: in a region or the whole world. Without a prefab it lists every entity but the floors and liquids; with one, only entities of that prefab. Shows at most \`limit\` (default ${EntityListView.DEFAULT_LIMIT}, at most ${EntityListView.MAX_LIMIT}) and says how many there are in all.`,
});

export const ViewPrefabs = Schema.TaggedStruct("ViewPrefabs", {}).annotate({
  description:
    "Every prefab with its glyph, name, label, layer and habitat, and whether it is an obstacle.",
});

export const ViewHistory = Schema.TaggedStruct("ViewHistory", {
  limit: Schema.optionalKey(
    Schema.Int.annotate({
      description: `The most events to show, default ${HistoryView.DEFAULT_LIMIT}, at most ${HistoryView.MAX_LIMIT}.`,
    })
  ),
}).annotate({
  description: `The latest edits to the world, one line each with its sequence number and time. Default ${HistoryView.DEFAULT_LIMIT}, at most ${HistoryView.MAX_LIMIT}.`,
});

/** What may be asked to see of the world. */
export const View = Schema.Union([
  ViewSummary,
  ViewMap,
  ViewCell,
  ViewEntities,
  ViewPrefabs,
  ViewHistory,
]).pipe(Schema.toTaggedUnion("_tag"));

const EMPTY_MAP =
  "The world is empty: no cell has a floor, so there is no map.";

/** How many of the latest events a view shows: none but for the history. */
export const eventsNeeded = (view: typeof View.Type) =>
  view._tag === "ViewHistory"
    ? Math.max(
        1,
        Math.min(
          HistoryView.MAX_LIMIT,
          Math.trunc(view.limit ?? HistoryView.DEFAULT_LIMIT)
        )
      )
    : 0;

/**
 * The view in words, from the world, the latest events (as many as
 * {@link eventsNeeded} asks for, oldest first) and how many events the
 * history has in all.
 */
export const text = (
  view: typeof View.Type,
  world: World.World,
  latest: readonly (typeof HistoryView.Entry.Type)[],
  eventCount: number
) =>
  View.match(view, {
    ViewCell: ({ cell }) => CellView.text(world, cell),
    ViewEntities: ({ limit, prefab, region }) =>
      EntityListView.text(
        world,
        Option.fromNullishOr(region),
        Option.fromNullishOr(prefab),
        limit ?? EntityListView.DEFAULT_LIMIT
      ),
    ViewHistory: () => HistoryView.text(latest, eventCount),
    ViewMap: ({ rect }) =>
      Option.getOrElse(
        MapView.ifAny(world, Option.fromNullishOr(rect)),
        () => EMPTY_MAP
      ),
    ViewPrefabs: () => PrefabListView.text,
    ViewSummary: () =>
      `${SummaryView.text(world)}\nHistory: ${eventCount} events.`,
  });
