import * as McpServer from "effect/ai/McpServer";
import * as Tool from "effect/ai/Tool";
import * as Toolkit from "effect/ai/Toolkit";
import * as Effect from "effect/Effect";

import { WorldClient } from "../../world-object/client.ts";
import { reply, textContent } from "../tool.ts";

const WorldSummary = Tool.make("world_summary", {
  ...reply,
  description:
    "The world's extent (the bounding box of its floors), how many cells of each floor and of water it has, how many entities of each sort it holds, and how many events its history has. Start here.",
})
  .annotate(Tool.Readonly, true)
  .annotate(Tool.Idempotent, true)
  .annotate(Tool.OpenWorld, false);

const toolkit = Toolkit.make(WorldSummary);

/** Registers `world_summary`: the world's extent and what it holds. */
export const worldSummary = McpServer.registerToolkit(toolkit, {
  content: { world_summary: textContent },
}).pipe(
  Effect.provide(
    toolkit.toLayer(
      Effect.map(WorldClient, (world) => ({
        world_summary: () => world.summary,
      }))
    )
  )
);
