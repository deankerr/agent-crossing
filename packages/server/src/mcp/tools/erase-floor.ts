import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";

import { AFTER_EDIT, editing } from "../edit.ts";
import { parsedCommand, RegionInput, regionOf } from "../inputs.ts";
import { editTool } from "../tool.ts";

const EraseInput = Schema.Struct({ region: RegionInput });

/** `erase_floor`: removes a region from the world. */
export const EraseFloor = editTool(
  "erase_floor",
  {
    description: `Removes the floors of a region and every entity on them, liquids included: those cells leave the world. ${AFTER_EDIT}`,
    parameters: EraseInput,
  },
  { destructive: true, idempotent: true }
);

/** The handler of `erase_floor`. */
export const eraseFloor = Effect.map(
  editing,
  (edit) => (input: typeof EraseInput.Type) =>
    edit(parsedCommand({ _tag: "Erase", region: regionOf(input.region) }))
);
