import * as Effect from "effect/Effect";
import * as Result from "effect/Result";
import type * as Schema from "effect/Schema";

import type { LocalClock } from "./clock.ts";
import { decodeFrame } from "./feed.ts";
import type { Frame, UnknownFrame, WorldFeed } from "./feed.ts";
import { initialState, receive, withConnection } from "./viewer-state.ts";
import type { ViewerState } from "./viewer-state.ts";

export interface ViewerStore {
  readonly clock: LocalClock;
  readonly getState: () => ViewerState;
  readonly subscribe: (listener: () => void) => () => void;
  readonly stop: () => void;
}

export type UndecodableFrame = (
  frame: Frame,
  error: Schema.SchemaError | UnknownFrame
) => void;

export const logUndecodableFrame: UndecodableFrame = (frame, error) => {
  Effect.runSync(
    Effect.logError(
      `Dropped a "${frame.event}" message from the world feed that did not decode`,
      error.message,
      { data: frame.data, event: frame.event }
    ).pipe(Effect.annotateLogs({ source: "agent-crossing-viewer" }))
  );
};

export const startViewer = (
  feed: WorldFeed,
  clock: LocalClock,
  onUndecodable: UndecodableFrame = logUndecodableFrame
) => {
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

      Result.match(decoded, {
        onFailure: (error) => {
          onUndecodable(frame, error);
        },
        onSuccess: (message) => {
          publish(receive(state, message, clock()));
        },
      });
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
