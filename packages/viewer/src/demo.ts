import { Cell, cellAt, Coordinate } from "@agent-crossing/world/cell";
import { Command } from "@agent-crossing/world/command";
import type { Components } from "@agent-crossing/world/components";
import { evolveAll } from "@agent-crossing/world/event";
import type { WorldEvent } from "@agent-crossing/world/event";
import { FeedFrame } from "@agent-crossing/world/feed";
import type { KindName } from "@agent-crossing/world/kind";
import { Disc, rect } from "@agent-crossing/world/region";
import { decide } from "@agent-crossing/world/rules";
import { changesFor } from "@agent-crossing/world/snapshot";
import { colours, Editor } from "@agent-crossing/world/values";
import { emptyWorld } from "@agent-crossing/world/world";
import type { World } from "@agent-crossing/world/world";
import * as Arr from "effect/Array";
import * as Option from "effect/Option";
import * as Result from "effect/Result";
import * as Schema from "effect/Schema";

import { unitOf } from "./hash.ts";

export const DEMO_SEED = 20_261_124;
export const DEMO_SIZE = 64;

/** The demo stops editing after this many scripted edits. */
export const DEMO_EDITS = 80;

/** No more changes than this go in one `Changes` frame, as from a server. */
export const CHANGES_PER_FRAME = 1000;

const decodeGenerate = Schema.decodeUnknownOption(Command.cases.Generate);

const DEMO_ORIGIN = Coordinate.make(-DEMO_SIZE / 2);

const defaultGenerate = Command.cases.Generate.make({
  height: DEMO_SIZE,
  origin: Cell.make({ x: DEMO_ORIGIN, y: DEMO_ORIGIN }),
  seed: DEMO_SEED,
  width: DEMO_SIZE,
});

const integerOf = (text: string | null) =>
  text !== null && /^-?\d+$/u.test(text)
    ? Option.some(Number(text))
    : Option.none<number>();

const sizeOf = (text: string | null) => {
  const match =
    text === null ? null : /^(?<wide>\d+)(?:x(?<deep>\d+))?$/u.exec(text);

  return match === null
    ? Option.none<readonly [number, number]>()
    : Option.some([
        Number(match.groups?.wide),
        Number(match.groups?.deep ?? match.groups?.wide),
      ] as const);
};

const generating = (seed: number, width: number, height: number) =>
  decodeGenerate({
    _tag: "Generate",
    height,
    origin: { x: -Math.floor(width / 2), y: -Math.floor(height / 2) },
    seed,
    width,
  });

/**
 * The demo's `Generate` command from `?demo&seed=…&size=…`, where size is
 * `N` or `WxH`. The landscape is centred on 0,0, so half of it has negative
 * coordinates. Anything unusable falls back to the defaults.
 */
export const demoCommand = (search: URLSearchParams) => {
  const seed = Option.getOrElse(integerOf(search.get("seed")), () => DEMO_SEED);

  const [width, height] = Option.getOrElse(
    sizeOf(search.get("size")),
    () => [DEMO_SIZE, DEMO_SIZE] as const
  );

  return Option.getOrElse(generating(seed, width, height), () => ({
    ...defaultGenerate,
    seed,
  }));
};

export type Generate = typeof Command.cases.Generate.Type;

const painter = Editor.make("demo");

const editors = Arr.map(["Ada", "Basil", "Clover", "Dot"] as const, (name) =>
  Editor.make(name)
);

const outcome = (world: World, command: Command, now: number, by: Editor) =>
  Result.getOrElse(decide(world, command, now, by), () => []);

/** The demo's world: the generated landscape folded from its events. */
export const demoWorld = (generate: Generate, now = 0) =>
  evolveAll(emptyWorld, outcome(emptyWorld, generate, now, painter));

/** What a server would send a new viewer of `world`: a whole snapshot. */
export const snapshotFrames = (world: World, cursor: number) => {
  const frames: readonly FeedFrame[] = [
    FeedFrame.cases.Reset.make({}),
    ...Arr.map(Arr.chunksOf(changesFor(world), CHANGES_PER_FRAME), (changes) =>
      FeedFrame.cases.Changes.make({ changes })
    ),
    FeedFrame.cases.Ready.make({ cursor }),
  ];

  return frames;
};

const SIGNS = [
  "Welcome, neighbours!",
  "Fresh berries this way",
  "Picnic spot",
  "Mind the ducks",
  "Lantern walk at dusk",
  "Saplings planted here",
] as const;

const pick = <A>(choices: readonly [A, ...A[]], roll: number) =>
  choices[Math.floor(roll * choices.length) % choices.length] ?? choices[0];

const spawn = (kind: KindName, cell: Cell, components: Components = {}) =>
  Command.cases.Spawn.make({ cell, components, kind });

type Script = (cell: Cell, roll: number) => Command;

const script: readonly [Script, ...Script[]] = [
  (cell, roll) => spawn("sign", cell, { text: pick(SIGNS, roll) }),
  (cell, roll) =>
    Command.cases.Scatter.make({
      components: { colour: pick(colours, roll) },
      density: 0.5,
      kinds: ["flowers"],
      region: Disc.make({ centre: cell, radius: 2 }),
      seed: Math.floor(roll * 1000),
    }),
  (cell) => spawn("lantern", cell),
  (cell) =>
    Command.cases.Paint.make({
      kind: "path",
      region: rect(
        cell,
        Option.getOrElse(cellAt(cell.x + 3, cell.y), () => cell)
      ),
    }),
  (cell) => spawn("bench", cell),
  (cell, roll) => spawn("block", cell, { colour: pick(colours, roll) }),
  (cell) => spawn("campfire", cell),
  (cell, roll) =>
    Command.cases.Scatter.make({
      density: 0.3,
      kinds: ["mushroom"],
      region: Disc.make({ centre: cell, radius: 2 }),
      seed: Math.floor(roll * 1000),
    }),
  (cell) => spawn("fence", cell),
];

const ATTEMPTS = 24;

/**
 * The events of the demo's edit numbered `step`, on a cell inside the
 * generated rectangle. Tries a few cells until the rules accept one, and
 * gives up quietly. Pure in the generate command and `step`.
 */
export const demoEdit = (
  world: World,
  generate: Generate,
  step: number,
  now: number
) => {
  const salt = `${generate.seed}:${step}`;
  const action = script[step % script.length] ?? script[0];

  const by = editors[Math.floor(unitOf(salt, -2) * editors.length)] ?? painter;

  for (let attempt = 0; attempt < ATTEMPTS; attempt += 1) {
    const cell = cellAt(
      generate.origin.x +
        Math.floor(unitOf(salt, attempt * 2) * generate.width),
      generate.origin.y +
        Math.floor(unitOf(salt, attempt * 2 + 1) * generate.height)
    );

    if (Option.isSome(cell)) {
      const events: readonly WorldEvent[] = outcome(
        world,
        action(cell.value, unitOf(salt, -1)),
        now,
        by
      );

      if (Arr.isReadonlyArrayNonEmpty(events)) {
        return events;
      }
    }
  }

  const none: readonly WorldEvent[] = [];

  return none;
};
