import { Cell, Coordinate } from "@agent-crossing/world/cell";
import { Command } from "@agent-crossing/world/command";
import type { Components } from "@agent-crossing/world/components";
import { evolveAll } from "@agent-crossing/world/event";
import type { GroundKind, Height } from "@agent-crossing/world/ground";
import type { KindName } from "@agent-crossing/world/kind";
import { Cells, rect } from "@agent-crossing/world/region";
import { decide } from "@agent-crossing/world/rules";
import { Editor } from "@agent-crossing/world/values";
import { emptyWorld } from "@agent-crossing/world/world";
import type { World } from "@agent-crossing/world/world";
import * as Arr from "effect/Array";
import * as Result from "effect/Result";

export const cell = (x: number, y: number) =>
  Cell.make({ x: Coordinate.make(x), y: Coordinate.make(y) });

export const tester = Editor.make("tester");

export const paintRect = (
  from: Cell,
  to: Cell,
  kind: GroundKind,
  height: Height
) => Command.cases.Paint.make({ height, kind, region: rect(from, to) });

export const paintCells = (
  cells: readonly [Cell, ...Cell[]],
  kind: GroundKind,
  height: Height
) => Command.cases.Paint.make({ height, kind, region: Cells.make({ cells }) });

export const spawn = (kind: KindName, at: Cell, components: Components = {}) =>
  Command.cases.Spawn.make({ cell: at, components, kind });

export const eventsOf = (world: World, command: Command, now = 0) =>
  Result.getOrThrow(decide(world, command, now, tester));

export const run = (world: World, command: Command, now = 0) =>
  evolveAll(world, eventsOf(world, command, now));

export const runAll = (commands: readonly Command[], world = emptyWorld) =>
  Arr.reduce(commands, world, (sofar, command) => run(sofar, command));
