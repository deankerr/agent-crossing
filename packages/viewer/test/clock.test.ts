import { describe, expect, it } from "@effect/vitest";

import { clockOffset, serverTime } from "../src/clock.ts";

describe(clockOffset, () => {
  it("maps local time onto the server clock", () => {
    const offset = clockOffset(1_000_500, 1_000_000);

    expect(offset).toBe(500);
    expect(serverTime(offset, 1_002_000)).toBe(1_002_500);
  });

  it("handles a browser clock that runs ahead", () => {
    expect(serverTime(clockOffset(1000, 61_000), 62_000)).toBe(2000);
  });
});
