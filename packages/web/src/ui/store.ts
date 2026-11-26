import * as Option from "effect/Option";
import { createContext, use, useSyncExternalStore } from "react";

import {
  initialFeedState,
  receive,
  withConnection,
} from "../feed/feed-state.ts";
import type { FeedState } from "../feed/feed-state.ts";
import type { WorldFeed } from "../feed/live-feed.ts";

interface SpectatorStore {
  readonly getState: () => FeedState;
  readonly subscribe: (listener: () => void) => () => void;
}

/** Runs a feed and keeps the folded state for React to read. */
export const startSpectator = (feed: WorldFeed) => {
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

  feed({
    onConnection: (connection) => {
      publish(withConnection(state, connection));
    },
    onFrame: (frame) => {
      publish(receive(state, frame));
    },
  });

  const store: SpectatorStore = {
    getState: () => state,
    subscribe: (listener) => {
      listeners.add(listener);

      return () => {
        listeners.delete(listener);
      };
    },
  };

  return store;
};

export const SpectatorContext = createContext(Option.none<SpectatorStore>());

export const useFeedState = () => {
  const store = Option.getOrThrowWith(
    use(SpectatorContext),
    () => new Error("useFeedState needs a SpectatorContext provider")
  );

  return useSyncExternalStore(store.subscribe, store.getState);
};
