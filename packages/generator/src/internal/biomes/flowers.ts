import * as Prefabs from "@agent-crossing/definitions/Prefabs";

import * as Biome from "../../Biome.ts";

const { FlowerPatches } = Prefabs.Nature;

/** A flower patch of any bloom, pinks and yellows the most common. */
export const Flowers = Biome.weighted([
  [FlowerPatches.pink, 3],
  [FlowerPatches.yellow, 3],
  [FlowerPatches.white, 2],
  [FlowerPatches.purple, 2],
  [FlowerPatches.red, 1],
  [FlowerPatches.orange, 1],
  [FlowerPatches.blue, 1],
]);
