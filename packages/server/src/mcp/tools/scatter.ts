import * as Command from "@agent-crossing/world/Command";
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";

import { AFTER_EDIT, editing, randomSeed } from "../edit.ts";
import {
  ComponentsInput,
  parsedCommand,
  Prefab,
  RegionInput,
  regionOf,
  Seed,
} from "../inputs.ts";
import { editTool } from "../tool.ts";

const ScatterInput = Schema.Struct({
  prefabs: Schema.NonEmptyArray(Prefab).annotate({
    description: `1 to ${Command.SCATTER_MAX_PREFABS} prefabs, chosen at random for each placement.`,
  }),
  region: RegionInput,
  density: Schema.Finite.annotate({
    description:
      "The share of the region's cells to try, 0 to 1. Cells where an entity may not be are skipped.",
  }),
  seed: Schema.optionalKey(Seed),
  components: Schema.optionalKey(ComponentsInput),
});

/** `scatter`: spawns entities over a share of a region. */
export const Scatter = editTool(
  "scatter",
  {
    description: `Spawns entities of the given prefabs on a random share (density) of a region's cells, skipping cells where they may not be. Good for forests, meadows and reed beds. ${AFTER_EDIT}`,
    parameters: ScatterInput,
  },
  { destructive: false, idempotent: false }
);

const scatterCommand = (
  { region, seed, ...scattered }: typeof ScatterInput.Type,
  fallbackSeed: number
) =>
  parsedCommand({
    ...scattered,
    _tag: "Scatter",
    region: regionOf(region),
    seed: seed ?? fallbackSeed,
  });

/** The handler of `scatter`, with a random seed when none is given. */
export const scatter = Effect.map(
  editing,
  (edit) => (input: typeof ScatterInput.Type) =>
    Effect.flatMap(randomSeed, (seed) => edit(scatterCommand(input, seed)))
);
