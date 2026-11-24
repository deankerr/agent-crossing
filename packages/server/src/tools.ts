import { cellAt, COORDINATE_LIMIT } from "@agent-crossing/world/cell";
import type { Cell } from "@agent-crossing/world/cell";
import type { Command } from "@agent-crossing/world/command";
import { KindName } from "@agent-crossing/world/kind";
import type { Region } from "@agent-crossing/world/region";
import { VIEW_MAX_RADIUS } from "@agent-crossing/world/text";
import type { Editor } from "@agent-crossing/world/values";
import * as Tool from "effect/ai/Tool";
import * as Toolkit from "effect/ai/Toolkit";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as Random from "effect/Random";
import * as Result from "effect/Result";
import * as Schema from "effect/Schema";

import { Area } from "./affected.ts";
import {
  ChangeInput,
  changeCommand,
  EraseInput,
  eraseCommand,
  GenerateInput,
  generateCommand,
  MoveInput,
  moveCommand,
  PaintInput,
  paintCommand,
  parsedRegion,
  RegionInput,
  RemoveInput,
  removeCommand,
  ScatterInput,
  scatterCommand,
  SpawnInput,
  spawnCommand,
  X,
  Y,
} from "./inputs.ts";
import {
  FIND_DEFAULT_LIMIT,
  FIND_MAX_LIMIT,
  HISTORY_DEFAULT_LIMIT,
  HISTORY_MAX_LIMIT,
  kindsText,
} from "./queries.ts";
import { rejectionText } from "./refusal.ts";
import { editText, framedOf } from "./replies.ts";
import type { Verdict } from "./wire.ts";

/** Who is calling: the editor named by the bearer token. */
export class Caller extends Context.Service<
  Caller,
  { readonly editor: Editor }
>()("agent-crossing/Caller") {}

/** A tool call that did nothing, with the reason and what would work. */
export class Refused extends Schema.TaggedError<
  Refused,
  { readonly brand: unique symbol }
>()("Refused", { message: Schema.String }) {}

/** The World object, as the tools see it: decoded values in and out. */
export interface WorldClient {
  readonly act: (command: Command, by: Editor) => Effect.Effect<Verdict>;
  readonly summary: Effect.Effect<string>;
  readonly map: (area: Option.Option<Area>) => Effect.Effect<string>;
  readonly agentView: (cell: Cell, radius: number) => Effect.Effect<string>;
  readonly inspect: (cell: Cell) => Effect.Effect<string>;
  readonly find: (
    region: Option.Option<Region>,
    kind: Option.Option<KindName>,
    limit: number
  ) => Effect.Effect<string>;
  readonly history: (limit: number) => Effect.Effect<string>;
}

const reply = {
  dependencies: [Caller],
  failure: Refused,
  success: Schema.String,
};

const AFTER_EDIT =
  "The result says what happened and shows a map of the affected area.";

export const Tools = Toolkit.make(
  Tool.make("world_summary", {
    ...reply,
    description:
      "The world's extent (its bounding box), how many cells of each ground kind and how many entities of each kind it holds, and how many events its history has. Start here.",
  }),
  Tool.make("view_map", {
    ...reply,
    description:
      "A character map of a rectangle of the world, a height map of the same cells and a legend. Give all four of x1, y1, x2, y2, or none for the whole world. Maps are at most 128 x 128 cells; a larger request is cut down from its north-west corner and the text says so.",
    parameters: Schema.Struct({
      x1: Schema.optionalKey(X),
      y1: Schema.optionalKey(Y),
      x2: Schema.optionalKey(X),
      y2: Schema.optionalKey(Y),
    }),
  }),
  Tool.make("view_as_agent", {
    ...reply,
    description:
      "What an agent standing on a cell would be told: the ground under it, a map of the square around it with @ at its cell, what stands nearby and any writing. Use it to check how a place reads to an agent.",
    parameters: Schema.Struct({
      x: X,
      y: Y,
      radius: Schema.optionalKey(
        Schema.Int.annotate({
          description: `How many cells it sees in each direction, 0 to ${VIEW_MAX_RADIUS}; default 8.`,
        })
      ),
    }),
  }),
  Tool.make("inspect_cell", {
    ...reply,
    description:
      "One cell in detail: its ground kind and height, whether it is walkable, and every entity on it with its id and effective components.",
    parameters: Schema.Struct({ x: X, y: Y }),
  }),
  Tool.make("find_entities", {
    ...reply,
    description: `Lists entities with their ids, kinds and cells, oldest first: in a region or the whole world, optionally only one kind. Shows at most \`limit\` (default ${FIND_DEFAULT_LIMIT}, at most ${FIND_MAX_LIMIT}) and says how many there are in all.`,
    parameters: Schema.Struct({
      region: Schema.optionalKey(RegionInput),
      kind: Schema.optionalKey(KindName),
      limit: Schema.optionalKey(Schema.Int),
    }),
  }),
  Tool.make("list_kinds", {
    ...reply,
    description:
      "Every ground kind with its glyph and traits (walkable, wet), and every entity kind with its glyph and default components (layer, obstacle, aquatic, colour, model).",
  }),
  Tool.make("history", {
    ...reply,
    description: `The latest edits to the world, one line each with its sequence number, time and editor. Default ${HISTORY_DEFAULT_LIMIT}, at most ${HISTORY_MAX_LIMIT}.`,
    parameters: Schema.Struct({ limit: Schema.optionalKey(Schema.Int) }),
  }),
  Tool.make("paint_ground", {
    ...reply,
    description: `Sets the ground kind, the height or both across a region. Cells without ground join the world only when a kind is given. Painting water removes things that cannot stand on water, and painting dry ground removes aquatic things. ${AFTER_EDIT}`,
    parameters: PaintInput,
  }),
  Tool.make("erase_ground", {
    ...reply,
    description: `Removes the ground of a region, and everything standing on it: those cells leave the world. ${AFTER_EDIT}`,
    parameters: EraseInput,
  }),
  Tool.make("spawn", {
    ...reply,
    description: `Puts one entity of a kind on a cell, optionally with its own components, such as the text of a sign. Refused when the cell has no ground, the ground does not suit it (aquatic things need water, others dry ground) or its layer is taken. ${AFTER_EDIT}`,
    parameters: SpawnInput,
  }),
  Tool.make("scatter", {
    ...reply,
    description: `Spawns entities of the given kinds on a random share (density) of a region's cells, skipping cells where they may not stand. Good for forests, meadows and reed beds. ${AFTER_EDIT}`,
    parameters: ScatterInput,
  }),
  Tool.make("move_entity", {
    ...reply,
    description: `Moves an entity to another cell, if it may stand there. ${AFTER_EDIT}`,
    parameters: MoveInput,
  }),
  Tool.make("change_entity", {
    ...reply,
    description: `Replaces an entity's own components, for example a sign's text or a block's colour; its kind's defaults still apply beneath. ${AFTER_EDIT}`,
    parameters: ChangeInput,
  }),
  Tool.make("remove_entities", {
    ...reply,
    description: `Removes entities, either listed by id or everything in a region (optionally only one kind). The ground stays. ${AFTER_EDIT}`,
    parameters: RemoveInput,
  }),
  Tool.make("generate_world", {
    ...reply,
    description: `Generates a landscape of ground, water, hills and plants over a width x height rectangle whose north-west corner is (x, y), default (0, 0), replacing the ground and entities already there. ${AFTER_EDIT}`,
    parameters: GenerateInput,
  })
);

const refused = (message: string) => Effect.fail(new Refused({ message }));

const parsed = <A>(result: Result.Result<A, string>) =>
  Result.match(result, { onFailure: refused, onSuccess: Effect.succeed });

const cellFor = (x: number, y: number) =>
  Option.match(cellAt(x, y), {
    onNone: () =>
      refused(
        `The cell ${x},${y} is outside the coordinate range: x and y must be between -${COORDINATE_LIMIT} and ${COORDINATE_LIMIT}.`
      ),
    onSome: (cell) => Effect.succeed(cell),
  });

const decodeArea = Schema.decodeUnknownResult(Area);

const areaFor = (input: {
  readonly x1?: number;
  readonly y1?: number;
  readonly x2?: number;
  readonly y2?: number;
}) => {
  const { x1, x2, y1, y2 } = input;

  if (
    x1 === undefined &&
    y1 === undefined &&
    x2 === undefined &&
    y2 === undefined
  ) {
    return Effect.succeedNone;
  }

  if (
    x1 === undefined ||
    y1 === undefined ||
    x2 === undefined ||
    y2 === undefined
  ) {
    return refused(
      "Give all four of x1, y1, x2 and y2 for a rectangle, or none of them for the whole world."
    );
  }

  return parsed(
    Result.mapBoth(
      decodeArea({ from: { x: x1, y: y1 }, to: { x: x2, y: y2 } }),
      {
        onFailure: (issue) => `The rectangle is not valid: ${issue.message}`,
        onSuccess: Option.some,
      }
    )
  );
};

const randomSeed = Random.nextIntBetween(0, 2_147_483_647);

export const toolHandlers = (world: WorldClient) => {
  const answered = (verdict: Verdict) =>
    verdict._tag === "Rejected"
      ? refused(`Refused: ${rejectionText(verdict.rejection)}`)
      : Effect.map(
          Option.match(framedOf(verdict), {
            onNone: () => Effect.succeedNone,
            onSome: (framed) =>
              Effect.map(world.map(Option.some(framed.area)), (map) =>
                Option.some({ framed, map })
              ),
          }),
          (shown) => editText(verdict, shown)
        );

  const editing = (command: Result.Result<Command, string>) =>
    Effect.gen(function* () {
      const { editor } = yield* Caller;
      const parsedCommand = yield* parsed(command);

      return yield* Effect.flatMap(world.act(parsedCommand, editor), answered);
    });

  return Tools.toLayer({
    change_entity: (input) => editing(changeCommand(input)),
    erase_ground: (input) => editing(eraseCommand(input)),
    find_entities: ({ kind, limit, region }) =>
      Effect.gen(function* () {
        const within = yield* Option.match(Option.fromNullishOr(region), {
          onNone: () => Effect.succeedNone,
          onSome: (input) => Effect.asSome(parsed(parsedRegion(input))),
        });

        return yield* world.find(
          within,
          Option.fromNullishOr(kind),
          limit ?? FIND_DEFAULT_LIMIT
        );
      }),
    generate_world: (input) =>
      Effect.flatMap(randomSeed, (seed) =>
        editing(generateCommand(input, seed))
      ),
    history: ({ limit }) => world.history(limit ?? HISTORY_DEFAULT_LIMIT),
    inspect_cell: ({ x, y }) => Effect.flatMap(cellFor(x, y), world.inspect),
    list_kinds: () => Effect.succeed(kindsText()),
    move_entity: (input) => editing(moveCommand(input)),
    paint_ground: (input) => editing(paintCommand(input)),
    remove_entities: (input) => editing(removeCommand(input)),
    scatter: (input) =>
      Effect.flatMap(randomSeed, (seed) =>
        editing(scatterCommand(input, seed))
      ),
    spawn: (input) => editing(spawnCommand(input)),
    view_as_agent: ({ radius, x, y }) =>
      Effect.flatMap(cellFor(x, y), (cell) =>
        world.agentView(cell, radius ?? 8)
      ),
    view_map: (input) => Effect.flatMap(areaFor(input), world.map),
    world_summary: () => world.summary,
  });
};
