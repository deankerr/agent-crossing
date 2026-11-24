import * as Option from "effect/Option";
import { createContext, use, useSyncExternalStore } from "react";

import { initialFeedState, receive, withConnection } from "./feed-state.ts";
import type { FeedState } from "./feed-state.ts";
import type { WorldFeed } from "./live-feed.ts";

export interface ViewerStore {
  readonly getState: () => FeedState;
  readonly subscribe: (listener: () => void) => () => void;
  readonly stop: () => void;
}

/** Runs a feed and keeps the folded state for React to read. */
export const startViewer = (feed: WorldFeed) => {
  let state = initialFeedState("connecting");
  const listeners = new Set<() => void>();

  const publish = (next: FeedState) => {
    if (next === state) {
      return;
    }

    state = next;

    for (const listener of listeners) {
      listener();
    }
  };

  const stop = feed({
    onConnection: (connection) => {
      publish(withConnection(state, connection));
    },
    onFrame: (frame) => {
      publish(receive(state, frame));
    },
  });

  const store: ViewerStore = {
    getState: () => state,
    stop,
    subscribe: (listener) => {
      listeners.add(listener);

      return () => {
        listeners.delete(listener);
      };
    },
  };

  return store;
};

export const ViewerContext = createContext(Option.none<ViewerStore>());

export const useFeedState = () => {
  const store = Option.getOrThrowWith(
    use(ViewerContext),
    () => new Error("useFeedState needs a ViewerContext provider")
  );

  return useSyncExternalStore(store.subscribe, store.getState);
};
