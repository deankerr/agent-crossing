import * as McpServer from "effect/ai/McpServer";
import * as Tool from "effect/ai/Tool";
import * as Toolkit from "effect/ai/Toolkit";
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";

import { AFTER_EDIT, editing } from "../edit.ts";
import { ComponentsInput, parsedCommand, Prefab, X, Y } from "../inputs.ts";
import { reply, textContent } from "../tool.ts";

export const SpawnInput = Schema.Struct({
  prefab: Prefab,
  x: X,
  y: Y,
  components: Schema.optionalKey(ComponentsInput),
});

const Spawn = Tool.make("spawn", {
  ...reply,
  description: `Puts one entity of a prefab on a cell, optionally with its own components, such as the text of a sign. Refused when the cell has no floor, the place (land or water) is not in its habitat or its layer is taken. ${AFTER_EDIT}`,
  parameters: SpawnInput,
})
  .annotate(Tool.Destructive, false)
  .annotate(Tool.Idempotent, false)
  .annotate(Tool.OpenWorld, false);

/** The command a spawn asks for, or what is wrong with it. */
export const spawnCommand = ({ x, y, ...spawned }: typeof SpawnInput.Type) =>
  parsedCommand({ ...spawned, _tag: "Spawn", cell: { x, y } });

const toolkit = Toolkit.make(Spawn);

/** Registers `spawn`: puts one entity on a cell. */
export const spawn = McpServer.registerToolkit(toolkit, {
  content: { spawn: textContent },
}).pipe(
  Effect.provide(
    toolkit.toLayer(
      Effect.map(editing, (edit) => ({
        spawn: (input) => edit(spawnCommand(input)),
      }))
    )
  )
);
