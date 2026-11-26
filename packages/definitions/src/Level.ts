import * as Schema from "effect/Schema";

export const MIN = -2;
export const MAX = 7;

/**
 * The vertical step of a position. Generated land uses 0 to 7; levels below
 * 0 are for the beds of ponds.
 */
export const Level = Schema.Int.check(
  Schema.isBetween({ maximum: MAX, minimum: MIN })
);
