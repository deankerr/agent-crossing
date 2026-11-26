import type { Span } from "@agent-crossing/world/state/span";
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

const fittingZoom = (span: Span, size: Size) => {
  const wide = span.maxX - span.minX + 1 + MARGIN * 2;

  const deep = (span.maxY - span.minY + 1) * DEPTH_SHARE + TALLEST + MARGIN * 2;

  return Math.max(0.5, Math.min(size.width / wide, size.height / deep));
};

const cameraDistance = (span: Span) =>
  Math.max(MIN_DISTANCE, diagonalOf(span) * DISTANCE_PER_DIAGONAL);

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
  span,
}: {
  readonly span: Span;
  readonly focus: Option.Option<FocusRequest>;
}) => {
  const controls = useRef<ComponentRef<typeof MapControls>>(null);
  const goal = useRef(Option.none<Vector3>());
  const size = useThree((state) => state.size);
  const fit = fittingZoom(span, size);
  const distance = cameraDistance(span);
  const start = useRef({ distance, span, zoom: fit });

  useLayoutEffect(() => {
    const rig = controls.current;

    if (rig === null) {
      return;
    }

    const { object: camera, target } = rig;
    const { x, z } = centerOf(start.current.span);
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
      rig.object.far = distance * 2 + diagonalOf(span);
      rig.object.updateProjectionMatrix();
    }
  }, [distance, span]);

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

    const lowest = new Vector3(span.minX - 0.5, 0, span.minY - 0.5);
    const highest = new Vector3(span.maxX + 0.5, TALLEST, span.maxY + 0.5);

    const keepOverWorld = () => {
      shiftBy(rig, rig.target.clone().clamp(lowest, highest).sub(rig.target));
    };

    rig.addEventListener("change", keepOverWorld);

    return () => {
      rig.removeEventListener("change", keepOverWorld);
    };
  }, [span]);

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
