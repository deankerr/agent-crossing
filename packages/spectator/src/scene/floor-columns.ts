import { cellKey } from "@agent-crossing/world/schema/cell";
import type { Cell, CellKey } from "@agent-crossing/world/schema/cell";
import { componentsOf, storedLevel } from "@agent-crossing/world/state/entity";
import type { Entity } from "@agent-crossing/world/state/entity";
import { Color } from "three";

import { cellNoise } from "./hash.ts";
import { surfaceOf, WORLD_BOTTOM } from "./layout.ts";
import { partHex } from "./model-geometry.ts";

/** Linear RGB, as instance colors want it. */
type Rgb = readonly [number, number, number];

/** A box filling one cell, from `bottom` to `top` in scene units. */
export interface Column {
  readonly cell: typeof Cell.Type;
  readonly bottom: number;
  readonly top: number;
  readonly color: Rgb;
}

/** Columns drawn with one material: lit land, or a liquid of one opacity. */
export interface ColumnGroup {
  readonly key: string;
  readonly liquid: boolean;
  readonly opacity: number;
  readonly columns: readonly Column[];
}

const CHECKER = 0.025;
const BRIGHTER_PER_LEVEL = 0.025;
const DARKER_FILL_PER_LEVEL = 0.02;

const scratch = new Color();

const shaded = (hex: string, factor: number) => {
  scratch.set(hex).multiplyScalar(factor);
  const rgb: Rgb = [scratch.r, scratch.g, scratch.b];

  return rgb;
};

const cellShade = (cell: typeof Cell.Type, variation: number) =>
  1 +
  (cellNoise(cell.x, cell.y) * 2 - 1) * variation +
  ((cell.x + cell.y) % 2 === 0 ? CHECKER : -CHECKER) * variation * 4;

const floorSurfaces = (entities: Iterable<typeof Entity.Type>) => {
  const surfaces = new Map<typeof CellKey.Type, number>();

  for (const entity of entities) {
    if (componentsOf(entity).layer === "floor") {
      surfaces.set(cellKey(entity.cell), surfaceOf(entity));
    }
  }

  return surfaces;
};

/**
 * The boxes that draw every floor and liquid, from the `slab` and `fill`
 * solids of their models. Heights are measured from each entity's own level;
 * a floor's fill reaches the bottom of the world and a liquid's the floor
 * beneath it. Floors brighten their slabs and darken their fills with level.
 */
export const floorColumns = (entities: Iterable<typeof Entity.Type>) => {
  const all = [...entities];
  const floors = floorSurfaces(all);
  const groups = new Map<string, ColumnGroup & { columns: Column[] }>();

  for (const entity of all) {
    const { colors, layer, model } = componentsOf(entity);
    const liquid = layer === "liquid";

    if ((layer === "floor" || liquid) && model !== undefined) {
      const surface = surfaceOf(entity);
      const level = storedLevel(entity);

      const beneath = liquid
        ? (floors.get(cellKey(entity.cell)) ?? WORLD_BOTTOM)
        : WORLD_BOTTOM;

      for (const part of model.parts) {
        const opacity = part.opacity ?? 1;
        const key = `${liquid ? "liquid" : "land"}:${opacity}`;
        const group = groups.get(key) ?? { columns: [], key, liquid, opacity };
        const hex = partHex(part, colors);
        const variation = cellShade(entity.cell, part.variation ?? 0);

        for (const form of part.forms) {
          const tone = (form.tone ?? 1) * variation;

          if ("slab" in form.solid) {
            const [top, thickness] = form.solid.slab;

            group.columns.push({
              bottom: surface + top - thickness,
              cell: entity.cell,
              color: shaded(
                hex,
                tone * (liquid ? 1 : 1 + level * BRIGHTER_PER_LEVEL)
              ),
              top: surface + top,
            });
          } else if ("fill" in form.solid) {
            group.columns.push({
              bottom: beneath,
              cell: entity.cell,
              color: shaded(
                hex,
                tone * (liquid ? 1 : 1 - level * DARKER_FILL_PER_LEVEL)
              ),
              top: surface + form.solid.fill,
            });
          }
        }

        groups.set(key, group);
      }
    }
  }

  const grouped: readonly ColumnGroup[] = [...groups.values()];

  return grouped;
};
