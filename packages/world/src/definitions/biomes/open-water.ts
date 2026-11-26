import * as Prefabs from "@agent-crossing/definitions/Prefabs";

import { biome } from "../../schema/biome.ts";

/** Water away from the shore, over dirt, with lily pads. */
export const OpenWater = biome({
  name: "open-water",
  floor: Prefabs.Terrain.Dirt,
  liquid: Prefabs.Terrain.Water,
  grows: [[Prefabs.Nature.LilyPad, 0.14]],
  extras: [],
});
