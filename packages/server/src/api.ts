import * as Cloudflare from "@alchemy.run/cloudflare";
import * as Effect from "effect/Effect";
import * as HttpServerRequest from "effect/http/HttpServerRequest";
import * as HttpServerResponse from "effect/http/HttpServerResponse";

import { mcpHandler } from "./mcp/server.ts";
import { preflight, stream } from "./stream/stream.ts";
import { WorldClient } from "./world-object/client.ts";

/** Where `alchemy dev` serves the Api on this machine. */
export const DEV_PORT = 1337;

export default class Api extends Cloudflare.Worker<Api>()(
  "Api",
  { dev: { port: DEV_PORT, strictPort: true }, main: import.meta.url },
  Effect.gen(function* () {
    const mcp = yield* mcpHandler;
    const events = yield* stream;

    return {
      fetch: Effect.gen(function* () {
        const request = yield* HttpServerRequest.HttpServerRequest;
        const { pathname } = new URL(request.url, "http://api");

        if (pathname === "/events" && request.method === "OPTIONS") {
          return preflight();
        }

        if (pathname === "/events" && request.method === "GET") {
          return events();
        }

        if (pathname === "/mcp") {
          return yield* mcp;
        }

        return HttpServerResponse.text("Not found", { status: 404 });
      }),
    };
  }).pipe(Effect.provide(WorldClient.layer))
) {}
