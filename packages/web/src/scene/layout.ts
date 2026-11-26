import type * as Cell from "@agent-crossing/world/Cell";
import * as Entity from "@agent-crossing/world/Entity";
import type * as Span from "@agent-crossing/world/Span";
import * as World from "@agent-crossing/world/World";
import * as Arr from "effect/Array";
import * as Option from "effect/Option";

const LEVEL_HEIGHT = 0.4;

const BASE_SURFACE = 0.3;

/** The bottom of the world, where every floor's fill ends. */
export const WORLD_BOTTOM = -1.2;

/**
 * The surface of a level, which a floor's or liquid's model is measured from.
 * Scene units: one cell is one unit, cell `x` sits at scene `x` and cell `y`
 * at scene `z`, so south is towards the camera.
 */
export const levelSurface = (level: number) =>
  BASE_SURFACE + level * LEVEL_HEIGHT;

/** The surface of a floor or liquid's own level. */
export const surfaceOf = (entity: typeof Entity.Entity.Type) =>
  levelSurface(Entity.level(entity));

const liquidTop = (liquid: typeof Entity.Entity.Type) => {
  const tops = Arr.flatMap(Entity.components(liquid).model.parts, (part) =>
    Arr.flatMap(part.forms, ({ solid }) =>
      "fill" in solid ? [solid.fill] : []
    )
  );

  return surfaceOf(liquid) + (tops.length === 0 ? 0 : Math.max(...tops));
};

/** Where entities stand on a cell: the top of its liquid, or else its floor's surface. */
export const standingSurface = (
  floor: Option.Option<typeof Entity.Entity.Type>,
  liquid: Option.Option<typeof Entity.Entity.Type>
) =>
  Option.match(liquid, {
    onNone: () => Option.map(floor, surfaceOf),
    onSome: (found) => Option.some(liquidTop(found)),
  });

export const standingSurfaceAt = (
  world: World.World,
  cell: typeof Cell.Cell.Type
) => standingSurface(World.floorAt(world, cell), World.liquidAt(world, cell));

/** The center of a span, as scene `x` and `z`. */
export const centerOf = (span: Span.Span) =>
  ({
    x: (span.minX + span.maxX) / 2,
    z: (span.minY + span.maxY) / 2,
  }) as const;

/** The diagonal of a span in cells, at least one. */
export const diagonalOf = (span: Span.Span) =>
  Math.hypot(span.maxX - span.minX + 1, span.maxY - span.minY + 1);
