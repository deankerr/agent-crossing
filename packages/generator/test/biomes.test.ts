import { describe, expect, it } from "@effect/vitest";
import * as Arr from "effect/Array";

import * as Biomes from "../src/Biomes.ts";

describe("the biomes", () => {
  it("gives each biome growth chances summing to at most 1", () => {
    const overfull = Arr.filter(
      Biomes.all,
      (biome) =>
        Arr.reduce(biome.grows, 0, (sum, [, chance]) => sum + chance) > 1
    );

    expect(Arr.map(overfull, (biome) => biome.name)).toStrictEqual([]);
  });
});
