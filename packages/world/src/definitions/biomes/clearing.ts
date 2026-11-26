import * as Prefabs from "@agent-crossing/definitions/Prefabs";

import { biome } from "../../schema/biome.ts";

/** Open grass with nothing growing on it, kept clear for gathering. */
export const Clearing = biome({
  name: "clearing",
  floor: Prefabs.Terrain.Grass,
  grows: [],
  extras: [],
});
