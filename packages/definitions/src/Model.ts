import * as Schema from "effect/Schema";

import * as Palette from "./Palette.ts";

const Vec3 = Schema.Tuple([Schema.Finite, Schema.Finite, Schema.Finite]);

const Fraction = Schema.Finite.check(
  Schema.isBetween({ maximum: 1, minimum: 0 })
);

/**
 * A solid shape. The first four are centered on their own origin:
 * - `box` by its sides;
 * - `cylinder` by top radius, bottom radius, height and segments;
 * - `cone` by radius, height and segments;
 * - `ball`, low-poly, by radius and detail.
 *
 * The last two cover the whole cell, measured from the cell's surface:
 * - `slab` by the height of its top face and how far it extends down;
 * - `fill` from the height of its top down to whatever is beneath it: the
 *   floor under a liquid, or the bottom of the world under a floor.
 */
export const Solid = Schema.Union([
  Schema.Struct({ box: Vec3 }),
  Schema.Struct({
    cylinder: Schema.Tuple([
      Schema.Finite,
      Schema.Finite,
      Schema.Finite,
      Schema.Int,
    ]),
  }),
  Schema.Struct({
    cone: Schema.Tuple([Schema.Finite, Schema.Finite, Schema.Int]),
  }),
  Schema.Struct({ ball: Schema.Tuple([Schema.Finite, Schema.Int]) }),
  Schema.Struct({ slab: Schema.Tuple([Schema.Finite, Schema.Finite]) }),
  Schema.Struct({ fill: Schema.Finite }),
]);

/** One solid placed in a part, with its own tone. */
export const Form = Schema.Struct({
  solid: Solid,
  /** Where the solid's center sits, with the cell's surface center at the origin. */
  at: Schema.optionalKey(Vec3),
  /** Euler angles in radians, applied before moving to `at`. */
  turn: Schema.optionalKey(Vec3),
  scale: Schema.optionalKey(Vec3),
  /** A brightness multiplier on the part's shade; 1 when absent. */
  tone: Schema.optionalKey(Schema.Finite.check(Schema.isGreaterThan(0))),
});

/** What a part, or an entity's recoloring of one, is called: `trunk`. */
export const PartName = Schema.String.check(
  Schema.isPattern(/^[a-z][a-z0-9-]{0,31}$/u)
);

/** A named piece of a model with one shade, made of one or more forms. */
export const Part = Schema.Struct({
  name: PartName,
  shade: Palette.Shade,
  forms: Schema.NonEmptyArray(Form),
  /** Drawn unlit, as if it gave off light. */
  glow: Schema.optionalKey(Schema.Literal(true)),
  /** How opaque the part is, for liquids; 1 when absent. */
  opacity: Schema.optionalKey(Fraction),
  /** How much the part's brightness may differ from cell to cell. */
  variation: Schema.optionalKey(Fraction),
});

/**
 * How an entity is turned and sized on its cell:
 * - `nature` any heading and a little bigger or smaller, from its id;
 * - `quarter` a quarter turn from its id, at full size;
 * - `facing` towards the default camera, give or take a little;
 * - `fence` along the neighboring entities of the same prefab;
 * - `fixed` never turned or resized, like floors and liquids.
 */
export const Pose = Schema.Literals([
  "nature",
  "quarter",
  "facing",
  "fence",
  "fixed",
]);

/** The named parts an entity is drawn from, and how it is posed. */
export const Model = Schema.Struct({
  parts: Schema.NonEmptyArray(Part),
  pose: Pose,
});
