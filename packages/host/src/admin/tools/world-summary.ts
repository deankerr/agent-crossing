import * as Effect from "effect/Effect";

import { WorldClient } from "../../world-object/client.ts";
import { queryTool } from "../tool.ts";

/** `world_summary`: the world's extent and what it holds. */
export const WorldSummary = queryTool("world_summary", {
  description:
    "The world's extent (the bounding box of its floors), how many cells of each floor and of water it has, how many entities of each sort it holds, and how many events its history has. Start here.",
});

/** The handler of `world_summary`. */
export const worldSummary = Effect.map(
  WorldClient,
  (world) => () => world.summary
);
