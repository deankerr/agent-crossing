import * as McpServer from "effect/ai/McpServer";
import * as Tool from "effect/ai/Tool";
import * as Toolkit from "effect/ai/Toolkit";
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";

import { AFTER_EDIT, editing } from "../edit.ts";
import { parsedCommand, RegionInput, regionOf } from "../inputs.ts";
import { reply, textContent } from "../tool.ts";

export const EraseInput = Schema.Struct({ region: RegionInput });

const EraseFloor = Tool.make("erase_floor", {
  ...reply,
  description: `Removes the floors of a region and every entity on them, liquids included: those cells leave the world. ${AFTER_EDIT}`,
  parameters: EraseInput,
})
  .annotate(Tool.Destructive, true)
  .annotate(Tool.Idempotent, true)
  .annotate(Tool.OpenWorld, false);

/** The command an erase asks for, or what is wrong with it. */
export const eraseCommand = (input: typeof EraseInput.Type) =>
  parsedCommand({ _tag: "Erase", region: regionOf(input.region) });

const toolkit = Toolkit.make(EraseFloor);

/** Registers `erase_floor`: removes a region from the world. */
export const eraseFloor = McpServer.registerToolkit(toolkit, {
  content: { erase_floor: textContent },
}).pipe(
  Effect.provide(
    toolkit.toLayer(
      Effect.map(editing, (edit) => ({
        erase_floor: (input) => edit(eraseCommand(input)),
      }))
    )
  )
);
