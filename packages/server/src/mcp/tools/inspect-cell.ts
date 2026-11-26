import * as Cell from "@agent-crossing/world/Cell";
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";

import { WorldClient } from "../../world-object/client.ts";
import { queryTool } from "../tool.ts";

const InspectCellInput = Schema.Struct({ cell: Cell.Cell });

/** `inspect_cell`: one cell and everything on it. */
export const InspectCell = queryTool("inspect_cell", {
  description:
    "One cell in detail: its floor and any liquid with their levels, whether it is land or water, and every other entity on it with its id and effective components.",
  parameters: InspectCellInput,
});

/** The handler of `inspect_cell`. */
export const inspectCell = Effect.map(
  WorldClient,
  (world) =>
    ({ cell }: typeof InspectCellInput.Type) =>
      world.inspect(cell)
);
