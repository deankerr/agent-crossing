import {
  GENERATE_MAX_SIZE,
  GENERATE_MIN_SIZE,
} from "@agent-crossing/world/editing/command";
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";

import { AFTER_EDIT, editing, randomSeed } from "../edit.ts";
import { parsedCommand, Seed, X, Y } from "../inputs.ts";
import { editTool } from "../tool.ts";

const GenerateInput = Schema.Struct({
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

/** `generate_world`: generates a landscape over a rectangle. */
export const GenerateWorld = editTool(
  "generate_world",
  {
    description: `Generates a landscape of floors, water, hills and plants over a width x height rectangle whose north-west corner is (x, y), default (0, 0), replacing every entity already there. ${AFTER_EDIT}`,
    parameters: GenerateInput,
  },
  { destructive: true, idempotent: false }
);

const generateCommand = (
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

/** The handler of `generate_world`, with a random seed when none is given. */
export const generateWorld = Effect.map(
  editing,
  (edit) => (input: typeof GenerateInput.Type) =>
    Effect.flatMap(randomSeed, (seed) => edit(generateCommand(input, seed)))
);
