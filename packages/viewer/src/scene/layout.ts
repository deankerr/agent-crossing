import {
  componentsOf,
  storedLevel,
} from "@agent-crossing/world/engine/state/entity";
import type { Entity } from "@agent-crossing/world/engine/state/entity";
import type { Span } from "@agent-crossing/world/engine/state/span";
import { floorAt, liquidAt } from "@agent-crossing/world/engine/state/world";
import type { World } from "@agent-crossing/world/engine/state/world";
import type { Cell } from "@agent-crossing/world/schema/cell";
import * as Arr from "effect/Array";
import * as Option from "effect/Option";

/**
 * Scene units: one cell is one unit, cell `x` sits at scene `x` and cell `y`
 * at scene `z`, so south is towards the camera. Levels step by
 * {@link LEVEL_HEIGHT}.
 */
export const LEVEL_HEIGHT = 0.4;

/** The surface of level 0. */
export const BASE_SURFACE = 0.3;

/** The bottom of the world, where every floor's fill ends. */
export const WORLD_BOTTOM = -1.2;

/** The surface of a level, which a floor's or liquid's model is measured from. */
export const levelSurface = (level: number) =>
  BASE_SURFACE + level * LEVEL_HEIGHT;

/** The surface of a floor or liquid's own level. */
export const surfaceOf = (entity: typeof Entity.Type) =>
  levelSurface(storedLevel(entity));

/** The top of a liquid: the highest top of its model's fills, or its level's surface without any. */
export const liquidTop = (liquid: typeof Entity.Type) => {
  const tops = Arr.flatMap(componentsOf(liquid).model?.parts ?? [], (part) =>
    Arr.flatMap(part.forms, ({ solid }) =>
      "fill" in solid ? [solid.fill] : []
    )
  );

  return surfaceOf(liquid) + (tops.length === 0 ? 0 : Math.max(...tops));
};

/** Where things stand on a cell: the top of its liquid, or else its floor's surface. */
export const standingSurface = (
  floor: Option.Option<typeof Entity.Type>,
  liquid: Option.Option<typeof Entity.Type>
) =>
  Option.match(liquid, {
    onNone: () => Option.map(floor, surfaceOf),
    onSome: (found) => Option.some(liquidTop(found)),
  });

export const standingSurfaceAt = (world: World, cell: typeof Cell.Type) =>
  standingSurface(floorAt(world, cell), liquidAt(world, cell));

/** The center of a span, as scene `x` and `z`. */
export const centerOf = (span: Span) =>
  ({
    x: (span.minX + span.maxX) / 2,
    z: (span.minY + span.maxY) / 2,
  }) as const;

/** The diagonal of a span in cells, at least one. */
export const diagonalOf = (span: Span) =>
  Math.hypot(span.maxX - span.minX + 1, span.maxY - span.minY + 1);
