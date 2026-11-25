import * as Cloudflare from "@alchemy.run/cloudflare";
import * as Rivet from "@alchemy.run/rivet";
import * as Alchemy from "alchemy";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import Api from "./packages/server/src/api.ts";

export default Alchemy.Stack(
  "AgentCrossing",
  {
    providers: Layer.mergeAll(Cloudflare.providers(), Rivet.providers()),
    state: Cloudflare.state(),
  },
  Effect.gen(function* () {
    const api = yield* Api;

    const viewer = yield* Cloudflare.Website.Vite("Viewer", {
      env: { VITE_WORLD_URL: api.url.as<string>() },
      rootDir: `${import.meta.dirname}/packages/viewer`,
    });

    return { api: api.url.as<string>(), viewer: viewer.url.as<string>() };
  })
);
