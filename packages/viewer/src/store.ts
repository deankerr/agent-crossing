import * as Result from "effect/Result";

import type { LocalClock } from "./clock.ts";
import { decodeFrame } from "./feed.ts";
import type { WorldFeed } from "./feed.ts";
import { initialState, receive, withConnection } from "./viewer-state.ts";
import type { ViewerState } from "./viewer-state.ts";

export interface ViewerStore {
  readonly clock: LocalClock;
  readonly getState: () => ViewerState;
  readonly subscribe: (listener: () => void) => () => void;
  readonly stop: () => void;
}

export const startViewer = (feed: WorldFeed, clock: LocalClock) => {
  let state = initialState("connecting");
  const listeners = new Set<() => void>();

  const publish = (next: ViewerState) => {
    state = next;

    listeners.forEach((listener) => {
      listener();
    });
  };

  const stop = feed({
    onConnection: (connection) => {
      publish(withConnection(state, connection));
    },
    onFrame: (frame) => {
      const decoded = decodeFrame(frame);

      if (Result.isSuccess(decoded)) {
        publish(receive(state, decoded.success, clock()));
      }
    },
  });

  const store: ViewerStore = {
    clock,
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
