import * as Option from "effect/Option";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { DEFAULT_WORLD_URL, eventsUrl, liveFeed } from "./feed/live-feed.ts";
import { App } from "./ui/app.tsx";
import { startSpectator, SpectatorContext } from "./ui/store.ts";

import "./ui/styles.css";

const store = startSpectator(
  liveFeed(
    eventsUrl(
      Option.getOrElse(
        Option.fromNullishOr(import.meta.env.VITE_WORLD_URL),
        () => DEFAULT_WORLD_URL
      )
    )
  )
);

Option.map(Option.fromNullishOr(document.querySelector("#root")), (root) => {
  createRoot(root).render(
    <StrictMode>
      <SpectatorContext value={Option.some(store)}>
        <App />
      </SpectatorContext>
    </StrictMode>
  );
});
