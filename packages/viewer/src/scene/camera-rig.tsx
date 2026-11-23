import { MAP_SIZE } from "@agent-crossing/world/grid";
import type { Tile } from "@agent-crossing/world/grid";
import { MapControls } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import * as Option from "effect/Option";
import { useEffect, useRef } from "react";
import type { ComponentRef } from "react";
import { MOUSE, TOUCH, Vector3 } from "three";

import { sceneX, sceneZ, surfaceAt } from "../layout.ts";

export const CAMERA_OFFSET = new Vector3(0, 21, 28);
export const MIN_ZOOM = 12;
export const MAX_ZOOM = 140;

const EDGE = MAP_SIZE / 2;
const GLIDE_RATE = 5;
const SETTLED = 0.01;

const lowestCorner = new Vector3(-EDGE, 0, -EDGE);
const highestCorner = new Vector3(EDGE, 2, EDGE);

export interface FocusRequest {
  readonly tile: Tile;
  readonly serial: number;
}

const focusPoint = (tile: Tile) =>
  new Vector3(sceneX(tile.x), surfaceAt(tile), sceneZ(tile.y));

export const CameraRig = ({
  focus,
}: {
  readonly focus: Option.Option<FocusRequest>;
}) => {
  const controls = useRef<ComponentRef<typeof MapControls>>(null);
  const goal = useRef(Option.none<Vector3>());
  const camera = useThree((state) => state.camera);

  useEffect(() => {
    goal.current = Option.map(focus, (request) => focusPoint(request.tile));
  }, [focus]);

  const shiftBy = (shift: Vector3) => {
    const rig = controls.current;

    if (rig !== null) {
      rig.target.add(shift);
      camera.position.add(shift);
    }
  };

  const keepOnMap = () => {
    const rig = controls.current;

    if (rig !== null) {
      shiftBy(
        rig.target.clone().clamp(lowestCorner, highestCorner).sub(rig.target)
      );
    }
  };

  useFrame((_, delta) => {
    const rig = controls.current;

    if (rig === null) {
      return;
    }

    Option.map(goal.current, (target) => {
      const remaining = target.clone().sub(rig.target);

      if (remaining.length() < SETTLED) {
        goal.current = Option.none();

        return;
      }

      shiftBy(remaining.multiplyScalar(1 - Math.exp(-delta * GLIDE_RATE)));
      rig.update();
    });
  });

  return (
    <MapControls
      dampingFactor={0.15}
      enableDamping
      enableRotate={false}
      makeDefault
      maxZoom={MAX_ZOOM}
      minZoom={MIN_ZOOM}
      mouseButtons={{ LEFT: MOUSE.PAN, MIDDLE: MOUSE.DOLLY, RIGHT: MOUSE.PAN }}
      onChange={keepOnMap}
      ref={controls}
      screenSpacePanning={false}
      target={[0, 0.5, 0]}
      touches={{ ONE: TOUCH.PAN, TWO: TOUCH.DOLLY_PAN }}
      zoomToCursor
    />
  );
};
