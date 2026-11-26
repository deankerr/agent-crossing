import * as Prefabs from "@agent-crossing/definitions/Prefabs";

import { biome } from "../../schema/biome.ts";
import { Flowers } from "./flowers.ts";

/** Open grass with the odd flower, bush or tree. */
export const Grassland = biome({
  name: "grassland",
  floor: Prefabs.Terrain.Grass,
  grows: [
    [Flowers, 0.035],
    [Prefabs.Nature.TallGrass, 0.045],
    [Prefabs.Nature.Bush, 0.012],
    [Prefabs.Nature.Oak, 0.01],
    [Prefabs.Nature.Birch, 0.006],
    [Prefabs.Nature.Rock, 0.006],
  ],
  extras: [],
});
