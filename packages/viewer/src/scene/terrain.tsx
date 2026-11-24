import type { Cell } from "@agent-crossing/world/cell";
import type { World } from "@agent-crossing/world/world";
import type { ThreeEvent } from "@react-three/fiber";
import * as HashMap from "effect/HashMap";
import { useMemo } from "react";
import {
  BoxGeometry,
  MeshLambertMaterial,
  MeshStandardMaterial,
  Quaternion,
  Vector3,
} from "three";

import { terrainColumns } from "../terrain-columns.ts";
import type { Column } from "../terrain-columns.ts";
import { Instances } from "./instanced.tsx";
import type { Paint, Place } from "./instanced.tsx";

const DRAG_PIXELS = 4;

const unitBox = new BoxGeometry(1, 1, 1);
const upright = new Quaternion();
const position = new Vector3();
const size = new Vector3();

const land = new MeshLambertMaterial();

const water = new MeshStandardMaterial({
  metalness: 0.05,
  roughness: 0.22,
});

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

const paintColumn: Paint<Column> = (column, colour) => {
  colour.setRGB(...column.colour);
};

export interface CellPicking {
  readonly onHover: (cell: Cell) => void;
  readonly onLeave: () => void;
  readonly onSelect: (cell: Cell) => void;
}

/** The ground as three instanced meshes: sides, caps and water. */
export const Terrain = ({
  onHover,
  onLeave,
  onSelect,
  world,
}: CellPicking & { readonly world: World }) => {
  const columns = useMemo(
    () => terrainColumns(HashMap.values(world.ground)),
    [world.ground]
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
      <Instances
        castShadow
        geometry={unitBox}
        items={columns.sides}
        material={land}
        onLeave={onLeave}
        onPick={pick}
        onPickClick={choose}
        paint={paintColumn}
        place={placeColumn}
        receiveShadow
      />
      <Instances
        castShadow
        geometry={unitBox}
        items={columns.caps}
        material={land}
        onLeave={onLeave}
        onPick={pick}
        onPickClick={choose}
        paint={paintColumn}
        place={placeColumn}
        receiveShadow
      />
      <Instances
        geometry={unitBox}
        items={columns.water}
        material={water}
        onLeave={onLeave}
        onPick={pick}
        onPickClick={choose}
        paint={paintColumn}
        place={placeColumn}
        receiveShadow
      />
    </group>
  );
};
