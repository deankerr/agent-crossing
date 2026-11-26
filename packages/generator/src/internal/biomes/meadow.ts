import * as Prefabs from "@agent-crossing/definitions/Prefabs";

import * as Biome from "../../Biome.ts";
import { Flowers } from "./flowers.ts";

/** Dry, sunny land thick with flowers and tall grass. */
export const Meadow = Biome.make({
  name: "meadow",
  floor: Prefabs.Terrain.Meadow,
  grows: [
    [Flowers, 0.16],
    [Prefabs.Nature.TallGrass, 0.12],
    [Prefabs.Nature.Bush, 0.03],
    [Prefabs.Nature.BerryBush, 0.015],
    [Prefabs.Nature.Oak, 0.01],
    [Prefabs.Nature.Birch, 0.005],
  ],
  extras: [],
});
