import type { Cell } from "@agent-crossing/world/schema/cell";
import type { World } from "@agent-crossing/world/state/world";
import type { ThreeEvent } from "@react-three/fiber";
import * as Arr from "effect/Array";
import * as HashMap from "effect/HashMap";
import { useMemo } from "react";
import {
  BoxGeometry,
  MeshLambertMaterial,
  MeshStandardMaterial,
  Quaternion,
  Vector3,
} from "three";
import type { Material } from "three";

import { floorColumns } from "./floor-columns.ts";
import type { Column, ColumnGroup } from "./floor-columns.ts";
import { Instances } from "./instanced.tsx";
import type { Paint, Place } from "./instanced.tsx";

const DRAG_PIXELS = 4;

const unitBox = new BoxGeometry(1, 1, 1);
const upright = new Quaternion();
const position = new Vector3();
const size = new Vector3();

const land = new MeshLambertMaterial();

const materials = new Map<string, Material>();

const materialOf = (group: ColumnGroup) => {
  const cached = materials.get(group.key);

  if (cached !== undefined) {
    return cached;
  }

  const translucent = group.opacity < 1;
  let material: Material = land;

  if (group.liquid) {
    material = new MeshStandardMaterial({
      metalness: 0.05,
      opacity: group.opacity,
      roughness: 0.22,
      transparent: translucent,
    });
  } else if (translucent) {
    material = new MeshLambertMaterial({
      opacity: group.opacity,
      transparent: true,
    });
  }

  materials.set(group.key, material);

  return material;
};

const DEPTH_FIRST = -2;
const BLEND_SECOND = -1;

const depthMaterials = new Map<string, Material>();

const depthMaterialOf = (group: ColumnGroup) => {
  const cached = depthMaterials.get(group.key);

  if (cached !== undefined) {
    return cached;
  }

  const material = materialOf(group).clone();
  material.colorWrite = false;
  depthMaterials.set(group.key, material);

  return material;
};

const placeColumn: Place<Column> = (column, matrix) => {
  matrix.compose(
    position.set(
      column.cell.x,
      (column.top + column.bottom) / 2,
      column.cell.y
    ),
    upright,
    size.set(1, column.top - column.bottom, 1)
  );
};

const paintColumn: Paint<Column> = (column, color) => {
  color.setRGB(...column.color);
};

export interface CellPicking {
  readonly onHover: (cell: typeof Cell.Type) => void;
  readonly onLeave: () => void;
  readonly onSelect: (cell: typeof Cell.Type) => void;
}

/**
 * Every floor and liquid as cell-filling boxes, one instanced mesh per
 * material. A translucent group is drawn twice, depth alone and then color,
 * so that only its nearest face blends: without that, the wall between two
 * neighboring water cells shows through whichever of them happens to be
 * drawn second.
 */
export const Floors = ({
  onHover,
  onLeave,
  onSelect,
  world,
}: CellPicking & { readonly world: World }) => {
  const groups = useMemo(
    () => floorColumns(HashMap.values(world.entities)),
    [world.entities]
  );

  const pick = (column: Column) => {
    onHover(column.cell);
  };

  const choose = (column: Column, event: ThreeEvent<MouseEvent>) => {
    if (event.delta <= DRAG_PIXELS) {
      onSelect(column.cell);
    }
  };

  return (
    <group>
      {Arr.map(
        Arr.filter(groups, (group) => group.opacity < 1),
        (group) => (
          <Instances
            geometry={unitBox}
            items={group.columns}
            key={group.key}
            material={depthMaterialOf(group)}
            paint={paintColumn}
            place={placeColumn}
            renderOrder={DEPTH_FIRST}
          />
        )
      )}
      {Arr.map(groups, (group) => (
        <Instances
          castShadow={!group.liquid}
          geometry={unitBox}
          items={group.columns}
          key={group.key}
          material={materialOf(group)}
          onLeave={onLeave}
          onPick={pick}
          onPickClick={choose}
          paint={paintColumn}
          place={placeColumn}
          receiveShadow
          renderOrder={group.opacity < 1 ? BLEND_SECOND : 0}
        />
      ))}
    </group>
  );
};
