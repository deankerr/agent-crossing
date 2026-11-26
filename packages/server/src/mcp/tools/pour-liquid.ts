import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";

import { AFTER_EDIT, editing } from "../edit.ts";
import {
  Floor,
  Liquid,
  parsedCommand,
  RegionInput,
  regionOf,
} from "../inputs.ts";
import { editTool } from "../tool.ts";

const PourInput = Schema.Struct({
  region: RegionInput,
  liquid: Liquid,
  bed: Schema.optionalKey(
    Floor.annotate({
      description:
        "The floor prefab the bed under the liquid becomes; the floor keeps its prefab when left out.",
    })
  ),
});

/** `pour_liquid`: turns the land of a region into water. */
export const PourLiquid = editTool(
  "pour_liquid",
  {
    description: `Pours a liquid over every floor of a region that has none, turning that land into water: the liquid takes the floor's level and the floor sinks one level beneath it, becoming the bed prefab when one is given. Floors already at the lowest level are skipped, and entities whose habitat is only land are removed. ${AFTER_EDIT}`,
    parameters: PourInput,
  },
  { destructive: true, idempotent: true }
);

const pourCommand = ({ region, ...liquid }: typeof PourInput.Type) =>
  parsedCommand({ ...liquid, _tag: "Pour", region: regionOf(region) });

/** The handler of `pour_liquid`. */
export const pourLiquid = Effect.map(
  editing,
  (edit) => (input: typeof PourInput.Type) => edit(pourCommand(input))
);
