import type * as Model from "@agent-crossing/definitions/Model";
import { cellKey } from "@agent-crossing/world/schema/cell";
import type { Cell, CellKey } from "@agent-crossing/world/schema/cell";
import { componentsOf, entitySerial } from "@agent-crossing/world/state/entity";
import type { Entity, EntityId } from "@agent-crossing/world/state/entity";
import { isFloor, isLiquid } from "@agent-crossing/world/state/world";
import type { World } from "@agent-crossing/world/state/world";
import * as HashMap from "effect/HashMap";
import * as Option from "effect/Option";

import { cellNoise, unitOf } from "./hash.ts";
import { standingSurface } from "./layout.ts";
import { paintedModelOf } from "./model-geometry.ts";
import type { PaintedModel } from "./model-geometry.ts";

type Id = typeof EntityId.Type;

/** One entity as its model's instanced mesh draws it. */
export interface EntityInstance {
  readonly id: Id;
  readonly cell: typeof Cell.Type;
  readonly x: number;
  readonly y: number;
  readonly z: number;
  /** Radians about the vertical axis. */
  readonly heading: number;
  readonly scale: number;
  /** The entity's own brightness. */
  readonly shade: number;
}

/** The entities drawn with one painted model. */
export interface ModelGroup {
  readonly model: PaintedModel;
  readonly instances: readonly EntityInstance[];
}

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

interface CellContents {
  floor: Option.Option<typeof Entity.Type>;
  liquid: Option.Option<typeof Entity.Type>;
  object: boolean;
  cover: boolean;
  readonly loose: Id[];
}

const contentsOf = (entities: Iterable<typeof Entity.Type>) => {
  const cells = new Map<typeof CellKey.Type, CellContents>();

  for (const entity of entities) {
    const key = cellKey(entity.cell);

    const contents = cells.get(key) ?? {
      cover: false,
      floor: Option.none(),
      liquid: Option.none(),
      loose: [],
      object: false,
    };

    const { layer } = componentsOf(entity);

    if (layer === "floor") {
      contents.floor = Option.some(entity);
    } else if (layer === "liquid") {
      contents.liquid = Option.some(entity);
    } else if (layer === "object") {
      contents.object = true;
    } else if (layer === "cover") {
      contents.cover = true;
    } else {
      contents.loose.push(entity.id);
    }

    cells.set(key, contents);
  }

  for (const contents of cells.values()) {
    contents.loose.sort((a, b) => entitySerial(a) - entitySerial(b));
  }

  return cells;
};

interface Offset {
  readonly dx: number;
  readonly dz: number;
  readonly scale: number;
}

const centered: Offset = { dx: 0, dz: 0, scale: 1 };

const corner = (index: number, aside: number, scale: number) => {
  const [cx, cz] = CORNERS[index % CORNERS.length] ?? CORNERS[0];

  return { dx: cx * aside, dz: cz * aside, scale } satisfies Offset;
};

const offsetOf = (entity: typeof Entity.Type, contents: CellContents) => {
  const { layer } = componentsOf(entity);
  const first = Math.floor(cellNoise(entity.cell.x, entity.cell.y) * 4);

  if (layer === "object") {
    return centered;
  }

  if (layer === "cover") {
    return contents.object
      ? corner(first, COVER_ASIDE, COVER_SHARING_SCALE)
      : centered;
  }

  const place = contents.loose.indexOf(entity.id);
  const sharing = contents.object || contents.cover;

  if (sharing) {
    return corner(first + 2 + place, LOOSE_ASIDE, LOOSE_SHARING_SCALE);
  }

  return contents.loose.length > 1
    ? corner(first + place, COVER_ASIDE, LOOSE_SHARING_SCALE)
    : centered;
};

const jitterOf = (id: Id, pose: typeof Model.Pose.Type) => {
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

    case "fence":
    case "fixed": {
      return { heading: 0, scale: 1 };
    }

    default: {
      return pose satisfies never;
    }
  }
};

const neighborKey = (cell: typeof Cell.Type, dx: number, dy: number) =>
  `${cell.x + dx},${cell.y + dy}`;

const fenceHeading = (cell: typeof Cell.Type, fences: ReadonlySet<string>) => {
  const eastWest =
    fences.has(neighborKey(cell, 1, 0)) || fences.has(neighborKey(cell, -1, 0));

  const northSouth =
    fences.has(neighborKey(cell, 0, 1)) || fences.has(neighborKey(cell, 0, -1));

  return northSouth && !eastWest ? QUARTER : 0;
};

const fenceCellsOf = (entities: Iterable<typeof Entity.Type>) => {
  const byPrefab = new Map<string, Set<string>>();

  for (const entity of entities) {
    if (componentsOf(entity).model.pose === "fence") {
      const cells = byPrefab.get(entity.prefab) ?? new Set<string>();
      cells.add(cellKey(entity.cell));
      byPrefab.set(entity.prefab, cells);
    }
  }

  return byPrefab;
};

const noFences: ReadonlySet<string> = new Set();

/**
 * Every entity but the floors and liquids, standing on its cell (at the top
 * of the liquid when there is one) and grouped by the painted model that
 * draws it. Entities on cells without a floor or liquid are left out.
 */
export const entityInstances = (world: Pick<World, "entities">) => {
  const entities = [...HashMap.values(world.entities)];
  const cells = contentsOf(entities);
  const fences = fenceCellsOf(entities);

  const groups = new Map<
    string,
    { model: PaintedModel; instances: EntityInstance[] }
  >();

  for (const entity of entities) {
    const contents = cells.get(cellKey(entity.cell));

    const surface =
      contents === undefined || isFloor(entity) || isLiquid(entity)
        ? Option.none<number>()
        : standingSurface(contents.floor, contents.liquid);

    if (contents !== undefined && Option.isSome(surface)) {
      const model = paintedModelOf(entity);
      const offset = offsetOf(entity, contents);
      const jitter = jitterOf(entity.id, model.pose);

      const instance: EntityInstance = {
        cell: entity.cell,
        heading:
          model.pose === "fence"
            ? fenceHeading(entity.cell, fences.get(entity.prefab) ?? noFences)
            : jitter.heading,
        id: entity.id,
        scale: jitter.scale * offset.scale,
        shade: SHADE_MIN + unitOf(entity.id, 3) * SHADE_RANGE,
        x: entity.cell.x + offset.dx,
        y: surface.value,
        z: entity.cell.y + offset.dz,
      };

      const group = groups.get(model.key) ?? { instances: [], model };
      group.instances.push(instance);
      groups.set(model.key, group);
    }
  }

  const grouped: readonly ModelGroup[] = [...groups.values()];

  return grouped;
};
