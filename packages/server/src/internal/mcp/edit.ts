import type * as Command from "@agent-crossing/world/Command";
import * as Effect from "effect/Effect";
import type * as Result from "effect/Result";

import * as WorldClient from "../../WorldClient.ts";
import type { Verdict } from "../world-object/wire.ts";
import { refusalText } from "./refusal.ts";
import { parsed, refused } from "./tool.ts";

/** The sentence that ends every edit tool's description. */
export const AFTER_EDIT =
  "The result says what happened and shows a map of the affected area.";

const answered = (verdict: typeof Verdict.Type) =>
  verdict._tag === "Refused"
    ? refused(`Refused: ${refusalText(verdict.refusal)}`)
    : Effect.succeed(verdict.text);

/**
 * The common path of every edit tool: the parsed command is acted on, and
 * the World object's reply passed on, or its refusal told in words.
 */
export const editing = Effect.map(
  WorldClient.WorldClient,
  (world) => (command: Result.Result<typeof Command.Command.Type, string>) =>
    Effect.flatMap(parsed(command), (parsedCommand) =>
      Effect.flatMap(world.act(parsedCommand), answered)
    )
);
