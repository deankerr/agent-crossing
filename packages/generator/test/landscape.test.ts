import * as Cell from "@agent-crossing/world/Cell";
import { describe, expect, it } from "@effect/vitest";
import * as Option from "effect/Option";

import * as Landscape from "../src/Landscape.ts";

const spec = (seed: number) => ({
  height: 40,
  origin: Option.getOrThrow(Cell.at(-5, 3)),
  seed,
  width: 48,
});

describe("generating a landscape", () => {
  it("is a pure function of its seed", () => {
    expect(Landscape.entities(spec(7))).toStrictEqual(
      Landscape.entities(spec(7))
    );
    expect(Landscape.entities(spec(7))).not.toStrictEqual(
      Landscape.entities(spec(8))
    );
  });
});
