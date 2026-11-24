import { biome, weighted } from "../../schema/biome.ts";
import { Nature, Terrain } from "../prefabs/index.ts";

/** Woodland on high ground, mostly pines. */
export const PineForest = biome({
  name: "pine-forest",
  floor: Terrain.ForestFloor,
  grows: [
    [
      weighted([
        [Nature.Pine, 0.55],
        [Nature.Oak, 0.2],
        [Nature.Birch, 0.15],
        [Nature.DeadTree, 0.1],
      ]),
      0.42,
    ],
    [Nature.Fern, 0.1],
    [Nature.Log, 0.025],
    [Nature.Stump, 0.02],
    [Nature.Bush, 0.02],
    [Nature.BerryBush, 0.015],
  ],
  extras: [[Nature.Mushroom, 0.04]],
});
