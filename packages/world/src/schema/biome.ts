import * as Arr from "effect/Array";
import * as Record from "effect/Record";

import type { Prefab } from "./prefab.ts";

/** A prefab with its weight, relative to the others in a choice. */
export type WeightedPrefab = readonly [Prefab, number];

/** A weighted set of prefabs, one of which is picked. */
export interface Choice {
  readonly options: readonly WeightedPrefab[];
}

/** Each prefab with its weight, relative to the others. */
export const weighted = (options: readonly WeightedPrefab[]) =>
  ({ options }) satisfies Choice;

/** Every prefab equally likely, from a list or a record. */
export const anyOf = (
  prefabs: Iterable<Prefab> | Readonly<Record<string, Prefab>>
) =>
  weighted(
    Arr.map(
      Symbol.iterator in prefabs
        ? Arr.fromIterable(prefabs)
        : Record.values(prefabs),
      (one) => [one, 1] as const
    )
  );

/** What a biome places on a cell, with its chance per cell. */
export type Growth = readonly [Prefab | Choice, number];

/** A recipe for generating an area. It is not stored in the world. */
export interface Biome {
  readonly name: string;
  readonly floor: Prefab;
  /** A liquid over the floor, making the area water. */
  readonly liquid?: Prefab;
  /**
   * At most one of these is placed per cell. The chances are slices of a
   * single roll, so they sum to at most 1.
   */
  readonly grows: readonly Growth[];
  /** Each rolled on its own, and may share a cell with what grew. */
  readonly extras: readonly Growth[];
}

/** A biome, keeping its name as a literal type. */
export const biome = <const Name extends string>(
  definition: Biome & { readonly name: Name }
) => definition;
