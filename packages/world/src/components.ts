import * as Schema from "effect/Schema";

import { Colour, Glyph, Noun, Text } from "./values.ts";

/**
 * A layer of a cell that at most one entity may claim. Entities without a
 * layer share their cell freely.
 */
export const Layer = Schema.Literals(["cover", "object"]);

export type Layer = typeof Layer.Type;

export const layers = Layer.literals;

/** A component that matters by being present. */
export const Marker = Schema.Literal(true);

/** How an agent reads an entity: "a birch tree", drawn as `I`. */
export const Label = Schema.Struct({
  noun: Noun,
  plural: Schema.optionalKey(Noun),
  glyph: Glyph,
});

export type Label = typeof Label.Type;

/** Which model of the viewer's library draws the entity. */
export const Appearance = Schema.Struct({
  model: Schema.String.check(Schema.isPattern(/^[a-z][a-z0-9-]{0,47}$/u)),
});

export type Appearance = typeof Appearance.Type;

const componentFields = {
  layer: Schema.optionalKey(Layer),
  obstacle: Schema.optionalKey(Marker),
  aquatic: Schema.optionalKey(Marker),
  label: Schema.optionalKey(Label),
  appearance: Schema.optionalKey(Appearance),
  colour: Schema.optionalKey(Colour),
  text: Schema.optionalKey(Text),
};

/**
 * The closed set of components, as one bag of optional keys. Rules and
 * renderers ask about components, never about kind names.
 */
export const Components = Schema.Struct(componentFields);

export type Components = typeof Components.Type;

export const noComponents: Components = {};

/** `over` wins wherever it says something. */
export const overlay = (under: Components, over: Components) =>
  ({ ...under, ...over }) satisfies Components;

export const isObstacle = (components: Components) =>
  components.obstacle === true;

export const isAquatic = (components: Components) =>
  components.aquatic === true;
