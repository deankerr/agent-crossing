import * as McpProtocol from "effect/ai/McpProtocol";
import * as McpServer from "effect/ai/McpServer";
import * as Effect from "effect/Effect";
import * as HttpRouter from "effect/http/HttpRouter";
import * as Layer from "effect/Layer";

import { INSTRUCTIONS } from "./instructions.ts";
import { AdminTools } from "./tools/index.ts";

/**
 * The handler for `/mcp`: the admin tools over MCP revision 2026-07-28, open
 * to anyone who can reach it. Yield it from the Worker's construction effect.
 */
export const adminHandler = Effect.orDie(
  HttpRouter.toHttpEffect(
    AdminTools.pipe(
      Layer.provide(
        McpServer.layerHttpRequestScoped({
          instructions: INSTRUCTIONS,
          name: "agent-crossing-admin",
          path: "/mcp",
          protocols: [McpProtocol.v2026_07_28],
          version: "0.2.0",
        })
      )
    )
  )
);
