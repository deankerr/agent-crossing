import * as Cell from "@agent-crossing/world/Cell";
import * as Region from "@agent-crossing/world/Region";
import * as World from "@agent-crossing/world/World";
import { useCursor } from "@react-three/drei";
import * as Option from "effect/Option";
import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { Object3D } from "three";
import type { DirectionalLight } from "three";

import { CameraRig } from "./camera-rig.tsx";
import type { FocusRequest } from "./camera-rig.tsx";
import { CellMarker } from "./cell-marker.tsx";
import { Entities } from "./entities.tsx";
import { Floors } from "./floors.tsx";
import { centerOf, diagonalOf } from "./layout.ts";

const SUN_DIRECTION = [-0.11, 0.88, 0.47] as const;
const SHADOW_MARGIN = 4;
const SHADOW_MAP = 2048;

const Lights = ({ bounds }: { readonly bounds: typeof Region.Rect.Type }) => {
  const sun = useRef<DirectionalLight>(null);
  const target = useMemo(() => new Object3D(), []);
  const { x, z } = centerOf(bounds);
  const reach = diagonalOf(bounds) / 2 + SHADOW_MARGIN;
  const distance = reach * 2 + 20;
  const [dx, dy, dz] = SUN_DIRECTION;

  useLayoutEffect(() => {
    const light = sun.current;

    if (light === null) {
      return;
    }

    const shadowCamera = light.shadow.camera;
    shadowCamera.left = -reach;
    shadowCamera.right = reach;
    shadowCamera.top = reach;
    shadowCamera.bottom = -reach;
    shadowCamera.near = 0.5;
    shadowCamera.far = distance + reach * 2;
    shadowCamera.updateProjectionMatrix();
  }, [distance, reach]);

  return (
    <>
      <hemisphereLight args={["#fffaf0", "#9cc78a", 1.5]} />
      <primitive object={target} position={[x, 0, z]} />
      <directionalLight
        castShadow
        color="#fff1d6"
        intensity={2.1}
        position={[x + dx * distance, dy * distance, z + dz * distance]}
        ref={sun}
        shadow-bias={-0.0005}
        shadow-mapSize={[SHADOW_MAP, SHADOW_MAP]}
        shadow-normalBias={0.03}
        target={target}
      />
    </>
  );
};

const ORIGIN_BOUNDS = Region.sized(
  { x: Cell.Coordinate.make(0), y: Cell.Coordinate.make(0) },
  1,
  1
);

export const WorldScene = ({
  focus,
  onSelect,
  selected,
  world,
}: {
  readonly world: World.World;
  readonly focus: Option.Option<FocusRequest>;
  readonly selected: Option.Option<typeof Cell.Cell.Type>;
  readonly onSelect: (cell: typeof Cell.Cell.Type) => void;
}) => {
  const [hovered, setHovered] = useState(Option.none<typeof Cell.Cell.Type>());
  const { entities, entitiesByCell } = world;

  const bounds = useMemo(
    () => World.bounds({ ...World.empty, entities, entitiesByCell }),
    [entities, entitiesByCell]
  );

  useCursor(Option.isSome(hovered));

  const hover = (cell: typeof Cell.Cell.Type) => {
    setHovered((previous) =>
      Option.exists(previous, (seen) => Cell.same(seen, cell))
        ? previous
        : Option.some(cell)
    );
  };

  const hoverOnly = Option.filter(
    hovered,
    (cell) => !Option.exists(selected, (chosen) => Cell.same(chosen, cell))
  );

  return (
    <>
      <Lights bounds={Option.getOrElse(bounds, () => ORIGIN_BOUNDS)} />
      <Floors
        onHover={hover}
        onLeave={() => {
          setHovered(Option.none());
        }}
        onSelect={onSelect}
        world={world}
      />
      <Entities world={world} />
      {Option.isSome(hoverOnly) ? (
        <CellMarker cell={hoverOnly.value} tone="hover" world={world} />
      ) : null}
      {Option.isSome(selected) ? (
        <CellMarker cell={selected.value} tone="selected" world={world} />
      ) : null}
      {Option.isSome(bounds) ? (
        <CameraRig bounds={bounds.value} focus={focus} />
      ) : null}
    </>
  );
};
