import * as Prefabs from "@agent-crossing/definitions/Prefabs";

import * as Biome from "../../Biome.ts";

/** Woodland on low land, mostly oaks. */
export const Forest = Biome.make({
  name: "forest",
  floor: Prefabs.Terrain.ForestFloor,
  grows: [
    [
      Biome.weighted([
        [Prefabs.Nature.Oak, 0.42],
        [Prefabs.Nature.Pine, 0.25],
        [Prefabs.Nature.Birch, 0.25],
        [Prefabs.Nature.DeadTree, 0.08],
      ]),
      0.42,
    ],
    [Prefabs.Nature.Fern, 0.1],
    [Prefabs.Nature.Log, 0.025],
    [Prefabs.Nature.Stump, 0.02],
    [Prefabs.Nature.Bush, 0.02],
    [Prefabs.Nature.BerryBush, 0.015],
  ],
  extras: [[Prefabs.Nature.Mushroom, 0.04]],
});
