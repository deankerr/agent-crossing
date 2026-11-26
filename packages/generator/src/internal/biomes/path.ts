import * as Prefabs from "@agent-crossing/definitions/Prefabs";

import * as Biome from "../../Biome.ts";

/** A clear path, with nothing growing on it. */
export const Path = Biome.make({
  name: "path",
  floor: Prefabs.Terrain.Path,
  grows: [],
  extras: [],
});
