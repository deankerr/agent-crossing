import * as Prefabs from "@agent-crossing/definitions/Prefabs";

import * as Biome from "../../Biome.ts";

/** Water away from the shore, over dirt, with lily pads. */
export const OpenWater = Biome.make({
  name: "open-water",
  floor: Prefabs.Terrain.Dirt,
  liquid: Prefabs.Terrain.Water,
  grows: [[Prefabs.Nature.LilyPad, 0.14]],
  extras: [],
});
