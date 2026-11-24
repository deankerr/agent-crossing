import type { GroundKind } from "@agent-crossing/world/ground";
import type { Colour } from "@agent-crossing/world/values";

/** The world's named colours as the viewer paints them. */
export const palette: Readonly<Record<Colour, string>> = {
  black: "#3d3a4b",
  blue: "#6fa8f2",
  brown: "#a0754c",
  green: "#6cc98a",
  grey: "#a9a6a0",
  orange: "#ffad5c",
  pink: "#ff9ec7",
  purple: "#b48cf0",
  red: "#f2665e",
  white: "#fbf7ef",
  yellow: "#ffd84d",
};

export interface GroundStyle {
  /** The colour of the top of the cell. */
  readonly top: string;
  /** The colour of the column below the top, seen on slopes and edges. */
  readonly side: string;
  /** How much each cell's top may differ in brightness from its neighbours. */
  readonly variation: number;
}

/**
 * How each kind of ground is drawn. Exhaustive, so a new kind of ground is a
 * compile error until it has a style.
 */
export const groundStyles: Readonly<Record<GroundKind, GroundStyle>> = {
  dirt: { side: "#a97c55", top: "#c49a6c", variation: 0.08 },
  forest: { side: "#9c7552", top: "#5f9f55", variation: 0.1 },
  grass: { side: "#c29a72", top: "#8fd16b", variation: 0.07 },
  meadow: { side: "#c29a72", top: "#b4d873", variation: 0.08 },
  path: { side: "#b8936c", top: "#e6cc9b", variation: 0.05 },
  sand: { side: "#d9bf8a", top: "#f1dfa6", variation: 0.05 },
  stone: { side: "#8f8b84", top: "#b7b3aa", variation: 0.09 },
  water: { side: "#4f9fc4", top: "#6cc4e4", variation: 0.04 },
};
