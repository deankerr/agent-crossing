import * as Region from "@agent-crossing/world/Region";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";

import { WorldClient } from "../../world-object/client.ts";
import { queryTool } from "../tool.ts";

const ViewMapInput = Schema.Struct({
  rect: Schema.optionalKey(
    Region.Rect.annotate({
      description:
        'The rectangle to map, {"_tag":"Rect","from":{"x":0,"y":0},"to":{"x":20,"y":10}}; the whole world when left out.',
    })
  ),
});

/** `view_map`: a glyph map, a level map and a legend of a rectangle. */
export const ViewMap = queryTool("view_map", {
  description:
    "A character map of a rectangle of the world, a level map of the same cells and a legend. Give a rectangle, or none for the whole world. Maps are at most 128 x 128 cells; a larger request is cut down from its north-west corner and the text says so.",
  parameters: ViewMapInput,
});

const EMPTY_WORLD =
  "The world is empty: no cell has a floor. Start with generate_world or fill_region.";

/** The handler of `view_map`. */
export const viewMap = Effect.map(
  WorldClient,
  (world) =>
    ({ rect }: typeof ViewMapInput.Type) =>
      Effect.map(
        world.map(
          Option.map(Option.fromNullishOr(rect), ({ from, to }) => ({
            from,
            to,
          }))
        ),
        Option.getOrElse(() => EMPTY_WORLD)
      )
);
