import * as Cloudflare from "@alchemy.run/cloudflare";
import * as Docker from "@alchemy.run/docker";
import * as Rivet from "@alchemy.run/rivet";
import * as Alchemy from "alchemy";
import { Stack } from "alchemy/Stack";
import { UserFacingError } from "alchemy/UserFacingError";
import * as Data from "effect/Data";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import Api, { DEV_PORT } from "./packages/server/src/Api.ts";
import * as Cluster from "./packages/server/src/Cluster.ts";

const PERSISTENT_STAGE = "persistent";

class CloudStageRefused extends Data.TaggedError("CloudStageRefused")<{
  readonly message: string;
}> {
  readonly [UserFacingError] = true;
}

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
    const here = yield* Cluster.local;
    const { stage } = yield* Stack;

    if (!here && stage !== PERSISTENT_STAGE) {
      return yield* Effect.die(
        new CloudStageRefused({
          message: `The stage "${stage}" would deploy to the persistent world's Rivet Cloud cluster. Run \`pnpm exec alchemy deploy --stage ${PERSISTENT_STAGE}\` to deploy, or \`pnpm exec alchemy dev\` to develop.`,
        })
      );
    }

    const api = yield* Api;

    const web = yield* Cloudflare.Website.Vite("Web", {
      dev: { port: DEV_PORT + 1, strictPort: true },
      env: here ? {} : { VITE_WORLD_URL: api.url.as<string>() },
      rootDir: `${import.meta.dirname}/packages/web`,
    });

    return { api: api.url.as<string>(), web: web.url.as<string>() };
  })
);
