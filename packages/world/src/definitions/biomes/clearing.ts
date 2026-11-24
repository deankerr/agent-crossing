import { biome } from "../../schema/biome.ts";
import { Terrain } from "../prefabs/index.ts";

/** Open grass with nothing growing on it, kept clear for gathering. */
export const Clearing = biome({
  name: "clearing",
  floor: Terrain.Grass,
  grows: [],
  extras: [],
});
