import { prefabsText } from "@agent-crossing/world/text/prefabs";
import * as McpServer from "effect/ai/McpServer";
import * as Tool from "effect/ai/Tool";
import * as Toolkit from "effect/ai/Toolkit";
import * as Effect from "effect/Effect";

import { reply, textContent } from "../tool.ts";

const ListPrefabs = Tool.make("list_prefabs", {
  ...reply,
  description:
    "Every prefab with its glyph, name, label, layer and habitat, and whether it is an obstacle.",
})
  .annotate(Tool.Readonly, true)
  .annotate(Tool.Idempotent, true)
  .annotate(Tool.OpenWorld, false);

const toolkit = Toolkit.make(ListPrefabs);

/** Registers `list_prefabs`: every prefab and what it is. */
export const listPrefabs = McpServer.registerToolkit(toolkit, {
  content: { list_prefabs: textContent },
}).pipe(
  Effect.provide(
    toolkit.toLayer({ list_prefabs: () => Effect.succeed(prefabsText()) })
  )
);
