import * as Cloudflare from "@alchemy.run/cloudflare";
import * as Docker from "@alchemy.run/docker";
import * as Rivet from "@alchemy.run/rivet";
import * as Alchemy from "alchemy";
import * as Config from "effect/Config";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";

import Api, { DEV_PORT } from "./packages/server/src/api.ts";
import { local } from "./packages/server/src/cluster.ts";

const DEV_API_AS_BROWSERS_REACH_IT = "AGENT_CROSSING_DEV_API_URL";

export default Alchemy.Stack(
  "AgentCrossing",
  {
    providers: Layer.mergeAll(
      Cloudflare.providers(),
      Docker.providers(),
      Rivet.providers()
    ),
    state: Cloudflare.state(),
  },
  Effect.gen(function* () {
    const api = yield* Api;
    const here = yield* local;

    const reached = yield* Config.option(
      Config.String(DEV_API_AS_BROWSERS_REACH_IT)
    );

    const viewer = yield* Cloudflare.Website.Vite("Viewer", {
      dev: { port: DEV_PORT + 1, strictPort: true },
      env: {
        VITE_WORLD_URL: here
          ? Option.getOrElse(reached, () => api.url.as<string>())
          : api.url.as<string>(),
      },
      rootDir: `${import.meta.dirname}/packages/viewer`,
    });

    return { api: api.url.as<string>(), viewer: viewer.url.as<string>() };
  })
);
