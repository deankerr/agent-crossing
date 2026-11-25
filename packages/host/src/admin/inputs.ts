import { PrefabName } from "@agent-crossing/world/definitions/prefabs";
import {
  Command,
  FloorName,
  LiquidName,
} from "@agent-crossing/world/editing/command";
import {
  DISC_MAX_RADIUS,
  Region,
  REGION_MAX_AREA,
} from "@agent-crossing/world/editing/region";
import { cellAt, COORDINATE_LIMIT } from "@agent-crossing/world/schema/cell";
import { Components } from "@agent-crossing/world/schema/components";
import * as Arr from "effect/Array";
import * as Effect from "effect/Effect";
import * as Match from "effect/Match";
import * as Option from "effect/Option";
import * as Result from "effect/Result";
import * as Schema from "effect/Schema";

import { refused } from "./tool.ts";

/** The tools' inputs: plain integers and small tagged objects an AI can write by hand. */

export const X = Schema.Int.annotate({
  description: "Column. x grows east (to the right).",
});

export const Y = Schema.Int.annotate({
  description: "Row. y grows south (down the map).",
});

export const Point = Schema.Struct({ x: X, y: Y });

export const RectInput = Schema.Struct({
  x1: X,
  y1: Y,
  x2: X,
  y2: Y,
}).annotate({
  description:
    "An inclusive rectangle between two opposite corners (x1, y1) and (x2, y2), in any order.",
});

export const RegionInput = Schema.Union([
  Schema.Struct({ type: Schema.Literal("rect"), ...RectInput.fields }),
  Schema.Struct({
    type: Schema.Literal("disc"),
    x: X,
    y: Y,
    radius: Schema.Int.annotate({
      description: `Cells within this straight-line distance of the center, 0 to ${DISC_MAX_RADIUS}.`,
    }),
  }),
  Schema.Struct({
    type: Schema.Literal("cells"),
    cells: Schema.NonEmptyArray(Point).annotate({
      description: "The cells, each {x, y}; repeats count once.",
    }),
  }),
]).annotate({
  description: `Which cells: {"type":"rect","x1":0,"y1":0,"x2":9,"y2":9}, {"type":"disc","x":5,"y":5,"radius":3} or {"type":"cells","cells":[{"x":1,"y":2}]}. At most ${REGION_MAX_AREA} cells.`,
});

export const ComponentsInput = Components.annotate({
  description:
    'Components of this one entity that differ from its prefab\'s, for example {"text":"Welcome to the glade"} for a sign or {"colors":{"body":"blue"}} for a block. Keys: label ({noun, plural?, glyph}), layer ("floor", "liquid", "cover" or "object"), habitat (["land"], ["water"] or both), obstacle (true), model, colors ({part: shade}), text, level.',
});

export const Prefab = PrefabName.annotate({
  description: "A prefab; list_prefabs describes them all.",
});

export const Floor = FloorName.annotate({
  description: "A floor prefab; list_prefabs describes them all.",
});

export const Liquid = LiquidName.annotate({
  description: "A liquid prefab; list_prefabs describes them all.",
});

export const Seed = Schema.Int.annotate({
  description:
    "Seed for the random choices; the same seed gives the same result. Random when left out.",
});

/** A region input in the encoded form of a `Region`, still to be parsed. */
export const regionOf = (input: typeof RegionInput.Type) =>
  Match.value(input).pipe(
    Match.discriminatorsExhaustive("type")({
      cells: ({ cells }) =>
        ({
          _tag: "Cells",
          cells: Arr.map(cells, ({ x, y }) => ({ x, y })),
        }) satisfies typeof Region.Encoded,
      disc: ({ radius, x, y }) =>
        ({
          _tag: "Disc",
          center: { x, y },
          radius,
        }) satisfies typeof Region.Encoded,
      rect: ({ x1, x2, y1, y2 }) =>
        ({
          _tag: "Rect",
          from: { x: x1, y: y1 },
          to: { x: x2, y: y2 },
        }) satisfies typeof Region.Encoded,
    })
  );

const decodeCommand = Schema.decodeUnknownResult(Command);
const decodeRegion = Schema.decodeUnknownResult(Region);

/** Parses a region input, or says in words what was wrong with it. */
export const parsedRegion = (input: typeof RegionInput.Type) =>
  Result.mapError(
    decodeRegion(regionOf(input)),
    (issue) => `The region is not valid: ${issue.message}`
  );

/**
 * Parses what a tool asked for into a command, or says in words what was
 * wrong with it.
 */
export const parsedCommand = (encoded: typeof Command.Encoded) =>
  Result.mapError(
    decodeCommand(encoded),
    (issue) => `The edit is not valid: ${issue.message}`
  );

/** The cell at x, y, or a refusal when it is outside the coordinate range. */
export const cellFor = (x: number, y: number) =>
  Option.match(cellAt(x, y), {
    onNone: () =>
      refused(
        `The cell ${x},${y} is outside the coordinate range: x and y must be between -${COORDINATE_LIMIT} and ${COORDINATE_LIMIT}.`
      ),
    onSome: (cell) => Effect.succeed(cell),
  });
