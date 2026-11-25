import * as Clock from "effect/Clock";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { demoFeed } from "./feed/demo-feed.ts";
import { demoCommand } from "./feed/demo.ts";
import { DEFAULT_WORLD_URL, eventsUrl, liveFeed } from "./feed/live-feed.ts";
import { App } from "./ui/app.tsx";
import { startSpectator, SpectatorContext } from "./ui/store.ts";

import "./ui/styles.css";

const search = new URLSearchParams(window.location.search);

const feed = search.has("demo")
  ? demoFeed(demoCommand(search), () => Effect.runSync(Clock.currentTimeMillis))
  : liveFeed({
      url: eventsUrl(
        Option.getOrElse(
          Option.fromNullishOr(import.meta.env.VITE_WORLD_URL),
          () => DEFAULT_WORLD_URL
        )
      ),
    });

const store = startSpectator(feed);

Option.map(Option.fromNullishOr(document.querySelector("#root")), (root) => {
  createRoot(root).render(
    <StrictMode>
      <SpectatorContext value={Option.some(store)}>
        <App />
      </SpectatorContext>
    </StrictMode>
  );
});
