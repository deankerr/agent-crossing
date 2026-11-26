import * as Cloudflare from "@alchemy.run/cloudflare";
import * as Docker from "@alchemy.run/docker";
import * as Rivet from "@alchemy.run/rivet";
import * as Alchemy from "alchemy";
import { Stack } from "alchemy/Stack";
import { UserFacingError } from "alchemy/UserFacingError";
import * as Config from "effect/Config";
import * as Data from "effect/Data";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";

import Api, { DEV_PORT } from "./packages/host/src/api.ts";
import { local } from "./packages/host/src/cluster.ts";

const DEV_API_AS_BROWSERS_REACH_IT = "AGENT_CROSSING_DEV_API_URL";
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
    const here = yield* local;
    const { stage } = yield* Stack;

    if (!here && stage !== PERSISTENT_STAGE) {
      return yield* Effect.die(
        new CloudStageRefused({
          message: `The stage "${stage}" would deploy to the persistent world's Rivet Cloud cluster. Run \`pnpm exec alchemy deploy --stage ${PERSISTENT_STAGE}\` to deploy, or \`pnpm exec alchemy dev\` to develop.`,
        })
      );
    }

    const api = yield* Api;

    const reached = yield* Config.option(
      Config.String(DEV_API_AS_BROWSERS_REACH_IT)
    );

    const spectator = yield* Cloudflare.Website.Vite("Spectator", {
      dev: { port: DEV_PORT + 1, strictPort: true },
      env: {
        VITE_WORLD_URL: here
          ? Option.getOrElse(reached, () => api.url.as<string>())
          : api.url.as<string>(),
      },
      rootDir: `${import.meta.dirname}/packages/spectator`,
    });

    return { api: api.url.as<string>(), spectator: spectator.url.as<string>() };
  })
);
