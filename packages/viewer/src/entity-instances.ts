import { cellKey } from "@agent-crossing/world/cell";
import type { Cell, CellKey } from "@agent-crossing/world/cell";
import { componentsOf, entitySerial } from "@agent-crossing/world/entity";
import type { Entity, EntityId } from "@agent-crossing/world/entity";
import type { Colour } from "@agent-crossing/world/values";
import type { World } from "@agent-crossing/world/world";
import * as HashMap from "effect/HashMap";
import * as Option from "effect/Option";

import { cellNoise, unitOf } from "./hash.ts";
import { surfaceOf } from "./layout.ts";
import { modelNameOf, modelSpecOf } from "./models.ts";
import type { Pose } from "./models.ts";

/** One entity as its model's instanced mesh draws it. */
export interface EntityInstance {
  readonly id: EntityId;
  readonly cell: Cell;
  readonly x: number;
  readonly y: number;
  readonly z: number;
  /** Radians about the vertical axis. */
  readonly heading: number;
  readonly scale: number;
  /** Brightness of the model's fixed colours. */
  readonly shade: number;
  /** The colour of the model's tinted parts. */
  readonly tint: Colour;
}

/** Instances grouped by model name; unknown models are grouped as the placeholder. */
export type ModelInstances = ReadonlyMap<string, readonly EntityInstance[]>;

const CORNERS = [
  [1, 1],
  [-1, 1],
  [-1, -1],
  [1, -1],
] as const;

const COVER_ASIDE = 0.22;
const COVER_SHARING_SCALE = 0.65;
const LOOSE_ASIDE = 0.3;
const LOOSE_SHARING_SCALE = 0.8;
const NATURE_SCALE_MIN = 0.85;
const NATURE_SCALE_RANGE = 0.3;
const SHADE_MIN = 0.92;
const SHADE_RANGE = 0.16;
const FACING_SWAY = 0.5;
const QUARTER = Math.PI / 2;
const TURN = Math.PI * 2;

interface Occupancy {
  object: boolean;
  cover: boolean;
  readonly loose: EntityId[];
}

const occupancyOf = (entities: Iterable<Entity>) => {
  const cells = new Map<CellKey, Occupancy>();

  for (const entity of entities) {
    const key = cellKey(entity.cell);

    const occupancy = cells.get(key) ?? {
      cover: false,
      loose: [],
      object: false,
    };

    const { layer } = componentsOf(entity);

    if (layer === "object") {
      occupancy.object = true;
    } else if (layer === "cover") {
      occupancy.cover = true;
    } else {
      occupancy.loose.push(entity.id);
    }

    cells.set(key, occupancy);
  }

  for (const occupancy of cells.values()) {
    occupancy.loose.sort((a, b) => entitySerial(a) - entitySerial(b));
  }

  return cells;
};

interface Offset {
  readonly dx: number;
  readonly dz: number;
  readonly scale: number;
}

const centred: Offset = { dx: 0, dz: 0, scale: 1 };

const corner = (index: number, aside: number, scale: number) => {
  const [cx, cz] = CORNERS[index % CORNERS.length] ?? CORNERS[0];

  return { dx: cx * aside, dz: cz * aside, scale } satisfies Offset;
};

const offsetOf = (entity: Entity, occupancy: Occupancy | undefined) => {
  if (occupancy === undefined) {
    return centred;
  }

  const { layer } = componentsOf(entity);
  const first = Math.floor(cellNoise(entity.cell.x, entity.cell.y) * 4);

  if (layer === "object") {
    return centred;
  }

  if (layer === "cover") {
    return occupancy.object
      ? corner(first, COVER_ASIDE, COVER_SHARING_SCALE)
      : centred;
  }

  const place = occupancy.loose.indexOf(entity.id);
  const sharing = occupancy.object || occupancy.cover;

  if (sharing) {
    return corner(first + 2 + place, LOOSE_ASIDE, LOOSE_SHARING_SCALE);
  }

  return occupancy.loose.length > 1
    ? corner(first + place, COVER_ASIDE, LOOSE_SHARING_SCALE)
    : centred;
};

/** Heading and size from the entity's id alone, so they never flicker. */
export const jitterOf = (id: EntityId, pose: Pose) => {
  const heading = unitOf(id, 1);
  const size = unitOf(id, 2);

  switch (pose) {
    case "nature": {
      return {
        heading: heading * TURN,
        scale: NATURE_SCALE_MIN + size * NATURE_SCALE_RANGE,
      };
    }

    case "quarter": {
      return { heading: Math.floor(heading * 4) * QUARTER, scale: 1 };
    }

    case "facing": {
      return { heading: (heading - 0.5) * FACING_SWAY, scale: 1 };
    }

    case "fence": {
      return { heading: 0, scale: 1 };
    }

    default: {
      return pose satisfies never;
    }
  }
};

const neighbourKey = (cell: Cell, dx: number, dy: number) =>
  `${cell.x + dx},${cell.y + dy}`;

const fenceHeading = (cell: Cell, fences: ReadonlySet<string>) => {
  const eastWest =
    fences.has(neighbourKey(cell, 1, 0)) ||
    fences.has(neighbourKey(cell, -1, 0));

  const northSouth =
    fences.has(neighbourKey(cell, 0, 1)) ||
    fences.has(neighbourKey(cell, 0, -1));

  return northSouth && !eastWest ? QUARTER : 0;
};

const fenceCellsOf = (entities: Iterable<Entity>) => {
  const byModel = new Map<string, Set<string>>();

  for (const entity of entities) {
    const model = modelNameOf(componentsOf(entity).appearance?.model);

    if (modelSpecOf(model).pose === "fence") {
      const cells = byModel.get(model) ?? new Set<string>();
      cells.add(cellKey(entity.cell));
      byModel.set(model, cells);
    }
  }

  return byModel;
};

const noFences: ReadonlySet<string> = new Set();

/**
 * Every entity standing on ground, placed on its cell's surface (the water
 * surface for wet ground) and grouped by the model that draws it. Entities
 * on cells without ground are left out.
 */
export const entityInstances = (world: Pick<World, "entities" | "ground">) => {
  const entities = [...HashMap.values(world.entities)];
  const occupancy = occupancyOf(entities);
  const fences = fenceCellsOf(entities);
  const groups = new Map<string, EntityInstance[]>();

  for (const entity of entities) {
    const key = cellKey(entity.cell);
    const ground = HashMap.get(world.ground, key);

    if (Option.isSome(ground)) {
      const components = componentsOf(entity);
      const model = modelNameOf(components.appearance?.model);
      const spec = modelSpecOf(model);
      const offset = offsetOf(entity, occupancy.get(key));
      const jitter = jitterOf(entity.id, spec.pose);

      const instance: EntityInstance = {
        cell: entity.cell,
        heading:
          spec.pose === "fence"
            ? fenceHeading(entity.cell, fences.get(model) ?? noFences)
            : jitter.heading,
        id: entity.id,
        scale: jitter.scale * offset.scale,
        shade: SHADE_MIN + unitOf(entity.id, 3) * SHADE_RANGE,
        tint: components.colour ?? spec.tint,
        x: entity.cell.x + offset.dx,
        y: surfaceOf(ground.value.ground),
        z: entity.cell.y + offset.dz,
      };

      const group = groups.get(model) ?? [];
      group.push(instance);
      groups.set(model, group);
    }
  }

  const grouped: ModelInstances = groups;

  return grouped;
};
