import {
  HISTORY_DEFAULT_LIMIT,
  HISTORY_MAX_LIMIT,
} from "@agent-crossing/world/text/history";
import * as McpServer from "effect/ai/McpServer";
import * as Tool from "effect/ai/Tool";
import * as Toolkit from "effect/ai/Toolkit";
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";

import { WorldClient } from "../../world-object/client.ts";
import { reply, textContent } from "../tool.ts";

export const HistoryInput = Schema.Struct({
  limit: Schema.optionalKey(Schema.Int),
});

const History = Tool.make("history", {
  ...reply,
  description: `The latest edits to the world, one line each with its sequence number, time and editor. Default ${HISTORY_DEFAULT_LIMIT}, at most ${HISTORY_MAX_LIMIT}.`,
  parameters: HistoryInput,
})
  .annotate(Tool.Readonly, true)
  .annotate(Tool.Idempotent, true)
  .annotate(Tool.OpenWorld, false);

const toolkit = Toolkit.make(History);

/** Registers `history`: the latest edits to the world. */
export const history = McpServer.registerToolkit(toolkit, {
  content: { history: textContent },
}).pipe(
  Effect.provide(
    toolkit.toLayer(
      Effect.map(WorldClient, (world) => ({
        history: ({ limit }) => world.history(limit ?? HISTORY_DEFAULT_LIMIT),
      }))
    )
  )
);
