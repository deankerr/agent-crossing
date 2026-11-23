import * as Number from "effect/Number";
import * as Option from "effect/Option";
import * as Str from "effect/String";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { App } from "./app.tsx";
import { browserClock } from "./clock.ts";
import { demoFeed } from "./demo-feed.ts";
import { DEMO_SEED } from "./demo.ts";
import { DEFAULT_WORLD_URL, eventsUrl, liveFeed } from "./live-feed.ts";
import { startViewer } from "./store.ts";

import "./styles.css";

const DEMO_SERVER_SKEW = 2500;

const search = new URLSearchParams(window.location.search);

const feed = search.has("demo")
  ? demoFeed({
      clock: browserClock,
      seed: Option.fromNullishOr(search.get("demo")).pipe(
        Option.filter(Str.isNonEmpty),
        Option.flatMap(Number.parse),
        Option.getOrElse(() => DEMO_SEED)
      ),
      serverSkew: DEMO_SERVER_SKEW,
    })
  : liveFeed({
      url: eventsUrl(
        Option.getOrElse(
          Option.fromNullishOr(import.meta.env.VITE_WORLD_URL),
          () => DEFAULT_WORLD_URL
        )
      ),
    });

const store = startViewer(feed, browserClock);

Option.map(Option.fromNullishOr(document.querySelector("#root")), (root) => {
  createRoot(root).render(
    <StrictMode>
      <App store={store} />
    </StrictMode>
  );
});
