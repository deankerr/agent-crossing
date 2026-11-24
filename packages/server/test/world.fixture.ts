import { Cell, Coordinate } from "@agent-crossing/world/cell";
import { Command } from "@agent-crossing/world/command";
import type { Components } from "@agent-crossing/world/components";
import { evolveAll } from "@agent-crossing/world/event";
import type { KindName } from "@agent-crossing/world/kind";
import { rect } from "@agent-crossing/world/region";
import { decide } from "@agent-crossing/world/rules";
import { Editor } from "@agent-crossing/world/values";
import { emptyWorld } from "@agent-crossing/world/world";
import type { World } from "@agent-crossing/world/world";
import * as Arr from "effect/Array";
import * as Result from "effect/Result";

export const cell = (x: number, y: number) =>
  Cell.make({ x: Coordinate.make(x), y: Coordinate.make(y) });

export const claude = Editor.make("claude");

export const span = (x1: number, y1: number, x2: number, y2: number) =>
  rect(cell(x1, y1), cell(x2, y2));

export const spawn = (kind: KindName, at: Cell, components: Components = {}) =>
  Command.cases.Spawn.make({ cell: at, components, kind });

export const eventsOf = (world: World, command: Command) =>
  Result.getOrThrowWith(
    decide(world, command, 1_700_000_000_000, claude),
    (rejection) => new Error(`rejected: ${rejection._tag}`)
  );

export const run = (world: World, command: Command) =>
  evolveAll(world, eventsOf(world, command));

export const runAll = (commands: readonly Command[], world = emptyWorld) =>
  Arr.reduce(commands, world, run);

/** A small generated landscape with a sign and a blue block on grass at its corner. */
export const garden = runAll([
  Command.cases.Generate.make({
    height: 12,
    origin: cell(0, 0),
    seed: 7,
    width: 12,
  }),
  Command.cases.Paint.make({ kind: "grass", region: span(0, 0, 2, 0) }),
  Command.cases.RemoveIn.make({ region: span(0, 0, 2, 0) }),
  spawn("sign", cell(0, 0), { text: 'Say "hi"' }),
  spawn("block", cell(1, 0), { colour: "blue" }),
]);
