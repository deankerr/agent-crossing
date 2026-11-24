import { describe, expect, it } from "@effect/vitest";
import * as Arr from "effect/Array";
import * as Record from "effect/Record";
import * as Result from "effect/Result";
import * as Schema from "effect/Schema";
import * as Str from "effect/String";

import { decodeCommand } from "../src/command.ts";
import { Components } from "../src/components.ts";
import { groundCatalogue } from "../src/ground.ts";
import { kindRows } from "../src/kind.ts";
import { cellsOf, Region } from "../src/region.ts";
import { cell, span } from "./world.fixture.ts";

const decodeComponents = Schema.decodeUnknownResult(Components);
const decodeRegion = Schema.decodeUnknownResult(Region);

describe("the kind table", () => {
  it("parses every row as components", () => {
    for (const [, row] of Record.toEntries(kindRows)) {
      expect(decodeComponents(row)).toStrictEqual(Result.succeed(row));
    }
  });

  it("gives every kind a label and an appearance", () => {
    for (const [kind, row] of Record.toEntries(kindRows)) {
      const components: Components = row;
      expect([kind, components.label !== undefined]).toStrictEqual([
        kind,
        true,
      ]);
      expect([kind, components.appearance !== undefined]).toStrictEqual([
        kind,
        true,
      ]);
    }
  });

  it("draws every kind and ground with its own glyph", () => {
    const glyphs = [
      ...Arr.map(Record.values(groundCatalogue), (traits) => traits.glyph),
      ...Arr.map(Record.values(kindRows), (row) => row.label.glyph),
      "@",
    ];

    expect(Arr.dedupe(glyphs)).toStrictEqual(glyphs);
  });
});

describe("regions", () => {
  it("cover a rectangle whatever the corner order", () => {
    expect(cellsOf(span(2, 1, 0, 0))).toStrictEqual([
      cell(0, 0),
      cell(1, 0),
      cell(2, 0),
      cell(0, 1),
      cell(1, 1),
      cell(2, 1),
    ]);
  });

  it("cover a disc by distance from its centre", () => {
    expect(
      cellsOf(Region.cases.Disc.make({ centre: cell(0, 0), radius: 1 }))
    ).toStrictEqual([
      cell(0, -1),
      cell(-1, 0),
      cell(0, 0),
      cell(1, 0),
      cell(0, 1),
    ]);
  });

  it("count listed cells once", () => {
    expect(
      cellsOf(
        Region.cases.Cells.make({ cells: [cell(1, 1), cell(2, 2), cell(1, 1)] })
      )
    ).toStrictEqual([cell(1, 1), cell(2, 2)]);
  });

  it("refuse rectangles larger than the area cap and wild coordinates", () => {
    expect(
      Result.isFailure(
        decodeRegion({
          _tag: "Rect",
          from: { x: 0, y: 0 },
          to: { x: 256, y: 256 },
        })
      )
    ).toBeTruthy();
    expect(
      Result.isFailure(
        decodeRegion({ _tag: "Cells", cells: [{ x: 1e9, y: 0 }] })
      )
    ).toBeTruthy();
  });
});

describe("commands", () => {
  const rect = { _tag: "Rect", from: { x: 0, y: 0 }, to: { x: 3, y: 3 } };

  it("parse a paint only when it gives a kind or a height", () => {
    expect(
      Result.isFailure(decodeCommand({ _tag: "Paint", region: rect }))
    ).toBeTruthy();
    expect(
      Result.isSuccess(
        decodeCommand({ _tag: "Paint", height: 2, region: rect })
      )
    ).toBeTruthy();
    expect(
      Result.isFailure(
        decodeCommand({ _tag: "Paint", kind: "lava", region: rect })
      )
    ).toBeTruthy();
  });

  it("parse a generate only at a bounded size", () => {
    const generate = { _tag: "Generate", origin: { x: 0, y: 0 }, seed: 1 };
    expect(
      Result.isSuccess(decodeCommand({ ...generate, height: 8, width: 256 }))
    ).toBeTruthy();
    expect(
      Result.isFailure(decodeCommand({ ...generate, height: 7, width: 64 }))
    ).toBeTruthy();
    expect(
      Result.isFailure(
        decodeCommand({
          ...generate,
          height: 64,
          origin: { x: 4090, y: 0 },
          width: 64,
        })
      )
    ).toBeTruthy();
  });

  it("trim sign text and refuse empty or overlong text", () => {
    const spawn = { _tag: "Spawn", cell: { x: 0, y: 0 }, kind: "sign" };
    expect(
      decodeCommand({ ...spawn, components: { text: "  hi  " } })
    ).toStrictEqual(Result.succeed({ ...spawn, components: { text: "hi" } }));
    expect(
      Result.isFailure(decodeCommand({ ...spawn, components: { text: "   " } }))
    ).toBeTruthy();
    expect(
      Result.isFailure(
        decodeCommand({ ...spawn, components: { text: Str.repeat(281)("x") } })
      )
    ).toBeTruthy();
  });
});
