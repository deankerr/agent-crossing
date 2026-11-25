import * as McpServer from "effect/ai/McpServer";
import * as Tool from "effect/ai/Tool";
import * as Toolkit from "effect/ai/Toolkit";
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";

import { AFTER_EDIT, editing } from "../edit.ts";
import {
  Floor,
  Liquid,
  parsedCommand,
  RegionInput,
  regionOf,
} from "../inputs.ts";
import { reply, textContent } from "../tool.ts";

export const PourInput = Schema.Struct({
  region: RegionInput,
  liquid: Liquid,
  bed: Schema.optionalKey(
    Floor.annotate({
      description:
        "The floor prefab the bed under the liquid becomes; the floor keeps its prefab when left out.",
    })
  ),
});

const PourLiquid = Tool.make("pour_liquid", {
  ...reply,
  description: `Pours a liquid over every floor of a region that has none, turning that land into water: the liquid takes the floor's level and the floor sinks one level beneath it, becoming the bed prefab when one is given. Floors already at the lowest level are skipped, and entities whose habitat is only land are removed. ${AFTER_EDIT}`,
  parameters: PourInput,
})
  .annotate(Tool.Destructive, true)
  .annotate(Tool.Idempotent, true)
  .annotate(Tool.OpenWorld, false);

/** The command a pour asks for, or what is wrong with it. */
export const pourCommand = ({ region, ...liquid }: typeof PourInput.Type) =>
  parsedCommand({ ...liquid, _tag: "Pour", region: regionOf(region) });

const toolkit = Toolkit.make(PourLiquid);

/** Registers `pour_liquid`: turns the land of a region into water. */
export const pourLiquid = McpServer.registerToolkit(toolkit, {
  content: { pour_liquid: textContent },
}).pipe(
  Effect.provide(
    toolkit.toLayer(
      Effect.map(editing, (edit) => ({
        pour_liquid: (input) => edit(pourCommand(input)),
      }))
    )
  )
);
