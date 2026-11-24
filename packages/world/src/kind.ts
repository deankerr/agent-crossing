import * as Record from "effect/Record";
import * as Schema from "effect/Schema";

import type { Components } from "./components.ts";

const object = { layer: "object", obstacle: true } as const;
const cover = { layer: "cover" } as const;

/**
 * Every kind of entity as a named bundle of default components. Plain data
 * that would serialise as JSON, so it can later become stored rows; a test
 * parses every row with the `Components` schema.
 *
 * Glyphs are unique. Upper case and punctuation mostly mark things that
 * block walking, lower case things underfoot.
 */
export const kindRows = {
  oak: {
    ...object,
    appearance: { model: "oak-tree" },
    label: { glyph: "T", noun: "oak tree" },
  },
  pine: {
    ...object,
    appearance: { model: "pine-tree" },
    label: { glyph: "A", noun: "pine tree" },
  },
  birch: {
    ...object,
    appearance: { model: "birch-tree" },
    label: { glyph: "I", noun: "birch tree" },
  },
  "dead-tree": {
    ...object,
    appearance: { model: "dead-tree" },
    label: { glyph: "Y", noun: "dead tree" },
  },
  stump: {
    ...object,
    appearance: { model: "stump" },
    label: { glyph: "U", noun: "tree stump" },
  },
  log: {
    ...object,
    appearance: { model: "fallen-log" },
    label: { glyph: "L", noun: "fallen log" },
  },
  bush: {
    ...object,
    appearance: { model: "bush" },
    label: { glyph: "B", noun: "bush", plural: "bushes" },
  },
  "berry-bush": {
    ...object,
    appearance: { model: "berry-bush" },
    label: { glyph: "Q", noun: "berry bush", plural: "berry bushes" },
  },
  rock: {
    ...object,
    appearance: { model: "rock" },
    label: { glyph: "R", noun: "rock" },
  },
  boulder: {
    ...object,
    appearance: { model: "boulder" },
    label: { glyph: "O", noun: "boulder" },
  },
  block: {
    ...object,
    appearance: { model: "block" },
    colour: "red",
    label: { glyph: "H", noun: "block" },
  },
  sign: {
    ...object,
    appearance: { model: "sign" },
    label: { glyph: "S", noun: "sign" },
  },
  fence: {
    ...object,
    appearance: { model: "fence" },
    label: { glyph: "#", noun: "fence" },
  },
  lantern: {
    ...object,
    appearance: { model: "lantern" },
    label: { glyph: "!", noun: "lantern" },
  },
  bench: {
    ...object,
    appearance: { model: "bench" },
    label: { glyph: "n", noun: "bench", plural: "benches" },
  },
  campfire: {
    ...object,
    appearance: { model: "campfire" },
    label: { glyph: "x", noun: "campfire" },
  },
  fern: {
    ...cover,
    appearance: { model: "fern" },
    label: { glyph: "f", noun: "fern" },
  },
  "tall-grass": {
    ...cover,
    appearance: { model: "tall-grass" },
    label: {
      glyph: "v",
      noun: "tuft of tall grass",
      plural: "tufts of tall grass",
    },
  },
  flowers: {
    ...cover,
    appearance: { model: "flower-patch" },
    colour: "pink",
    label: { glyph: "*", noun: "flower patch", plural: "flower patches" },
  },
  pebbles: {
    ...cover,
    appearance: { model: "pebbles" },
    label: {
      glyph: "'",
      noun: "patch of pebbles",
      plural: "patches of pebbles",
    },
  },
  mushroom: {
    appearance: { model: "mushroom" },
    label: { glyph: "m", noun: "mushroom" },
  },
  reeds: {
    ...cover,
    aquatic: true,
    appearance: { model: "reeds" },
    label: { glyph: "|", noun: "clump of reeds", plural: "clumps of reeds" },
  },
  "lily-pad": {
    ...cover,
    aquatic: true,
    appearance: { model: "lily-pad" },
    label: { glyph: "o", noun: "lily pad" },
  },
} as const satisfies Record<string, Components>;

export const KindName = Schema.Literals(Record.keys(kindRows));

export type KindName = typeof KindName.Type;

export const kindNames = KindName.literals;

const defaults: Record<KindName, Components> = kindRows;

export const kindDefaults = (kind: KindName) => defaults[kind];
