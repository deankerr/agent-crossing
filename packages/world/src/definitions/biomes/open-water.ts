import { biome } from "../../schema/biome.ts";
import { Nature, Terrain } from "../prefabs/index.ts";

/** Water away from the shore, over dirt, with lily pads. */
export const OpenWater = biome({
  name: "open-water",
  floor: Terrain.Dirt,
  liquid: Terrain.Water,
  grows: [[Nature.LilyPad, 0.14]],
  extras: [],
});
