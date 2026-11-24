import { Command } from "@agent-crossing/world/command";
import { EntityId } from "@agent-crossing/world/entity";
import { Cells, Disc, Rect } from "@agent-crossing/world/region";
import { describe, expect, it } from "@effect/vitest";
import * as Result from "effect/Result";

import {
  changeCommand,
  eraseCommand,
  generateCommand,
  moveCommand,
  paintCommand,
  removeCommand,
  scatterCommand,
  spawnCommand,
} from "../src/inputs.ts";
import { cell } from "./world.fixture.ts";

const rectInput = { type: "rect", x1: 4, x2: 0, y1: 0, y2: 2 } as const;
const rectRegion = Rect.make({ from: cell(4, 0), to: cell(0, 2) });

const failureOf = <A>(result: Result.Result<A, string>) =>
  Result.match(result, { onFailure: (text) => text, onSuccess: () => "ok" });

describe("tool inputs", () => {
  it("paint a rectangle with a kind, a height or both", () => {
    expect(paintCommand({ kind: "sand", region: rectInput })).toStrictEqual(
      Result.succeed(
        Command.cases.Paint.make({ kind: "sand", region: rectRegion })
      )
    );
    expect(paintCommand({ height: 3, region: rectInput })).toStrictEqual(
      Result.succeed(
        Command.cases.Paint.make({ height: 3, region: rectRegion })
      )
    );
    expect(failureOf(paintCommand({ region: rectInput }))).toContain(
      "give a ground kind, a height or both"
    );
    expect(failureOf(paintCommand({ height: 9, region: rectInput }))).toContain(
      "The edit is not valid"
    );
  });

  it("erase a disc or a list of cells", () => {
    expect(
      eraseCommand({ region: { radius: 2, type: "disc", x: 1, y: -1 } })
    ).toStrictEqual(
      Result.succeed(
        Command.cases.Erase.make({
          region: Disc.make({ centre: cell(1, -1), radius: 2 }),
        })
      )
    );
    expect(
      eraseCommand({
        region: { cells: [{ x: 1, y: 2 }], type: "cells" },
      })
    ).toStrictEqual(
      Result.succeed(
        Command.cases.Erase.make({
          region: Cells.make({ cells: [cell(1, 2)] }),
        })
      )
    );
  });

  it("spawn on a cell with its own components", () => {
    expect(
      spawnCommand({ components: { text: " Hi " }, kind: "sign", x: 2, y: 3 })
    ).toStrictEqual(
      Result.succeed(
        Command.cases.Spawn.make({
          cell: cell(2, 3),
          components: { text: "Hi" },
          kind: "sign",
        })
      )
    );
    expect(failureOf(spawnCommand({ kind: "sign", x: 5000, y: 0 }))).toContain(
      "The edit is not valid"
    );
  });

  it("scatter with the given seed, or the random one", () => {
    const input = {
      density: 0.5,
      kinds: ["oak", "pine"],
      region: rectInput,
    } as const;

    expect(scatterCommand(input, 42)).toStrictEqual(
      Result.succeed(
        Command.cases.Scatter.make({
          density: 0.5,
          kinds: ["oak", "pine"],
          region: rectRegion,
          seed: 42,
        })
      )
    );
    expect(
      Result.map(scatterCommand({ ...input, seed: 7 }, 42), (command) =>
        command._tag === "Scatter" ? command.seed : -1
      )
    ).toStrictEqual(Result.succeed(7));
    expect(failureOf(scatterCommand({ ...input, density: 2 }, 1))).toContain(
      "The edit is not valid"
    );
  });

  it("move and change entities by id", () => {
    const id = EntityId.make("e4");

    expect(moveCommand({ id, x: 1, y: 1 })).toStrictEqual(
      Result.succeed(Command.cases.Move.make({ entity: id, to: cell(1, 1) }))
    );
    expect(changeCommand({ components: { colour: "red" }, id })).toStrictEqual(
      Result.succeed(
        Command.cases.Change.make({ components: { colour: "red" }, entity: id })
      )
    );
  });

  it("remove by ids or by region, never both", () => {
    const id = EntityId.make("e4");

    expect(removeCommand({ ids: [id] })).toStrictEqual(
      Result.succeed(Command.cases.Remove.make({ entities: [id] }))
    );
    expect(removeCommand({ kind: "oak", region: rectInput })).toStrictEqual(
      Result.succeed(
        Command.cases.RemoveIn.make({ kind: "oak", region: rectRegion })
      )
    );
    expect(
      failureOf(removeCommand({ ids: [id], region: rectInput }))
    ).toContain("not both");
    expect(failureOf(removeCommand({ ids: [id], kind: "oak" }))).toContain(
      "kind only narrows a region"
    );
    expect(failureOf(removeCommand({}))).toContain("Give ids");
  });

  it("generate from the origin unless told otherwise", () => {
    expect(generateCommand({ height: 64, width: 64 }, 5)).toStrictEqual(
      Result.succeed(
        Command.cases.Generate.make({
          height: 64,
          origin: cell(0, 0),
          seed: 5,
          width: 64,
        })
      )
    );
    expect(failureOf(generateCommand({ height: 4, width: 64 }, 5))).toContain(
      "The edit is not valid"
    );
  });
});
