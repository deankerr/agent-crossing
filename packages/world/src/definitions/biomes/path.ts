import { biome } from "../../schema/biome.ts";
import { Terrain } from "../prefabs/index.ts";

/** A clear path, with nothing growing on it. */
export const Path = biome({
  name: "path",
  floor: Terrain.Path,
  grows: [],
  extras: [],
});
