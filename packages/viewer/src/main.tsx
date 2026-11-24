import * as Clock from "effect/Clock";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { App } from "./app.tsx";
import { demoFeed } from "./demo-feed.ts";
import { demoCommand } from "./demo.ts";
import { DEFAULT_WORLD_URL, eventsUrl, liveFeed } from "./live-feed.ts";
import { startViewer, ViewerContext } from "./store.ts";

import "./styles.css";

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

const store = startViewer(feed);

Option.map(Option.fromNullishOr(document.querySelector("#root")), (root) => {
  createRoot(root).render(
    <StrictMode>
      <ViewerContext value={Option.some(store)}>
        <App />
      </ViewerContext>
    </StrictMode>
  );
});
