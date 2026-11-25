import { Nature } from "@agent-crossing/world/definitions/prefabs";
import type { PrefabName } from "@agent-crossing/world/definitions/prefabs";
import { Command } from "@agent-crossing/world/editing/command";
import { decide } from "@agent-crossing/world/editing/decide";
import { Disc, rect } from "@agent-crossing/world/editing/region";
import { FeedFrame } from "@agent-crossing/world/feed/frame";
import { Editor } from "@agent-crossing/world/history/edit";
import { evolveAll } from "@agent-crossing/world/history/event";
import type { WorldEvent } from "@agent-crossing/world/history/event";
import { Cell, cellAt, Coordinate } from "@agent-crossing/world/schema/cell";
import { colorWords } from "@agent-crossing/world/schema/color";
import type { Components } from "@agent-crossing/world/schema/components";
import { changesFor } from "@agent-crossing/world/state/snapshot";
import { emptyWorld } from "@agent-crossing/world/state/world";
import type { World } from "@agent-crossing/world/state/world";
import * as Arr from "effect/Array";
import * as Option from "effect/Option";
import * as Result from "effect/Result";
import * as Schema from "effect/Schema";

import { unitOf } from "../scene/hash.ts";

export const DEMO_SEED = 20_261_124;
export const DEMO_SIZE = 64;

/** The demo stops editing after this many scripted edits. */
export const DEMO_EDITS = 80;

/** No more changes than this go in one `Changes` frame, as from the Api. */
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
 * `N` or `WxH`. The landscape is centered on 0,0, so half of it has negative
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

const flowerPatches = Arr.map(
  [
    Nature.FlowerPatches.pink,
    Nature.FlowerPatches.yellow,
    Nature.FlowerPatches.white,
    Nature.FlowerPatches.purple,
    Nature.FlowerPatches.red,
    Nature.FlowerPatches.orange,
    Nature.FlowerPatches.blue,
  ] as const,
  (one) => one.name
);

const editors = Arr.map(["Ada", "Basil", "Clover", "Dot"] as const, (name) =>
  Editor.make(name)
);

const outcome = (
  world: World,
  command: typeof Command.Type,
  now: number,
  by: typeof Editor.Type
) => Result.getOrElse(decide(world, command, now, by), () => []);

/** The demo's world: the generated landscape folded from its events. */
export const demoWorld = (generate: Generate, now = 0) =>
  evolveAll(emptyWorld, outcome(emptyWorld, generate, now, painter));

/** What the Api would send a new spectator of `world`: a whole snapshot. */
export const snapshotFrames = (world: World, cursor: number) => {
  const frames: readonly (typeof FeedFrame.Type)[] = [
    FeedFrame.cases.Reset.make({}),
    ...Arr.map(Arr.chunksOf(changesFor(world), CHANGES_PER_FRAME), (changes) =>
      FeedFrame.cases.Changes.make({ changes })
    ),
    FeedFrame.cases.Ready.make({ cursor }),
  ];

  return frames;
};

const SIGNS = [
  "Welcome, neighbors!",
  "Fresh berries this way",
  "Picnic spot",
  "Mind the ducks",
  "Lantern walk at dusk",
  "Saplings planted here",
] as const;

const pick = <A>(choices: readonly [A, ...A[]], roll: number) =>
  choices[Math.floor(roll * choices.length) % choices.length] ?? choices[0];

const spawn = (
  prefab: typeof PrefabName.Type,
  cell: typeof Cell.Type,
  components: typeof Components.Type = {}
) => Command.cases.Spawn.make({ cell, components, prefab });

type Script = (cell: typeof Cell.Type, roll: number) => typeof Command.Type;

const script: readonly [Script, ...Script[]] = [
  (cell, roll) => spawn("sign", cell, { text: pick(SIGNS, roll) }),
  (cell, roll) =>
    Command.cases.Scatter.make({
      density: 0.5,
      prefabs: [pick(flowerPatches, roll)],
      region: Disc.make({ center: cell, radius: 2 }),
      seed: Math.floor(roll * 1000),
    }),
  (cell) => spawn("lantern", cell),
  (cell) =>
    Command.cases.Paint.make({
      floor: "path",
      region: rect(
        cell,
        Option.getOrElse(cellAt(cell.x + 3, cell.y), () => cell)
      ),
    }),
  (cell) => spawn("bench", cell),
  (cell, roll) =>
    spawn("block", cell, { colors: { body: pick(colorWords, roll) } }),
  (cell) => spawn("campfire", cell),
  (cell, roll) =>
    Command.cases.Scatter.make({
      density: 0.3,
      prefabs: ["mushroom"],
      region: Disc.make({ center: cell, radius: 2 }),
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
      const events: readonly (typeof WorldEvent.Type)[] = outcome(
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

  const none: readonly (typeof WorldEvent.Type)[] = [];

  return none;
};
