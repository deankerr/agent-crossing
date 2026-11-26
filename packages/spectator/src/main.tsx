import * as Option from "effect/Option";
import * as Schema from "effect/Schema";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { eventsUrl, liveFeed } from "./feed/live-feed.ts";
import { App } from "./ui/app.tsx";
import { startSpectator, SpectatorContext } from "./ui/store.ts";

import "./ui/styles.css";

const worldUrl = Schema.decodeUnknownOption(Schema.URLFromString)(
  import.meta.env.VITE_WORLD_URL
);

const page = Option.match(worldUrl, {
  onNone: () => (
    <p className="stage-notice">
      This page was built without a world address in VITE_WORLD_URL, so it has
      nothing to show.
    </p>
  ),
  onSome: (url) => (
    <SpectatorContext
      value={Option.some(startSpectator(liveFeed(eventsUrl(url))))}
    >
      <App />
    </SpectatorContext>
  ),
});

Option.map(Option.fromNullishOr(document.querySelector("#root")), (root) => {
  createRoot(root).render(<StrictMode>{page}</StrictMode>);
});
