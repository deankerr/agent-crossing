import * as Cloudflare from "@alchemy.run/cloudflare";
import * as Effect from "effect/Effect";
import * as HttpServerRequest from "effect/http/HttpServerRequest";
import * as HttpServerResponse from "effect/http/HttpServerResponse";

import * as EventStream from "./EventStream.ts";
import * as McpServer from "./McpServer.ts";
import * as WorldClient from "./WorldClient.ts";

/** Where `alchemy dev` serves the Api on this machine. */
export const DEV_PORT = 1337;

export default class Api extends Cloudflare.Worker<Api>()(
  "Api",
  { dev: { port: DEV_PORT, strictPort: true }, main: import.meta.url },
  Effect.gen(function* () {
    const mcp = yield* McpServer.handler;
    const events = yield* EventStream.handler;

    return {
      fetch: Effect.gen(function* () {
        const request = yield* HttpServerRequest.HttpServerRequest;
        const { pathname } = new URL(request.url, "http://api");

        if (pathname === "/events" && request.method === "OPTIONS") {
          return EventStream.preflight();
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
  }).pipe(Effect.provide(WorldClient.WorldClient.layer))
) {}
