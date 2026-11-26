import * as Prefabs from "@agent-crossing/definitions/Prefabs";

import * as Biome from "../../Biome.ts";

/** Open grass with nothing growing on it, kept clear for gathering. */
export const Clearing = Biome.make({
  name: "clearing",
  floor: Prefabs.Terrain.Grass,
  grows: [],
  extras: [],
});
