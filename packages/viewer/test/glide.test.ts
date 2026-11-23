import type { Tile } from "@agent-crossing/world/grid";
import { Motion, positionAt } from "@agent-crossing/world/walk";
import type { Path } from "@agent-crossing/world/walk";
import { describe, expect, it } from "@effect/vitest";

import {
  FACING_VIEWER,
  headingOf,
  placementAt,
  turnBetween,
} from "../src/glide.ts";
import { tile } from "./world.fixture.ts";

const flat = () => 0;
const terraced = (where: Tile) => (where.x >= 18 ? 1 : 0);

const path: Path = [tile(16, 16), tile(17, 16), tile(18, 16), tile(18, 17)];
const walking = Motion.cases.Walking.make({ path, startedAt: 10_000 });
const EAST = Math.PI / 2;
const SOUTH = 0;

describe(placementAt, () => {
  it("stands on its tile facing the viewer", () => {
    expect(
      placementAt(Motion.cases.Standing.make({ tile: tile(4, 5) }), 0, flat)
    ).toStrictEqual({
      heading: FACING_VIEWER,
      level: 0,
      stride: 0,
      walking: false,
      x: 4,
      y: 5,
    });
  });

  it("waits on the first tile until the walk starts", () => {
    expect(placementAt(walking, 9000, flat)).toMatchObject({ x: 16, y: 16 });
  });

  it("moves smoothly between tiles at three tiles a second", () => {
    const halfway = placementAt(walking, 10_000 + 1000 / 6, flat);

    expect(halfway.x).toBeCloseTo(16.5);
    expect(halfway.y).toBe(16);
    expect(halfway.heading).toBeCloseTo(EAST);
    expect(halfway.walking).toBeTruthy();
  });

  it("stays within the step the rules place it on", () => {
    for (let at = 10_000; at <= 11_000; at += 37) {
      const placement = placementAt(walking, at, flat);
      const ruled = positionAt(walking, at);

      expect(Math.abs(placement.x - ruled.x)).toBeLessThanOrEqual(1);
      expect(Math.abs(placement.y - ruled.y)).toBeLessThanOrEqual(1);
      expect(Math.floor(placement.x + 1e-9)).toBe(Math.min(ruled.x, 18));
    }
  });

  it("climbs between levels while stepping up", () => {
    const climbing = placementAt(walking, 10_000 + 1000 / 2, terraced);

    expect(climbing.level).toBeCloseTo(0.5);
    expect(placementAt(walking, 10_000 + 1000 / 3, terraced).level).toBeCloseTo(
      0
    );
  });

  it("turns through the corner rather than snapping", () => {
    const cornering = placementAt(walking, 10_000 + 2000 / 3, flat);

    expect(cornering.heading).toBeCloseTo((EAST + SOUTH) / 2);
  });

  it("stops at the destination facing its last step", () => {
    expect(placementAt(walking, 20_000, flat)).toMatchObject({
      heading: SOUTH,
      walking: false,
      x: 18,
      y: 17,
    });
  });
});

describe(turnBetween, () => {
  it("turns the short way round", () => {
    expect(turnBetween(3, -3, 0.5)).toBeCloseTo(Math.PI);
    expect(headingOf(tile(1, 1), tile(0, 1))).toBeCloseTo(-EAST);
  });
});
