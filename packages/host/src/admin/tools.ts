import { PrefabName } from "@agent-crossing/world/definitions/prefabs";
import type { Command } from "@agent-crossing/world/editing/command";
import type { Editor } from "@agent-crossing/world/history/edit";
import { cellAt, COORDINATE_LIMIT } from "@agent-crossing/world/schema/cell";
import { Area } from "@agent-crossing/world/state/area";
import { VIEW_MAX_RADIUS } from "@agent-crossing/world/text/agent-view";
import {
  FIND_DEFAULT_LIMIT,
  FIND_MAX_LIMIT,
} from "@agent-crossing/world/text/find";
import {
  HISTORY_DEFAULT_LIMIT,
  HISTORY_MAX_LIMIT,
} from "@agent-crossing/world/text/history";
import { prefabsText } from "@agent-crossing/world/text/prefabs";
import * as Tool from "effect/ai/Tool";
import * as Toolkit from "effect/ai/Toolkit";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as Random from "effect/Random";
import * as Result from "effect/Result";
import * as Schema from "effect/Schema";

import type { WorldClient } from "../world-object/client.ts";
import type { Verdict } from "../world-object/wire.ts";
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
  PourInput,
  pourCommand,
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
import { rejectionText } from "./refusal.ts";
import { editText, framedOf } from "./replies.ts";

/** Who is calling: the editor named by the bearer token. */
export class Caller extends Context.Service<
  Caller,
  { readonly editor: typeof Editor.Type }
>()("agent-crossing/Caller") {}

/** A tool call that did nothing, with the reason and what would work. */
export class Refused extends Schema.TaggedError<
  Refused,
  { readonly brand: unique symbol }
>()("Refused", { message: Schema.String }) {}

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
      "The world's extent (the bounding box of its floors), how many cells of each floor and of water it has, how many entities of each sort it holds, and how many events its history has. Start here.",
  }),
  Tool.make("view_map", {
    ...reply,
    description:
      "A character map of a rectangle of the world, a level map of the same cells and a legend. Give all four of x1, y1, x2, y2, or none for the whole world. Maps are at most 128 x 128 cells; a larger request is cut down from its north-west corner and the text says so.",
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
      "What an agent standing on a cell would be told: the floor or liquid under it and its level, a map of the square around it with @ at its cell, what stands nearby and any writing. Use it to check how a place reads to an agent.",
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
      "One cell in detail: its floor and any liquid with their levels, whether it is walkable, and every other entity on it with its id and effective components.",
    parameters: Schema.Struct({ x: X, y: Y }),
  }),
  Tool.make("find_entities", {
    ...reply,
    description: `Lists entities with their ids, prefabs and cells, oldest first: in a region or the whole world. Without a prefab it lists every entity but the floors and liquids; with one, only entities of that prefab. Shows at most \`limit\` (default ${FIND_DEFAULT_LIMIT}, at most ${FIND_MAX_LIMIT}) and says how many there are in all.`,
    parameters: Schema.Struct({
      region: Schema.optionalKey(RegionInput),
      prefab: Schema.optionalKey(PrefabName),
      limit: Schema.optionalKey(Schema.Int),
    }),
  }),
  Tool.make("list_prefabs", {
    ...reply,
    description:
      "Every prefab with its glyph, name, label, layer and habitat, and whether it is an obstacle.",
  }),
  Tool.make("history", {
    ...reply,
    description: `The latest edits to the world, one line each with its sequence number, time and editor. Default ${HISTORY_DEFAULT_LIMIT}, at most ${HISTORY_MAX_LIMIT}.`,
    parameters: Schema.Struct({ limit: Schema.optionalKey(Schema.Int) }),
  }),
  Tool.make("paint_floor", {
    ...reply,
    description: `Sets the floor prefab, the level or both across a region, keeping what stands on the floors. Cells without a floor join the world only when a floor is given; new floors start at level 0 unless a level is given. ${AFTER_EDIT}`,
    parameters: PaintInput,
  }),
  Tool.make("pour_liquid", {
    ...reply,
    description: `Pours a liquid over every floor of a region that has none, turning that land into water: the liquid takes the floor's level and the floor sinks one level beneath it, becoming the bed prefab when one is given. Floors already at the lowest level are skipped, and entities whose habitat is only land are removed. ${AFTER_EDIT}`,
    parameters: PourInput,
  }),
  Tool.make("erase_floor", {
    ...reply,
    description: `Removes the floors of a region and every entity on them, liquids included: those cells leave the world. ${AFTER_EDIT}`,
    parameters: EraseInput,
  }),
  Tool.make("spawn", {
    ...reply,
    description: `Puts one entity of a prefab on a cell, optionally with its own components, such as the text of a sign. Refused when the cell has no floor, the place (land or water) is not in its habitat or its layer is taken. ${AFTER_EDIT}`,
    parameters: SpawnInput,
  }),
  Tool.make("scatter", {
    ...reply,
    description: `Spawns entities of the given prefabs on a random share (density) of a region's cells, skipping cells where they may not be. Good for forests, meadows and reed beds. ${AFTER_EDIT}`,
    parameters: ScatterInput,
  }),
  Tool.make("move_entity", {
    ...reply,
    description: `Moves an entity to another cell, if it may be there. ${AFTER_EDIT}`,
    parameters: MoveInput,
  }),
  Tool.make("change_entity", {
    ...reply,
    description: `Replaces an entity's own components, for example a sign's text or a block's colors; its prefab's components still apply beneath. ${AFTER_EDIT}`,
    parameters: ChangeInput,
  }),
  Tool.make("remove_entities", {
    ...reply,
    description: `Removes entities, either listed by id or everything in a region. In a region without a prefab the floors and liquids stay; with a prefab, only entities of that prefab go. ${AFTER_EDIT}`,
    parameters: RemoveInput,
  }),
  Tool.make("generate_world", {
    ...reply,
    description: `Generates a landscape of floors, water, hills and plants over a width x height rectangle whose north-west corner is (x, y), default (0, 0), replacing every entity already there. ${AFTER_EDIT}`,
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

const EMPTY_WORLD =
  "The world is empty: no cell has a floor. Start with generate_world or paint_floor.";

const randomSeed = Random.nextIntBetween(0, 2_147_483_647);

export const toolHandlers = (world: WorldClient) => {
  const answered = (verdict: typeof Verdict.Type) =>
    verdict._tag === "Rejected"
      ? refused(`Refused: ${rejectionText(verdict.rejection)}`)
      : Effect.map(
          Option.match(framedOf(verdict), {
            onNone: () => Effect.succeedNone,
            onSome: (framed) =>
              Effect.map(
                world.map(Option.some(framed.area)),
                Option.map((map) => ({ framed, map }))
              ),
          }),
          (shown) => editText(verdict, shown)
        );

  const editing = (command: Result.Result<typeof Command.Type, string>) =>
    Effect.gen(function* () {
      const { editor } = yield* Caller;
      const parsedCommand = yield* parsed(command);

      return yield* Effect.flatMap(world.act(parsedCommand, editor), answered);
    });

  return Tools.toLayer({
    change_entity: (input) => editing(changeCommand(input)),
    erase_floor: (input) => editing(eraseCommand(input)),
    find_entities: ({ limit, prefab, region }) =>
      Effect.gen(function* () {
        const within = yield* Option.match(Option.fromNullishOr(region), {
          onNone: () => Effect.succeedNone,
          onSome: (input) => Effect.asSome(parsed(parsedRegion(input))),
        });

        return yield* world.find(
          within,
          Option.fromNullishOr(prefab),
          limit ?? FIND_DEFAULT_LIMIT
        );
      }),
    generate_world: (input) =>
      Effect.flatMap(randomSeed, (seed) =>
        editing(generateCommand(input, seed))
      ),
    history: ({ limit }) => world.history(limit ?? HISTORY_DEFAULT_LIMIT),
    inspect_cell: ({ x, y }) => Effect.flatMap(cellFor(x, y), world.inspect),
    list_prefabs: () => Effect.succeed(prefabsText()),
    move_entity: (input) => editing(moveCommand(input)),
    paint_floor: (input) => editing(paintCommand(input)),
    pour_liquid: (input) => editing(pourCommand(input)),
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
    view_map: (input) =>
      Effect.map(
        Effect.flatMap(areaFor(input), world.map),
        Option.getOrElse(() => EMPTY_WORLD)
      ),
    world_summary: () => world.summary,
  });
};
