import * as Schema from "effect/Schema";

import * as Level from "./Level.ts";
import * as Model from "./Model.ts";
import * as Palette from "./Palette.ts";

const TEXT_MAX_LENGTH = 280;
const NOUN_MAX_LENGTH = 40;

const trimmedText = (maximum: number) =>
  Schema.Trim.check(Schema.isMinLength(1), Schema.isMaxLength(maximum));

const Text = trimmedText(TEXT_MAX_LENGTH);

const Noun = trimmedText(NOUN_MAX_LENGTH);

const Glyph = Schema.String.check(Schema.isPattern(/^[!-~]$/u));

/** How an agent reads an entity: "a birch tree", drawn as `I`. */
export const Label = Schema.Struct({
  noun: Noun,
  plural: Schema.optionalKey(Noun),
  glyph: Glyph,
});

/**
 * A slot of a cell that at most one entity may fill. Entities without a
 * layer share their cell freely.
 */
export const Layer = Schema.Literals(["floor", "liquid", "cover", "object"]);

/** A place an entity can be: land is a floor with no liquid over it. */
export const Place = Schema.Literals(["land", "water"]);

const Marker = Schema.Literal(true);

/** The shades an entity gives to named parts of its model. */
export const Colors = Schema.Record(Model.PartName, Palette.Shade);

/**
 * The closed set of components, as one bag of optional keys. Rules and
 * renderers ask about components, never about prefab names.
 */
export const Components = Schema.Struct({
  label: Schema.optionalKey(Label),
  layer: Schema.optionalKey(Layer),
  /** Where the entity can be. Floors and liquids have none. */
  habitat: Schema.optionalKey(Schema.NonEmptyArray(Place)),
  /** It is in the way: nothing can move into its cell. */
  obstacle: Schema.optionalKey(Marker),
  model: Schema.optionalKey(Model.Model),
  colors: Schema.optionalKey(Colors),
  text: Schema.optionalKey(Text),
  /** Stored by each floor and liquid; no prefab sets it. */
  level: Schema.optionalKey(Level.Level),
});
