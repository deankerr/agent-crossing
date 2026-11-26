import * as StreamFrame from "@agent-crossing/server/StreamFrame";
import * as EventText from "@agent-crossing/views/EventText";
import type * as Cell from "@agent-crossing/world/Cell";
import type * as Entity from "@agent-crossing/world/Entity";
import * as Event from "@agent-crossing/world/Event";
import * as World from "@agent-crossing/world/World";
import * as Arr from "effect/Array";
import * as Option from "effect/Option";

const HISTORY_LIMIT = 120;

export type Connection = "connecting" | "live" | "reconnecting";

/** One line of the history log. */
export interface HistoryEntry {
  readonly key: string;
  readonly at: number;
  readonly kind: (typeof Event.Event.Type)["_tag"];
  readonly sentence: string;
  /** Where it happened, to look at when the entry is picked. */
  readonly cell: Option.Option<typeof Cell.Cell.Type>;
}

/** A complete world, as of the event numbered `cursor`. */
interface Shown {
  readonly world: World.World;
  readonly cursor: number;
  /** Counts the snapshots received, so keys stay unique across reconnects. */
  readonly generation: number;
}

export interface StreamState {
  readonly connection: Connection;
  /** The entities arriving since the last `Reset`, until its `Ready`. */
  readonly loading: Option.Option<readonly (typeof Entity.Entity.Type)[]>;
  /** The last complete world; kept on screen while a new snapshot loads. */
  readonly shown: Option.Option<Shown>;
  /** Newest first. */
  readonly history: readonly HistoryEntry[];
}

export const initialStreamState = (connection: Connection) => {
  const state: StreamState = {
    connection,
    history: [],
    loading: Option.none(),
    shown: Option.none(),
  };

  return state;
};

export const withConnection = (state: StreamState, connection: Connection) =>
  ({ ...state, connection }) satisfies StreamState;

const happened = (
  state: StreamState,
  shown: Shown,
  seq: number,
  event: typeof Event.Event.Type
) => {
  if (seq <= shown.cursor) {
    return state;
  }

  const entry: HistoryEntry = {
    at: event.at,
    cell: Arr.head(Event.cells(event)),
    key: `${shown.generation}:${seq}`,
    kind: event._tag,
    sentence: EventText.sentence(event),
  };

  const next: StreamState = {
    ...state,
    history: Arr.take(Arr.prepend(state.history, entry), HISTORY_LIMIT),
    shown: Option.some({
      ...shown,
      cursor: seq,
      world: World.apply(shown.world, event),
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
 * Folds one frame of the world's stream into the state. A `Reset` starts a
 * fresh snapshot without hiding the world on screen; `Ready` swaps it in;
 * `Happened` applies to the shown world at once. Frames out of order are ignored.
 */
export const receive = (
  state: StreamState,
  frame: typeof StreamFrame.StreamFrame.Type
) => {
  const next: StreamState = StreamFrame.StreamFrame.match(frame, {
    Entities: ({ entities }) =>
      Option.match(state.loading, {
        onNone: () => state,
        onSome: (loaded) => ({
          ...state,
          loading: Option.some([...loaded, ...entities]),
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
        onSome: (loaded) => ({
          ...state,
          loading: Option.none(),
          shown: Option.some({
            cursor,
            generation: nextGeneration(state.shown),
            world: World.make(loaded, 0),
          }),
        }),
      }),
    Reset: () => ({ ...state, loading: Option.some([]) }),
  });

  return next;
};

export type Status =
  | "connecting"
  | "loading"
  | "reloading"
  | "live"
  | "reconnecting";

/** What the badge says, derived from the connection and the snapshot. */
export const statusOf = (state: StreamState) => {
  const loaded = Option.isSome(state.shown);

  if (state.connection !== "live") {
    return state.connection satisfies Status;
  }

  if (Option.isSome(state.loading)) {
    return (loaded ? "reloading" : "loading") satisfies Status;
  }

  return (loaded ? "live" : "loading") satisfies Status;
};
