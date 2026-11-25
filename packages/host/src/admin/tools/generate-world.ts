import {
  GENERATE_MAX_SIZE,
  GENERATE_MIN_SIZE,
} from "@agent-crossing/world/editing/command";
import * as McpServer from "effect/ai/McpServer";
import * as Tool from "effect/ai/Tool";
import * as Toolkit from "effect/ai/Toolkit";
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";

import { AFTER_EDIT, editing, randomSeed } from "../edit.ts";
import { parsedCommand, Seed, X, Y } from "../inputs.ts";
import { reply, textContent } from "../tool.ts";

export const GenerateInput = Schema.Struct({
  width: Schema.Int.annotate({
    description: `Width in cells, ${GENERATE_MIN_SIZE} to ${GENERATE_MAX_SIZE}.`,
  }),
  height: Schema.Int.annotate({
    description: `Height in cells, ${GENERATE_MIN_SIZE} to ${GENERATE_MAX_SIZE}.`,
  }),
  x: Schema.optionalKey(
    X.annotate({ description: "x of the north-west corner; default 0." })
  ),
  y: Schema.optionalKey(
    Y.annotate({ description: "y of the north-west corner; default 0." })
  ),
  seed: Schema.optionalKey(Seed),
});

const GenerateWorld = Tool.make("generate_world", {
  ...reply,
  description: `Generates a landscape of floors, water, hills and plants over a width x height rectangle whose north-west corner is (x, y), default (0, 0), replacing every entity already there. ${AFTER_EDIT}`,
  parameters: GenerateInput,
})
  .annotate(Tool.Destructive, true)
  .annotate(Tool.Idempotent, false)
  .annotate(Tool.OpenWorld, false);

/** The command a generation asks for, with this seed unless it gives one, or what is wrong with it. */
export const generateCommand = (
  input: typeof GenerateInput.Type,
  fallbackSeed: number
) =>
  parsedCommand({
    _tag: "Generate",
    height: input.height,
    origin: { x: input.x ?? 0, y: input.y ?? 0 },
    seed: input.seed ?? fallbackSeed,
    width: input.width,
  });

const toolkit = Toolkit.make(GenerateWorld);

/** Registers `generate_world`: generates a landscape over a rectangle. */
export const generateWorld = McpServer.registerToolkit(toolkit, {
  content: { generate_world: textContent },
}).pipe(
  Effect.provide(
    toolkit.toLayer(
      Effect.map(editing, (edit) => ({
        generate_world: (input) =>
          Effect.flatMap(randomSeed, (seed) =>
            edit(generateCommand(input, seed))
          ),
      }))
    )
  )
);
