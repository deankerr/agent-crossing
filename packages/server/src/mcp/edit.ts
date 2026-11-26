import type * as Command from "@agent-crossing/world/Command";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import type * as Result from "effect/Result";

import { WorldClient } from "../world-object/client.ts";
import type { Verdict } from "../world-object/wire.ts";
import { refusalText } from "./refusal.ts";
import { editText, framedOf } from "./replies.ts";
import { parsed, refused } from "./tool.ts";

/** The sentence that ends every edit tool's description. */
export const AFTER_EDIT =
  "The result says what happened and shows a map of the affected area.";

/**
 * The common path of every edit tool: the parsed command is acted on, and the
 * verdict told in words with a map of what it touched, or refused.
 */
export const editing = Effect.map(WorldClient, (world) => {
  const answered = (verdict: typeof Verdict.Type) =>
    verdict._tag === "Rejected"
      ? refused(`Refused: ${refusalText(verdict.rejection)}`)
      : Effect.map(
          Option.match(framedOf(verdict), {
            onNone: () => Effect.succeedNone,
            onSome: (framed) =>
              Effect.map(
                world.map(Option.some(framed.area)),
                Option.map((map) => ({ framed, map }))
              ),
          }),
          (shown) => editText(verdict, shown)
        );

  return (command: Result.Result<typeof Command.Command.Type, string>) =>
    Effect.flatMap(parsed(command), (parsedCommand) =>
      Effect.flatMap(world.act(parsedCommand), answered)
    );
});
