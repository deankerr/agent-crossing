import * as Schema from "effect/Schema";
import * as Str from "effect/String";

export const NAME_MAX_LENGTH = 24;
export const TEXT_MAX_LENGTH = 280;

const trimmedText = (maximum: number) =>
  Schema.Trim.check(Schema.isMinLength(1), Schema.isMaxLength(maximum));

export const Username = Schema.Trimmed.check(
  Schema.isMinLength(1),
  Schema.isMaxLength(NAME_MAX_LENGTH)
).pipe(Schema.brand("Username"));

export type Username = typeof Username.Type;

export const DisplayName = trimmedText(NAME_MAX_LENGTH).pipe(
  Schema.brand("DisplayName")
);

export type DisplayName = typeof DisplayName.Type;

export const Text = trimmedText(TEXT_MAX_LENGTH).pipe(Schema.brand("Text"));

export type Text = typeof Text.Type;

export const Timestamp = Schema.Int;

export type Timestamp = typeof Timestamp.Type;

export const Colour = Schema.Literals([
  "red",
  "orange",
  "yellow",
  "green",
  "blue",
  "purple",
  "pink",
  "white",
]);

export type Colour = typeof Colour.Type;

export const displayNameOf = (username: Username) => DisplayName.make(username);

export const sameName = (a: string, b: string) =>
  Str.toLowerCase(a) === Str.toLowerCase(b);
