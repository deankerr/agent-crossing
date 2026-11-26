import {
  HISTORY_DEFAULT_LIMIT,
  HISTORY_MAX_LIMIT,
} from "@agent-crossing/world/text/history";
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";

import { WorldClient } from "../../world-object/client.ts";
import { queryTool } from "../tool.ts";

const HistoryInput = Schema.Struct({
  limit: Schema.optionalKey(Schema.Int),
});

/** `history`: the latest edits to the world. */
export const History = queryTool("history", {
  description: `The latest edits to the world, one line each with its sequence number and time. Default ${HISTORY_DEFAULT_LIMIT}, at most ${HISTORY_MAX_LIMIT}.`,
  parameters: HistoryInput,
});

/** The handler of `history`. */
export const history = Effect.map(
  WorldClient,
  (world) =>
    ({ limit }: typeof HistoryInput.Type) =>
      world.history(limit ?? HISTORY_DEFAULT_LIMIT)
);
