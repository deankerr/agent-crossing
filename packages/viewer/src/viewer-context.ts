import * as Option from "effect/Option";
import { createContext, use, useSyncExternalStore } from "react";

import type { ViewerStore } from "./store.ts";
import { serverNowOf } from "./viewer-state.ts";

export const ViewerContext = createContext<Option.Option<ViewerStore>>(
  Option.none()
);

export const useViewerStore = () =>
  Option.getOrThrowWith(
    use(ViewerContext),
    () => new Error("useViewerStore needs a ViewerContext provider")
  );

export const useViewerState = () => {
  const store = useViewerStore();

  return useSyncExternalStore(store.subscribe, store.getState);
};

export const serverNowIn = (store: ViewerStore) =>
  Option.map(store.getState().synced, (synced) =>
    serverNowOf(synced, store.clock())
  );
