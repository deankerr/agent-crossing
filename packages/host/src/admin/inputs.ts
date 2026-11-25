import { PrefabName } from "@agent-crossing/world/definitions/prefabs";
import {
  Command,
  FloorName,
  GENERATE_MAX_SIZE,
  GENERATE_MIN_SIZE,
  LiquidName,
  SCATTER_MAX_PREFABS,
} from "@agent-crossing/world/editing/command";
import {
  DISC_MAX_RADIUS,
  Region,
  REGION_MAX_AREA,
} from "@agent-crossing/world/editing/region";
import { MAX_LEVEL, MIN_LEVEL } from "@agent-crossing/world/schema/cell";
import { Components } from "@agent-crossing/world/schema/components";
import { EntityId } from "@agent-crossing/world/state/entity";
import * as Arr from "effect/Array";
import * as Match from "effect/Match";
import * as Result from "effect/Result";
import * as Schema from "effect/Schema";

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

const ComponentsInput = Components.annotate({
  description:
    'Components of this one entity that differ from its prefab\'s, for example {"text":"Welcome to the glade"} for a sign or {"colors":{"body":"blue"}} for a block. Keys: label ({noun, plural?, glyph}), layer ("floor", "liquid", "cover" or "object"), habitat (["land"], ["water"] or both), obstacle (true), model, colors ({part: shade}), text, level.',
});

const Prefab = PrefabName.annotate({
  description: "A prefab; list_prefabs describes them all.",
});

const Floor = FloorName.annotate({
  description: "A floor prefab; list_prefabs describes them all.",
});

const Liquid = LiquidName.annotate({
  description: "A liquid prefab; list_prefabs describes them all.",
});

const Seed = Schema.Int.annotate({
  description:
    "Seed for the random choices; the same seed gives the same result. Random when left out.",
});

/** The inputs of the edit tools. */
export const PaintInput = Schema.Struct({
  region: RegionInput,
  floor: Schema.optionalKey(Floor),
  level: Schema.optionalKey(
    Schema.Int.annotate({
      description: `Level ${MIN_LEVEL} (low) to ${MAX_LEVEL} (high). Floors keep their level when left out; new floors start at 0.`,
    })
  ),
});

export const PourInput = Schema.Struct({
  region: RegionInput,
  liquid: Liquid,
  bed: Schema.optionalKey(
    Floor.annotate({
      description:
        "The floor prefab the bed under the liquid becomes; the floor keeps its prefab when left out.",
    })
  ),
});

export const EraseInput = Schema.Struct({ region: RegionInput });

export const SpawnInput = Schema.Struct({
  prefab: Prefab,
  x: X,
  y: Y,
  components: Schema.optionalKey(ComponentsInput),
});

export const ScatterInput = Schema.Struct({
  prefabs: Schema.NonEmptyArray(Prefab).annotate({
    description: `1 to ${SCATTER_MAX_PREFABS} prefabs, chosen at random for each placement.`,
  }),
  region: RegionInput,
  density: Schema.Finite.annotate({
    description:
      "The share of the region's cells to try, 0 to 1. Cells where an entity may not be are skipped.",
  }),
  seed: Schema.optionalKey(Seed),
  components: Schema.optionalKey(ComponentsInput),
});

export const MoveInput = Schema.Struct({
  id: EntityId.annotate({ description: "The entity's id, like e12." }),
  x: X,
  y: Y,
});

export const ChangeInput = Schema.Struct({
  id: EntityId.annotate({ description: "The entity's id, like e12." }),
  components: ComponentsInput.annotate({
    description:
      'The entity\'s own components, replacing those it had; its prefab\'s still apply beneath. {} resets it to its prefab. Example: {"text":"Gone fishing","colors":{"board":"blue"}}.',
  }),
});

export const RemoveInput = Schema.Struct({
  ids: Schema.optionalKey(
    Schema.NonEmptyArray(EntityId).annotate({
      description: 'The ids of the entities to remove, like ["e3", "e7"].',
    })
  ),
  region: Schema.optionalKey(RegionInput),
  prefab: Schema.optionalKey(
    PrefabName.annotate({
      description:
        "With region: remove only entities of this prefab, floors and liquids included.",
    })
  ),
});

export const GenerateInput = Schema.Struct({
  width: Schema.Int.annotate({
    description: `Width in cells, ${GENERATE_MIN_SIZE} to ${GENERATE_MAX_SIZE}.`,
  }),
  height: Schema.Int.annotate({
    description: `Height in cells, ${GENERATE_MIN_SIZE} to ${GENERATE_MAX_SIZE}.`,
  }),
  x: Schema.optionalKey(
    X.annotate({ description: "x of the north-west corner; default 0." })
  ),
  y: Schema.optionalKey(
    Y.annotate({ description: "y of the north-west corner; default 0." })
  ),
  seed: Schema.optionalKey(Seed),
});

const regionOf = (input: typeof RegionInput.Type) =>
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

export const paintCommand = ({ region, ...floor }: typeof PaintInput.Type) =>
  parsedCommand({ ...floor, _tag: "Paint", region: regionOf(region) });

export const pourCommand = ({ region, ...liquid }: typeof PourInput.Type) =>
  parsedCommand({ ...liquid, _tag: "Pour", region: regionOf(region) });

export const eraseCommand = (input: typeof EraseInput.Type) =>
  parsedCommand({ _tag: "Erase", region: regionOf(input.region) });

export const spawnCommand = ({ x, y, ...spawned }: typeof SpawnInput.Type) =>
  parsedCommand({ ...spawned, _tag: "Spawn", cell: { x, y } });

export const scatterCommand = (
  { region, seed, ...scattered }: typeof ScatterInput.Type,
  randomSeed: number
) =>
  parsedCommand({
    ...scattered,
    _tag: "Scatter",
    region: regionOf(region),
    seed: seed ?? randomSeed,
  });

export const moveCommand = (input: typeof MoveInput.Type) =>
  parsedCommand({
    _tag: "Move",
    entity: input.id,
    to: { x: input.x, y: input.y },
  });

export const changeCommand = (input: typeof ChangeInput.Type) =>
  parsedCommand({
    _tag: "Change",
    components: input.components,
    entity: input.id,
  });

export const removeCommand = ({
  ids,
  region,
  ...only
}: typeof RemoveInput.Type) => {
  if (ids !== undefined && region !== undefined) {
    return Result.fail(
      "Give either ids or a region, not both: ids removes those entities, region (with an optional prefab) removes what is there."
    );
  }

  if (region !== undefined) {
    return parsedCommand({
      ...only,
      _tag: "RemoveIn",
      region: regionOf(region),
    });
  }

  if (ids !== undefined) {
    return only.prefab === undefined
      ? parsedCommand({ _tag: "Remove", entities: ids })
      : Result.fail(
          "prefab only narrows a region; with ids, the listed entities are removed whatever their prefab."
        );
  }

  return Result.fail(
    'Give ids (a non-empty list like ["e3"]) or a region to remove from.'
  );
};

export const generateCommand = (
  input: typeof GenerateInput.Type,
  seed: number
) =>
  parsedCommand({
    _tag: "Generate",
    height: input.height,
    origin: { x: input.x ?? 0, y: input.y ?? 0 },
    seed: input.seed ?? seed,
    width: input.width,
  });
