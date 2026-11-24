import type { Cell } from "@agent-crossing/world/cell";
import type { EntityId } from "@agent-crossing/world/entity";
import { evolve, WorldEvent } from "@agent-crossing/world/event";
import { FeedFrame } from "@agent-crossing/world/feed";
import { eventText } from "@agent-crossing/world/text";
import { applyAll, emptyWorld, entityOf } from "@agent-crossing/world/world";
import type { World } from "@agent-crossing/world/world";
import * as Arr from "effect/Array";
import * as Option from "effect/Option";

/** The most history entries kept. */
export const HISTORY_LIMIT = 200;

export type Connection = "connecting" | "live" | "reconnecting" | "demo";

/** One line of the history log. */
export interface HistoryEntry {
  readonly key: string;
  readonly seq: number;
  readonly at: number;
  readonly kind: WorldEvent["_tag"];
  readonly sentence: string;
  /** Where it happened, to look at when the entry is picked. */
  readonly cell: Option.Option<Cell>;
}

/** A complete world, as of the event numbered `cursor`. */
export interface Shown {
  readonly world: World;
  readonly cursor: number;
  /** Counts the snapshots received, so keys stay unique across reconnects. */
  readonly generation: number;
}

export interface FeedState {
  readonly connection: Connection;
  /** The snapshot arriving since the last `Reset`, until its `Ready`. */
  readonly loading: Option.Option<World>;
  /** The last complete world; kept on screen while a new snapshot loads. */
  readonly shown: Option.Option<Shown>;
  /** Newest first. */
  readonly history: readonly HistoryEntry[];
}

export const initialFeedState = (connection: Connection) => {
  const state: FeedState = {
    connection,
    history: [],
    loading: Option.none(),
    shown: Option.none(),
  };

  return state;
};

export const withConnection = (state: FeedState, connection: Connection) =>
  ({ ...state, connection }) satisfies FeedState;

const cellOfEntity = (world: World, id: EntityId) =>
  Option.map(entityOf(world, id), (entity) => entity.cell);

/** Where an event happened, judged from the world it happened to. */
export const eventCell = (world: World, event: WorldEvent) =>
  WorldEvent.match(event, {
    Changed: ({ entity }) => cellOfEntity(world, entity),
    GroundErased: ({ cells }) => Option.some(cells[0]),
    GroundPainted: ({ tiles }) => Option.some(tiles[0].cell),
    Moved: ({ to }) => Option.some(to),
    Removed: ({ entities }) => cellOfEntity(world, entities[0]),
    Spawned: ({ entities }) => Option.some(entities[0].cell),
  });

const happened = (
  state: FeedState,
  shown: Shown,
  seq: number,
  event: WorldEvent
) => {
  if (seq <= shown.cursor) {
    return state;
  }

  const entry: HistoryEntry = {
    at: event.at,
    cell: eventCell(shown.world, event),
    key: `${shown.generation}:${seq}`,
    kind: event._tag,
    sentence: eventText(event),
    seq,
  };

  const next: FeedState = {
    ...state,
    history: Arr.take(Arr.prepend(state.history, entry), HISTORY_LIMIT),
    shown: Option.some({
      ...shown,
      cursor: seq,
      world: evolve(shown.world, event),
    }),
  };

  return next;
};

const nextGeneration = (shown: Option.Option<Shown>) =>
  Option.match(shown, {
    onNone: () => 0,
    onSome: ({ generation }) => generation + 1,
  });

/**
 * Folds one frame of the spectator stream into the state. A `Reset` starts a
 * fresh snapshot without hiding the world on screen; `Ready` swaps it in;
 * `Happened` evolves the shown world at once. Frames out of order are ignored.
 */
export const receive = (state: FeedState, frame: FeedFrame) => {
  const next: FeedState = FeedFrame.match(frame, {
    Changes: ({ changes }) =>
      Option.match(state.loading, {
        onNone: () => state,
        onSome: (world) => ({
          ...state,
          loading: Option.some(applyAll(world, changes)),
        }),
      }),
    Happened: ({ event, seq }) =>
      Option.isSome(state.loading)
        ? state
        : Option.match(state.shown, {
            onNone: () => state,
            onSome: (shown) => happened(state, shown, seq, event),
          }),
    Ready: ({ cursor }) =>
      Option.match(state.loading, {
        onNone: () => state,
        onSome: (world) => ({
          ...state,
          loading: Option.none(),
          shown: Option.some({
            cursor,
            generation: nextGeneration(state.shown),
            world,
          }),
        }),
      }),
    Reset: () => ({ ...state, loading: Option.some(emptyWorld) }),
  });

  return next;
};

export type Status =
  | "connecting"
  | "loading"
  | "reloading"
  | "live"
  | "reconnecting"
  | "demo";

/** What the badge says, derived from the connection and the snapshot. */
export const statusOf = (state: FeedState) => {
  const loaded = Option.isSome(state.shown);

  if (state.connection !== "live") {
    return state.connection satisfies Status;
  }

  if (Option.isSome(state.loading)) {
    return (loaded ? "reloading" : "loading") satisfies Status;
  }

  return (loaded ? "live" : "loading") satisfies Status;
};
