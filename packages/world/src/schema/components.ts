import * as Schema from "effect/Schema";

import { Shade } from "../definitions/palette.ts";
import { Level } from "./cell.ts";
import { Model, PartName } from "./model.ts";

export const TEXT_MAX_LENGTH = 280;
export const NOUN_MAX_LENGTH = 40;

const trimmedText = (maximum: number) =>
  Schema.Trim.check(Schema.isMinLength(1), Schema.isMaxLength(maximum));

/** Writing on a sign and the like. */
export const Text = trimmedText(TEXT_MAX_LENGTH);

/** What an agent calls a thing, in the singular: "oak tree". */
export const Noun = trimmedText(NOUN_MAX_LENGTH);

/** One printable ASCII character drawn on an agent's map. */
export const Glyph = Schema.String.check(Schema.isPattern(/^[!-~]$/u));

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

/** A component that matters by being present. */
export const Marker = Schema.Literal(true);

/** The shades an entity gives to named parts of its model. */
export const Colors = Schema.Record(PartName, Shade);

/**
 * The closed set of components, as one bag of optional keys. Rules and
 * renderers ask about components, never about prefab names.
 */
export const Components = Schema.Struct({
  label: Schema.optionalKey(Label),
  layer: Schema.optionalKey(Layer),
  /** Where the entity can be. Floors and liquids have none. */
  habitat: Schema.optionalKey(Schema.NonEmptyArray(Place)),
  /** It fills its place, so nothing else can be there. */
  obstacle: Schema.optionalKey(Marker),
  model: Schema.optionalKey(Model),
  colors: Schema.optionalKey(Colors),
  text: Schema.optionalKey(Text),
  /** Stored by each floor and liquid; no prefab sets it. */
  level: Schema.optionalKey(Level),
});
