import * as Arr from "effect/Array";
import { useLayoutEffect, useMemo, useRef } from "react";
import {
  BoxGeometry,
  Color,
  Matrix4,
  MeshLambertMaterial,
  MeshStandardMaterial,
  Quaternion,
  Vector3,
} from "three";
import type { InstancedMesh, Material } from "three";

import { grassColumns, soilColumns, waterColumns } from "./terrain-columns.ts";
import type { Column } from "./terrain-columns.ts";

const unitBox = new BoxGeometry(1, 1, 1);
const upright = new Quaternion();

const ColumnField = ({
  columns,
  material,
  shadows,
}: {
  readonly columns: readonly Column[];
  readonly material: Material;
  readonly shadows: boolean;
}) => {
  const mesh = useRef<InstancedMesh>(null);

  useLayoutEffect(() => {
    const field = mesh.current;

    if (field === null) {
      return;
    }

    Arr.forEach(columns, (column, index) => {
      const height = column.top - column.bottom;

      field.setMatrixAt(
        index,
        new Matrix4().compose(
          new Vector3(column.x, column.bottom + height / 2, column.z),
          upright,
          new Vector3(1, height, 1)
        )
      );
      field.setColorAt(index, new Color(column.colour));
    });

    field.instanceMatrix.needsUpdate = true;
    field.computeBoundingSphere();
  }, [columns]);

  return (
    <instancedMesh
      args={[unitBox, material, columns.length]}
      castShadow={shadows}
      receiveShadow
      ref={mesh}
    />
  );
};

export const Terrain = () => {
  const land = useMemo(() => new MeshLambertMaterial(), []);

  const water = useMemo(
    () => new MeshStandardMaterial({ metalness: 0, roughness: 0.3 }),
    []
  );

  return (
    <group>
      <ColumnField columns={soilColumns} material={land} shadows />
      <ColumnField columns={grassColumns} material={land} shadows />
      <ColumnField columns={waterColumns} material={water} shadows={false} />
    </group>
  );
};
