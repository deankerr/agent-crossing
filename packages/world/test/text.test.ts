import { describe, expect, it } from "@effect/vitest";
import * as Arr from "effect/Array";
import * as Str from "effect/String";

import { entityIdFor } from "../src/entity.ts";
import { WorldEvent } from "../src/event.ts";
import {
  agentViewText,
  eventText,
  inspectText,
  mapText,
  summaryText,
} from "../src/text.ts";
import { emptyWorld } from "../src/world.ts";
import {
  cell,
  dean,
  eventsOf,
  paint,
  runAll,
  span,
  spawn,
} from "./world.fixture.ts";

const world = runAll([
  paint(span(0, 0, 5, 3), "grass", 1),
  paint(span(4, 2, 5, 3), "water", 0),
  paint(span(0, 0, 1, 0), undefined, 2),
  spawn("oak", cell(1, 1)),
  spawn("flowers", cell(2, 1), { colour: "yellow" }),
  spawn("sign", cell(3, 0), { text: "Welcome" }),
  spawn("lily-pad", cell(5, 3)),
  spawn("fern", cell(1, 1)),
]);

const AXES =
  "x grows east (right) and y grows south (down). The first header row labels x every 10 columns, the second gives the last digit of each column's x, and each row starts with its y. One character per cell; blank cells are outside the world.";

const lines = (...all: readonly string[]) => Arr.join(all, "\n");

describe(mapText, () => {
  it("draws objects over covers over ground, then heights and a legend", () => {
    expect(mapText(world, { from: cell(-1, -1), to: cell(6, 4) })).toBe(
      lines(
        `Map of x -1 to 6, y -1 to 4. ${AXES}`,
        "    0",
        "   10123456",
        "-1",
        " 0  ...S..",
        " 1  .T*...",
        " 2  ....~~",
        " 3  ....~o",
        " 4",
        "",
        "Heights (0 low to 7 high, ~ water):",
        "    0",
        "   10123456",
        "-1",
        " 0  221111",
        " 1  111111",
        " 2  1111~~",
        " 3  1111~~",
        " 4",
        "",
        "Legend: . grass, ~ water, S sign, T oak tree, * flower patch, o lily pad"
      )
    );
  });

  it("labels wide coordinates every ten columns and states any cut", () => {
    const [, cut, labels, digits] = Str.split(
      mapText(emptyWorld, { from: cell(-95, 98), to: cell(200, 98) }),
      "\n"
    );

    expect(cut).toBe(
      "The request covered x -95 to 200, y 98 to 98; maps are at most 128 × 128 cells, so this shows x -95 to 32, y 98 to 98."
    );
    expect(Str.startsWith("   -95  -90       -80")(labels ?? "")).toBeTruthy();
    expect(Str.startsWith("   543210987654321098")(digits ?? "")).toBeTruthy();
  });
});

describe(agentViewText, () => {
  it("tells a character where it stands, what it sees and what is written", () => {
    expect(agentViewText(world, cell(2, 2), 2)).toBe(
      lines(
        "You are at 2,2, on grass at height 1.",
        `Within 2 cells (x 0 to 4, y 0 to 4). ${AXES} @ is you.`,
        "  0",
        "  01234",
        "0 ...S.",
        "1 .T*..",
        "2 ..@.~",
        "3 ....~",
        "4",
        "",
        "Heights (0 low to 7 high, ~ water):",
        "  0",
        "  01234",
        "0 22111",
        "1 11111",
        "2 1111~",
        "3 1111~",
        "4",
        "",
        "Legend: . grass, ~ water, S sign, T oak tree, * flower patch, @ you",
        "",
        "Nearby: 1 fern, 1 flower patch, 1 oak tree, 1 sign.",
        "Writing nearby:",
        '- e3 sign at 3,0: "Welcome"'
      )
    );
  });

  it("says when the character is outside the world", () => {
    expect(
      Str.startsWith(
        "You are at 40,40, which is outside the world: there is no ground there."
      )(agentViewText(world, cell(40, 40), 1))
    ).toBeTruthy();
  });
});

describe("inspectText and summaryText", () => {
  it("list a cell's ground and effective components", () => {
    expect(inspectText(world, cell(1, 1))).toBe(
      lines(
        "Cell 1,1: grass at height 1, not walkable.",
        '- e1 oak: layer object, obstacle, label "oak tree" (T), model oak-tree',
        '- e5 fern: layer cover, label "fern" (f), model fern'
      )
    );
    expect(inspectText(world, cell(2, 1))).toContain("colour yellow");
    expect(inspectText(world, cell(9, 9))).toBe(
      "Cell 9,9 is outside the world: it has no ground."
    );
  });

  it("sum up the world", () => {
    expect(summaryText(world)).toBe(
      lines(
        "The world spans x 0 to 5, y 0 to 3, with 24 cells of ground.",
        "Ground: 20 grass, 4 water.",
        "Entities (5): 1 fern, 1 flowers, 1 lily-pad, 1 oak, 1 sign."
      )
    );
    expect(summaryText(emptyWorld)).toBe(
      "The world is empty: no cell has ground."
    );
  });
});

describe(eventText, () => {
  it("describes each event in one sentence", () => {
    const texts = Arr.flatMap(
      [
        paint(span(0, 0, 9, 9), "meadow"),
        spawn("sign", cell(0, 3), { text: "hi" }),
        spawn("oak", cell(2, 3)),
      ],
      (command) => Arr.map(eventsOf(world, command), eventText)
    );

    expect(texts).toStrictEqual([
      "dean removed e4",
      "dean painted 100 cells with meadow",
      "dean put a sign at 0,3",
      "dean put an oak tree at 2,3",
    ]);
    expect(
      eventText(
        WorldEvent.cases.Removed.make({
          at: 0,
          by: dean,
          entities: [entityIdFor(1), entityIdFor(2)],
        })
      )
    ).toBe("dean removed 2 things");
  });
});
