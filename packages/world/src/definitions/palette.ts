import * as Record from "effect/Record";
import * as Schema from "effect/Schema";

import type { ColorWord } from "../schema/color.ts";

/** A shade as the viewer paints it, and the plain word an agent reads. */
export interface ShadeValue {
  readonly hex: string;
  readonly word: typeof ColorWord.Type;
}

/**
 * Every shade the world is drawn in. Lighter and darker versions of a shade
 * are not shades of their own: a form asks for them with `tone`.
 */
export const palette = {
  red: { hex: "#f2665e", word: "red" },
  orange: { hex: "#ffad5c", word: "orange" },
  yellow: { hex: "#ffd84d", word: "yellow" },
  green: { hex: "#6cc98a", word: "green" },
  blue: { hex: "#6fa8f2", word: "blue" },
  purple: { hex: "#b48cf0", word: "purple" },
  pink: { hex: "#ff9ec7", word: "pink" },
  white: { hex: "#fbf7ef", word: "white" },
  brown: { hex: "#a0754c", word: "brown" },
  gray: { hex: "#a9a6a0", word: "gray" },
  black: { hex: "#3d3a4b", word: "black" },

  bark: { hex: "#8a5a3b", word: "brown" },
  "birch-bark": { hex: "#efe9dc", word: "white" },
  "birch-band": { hex: "#4a423b", word: "black" },
  "dead-wood": { hex: "#8c7a66", word: "brown" },
  heartwood: { hex: "#e3c18c", word: "brown" },
  plank: { hex: "#d9a873", word: "brown" },

  leaf: { hex: "#5fae5a", word: "green" },
  "birch-leaf": { hex: "#a8d35f", word: "green" },
  pine: { hex: "#3e7d4f", word: "green" },
  fern: { hex: "#5aa35a", word: "green" },
  lily: { hex: "#4f9e4f", word: "green" },
  "tall-grass": { hex: "#8cc463", word: "green" },
  reed: { hex: "#9db86a", word: "green" },
  "reed-head": { hex: "#7a5a3a", word: "brown" },
  berry: { hex: "#d8434f", word: "red" },
  cream: { hex: "#f3ead8", word: "white" },

  iron: { hex: "#4f4c57", word: "black" },
  lamp: { hex: "#ffe08f", word: "yellow" },
  flame: { hex: "#ff9a3c", word: "orange" },
  ember: { hex: "#ffd25a", word: "yellow" },

  grass: { hex: "#8fd16b", word: "green" },
  meadow: { hex: "#b4d873", word: "green" },
  "forest-floor": { hex: "#5f9f55", word: "green" },
  sand: { hex: "#f1dfa6", word: "yellow" },
  "packed-sand": { hex: "#d9bf8a", word: "yellow" },
  dirt: { hex: "#c49a6c", word: "brown" },
  path: { hex: "#e6cc9b", word: "brown" },
  stone: { hex: "#b7b3aa", word: "gray" },
  earth: { hex: "#c29a72", word: "brown" },
  "dark-earth": { hex: "#a97c55", word: "brown" },
  water: { hex: "#6cc4e4", word: "blue" },
} as const satisfies Record<string, ShadeValue>;

/** The name of a shade in the palette. */
export const Shade = Schema.Literals(Record.keys(palette));

export const shades = Shade.literals;
