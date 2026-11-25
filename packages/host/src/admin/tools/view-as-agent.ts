import { VIEW_MAX_RADIUS } from "@agent-crossing/world/text/agent-view";
import * as McpServer from "effect/ai/McpServer";
import * as Tool from "effect/ai/Tool";
import * as Toolkit from "effect/ai/Toolkit";
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";

import { WorldClient } from "../../world-object/client.ts";
import { cellFor, X, Y } from "../inputs.ts";
import { reply, textContent } from "../tool.ts";

export const ViewAsAgentInput = Schema.Struct({
  x: X,
  y: Y,
  radius: Schema.optionalKey(
    Schema.Int.annotate({
      description: `How many cells it sees in each direction, 0 to ${VIEW_MAX_RADIUS}; default 8.`,
    })
  ),
});

const ViewAsAgent = Tool.make("view_as_agent", {
  ...reply,
  description:
    "What an agent standing on a cell would be told: the floor or liquid under it and its level, a map of the square around it with @ at its cell, what stands nearby and any writing. Use it to check how a place reads to an agent.",
  parameters: ViewAsAgentInput,
})
  .annotate(Tool.Readonly, true)
  .annotate(Tool.Idempotent, true)
  .annotate(Tool.OpenWorld, false);

const toolkit = Toolkit.make(ViewAsAgent);

/** Registers `view_as_agent`: what an agent standing on a cell would be told. */
export const viewAsAgent = McpServer.registerToolkit(toolkit, {
  content: { view_as_agent: textContent },
}).pipe(
  Effect.provide(
    toolkit.toLayer(
      Effect.map(WorldClient, (world) => ({
        view_as_agent: ({ radius, x, y }) =>
          Effect.flatMap(cellFor(x, y), (cell) =>
            world.agentView(cell, radius ?? 8)
          ),
      }))
    )
  )
);
