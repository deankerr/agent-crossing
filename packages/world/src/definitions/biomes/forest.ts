import { biome, weighted } from "../../schema/biome.ts";
import { Nature, Terrain } from "../prefabs/index.ts";

/** Woodland on low land, mostly oaks. */
export const Forest = biome({
  name: "forest",
  floor: Terrain.ForestFloor,
  grows: [
    [
      weighted([
        [Nature.Oak, 0.42],
        [Nature.Pine, 0.25],
        [Nature.Birch, 0.25],
        [Nature.DeadTree, 0.08],
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
