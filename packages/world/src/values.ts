import * as Schema from "effect/Schema";

export const EDITOR_MAX_LENGTH = 24;
export const TEXT_MAX_LENGTH = 280;
export const NOUN_MAX_LENGTH = 40;

const trimmedText = (maximum: number) =>
  Schema.Trim.check(Schema.isMinLength(1), Schema.isMaxLength(maximum));

/** Who made an edit: a human or an AI painting the world. */
export const Editor = trimmedText(EDITOR_MAX_LENGTH).pipe(
  Schema.brand("Editor")
);

export type Editor = typeof Editor.Type;

/** Epoch milliseconds, always passed in, never read from a clock. */
export const Timestamp = Schema.Int;

export type Timestamp = typeof Timestamp.Type;

/** Writing on a sign and the like. */
export const Text = trimmedText(TEXT_MAX_LENGTH);

export type Text = typeof Text.Type;

/** What an agent calls a thing, in the singular: "oak tree". */
export const Noun = trimmedText(NOUN_MAX_LENGTH);

export type Noun = typeof Noun.Type;

/** One printable ASCII character drawn on an agent's map. */
export const Glyph = Schema.String.check(Schema.isPattern(/^[!-~]$/u));

export type Glyph = typeof Glyph.Type;

export const colours = [
  "red",
  "orange",
  "yellow",
  "green",
  "blue",
  "purple",
  "pink",
  "white",
  "brown",
  "grey",
  "black",
] as const;

export const Colour = Schema.Literals(colours);

export type Colour = typeof Colour.Type;
