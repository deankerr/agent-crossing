import { Command } from "@agent-crossing/world/command";
import { EntityId } from "@agent-crossing/world/entity";
import { decide } from "@agent-crossing/world/rules";
import { describe, expect, it } from "@effect/vitest";
import * as Option from "effect/Option";
import * as Result from "effect/Result";

import { framedEdit } from "../src/affected.ts";
import { findText, kindsText, mapOf } from "../src/queries.ts";
import { rejectionText } from "../src/refusal.ts";
import { editText, framedOf } from "../src/replies.ts";
import { Verdict } from "../src/wire.ts";
import { cell, claude, garden, spawn } from "./world.fixture.ts";

const nothing = {
  changed: 0,
  erased: 0,
  moved: 0,
  painted: 0,
  placed: 0,
  removed: 0,
};

const refusalFor = (command: Command) =>
  Result.match(decide(garden, command, 0, claude), {
    onFailure: rejectionText,
    onSuccess: () => "accepted",
  });

describe("refusals", () => {
  it("say a cell outside the world needs ground first", () => {
    expect(refusalFor(spawn("oak", cell(40, 40)))).toBe(
      "Cell 40,40 has no ground, so it is outside the world. Choose a cell inside the world (world_summary gives its extent), or paint ground there first with paint_ground."
    );
  });

  it("name the occupant of a taken layer and what to do", () => {
    const text = refusalFor(spawn("bench", cell(0, 0)));

    expect(text).toContain("The object layer of cell 0,0 is taken by e");
    expect(text).toContain("a sign (sign)");
    expect(text).toContain(
      "Things with no layer (mushroom) may share any cell."
    );
  });

  it("explain where aquatic and dry things belong", () => {
    expect(refusalFor(spawn("reeds", cell(0, 0)))).toContain(
      "Aquatic things go only on wet ground (water)"
    );
  });

  it("point to find_entities for an unknown id", () => {
    expect(
      refusalFor(
        Command.cases.Remove.make({ entities: [EntityId.make("e999")] })
      )
    ).toContain("There is no entity e999");
  });
});

describe("edit replies", () => {
  it("frame a small edit with a margin of two cells", () => {
    const framed = framedEdit({ maxX: 3, maxY: 4, minX: 1, minY: 2 });

    expect(framed.cut).toBeFalsy();
    expect(framed.area).toStrictEqual({ from: cell(-1, 0), to: cell(5, 6) });
  });

  it("cut a large edit down to 48 x 48 cells from the north-west", () => {
    const framed = framedEdit({ maxX: 63, maxY: 63, minX: 0, minY: 0 });

    expect(framed.cut).toBeTruthy();
    expect(framed.area).toStrictEqual({ from: cell(-2, -2), to: cell(45, 45) });
  });

  it("say what happened, then what the map shows", () => {
    const accepted = Verdict.cases.Accepted.make({
      changes: 2,
      edited: { from: cell(1, 1), to: cell(1, 1) },
      sentences: ["claude put a sign at 1,1"],
      tally: { ...nothing, placed: 1 },
    });

    const framed = Option.getOrThrow(framedOf(accepted));
    const text = editText(accepted, Option.some({ framed, map: "MAP" }));

    expect(text).toBe(
      "claude put a sign at 1,1. (1 event, 2 changes.)\n\nThe edit touched x 1 to 1, y 1 to 1.\n\nMAP"
    );
  });

  it("tally an edit of many events", () => {
    const text = editText(
      Verdict.cases.Accepted.make({
        changes: 5442,
        sentences: Array.from({ length: 7 }, () => "claude did something"),
        tally: { ...nothing, painted: 4096, placed: 1344, removed: 2 },
      }),
      Option.none()
    );

    expect(text).toBe(
      "Painted 4096 cells, removed 2 things and placed 1344 things. (7 events, 5442 changes.)"
    );
  });

  it("say so when nothing changed", () => {
    expect(
      editText(
        Verdict.cases.Accepted.make({
          changes: 0,
          sentences: [],
          tally: nothing,
        }),
        Option.none()
      )
    ).toContain("Nothing changed");
  });
});

describe("queries", () => {
  it("find entities with their ids, kinds, cells and own components", () => {
    const text = findText(garden, Option.none(), Option.some("sign"), 10);

    expect(text).toMatch(
      /^1 sign entity in the world:\ne\d+ sign \(sign\) at 0,0: text "Say 'hi'"$/u
    );
  });

  it("state the cap when there are more", () => {
    expect(findText(garden, Option.none(), Option.none(), 1)).toContain(
      "showing the first 1"
    );
  });

  it("list every kind", () => {
    const text = kindsText();

    expect(text).toContain("~ water: water, walkable no, wet yes");
    expect(text).toContain(
      '| reeds: "clump of reeds", layer cover, aquatic (water only)'
    );
  });

  it("map the whole world, or say it is empty", () => {
    expect(mapOf(garden, Option.none())).toContain(
      "Map of x 0 to 11, y 0 to 11."
    );
  });
});
