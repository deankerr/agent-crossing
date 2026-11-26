import * as Prefabs from "@agent-crossing/definitions/Prefabs";

import * as Biome from "../../Biome.ts";

/** Rocky heights. */
export const Stone = Biome.make({
  name: "stone",
  floor: Prefabs.Terrain.Stone,
  grows: [
    [Prefabs.Nature.Rock, 0.1],
    [Prefabs.Nature.Boulder, 0.05],
    [Prefabs.Nature.Pebbles, 0.07],
    [Prefabs.Nature.Pine, 0.03],
    [Prefabs.Nature.DeadTree, 0.02],
  ],
  extras: [],
});
