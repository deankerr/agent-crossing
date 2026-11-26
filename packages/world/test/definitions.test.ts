import { describe, expect, it } from "@effect/vitest";
import * as Arr from "effect/Array";
import * as Record from "effect/Record";
import * as Result from "effect/Result";
import * as Schema from "effect/Schema";

import { Biomes } from "../src/definitions/biomes/index.ts";
import { prefabs } from "../src/definitions/prefabs/index.ts";
import { Components } from "../src/schema/components.ts";

const parse = Schema.decodeUnknownResult(Components);

describe("the definitions", () => {
  it("parses every prefab's components", () => {
    const failing = Arr.filter(prefabs, (prefab) =>
      Result.isFailure(parse(prefab.components))
    );

    expect(Arr.map(failing, (prefab) => prefab.name)).toStrictEqual([]);
  });

  it("names every prefab once", () => {
    const names = Arr.map(prefabs, (prefab) => prefab.name);

    expect(Arr.dedupe(names)).toStrictEqual(names);
  });

  it("names every part once within its model", () => {
    const repeating = Arr.filter(prefabs, (prefab) => {
      const parts = Arr.map(prefab.components.model.parts, (part) => part.name);

      return Arr.dedupe(parts).length !== parts.length;
    });

    expect(Arr.map(repeating, (prefab) => prefab.name)).toStrictEqual([]);
  });

  it("gives each biome growth chances summing to at most 1", () => {
    const overfull = Arr.filter(
      Record.values(Biomes),
      (biome) =>
        Arr.reduce(biome.grows, 0, (sum, [, chance]) => sum + chance) > 1
    );

    expect(Arr.map(overfull, (biome) => biome.name)).toStrictEqual([]);
  });
});
