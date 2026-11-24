import { biome } from "../../schema/biome.ts";
import { Nature, Terrain } from "../prefabs/index.ts";
import { Flowers } from "./flowers.ts";

/** Open grass with the odd flower, bush or tree. */
export const Grassland = biome({
  name: "grassland",
  floor: Terrain.Grass,
  grows: [
    [Flowers, 0.035],
    [Nature.TallGrass, 0.045],
    [Nature.Bush, 0.012],
    [Nature.Oak, 0.01],
    [Nature.Birch, 0.006],
    [Nature.Rock, 0.006],
  ],
  extras: [],
});
