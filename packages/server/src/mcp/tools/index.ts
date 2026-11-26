import * as McpServer from "effect/ai/McpServer";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Record from "effect/Record";

import { textContent } from "../tool.ts";
import { CommandTools } from "./commands.ts";
import { ViewTools } from "./views.ts";

/**
 * Every MCP tool, each answering in text, listed in this order: one tool for
 * each view, then one for each command.
 */
export const McpTools = Layer.effectDiscard(
  Effect.andThen(
    McpServer.registerToolkit(ViewTools.toolkit, {
      content: Record.map(ViewTools.toolkit.tools, () => textContent),
    }).pipe(Effect.provide(ViewTools.toolkit.toLayer(ViewTools.handlers))),
    McpServer.registerToolkit(CommandTools.toolkit, {
      content: Record.map(CommandTools.toolkit.tools, () => textContent),
    }).pipe(Effect.provide(CommandTools.toolkit.toLayer(CommandTools.handlers)))
  )
);
