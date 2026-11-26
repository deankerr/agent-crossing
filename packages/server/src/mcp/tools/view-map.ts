import { Area } from "@agent-crossing/world/state/area";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as Result from "effect/Result";
import * as Schema from "effect/Schema";

import { WorldClient } from "../../world-object/client.ts";
import { X, Y } from "../inputs.ts";
import { parsed, queryTool, refused } from "../tool.ts";

const ViewMapInput = Schema.Struct({
  x1: Schema.optionalKey(X),
  y1: Schema.optionalKey(Y),
  x2: Schema.optionalKey(X),
  y2: Schema.optionalKey(Y),
});

/** `view_map`: a glyph map, a level map and a legend of a rectangle. */
export const ViewMap = queryTool("view_map", {
  description:
    "A character map of a rectangle of the world, a level map of the same cells and a legend. Give all four of x1, y1, x2, y2, or none for the whole world. Maps are at most 128 x 128 cells; a larger request is cut down from its north-west corner and the text says so.",
  parameters: ViewMapInput,
});

const decodeArea = Schema.decodeUnknownResult(Area);

const areaFor = ({ x1, x2, y1, y2 }: typeof ViewMapInput.Type) => {
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

/** The handler of `view_map`. */
export const viewMap = Effect.map(
  WorldClient,
  (world) => (input: typeof ViewMapInput.Type) =>
    Effect.map(
      Effect.flatMap(areaFor(input), world.map),
      Option.getOrElse(() => EMPTY_WORLD)
    )
);
