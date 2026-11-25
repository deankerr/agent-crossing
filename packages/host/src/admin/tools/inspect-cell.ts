import * as McpServer from "effect/ai/McpServer";
import * as Tool from "effect/ai/Tool";
import * as Toolkit from "effect/ai/Toolkit";
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";

import { WorldClient } from "../../world-object/client.ts";
import { cellFor, X, Y } from "../inputs.ts";
import { reply, textContent } from "../tool.ts";

export const InspectCellInput = Schema.Struct({ x: X, y: Y });

const InspectCell = Tool.make("inspect_cell", {
  ...reply,
  description:
    "One cell in detail: its floor and any liquid with their levels, whether it is walkable, and every other entity on it with its id and effective components.",
  parameters: InspectCellInput,
})
  .annotate(Tool.Readonly, true)
  .annotate(Tool.Idempotent, true)
  .annotate(Tool.OpenWorld, false);

const toolkit = Toolkit.make(InspectCell);

/** Registers `inspect_cell`: one cell and everything on it. */
export const inspectCell = McpServer.registerToolkit(toolkit, {
  content: { inspect_cell: textContent },
}).pipe(
  Effect.provide(
    toolkit.toLayer(
      Effect.map(WorldClient, (world) => ({
        inspect_cell: ({ x, y }) =>
          Effect.flatMap(cellFor(x, y), world.inspect),
      }))
    )
  )
);
