import * as Schema from "effect/Schema";

export const EDITOR_MAX_LENGTH = 24;

/** Who made an edit: a human or an AI painting the world. */
export const Editor = Schema.Trim.check(
  Schema.isMinLength(1),
  Schema.isMaxLength(EDITOR_MAX_LENGTH)
).pipe(Schema.brand("Editor"));

/** Epoch milliseconds, always passed in, never read from a clock. */
export const Timestamp = Schema.Int;
