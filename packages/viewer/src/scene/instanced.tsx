import type { ThreeEvent } from "@react-three/fiber";
import { constVoid } from "effect/Function";
import { useLayoutEffect, useRef } from "react";
import { Color, Matrix4 } from "three";
import type { BufferGeometry, InstancedMesh, Material } from "three";

const MIN_CAPACITY = 16;

/**
 * Room for `count` instances, rounded up to a power of two so that a mesh is
 * only rebuilt when the world grows past it, not on every new thing.
 */
export const capacityFor = (count: number) =>
  Math.max(MIN_CAPACITY, 2 ** Math.ceil(Math.log2(Math.max(1, count))));

export type Place<A> = (item: A, matrix: Matrix4) => void;

export type Paint<A> = (item: A, color: Color) => void;

export interface InstancesProps<A> {
  readonly items: readonly A[];
  readonly geometry: BufferGeometry;
  readonly material: Material;
  /** Stable functions: changing them refills every instance. */
  readonly place: Place<A>;
  readonly paint: Paint<A>;
  readonly castShadow?: boolean;
  readonly receiveShadow?: boolean;
  /** Draw order among meshes of the same pass: lower is earlier. */
  readonly renderOrder?: number;
  readonly onPick?: (item: A, event: ThreeEvent<PointerEvent>) => void;
  readonly onPickClick?: (item: A, event: ThreeEvent<MouseEvent>) => void;
  readonly onLeave?: () => void;
}

const matrix = new Matrix4();
const color = new Color();

/**
 * One instanced mesh drawing every item. The buffers are refilled only when
 * `items` changes, which happens only when the world does.
 */
export const Instances = <A,>({
  castShadow = false,
  geometry,
  items,
  material,
  onLeave,
  onPick,
  onPickClick,
  paint,
  place,
  receiveShadow = false,
  renderOrder = 0,
}: InstancesProps<A>) => {
  const mesh = useRef<InstancedMesh>(null);
  const capacity = capacityFor(items.length);
  const pickable = onPick !== undefined || onPickClick !== undefined;

  useLayoutEffect(() => {
    const instanced = mesh.current;

    if (instanced === null) {
      return;
    }

    for (const [index, item] of items.entries()) {
      place(item, matrix);
      instanced.setMatrixAt(index, matrix);
      paint(item, color);
      instanced.setColorAt(index, color);
    }

    instanced.count = items.length;
    instanced.instanceMatrix.needsUpdate = true;

    if (instanced.instanceColor !== null) {
      instanced.instanceColor.needsUpdate = true;
    }

    if (pickable) {
      instanced.computeBoundingBox();
      instanced.computeBoundingSphere();
    }
  }, [items, paint, pickable, place]);

  const itemOf = (instanceId: number | undefined) =>
    instanceId === undefined ? undefined : items[instanceId];

  const pointerMove = (event: ThreeEvent<PointerEvent>) => {
    const item = itemOf(event.instanceId);

    if (item !== undefined && onPick !== undefined) {
      event.stopPropagation();
      onPick(item, event);
    }
  };

  const click = (event: ThreeEvent<MouseEvent>) => {
    const item = itemOf(event.instanceId);

    if (item !== undefined && onPickClick !== undefined) {
      event.stopPropagation();
      onPickClick(item, event);
    }
  };

  const leave = () => {
    onLeave?.();
  };

  const picking = pickable
    ? { onClick: click, onPointerMove: pointerMove, onPointerOut: leave }
    : { raycast: constVoid };

  return (
    <instancedMesh
      args={[geometry, material, capacity]}
      castShadow={castShadow}
      frustumCulled={false}
      key={capacity}
      receiveShadow={receiveShadow}
      ref={mesh}
      renderOrder={renderOrder}
      {...picking}
    />
  );
};
