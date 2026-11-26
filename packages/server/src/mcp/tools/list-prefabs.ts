import { prefabsText } from "@agent-crossing/world/text/prefabs";
import * as Effect from "effect/Effect";

import { queryTool } from "../tool.ts";

/** `list_prefabs`: every prefab and what it is. */
export const ListPrefabs = queryTool("list_prefabs", {
  description:
    "Every prefab with its glyph, name, label, layer and habitat, and whether it is an obstacle.",
});

/** The handler of `list_prefabs`. */
export const listPrefabs = Effect.succeed(() => Effect.succeed(prefabsText()));
