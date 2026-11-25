import { VIEW_MAX_RADIUS } from "@agent-crossing/world/text/agent-view";
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";

import { WorldClient } from "../../world-object/client.ts";
import { cellFor, X, Y } from "../inputs.ts";
import { queryTool } from "../tool.ts";

const ViewAsAgentInput = Schema.Struct({
  x: X,
  y: Y,
  radius: Schema.optionalKey(
    Schema.Int.annotate({
      description: `How many cells it sees in each direction, 0 to ${VIEW_MAX_RADIUS}; default 8.`,
    })
  ),
});

/** `view_as_agent`: what an agent standing on a cell would be told. */
export const ViewAsAgent = queryTool("view_as_agent", {
  description:
    "What an agent standing on a cell would be told: the floor or liquid under it and its level, a map of the square around it with @ at its cell, what stands nearby and any writing. Use it to check how a place reads to an agent.",
  parameters: ViewAsAgentInput,
});

/** The handler of `view_as_agent`. */
export const viewAsAgent = Effect.map(
  WorldClient,
  (world) =>
    ({ radius, x, y }: typeof ViewAsAgentInput.Type) =>
      Effect.flatMap(cellFor(x, y), (cell) =>
        world.agentView(cell, radius ?? 8)
      )
);
