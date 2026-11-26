import { describe, expect, it } from "@effect/vitest";
import * as Arr from "effect/Array";
import * as Result from "effect/Result";
import * as Schema from "effect/Schema";

import * as Components from "../src/Components.ts";
import * as Prefabs from "../src/Prefabs.ts";

const parse = Schema.decodeUnknownResult(Components.Components);

describe("the prefabs", () => {
  it("parses every prefab's components", () => {
    const failing = Arr.filter(Prefabs.all, (prefab) =>
      Result.isFailure(parse(prefab.components))
    );

    expect(Arr.map(failing, (prefab) => prefab.name)).toStrictEqual([]);
  });

  it("names every prefab once", () => {
    const names = Arr.map(Prefabs.all, (prefab) => prefab.name);

    expect(Arr.dedupe(names)).toStrictEqual(names);
  });

  it("names every part once within its model", () => {
    const repeating = Arr.filter(Prefabs.all, (prefab) => {
      const parts = Arr.map(prefab.components.model.parts, (part) => part.name);

      return Arr.dedupe(parts).length !== parts.length;
    });

    expect(Arr.map(repeating, (prefab) => prefab.name)).toStrictEqual([]);
  });
});
