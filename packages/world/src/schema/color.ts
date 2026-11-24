import * as Schema from "effect/Schema";

/** The plain color words an agent reads. Every shade belongs to one. */
export const ColorWord = Schema.Literals([
  "red",
  "orange",
  "yellow",
  "green",
  "blue",
  "purple",
  "pink",
  "white",
  "brown",
  "gray",
  "black",
]);

export const colorWords = ColorWord.literals;
