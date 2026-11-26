import * as Prefabs from "@agent-crossing/definitions/Prefabs";

import { biome } from "../../schema/biome.ts";

/** Shallow water next to land, over sand, full of reeds. */
export const Shore = biome({
  name: "shore",
  floor: Prefabs.Terrain.Sand,
  liquid: Prefabs.Terrain.Water,
  grows: [
    [Prefabs.Nature.Reeds, 0.32],
    [Prefabs.Nature.LilyPad, 0.03],
  ],
  extras: [],
});
