import * as HistoryView from "@agent-crossing/views/HistoryView";
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";

import { WorldClient } from "../../world-object/client.ts";
import { queryTool } from "../tool.ts";

const HistoryInput = Schema.Struct({
  limit: Schema.optionalKey(Schema.Int),
});

/** `history`: the latest edits to the world. */
export const History = queryTool("history", {
  description: `The latest edits to the world, one line each with its sequence number and time. Default ${HistoryView.DEFAULT_LIMIT}, at most ${HistoryView.MAX_LIMIT}.`,
  parameters: HistoryInput,
});

/** The handler of `history`. */
export const history = Effect.map(
  WorldClient,
  (world) =>
    ({ limit }: typeof HistoryInput.Type) =>
      world.history(limit ?? HistoryView.DEFAULT_LIMIT)
);
