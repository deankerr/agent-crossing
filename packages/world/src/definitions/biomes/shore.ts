import { biome } from "../../schema/biome.ts";
import { Nature, Terrain } from "../prefabs/index.ts";

/** Shallow water next to land, over sand, full of reeds. */
export const Shore = biome({
  name: "shore",
  floor: Terrain.Sand,
  liquid: Terrain.Water,
  grows: [
    [Nature.Reeds, 0.32],
    [Nature.LilyPad, 0.03],
  ],
  extras: [],
});
