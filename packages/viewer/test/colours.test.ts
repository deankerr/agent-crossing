import { Colour } from "@agent-crossing/world/values";
import { describe, expect, it } from "@effect/vitest";
import * as Arr from "effect/Array";
import * as Record from "effect/Record";

import { characterColour, hueOf, palette } from "../src/colours.ts";

const names = ["fern", "mossy", "pip", "juniper", "wisp", "Fern", "a", "🌷"];

describe(hueOf, () => {
  it("is stable for a username", () => {
    expect(hueOf("fern")).toBe(hueOf("fern"));
    expect(characterColour("mossy")).toBe(characterColour("mossy"));
  });

  it.each(names)("keeps %s on the colour wheel", (name) => {
    expect(hueOf(name)).toBeGreaterThanOrEqual(0);
    expect(hueOf(name)).toBeLessThan(360);
    expect(Number.isInteger(hueOf(name))).toBeTruthy();
  });

  it("spreads different names across hues", () => {
    expect(new Set(Arr.map(names, (name) => hueOf(name))).size).toBeGreaterThan(
      5
    );
  });
});

describe("colour palette", () => {
  it("has a value for every colour in the world", () => {
    expect(new Set(Record.keys(palette))).toStrictEqual(
      new Set(Colour.literals)
    );
  });
});
