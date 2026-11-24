import * as Arr from "effect/Array";
import * as Option from "effect/Option";
import {
  BoxGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  Euler,
  Float32BufferAttribute,
  IcosahedronGeometry,
  Matrix4,
  Quaternion,
  Vector3,
} from "three";
import type { BufferGeometry } from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

import { modelSpecOf } from "../models.ts";
import type { Paint, Part, Solid } from "../models.ts";

/** A model's parts merged into at most one geometry per way of colouring. */
export interface ModelGeometry {
  readonly fixed: Option.Option<BufferGeometry>;
  readonly tinted: Option.Option<BufferGeometry>;
  readonly glowing: Option.Option<BufferGeometry>;
}

const WHITE = "#ffffff";

const solidGeometry = (solid: Solid) => {
  if ("box" in solid) {
    return new BoxGeometry(...solid.box);
  }

  if ("cylinder" in solid) {
    return new CylinderGeometry(...solid.cylinder);
  }

  if ("cone" in solid) {
    return new ConeGeometry(...solid.cone);
  }

  return new IcosahedronGeometry(...solid.ball);
};

const colourOf = (paint: Paint) => {
  if ("fixed" in paint) {
    return paint.fixed;
  }

  if ("glow" in paint) {
    return paint.glow;
  }

  return WHITE;
};

const partGeometry = (part: Part) => {
  const primitive = solidGeometry(part.solid);

  const geometry =
    primitive.index === null ? primitive : primitive.toNonIndexed();

  geometry.deleteAttribute("uv");

  const [x, y, z] = part.at;
  const [rx, ry, rz] = part.turn ?? [0, 0, 0];
  const [sx, sy, sz] = part.scale ?? [1, 1, 1];

  geometry.applyMatrix4(
    new Matrix4().compose(
      new Vector3(x, y, z),
      new Quaternion().setFromEuler(new Euler(rx, ry, rz)),
      new Vector3(sx, sy, sz)
    )
  );

  const colour = new Color(colourOf(part.paint));
  const { count } = geometry.getAttribute("position");
  const colours = new Float32Array(count * 3);

  for (let vertex = 0; vertex < count; vertex += 1) {
    colours.set([colour.r, colour.g, colour.b], vertex * 3);
  }

  geometry.setAttribute("color", new Float32BufferAttribute(colours, 3));

  return geometry;
};

const merged = (parts: readonly Part[]) =>
  parts.length === 0
    ? Option.none<BufferGeometry>()
    : Option.fromNullishOr(mergeGeometries(Arr.map(parts, partGeometry)));

const buildGeometry = (name: string) => {
  const { parts } = modelSpecOf(name);

  return {
    fixed: merged(Arr.filter(parts, (part) => "fixed" in part.paint)),
    glowing: merged(Arr.filter(parts, (part) => "glow" in part.paint)),
    tinted: merged(Arr.filter(parts, (part) => "tint" in part.paint)),
  } satisfies ModelGeometry;
};

const built = new Map<string, ModelGeometry>();

/** The merged geometry of a library model, built once and then shared. */
export const modelGeometry = (name: string) => {
  const cached = built.get(name);

  if (cached !== undefined) {
    return cached;
  }

  const geometry = buildGeometry(name);
  built.set(name, geometry);

  return geometry;
};
