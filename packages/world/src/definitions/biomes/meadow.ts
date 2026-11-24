import { biome } from "../../schema/biome.ts";
import { Nature, Terrain } from "../prefabs/index.ts";
import { Flowers } from "./flowers.ts";

/** Dry, sunny ground thick with flowers and tall grass. */
export const Meadow = biome({
  name: "meadow",
  floor: Terrain.Meadow,
  grows: [
    [Flowers, 0.16],
    [Nature.TallGrass, 0.12],
    [Nature.Bush, 0.03],
    [Nature.BerryBush, 0.015],
    [Nature.Oak, 0.01],
    [Nature.Birch, 0.005],
  ],
  extras: [],
});
