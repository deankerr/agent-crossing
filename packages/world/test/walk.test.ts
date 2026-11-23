import { assert, describe, expect, it } from "@effect/vitest";
import * as Arr from "effect/Array";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";

import {
  allTiles,
  centre,
  isAdjacent,
  manhattanDistance,
  neighbours,
  sameTile,
  tileIndex,
} from "../src/grid.ts";
import { canStep, isLand } from "../src/terrain.ts";
import {
  arrivalAt,
  findPath,
  Motion,
  positionAt,
  walkInProgressAt,
} from "../src/walk.ts";
import type { Path } from "../src/walk.ts";
import { tile } from "./world.fixture.ts";

const nothingBlocked = () => false;

const isValidWalk = (path: Path) =>
  Arr.every(
    Arr.zip(path, Arr.drop(path, 1)),
    ([from, to]) => isAdjacent(from, to) && canStep(from, to)
  );

const landTiles = Arr.filter(allTiles, isLand);

describe(findPath, () => {
  it.prop(
    "walks between any two land tiles in valid shortest-looking steps",
    {
      from: Schema.Int.check(
        Schema.isBetween({ maximum: landTiles.length - 1, minimum: 0 })
      ),
      to: Schema.Int.check(
        Schema.isBetween({ maximum: landTiles.length - 1, minimum: 0 })
      ),
    },
    ({ from, to }) => {
      const start = landTiles[from] ?? centre;
      const end = landTiles[to] ?? centre;
      const path = Option.getOrThrow(findPath(start, end, nothingBlocked));
      assert.deepStrictEqual(path[0], start);
      assert.deepStrictEqual(Arr.lastNonEmpty(path), end);
      assert.isTrue(isValidWalk(path));
      assert.isAtLeast(path.length - 1, manhattanDistance(start, end));
    },
    { arbitrary: { runs: 60 } }
  );

  it("takes the straight line when nothing is in the way", () => {
    const start = centre;

    const end = Option.getOrThrow(
      Arr.findFirst(neighbours(centre), (next) => canStep(centre, next))
    );

    expect(findPath(start, end, nothingBlocked)).toStrictEqual(
      Option.some([start, end])
    );
  });

  it("walks around blocked tiles", () => {
    const blocked = new Set(
      Arr.map(
        Arr.filter(neighbours(centre), (next) => !sameTile(next, tile(17, 16))),
        tileIndex
      )
    );

    const path = Option.getOrThrow(
      findPath(centre, tile(16, 14), (step) => blocked.has(tileIndex(step)))
    );

    expect(Arr.some(path, (step) => blocked.has(tileIndex(step)))).toBeFalsy();
    expect(isValidWalk(path)).toBeTruthy();
  });

  it("finds nothing when the start is walled in", () => {
    const walls = new Set(Arr.map(neighbours(centre), tileIndex));
    expect(
      findPath(centre, tile(20, 20), (step) => walls.has(tileIndex(step)))
    ).toStrictEqual(Option.none());
  });
});

describe(positionAt, () => {
  const path: Path = [tile(16, 16), tile(17, 16), tile(18, 16), tile(19, 16)];

  const walking = Motion.cases.Walking.make({ path, startedAt: 10_000 });

  it("advances three tiles a second", () => {
    expect(positionAt(walking, 10_000)).toStrictEqual(tile(16, 16));
    expect(positionAt(walking, 10_333)).toStrictEqual(tile(16, 16));
    expect(positionAt(walking, 10_334)).toStrictEqual(tile(17, 16));
    expect(positionAt(walking, 10_667)).toStrictEqual(tile(18, 16));
    expect(positionAt(walking, 11_000)).toStrictEqual(tile(19, 16));
  });

  it("stays at the destination after arriving", () => {
    expect(arrivalAt(path, 10_000)).toBe(11_000);
    expect(positionAt(walking, 99_000)).toStrictEqual(tile(19, 16));
  });

  it("reports the remaining path while walking and nothing after", () => {
    expect(walkInProgressAt(walking, 10_400)).toStrictEqual(
      Option.some({
        arrivesAt: 11_000,
        destination: tile(19, 16),
        remaining: [tile(17, 16), tile(18, 16), tile(19, 16)],
      })
    );
    expect(walkInProgressAt(walking, 11_000)).toStrictEqual(Option.none());
  });
});
