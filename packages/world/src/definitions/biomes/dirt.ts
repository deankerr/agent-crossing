import { biome } from "../../schema/biome.ts";
import { Nature, Terrain } from "../prefabs/index.ts";

/** Bare patches of earth. */
export const Dirt = biome({
  name: "dirt",
  floor: Terrain.Dirt,
  grows: [
    [Nature.Pebbles, 0.06],
    [Nature.Stump, 0.02],
  ],
  extras: [],
});
