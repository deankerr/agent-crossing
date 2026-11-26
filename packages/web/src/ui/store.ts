import * as Option from "effect/Option";
import { createContext, use, useSyncExternalStore } from "react";

import type { WorldStream } from "../stream/live-stream.ts";
import {
  initialStreamState,
  receive,
  withConnection,
} from "../stream/stream-state.ts";
import type { StreamState } from "../stream/stream-state.ts";

interface SpectatorStore {
  readonly getState: () => StreamState;
  readonly subscribe: (listener: () => void) => () => void;
}

/** Runs a stream and keeps the folded state for React to read. */
export const startSpectator = (stream: WorldStream) => {
  let state = initialStreamState("connecting");
  const listeners = new Set<() => void>();

  const publish = (next: StreamState) => {
    if (next === state) {
      return;
    }

    state = next;

    for (const listener of listeners) {
      listener();
    }
  };

  stream({
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

export const useStreamState = () => {
  const store = Option.getOrThrowWith(
    use(SpectatorContext),
    () => new Error("useStreamState needs a SpectatorContext provider")
  );

  return useSyncExternalStore(store.subscribe, store.getState);
};
