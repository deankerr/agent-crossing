import * as Level from "@agent-crossing/definitions/Level";
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";

import { AFTER_EDIT, editing } from "../edit.ts";
import { Floor, parsedCommand, RegionInput, regionOf } from "../inputs.ts";
import { editTool } from "../tool.ts";

const PaintInput = Schema.Struct({
  region: RegionInput,
  floor: Schema.optionalKey(Floor),
  level: Schema.optionalKey(
    Schema.Int.annotate({
      description: `Level ${Level.MIN} (low) to ${Level.MAX} (high). Floors keep their level when left out; new floors start at 0.`,
    })
  ),
});

/** `paint_floor`: lays or changes the floors of a region. */
export const PaintFloor = editTool(
  "paint_floor",
  {
    description: `Sets the floor prefab, the level or both across a region, keeping what stands on the floors. Cells without a floor join the world only when a floor is given; new floors start at level 0 unless a level is given. ${AFTER_EDIT}`,
    parameters: PaintInput,
  },
  { destructive: true, idempotent: true }
);

const paintCommand = ({ region, ...floor }: typeof PaintInput.Type) =>
  parsedCommand({ ...floor, _tag: "Paint", region: regionOf(region) });

/** The handler of `paint_floor`. */
export const paintFloor = Effect.map(
  editing,
  (edit) => (input: typeof PaintInput.Type) => edit(paintCommand(input))
);
