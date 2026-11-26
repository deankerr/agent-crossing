import * as Option from "effect/Option";
import * as Schema from "effect/Schema";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { eventsUrl, liveStream } from "./stream/live-stream.ts";
import { App } from "./ui/app.tsx";
import { startSpectator, SpectatorContext } from "./ui/store.ts";

import "./ui/styles.css";

const worldUrl = Option.getOrElse(
  Schema.decodeUnknownOption(Schema.URLFromString)(
    import.meta.env.VITE_WORLD_URL
  ),
  () => new URL(globalThis.location.origin)
);

const page = (
  <SpectatorContext
    value={Option.some(startSpectator(liveStream(eventsUrl(worldUrl))))}
  >
    <App />
  </SpectatorContext>
);

Option.map(Option.fromNullishOr(document.querySelector("#root")), (root) => {
  createRoot(root).render(<StrictMode>{page}</StrictMode>);
});
