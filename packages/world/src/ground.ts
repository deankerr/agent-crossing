import * as Record from "effect/Record";
import * as Schema from "effect/Schema";

import { Cell } from "./cell.ts";
import type { Glyph, Noun } from "./values.ts";

export interface GroundTraits {
  /** Characters may stand on it. */
  readonly walkable: boolean;
  /** It is water: only aquatic things may be placed on it. */
  readonly wet: boolean;
  readonly noun: Noun;
  readonly glyph: Glyph;
}

/** Every kind of ground, as data. Rules ask about traits, never about names. */
export const groundCatalogue = {
  grass: { glyph: ".", noun: "grass", walkable: true, wet: false },
  meadow: { glyph: ",", noun: "meadow", walkable: true, wet: false },
  forest: { glyph: ";", noun: "forest floor", walkable: true, wet: false },
  sand: { glyph: ":", noun: "sand", walkable: true, wet: false },
  dirt: { glyph: "-", noun: "dirt", walkable: true, wet: false },
  path: { glyph: "=", noun: "path", walkable: true, wet: false },
  stone: { glyph: "^", noun: "stone", walkable: true, wet: false },
  water: { glyph: "~", noun: "water", walkable: false, wet: true },
} as const satisfies Record<string, GroundTraits>;

export const GroundKind = Schema.Literals(Record.keys(groundCatalogue));

export type GroundKind = typeof GroundKind.Type;

export const groundKinds = GroundKind.literals;

const traits: Record<GroundKind, GroundTraits> = groundCatalogue;

export const traitsOf = (kind: GroundKind) => traits[kind];

export const MAX_HEIGHT = 7;

export const Height = Schema.Int.check(
  Schema.isBetween({ maximum: MAX_HEIGHT, minimum: 0 })
);

export type Height = typeof Height.Type;

/** What an in-world cell is made of. A cell is in the world iff it has ground. */
export const Ground = Schema.Struct({ kind: GroundKind, height: Height });

export type Ground = typeof Ground.Type;

/** A cell together with its ground. */
export const Tile = Schema.Struct({ cell: Cell, ground: Ground });

export type Tile = typeof Tile.Type;

export const sameGround = (a: Ground, b: Ground) =>
  a.kind === b.kind && a.height === b.height;
