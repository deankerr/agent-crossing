import * as Record from "effect/Record";
import * as Schema from "effect/Schema";

/**
 * Every shade the world is drawn in. Lighter and darker versions of a shade
 * are not shades of their own: a form asks for them with `tone`.
 */
export const palette = {
  red: "#f2665e",
  orange: "#ffad5c",
  yellow: "#ffd84d",
  green: "#6cc98a",
  blue: "#6fa8f2",
  purple: "#b48cf0",
  pink: "#ff9ec7",
  white: "#fbf7ef",
  brown: "#a0754c",
  gray: "#a9a6a0",
  black: "#3d3a4b",

  bark: "#8a5a3b",
  "birch-bark": "#efe9dc",
  "birch-band": "#4a423b",
  "dead-wood": "#8c7a66",
  heartwood: "#e3c18c",
  plank: "#d9a873",

  leaf: "#5fae5a",
  "birch-leaf": "#a8d35f",
  pine: "#3e7d4f",
  fern: "#5aa35a",
  lily: "#4f9e4f",
  "tall-grass": "#8cc463",
  reed: "#9db86a",
  "reed-head": "#7a5a3a",
  berry: "#d8434f",
  cream: "#f3ead8",

  iron: "#4f4c57",
  lamp: "#ffe08f",
  flame: "#ff9a3c",
  ember: "#ffd25a",

  grass: "#8fd16b",
  meadow: "#b4d873",
  "forest-floor": "#5f9f55",
  sand: "#f1dfa6",
  "packed-sand": "#d9bf8a",
  dirt: "#c49a6c",
  path: "#e6cc9b",
  stone: "#b7b3aa",
  earth: "#c29a72",
  "dark-earth": "#a97c55",
  water: "#6cc4e4",
} as const satisfies Record<string, string>;

/** The name of a shade in the palette. */
export const Shade = Schema.Literals(Record.keys(palette));
