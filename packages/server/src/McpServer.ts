import * as McpProtocol from "effect/ai/McpProtocol";
import * as EffectMcpServer from "effect/ai/McpServer";
import * as Effect from "effect/Effect";
import * as HttpRouter from "effect/http/HttpRouter";
import * as Layer from "effect/Layer";
import * as Record from "effect/Record";

import { CommandTools } from "./internal/mcp/command-tools.ts";
import { INSTRUCTIONS } from "./internal/mcp/instructions.ts";
import { textContent } from "./internal/mcp/tool.ts";
import { ViewTools } from "./internal/mcp/view-tools.ts";

const tools = Layer.effectDiscard(
  Effect.andThen(
    EffectMcpServer.registerToolkit(ViewTools.toolkit, {
      content: Record.map(ViewTools.toolkit.tools, () => textContent),
    }).pipe(Effect.provide(ViewTools.toolkit.toLayer(ViewTools.handlers))),
    EffectMcpServer.registerToolkit(CommandTools.toolkit, {
      content: Record.map(CommandTools.toolkit.tools, () => textContent),
    }).pipe(Effect.provide(CommandTools.toolkit.toLayer(CommandTools.handlers)))
  )
);

/**
 * The handler for `/mcp`: every MCP tool, each answering in text, listed in
 * this order: one tool for each view, then one for each command; over MCP
 * revision 2026-07-28, open to anyone who can reach it. Yield it from the
 * Worker's construction effect.
 */
export const handler = Effect.orDie(
  HttpRouter.toHttpEffect(
    tools.pipe(
      Layer.provide(
        EffectMcpServer.layerHttpRequestScoped({
          instructions: INSTRUCTIONS,
          name: "agent-crossing",
          path: "/mcp",
          protocols: [McpProtocol.v2026_07_28],
          version: "0.2.0",
        })
      )
    )
  )
);
