import type { Command } from "@agent-crossing/world/editing/command";
import { Editor } from "@agent-crossing/world/history/edit";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as Random from "effect/Random";
import type * as Result from "effect/Result";

import { WorldClient } from "../world-object/client.ts";
import type { Verdict } from "../world-object/wire.ts";
import { rejectionText } from "./refusal.ts";
import { editText, framedOf } from "./replies.ts";
import { parsed, refused } from "./tool.ts";

/** The sentence that ends every edit tool's description. */
export const AFTER_EDIT =
  "The result says what happened and shows a map of the affected area.";

const ADMIN = Editor.make("admin");

/** A seed for an edit that was given none. */
export const randomSeed = Random.nextIntBetween(0, 2_147_483_647);

/**
 * The common path of every edit tool: the parsed command is acted on as made
 * by `admin`, and the verdict told in words with a map of what it touched, or
 * refused.
 */
export const editing = Effect.map(WorldClient, (world) => {
  const answered = (verdict: typeof Verdict.Type) =>
    verdict._tag === "Rejected"
      ? refused(`Refused: ${rejectionText(verdict.rejection)}`)
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

  return (command: Result.Result<typeof Command.Type, string>) =>
    Effect.flatMap(parsed(command), (parsedCommand) =>
      Effect.flatMap(world.act(parsedCommand, ADMIN), answered)
    );
});
