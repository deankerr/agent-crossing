import { describe, expect, it } from "@effect/vitest";
import * as Arr from "effect/Array";
import * as Record from "effect/Record";

import { Biomes } from "../index.ts";

describe("the definitions", () => {
  it("gives each biome growth chances summing to at most 1", () => {
    const overfull = Arr.filter(
      Record.values(Biomes),
      (biome) =>
        Arr.reduce(biome.grows, 0, (sum, [, chance]) => sum + chance) > 1
    );

    expect(Arr.map(overfull, (biome) => biome.name)).toStrictEqual([]);
  });
});
