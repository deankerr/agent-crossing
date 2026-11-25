import { describe, expect, it } from "@effect/vitest";
import * as Option from "effect/Option";

import { generateLandscape } from "../src/generation/landscape.ts";
import { cellAt } from "../src/schema/cell.ts";

const spec = (seed: number) => ({
  height: 40,
  origin: Option.getOrThrow(cellAt(-5, 3)),
  seed,
  width: 48,
});

describe("generating a landscape", () => {
  it("is a pure function of its seed", () => {
    expect(generateLandscape(spec(7))).toStrictEqual(
      generateLandscape(spec(7))
    );
    expect(generateLandscape(spec(7))).not.toStrictEqual(
      generateLandscape(spec(8))
    );
  });
});
