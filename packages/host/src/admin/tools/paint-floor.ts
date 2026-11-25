import { MAX_LEVEL, MIN_LEVEL } from "@agent-crossing/world/schema/cell";
import * as McpServer from "effect/ai/McpServer";
import * as Tool from "effect/ai/Tool";
import * as Toolkit from "effect/ai/Toolkit";
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";

import { AFTER_EDIT, editing } from "../edit.ts";
import { Floor, parsedCommand, RegionInput, regionOf } from "../inputs.ts";
import { reply, textContent } from "../tool.ts";

export const PaintInput = Schema.Struct({
  region: RegionInput,
  floor: Schema.optionalKey(Floor),
  level: Schema.optionalKey(
    Schema.Int.annotate({
      description: `Level ${MIN_LEVEL} (low) to ${MAX_LEVEL} (high). Floors keep their level when left out; new floors start at 0.`,
    })
  ),
});

const PaintFloor = Tool.make("paint_floor", {
  ...reply,
  description: `Sets the floor prefab, the level or both across a region, keeping what stands on the floors. Cells without a floor join the world only when a floor is given; new floors start at level 0 unless a level is given. ${AFTER_EDIT}`,
  parameters: PaintInput,
})
  .annotate(Tool.Destructive, true)
  .annotate(Tool.Idempotent, true)
  .annotate(Tool.OpenWorld, false);

/** The command a paint asks for, or what is wrong with it. */
export const paintCommand = ({ region, ...floor }: typeof PaintInput.Type) =>
  parsedCommand({ ...floor, _tag: "Paint", region: regionOf(region) });

const toolkit = Toolkit.make(PaintFloor);

/** Registers `paint_floor`: lays or changes the floors of a region. */
export const paintFloor = McpServer.registerToolkit(toolkit, {
  content: { paint_floor: textContent },
}).pipe(
  Effect.provide(
    toolkit.toLayer(
      Effect.map(editing, (edit) => ({
        paint_floor: (input) => edit(paintCommand(input)),
      }))
    )
  )
);
