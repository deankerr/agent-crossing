import * as Prefabs from "@agent-crossing/definitions/Prefabs";

import * as Biome from "../../Biome.ts";

/** Bare patches of earth. */
export const Dirt = Biome.make({
  name: "dirt",
  floor: Prefabs.Terrain.Dirt,
  grows: [
    [Prefabs.Nature.Pebbles, 0.06],
    [Prefabs.Nature.Stump, 0.02],
  ],
  extras: [],
});
