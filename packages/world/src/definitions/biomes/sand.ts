import * as Prefabs from "@agent-crossing/definitions/Prefabs";

import { biome } from "../../schema/biome.ts";

/** The sandy land beside water. */
export const Sand = biome({
  name: "sand",
  floor: Prefabs.Terrain.Sand,
  grows: [
    [Prefabs.Nature.Pebbles, 0.04],
    [Prefabs.Nature.Rock, 0.01],
  ],
  extras: [],
});
