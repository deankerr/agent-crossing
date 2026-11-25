import { SCATTER_MAX_PREFABS } from "@agent-crossing/world/editing/command";
import * as McpServer from "effect/ai/McpServer";
import * as Tool from "effect/ai/Tool";
import * as Toolkit from "effect/ai/Toolkit";
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
import { reply, textContent } from "../tool.ts";

export const ScatterInput = Schema.Struct({
  prefabs: Schema.NonEmptyArray(Prefab).annotate({
    description: `1 to ${SCATTER_MAX_PREFABS} prefabs, chosen at random for each placement.`,
  }),
  region: RegionInput,
  density: Schema.Finite.annotate({
    description:
      "The share of the region's cells to try, 0 to 1. Cells where an entity may not be are skipped.",
  }),
  seed: Schema.optionalKey(Seed),
  components: Schema.optionalKey(ComponentsInput),
});

const Scatter = Tool.make("scatter", {
  ...reply,
  description: `Spawns entities of the given prefabs on a random share (density) of a region's cells, skipping cells where they may not be. Good for forests, meadows and reed beds. ${AFTER_EDIT}`,
  parameters: ScatterInput,
})
  .annotate(Tool.Destructive, false)
  .annotate(Tool.Idempotent, false)
  .annotate(Tool.OpenWorld, false);

/** The command a scatter asks for, with this seed unless it gives one, or what is wrong with it. */
export const scatterCommand = (
  { region, seed, ...scattered }: typeof ScatterInput.Type,
  fallbackSeed: number
) =>
  parsedCommand({
    ...scattered,
    _tag: "Scatter",
    region: regionOf(region),
    seed: seed ?? fallbackSeed,
  });

const toolkit = Toolkit.make(Scatter);

/** Registers `scatter`: spawns entities over a share of a region. */
export const scatter = McpServer.registerToolkit(toolkit, {
  content: { scatter: textContent },
}).pipe(
  Effect.provide(
    toolkit.toLayer(
      Effect.map(editing, (edit) => ({
        scatter: (input) =>
          Effect.flatMap(randomSeed, (seed) =>
            edit(scatterCommand(input, seed))
          ),
      }))
    )
  )
);
