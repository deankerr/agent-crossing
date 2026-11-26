import * as Prefabs from "@agent-crossing/definitions/Prefabs";

import { biome, weighted } from "../../schema/biome.ts";

/** Woodland on low land, mostly oaks. */
export const Forest = biome({
  name: "forest",
  floor: Prefabs.Terrain.ForestFloor,
  grows: [
    [
      weighted([
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
