import { biome } from "../../schema/biome.ts";
import { Nature, Terrain } from "../prefabs/index.ts";

/** Rocky heights. */
export const Stone = biome({
  name: "stone",
  floor: Terrain.Stone,
  grows: [
    [Nature.Rock, 0.1],
    [Nature.Boulder, 0.05],
    [Nature.Pebbles, 0.07],
    [Nature.Pine, 0.03],
    [Nature.DeadTree, 0.02],
  ],
  extras: [],
});
