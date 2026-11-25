import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";

import { AFTER_EDIT, editing } from "../edit.ts";
import { ComponentsInput, parsedCommand, Prefab, X, Y } from "../inputs.ts";
import { editTool } from "../tool.ts";

const SpawnInput = Schema.Struct({
  prefab: Prefab,
  x: X,
  y: Y,
  components: Schema.optionalKey(ComponentsInput),
});

/** `spawn`: puts one entity on a cell. */
export const Spawn = editTool(
  "spawn",
  {
    description: `Puts one entity of a prefab on a cell, optionally with its own components, such as the text of a sign. Refused when the cell has no floor, the place (land or water) is not in its habitat or its layer is taken. ${AFTER_EDIT}`,
    parameters: SpawnInput,
  },
  { destructive: false, idempotent: false }
);

/** The handler of `spawn`. */
export const spawn = Effect.map(
  editing,
  (edit) =>
    ({ x, y, ...spawned }: typeof SpawnInput.Type) =>
      edit(parsedCommand({ ...spawned, _tag: "Spawn", cell: { x, y } }))
);
