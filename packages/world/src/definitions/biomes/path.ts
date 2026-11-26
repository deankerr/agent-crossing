import * as Prefabs from "@agent-crossing/definitions/Prefabs";

import { biome } from "../../schema/biome.ts";

/** A clear path, with nothing growing on it. */
export const Path = biome({
  name: "path",
  floor: Prefabs.Terrain.Path,
  grows: [],
  extras: [],
});
