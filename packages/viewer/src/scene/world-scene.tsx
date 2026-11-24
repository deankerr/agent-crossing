import { sameCell } from "@agent-crossing/world/cell";
import type { Cell } from "@agent-crossing/world/cell";
import type { Span } from "@agent-crossing/world/region";
import { bounds, emptyWorld } from "@agent-crossing/world/world";
import type { World } from "@agent-crossing/world/world";
import { useCursor } from "@react-three/drei";
import * as Option from "effect/Option";
import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { Object3D } from "three";
import type { DirectionalLight } from "three";

import { centreOf, diagonalOf } from "../layout.ts";
import { CameraRig } from "./camera-rig.tsx";
import type { FocusRequest } from "./camera-rig.tsx";
import { CellMarker } from "./cell-marker.tsx";
import { Entities } from "./entities.tsx";
import { Terrain } from "./terrain.tsx";

const SUN_DIRECTION = [-0.11, 0.88, 0.47] as const;
const SHADOW_MARGIN = 4;
const SHADOW_MAP = 2048;

const Lights = ({ span }: { readonly span: Span }) => {
  const sun = useRef<DirectionalLight>(null);
  const target = useMemo(() => new Object3D(), []);
  const { x, z } = centreOf(span);
  const reach = diagonalOf(span) / 2 + SHADOW_MARGIN;
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

const ORIGIN_SPAN: Span = { maxX: 0, maxY: 0, minX: 0, minY: 0 };

export const WorldScene = ({
  focus,
  onSelect,
  selected,
  world,
}: {
  readonly world: World;
  readonly focus: Option.Option<FocusRequest>;
  readonly selected: Option.Option<Cell>;
  readonly onSelect: (cell: Cell) => void;
}) => {
  const [hovered, setHovered] = useState(Option.none<Cell>());
  const { ground } = world;
  const span = useMemo(() => bounds({ ...emptyWorld, ground }), [ground]);

  useCursor(Option.isSome(hovered));

  const hover = (cell: Cell) => {
    setHovered((previous) =>
      Option.exists(previous, (seen) => sameCell(seen, cell))
        ? previous
        : Option.some(cell)
    );
  };

  const hoverOnly = Option.filter(
    hovered,
    (cell) => !Option.exists(selected, (chosen) => sameCell(chosen, cell))
  );

  return (
    <>
      <Lights span={Option.getOrElse(span, () => ORIGIN_SPAN)} />
      <Terrain
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
      {Option.isSome(span) ? (
        <CameraRig focus={focus} span={span.value} />
      ) : null}
    </>
  );
};
