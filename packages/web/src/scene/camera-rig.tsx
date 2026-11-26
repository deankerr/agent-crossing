import * as Region from "@agent-crossing/world/Region";
import { MapControls } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import * as Option from "effect/Option";
import { useEffect, useLayoutEffect, useRef } from "react";
import type { ComponentRef } from "react";
import { MOUSE, OrthographicCamera, TOUCH, Vector3 } from "three";

import { centerOf, diagonalOf, levelSurface } from "./layout.ts";

/** The default view: from the south, looking down at about 53 degrees. */
export const VIEW_DIRECTION = new Vector3(0, 21, 28).normalize();

const MIN_DISTANCE = 40;
const DISTANCE_PER_DIAGONAL = 1.2;
const MAX_ZOOM = 160;
const ZOOM_OUT_SHARE = 0.4;
const MIN_POLAR = 0.25;
const MAX_POLAR = 1.2;
const GLIDE_RATE = 5;
const SETTLED = 0.01;
const MARGIN = 2;
const DEPTH_SHARE = 0.62;
const TALLEST = levelSurface(7);

export interface FocusRequest {
  readonly point: readonly [number, number, number];
  readonly serial: number;
}

interface Size {
  readonly width: number;
  readonly height: number;
}

const fittingZoom = (bounds: typeof Region.Rect.Type, size: Size) => {
  const wide = Region.width(bounds) + MARGIN * 2;

  const deep = Region.height(bounds) * DEPTH_SHARE + TALLEST + MARGIN * 2;

  return Math.max(0.5, Math.min(size.width / wide, size.height / deep));
};

const cameraDistance = (bounds: typeof Region.Rect.Type) =>
  Math.max(MIN_DISTANCE, diagonalOf(bounds) * DISTANCE_PER_DIAGONAL);

interface Rig {
  readonly target: Vector3;
  readonly object: { readonly position: Vector3 };
}

const shiftBy = (rig: Rig, shift: Vector3) => {
  rig.target.add(shift);
  rig.object.position.add(shift);
};

/**
 * Pan, zoom and orbit within limits derived from the world's bounds. It fits
 * the world when mounted; remount it (with a new key) to fit again.
 */
export const CameraRig = ({
  focus,
  bounds,
}: {
  readonly bounds: typeof Region.Rect.Type;
  readonly focus: Option.Option<FocusRequest>;
}) => {
  const controls = useRef<ComponentRef<typeof MapControls>>(null);
  const goal = useRef(Option.none<Vector3>());
  const size = useThree((state) => state.size);
  const fit = fittingZoom(bounds, size);
  const distance = cameraDistance(bounds);
  const start = useRef({ bounds, distance, zoom: fit });

  useLayoutEffect(() => {
    const rig = controls.current;

    if (rig === null) {
      return;
    }

    const { object: camera, target } = rig;
    const { x, z } = centerOf(start.current.bounds);
    target.set(x, levelSurface(1), z);
    camera.position
      .copy(target)
      .addScaledVector(VIEW_DIRECTION, start.current.distance);

    if (camera instanceof OrthographicCamera) {
      camera.zoom = start.current.zoom;
      camera.updateProjectionMatrix();
    }

    rig.update();
  }, []);

  useEffect(() => {
    const rig = controls.current;

    if (rig !== null && rig.object instanceof OrthographicCamera) {
      rig.object.near = 0.1;
      rig.object.far = distance * 2 + diagonalOf(bounds);
      rig.object.updateProjectionMatrix();
    }
  }, [distance, bounds]);

  useEffect(() => {
    goal.current = Option.map(
      focus,
      (request) => new Vector3(...request.point)
    );
  }, [focus]);

  // WARNING: never pass MapControls an `onChange`; each new one reconnects the controls, and mid-drag that loses the pointerup and deafens them for good.
  useEffect(() => {
    const rig = controls.current;

    if (rig === null) {
      return;
    }

    const lowest = new Vector3(bounds.from.x - 0.5, 0, bounds.from.y - 0.5);
    const highest = new Vector3(bounds.to.x + 0.5, TALLEST, bounds.to.y + 0.5);

    const keepOverWorld = () => {
      shiftBy(rig, rig.target.clone().clamp(lowest, highest).sub(rig.target));
    };

    rig.addEventListener("change", keepOverWorld);

    return () => {
      rig.removeEventListener("change", keepOverWorld);
    };
  }, [bounds]);

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

      shiftBy(rig, remaining.multiplyScalar(1 - Math.exp(-delta * GLIDE_RATE)));
      rig.update();
    });
  });

  return (
    <MapControls
      dampingFactor={0.15}
      enableDamping
      makeDefault
      maxPolarAngle={MAX_POLAR}
      maxZoom={MAX_ZOOM}
      minPolarAngle={MIN_POLAR}
      minZoom={Math.min(fit * ZOOM_OUT_SHARE, MAX_ZOOM)}
      mouseButtons={{
        LEFT: MOUSE.PAN,
        MIDDLE: MOUSE.DOLLY,
        RIGHT: MOUSE.ROTATE,
      }}
      ref={controls}
      screenSpacePanning={false}
      touches={{ ONE: TOUCH.PAN, TWO: TOUCH.DOLLY_ROTATE }}
      zoomToCursor
    />
  );
};
