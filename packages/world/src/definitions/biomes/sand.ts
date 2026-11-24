import { biome } from "../../schema/biome.ts";
import { Nature, Terrain } from "../prefabs/index.ts";

/** The sandy land beside water. */
export const Sand = biome({
  name: "sand",
  floor: Terrain.Sand,
  grows: [
    [Nature.Pebbles, 0.04],
    [Nature.Rock, 0.01],
  ],
  extras: [],
});
