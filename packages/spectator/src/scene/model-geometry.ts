import type { Colors } from "@agent-crossing/world/schema/components";
import type {
  Form,
  Part,
  Pose,
  Solid,
} from "@agent-crossing/world/schema/model";
import { palette } from "@agent-crossing/world/schema/palette";
import type { Shade } from "@agent-crossing/world/schema/palette";
import { componentsOf } from "@agent-crossing/world/state/entity";
import type { Entity } from "@agent-crossing/world/state/entity";
import * as Arr from "effect/Array";
import * as Hash from "effect/Hash";
import * as Option from "effect/Option";
import * as Order from "effect/Order";
import * as Record from "effect/Record";
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

/** A part with its color settled: its shade, or the entity's override for it. */
interface PaintedPart {
  readonly hex: string;
  readonly glow: boolean;
  readonly forms: readonly (typeof Form.Type)[];
}

/**
 * What an entity's model draws, once its colors are settled. Entities with
 * the same `key` share one geometry.
 */
export interface PaintedModel {
  readonly key: string;
  readonly pose: typeof Pose.Type;
  readonly parts: readonly PaintedPart[];
}

interface ModelGeometry {
  readonly lit: Option.Option<BufferGeometry>;
  readonly glowing: Option.Option<BufferGeometry>;
  readonly height: number;
}

const PLACEHOLDER_HEX = "#e05cd0";

const placeholder: PaintedModel = {
  key: "placeholder",
  parts: [
    {
      forms: [
        { at: [0, 0.22, 0], solid: { box: [0.44, 0.44, 0.44] } },
        { at: [0, 0.56, 0], solid: { ball: [0.12, 0] } },
      ],
      glow: false,
      hex: PLACEHOLDER_HEX,
    },
  ],
  pose: "quarter",
};

/** The hex a part is painted: the entity's color for it, or its own shade. */
export const partHex = (
  part: typeof Part.Type,
  colors: typeof Colors.Type | undefined
) => {
  const shade: typeof Shade.Type = colors?.[part.name] ?? part.shade;

  return palette[shade];
};

const byPart = Order.mapInput(
  Order.String,
  ([part]: readonly [string, string]) => part
);

const colorsKey = (colors: typeof Colors.Type | undefined) =>
  Arr.join(
    Arr.map(
      Arr.sort(Record.toEntries(colors ?? {}), byPart),
      ([part, shade]) => `${part}=${shade}`
    ),
    ","
  );

/** The entity's model with its colors settled, or the placeholder. */
export const paintedModelOf = (entity: typeof Entity.Type) => {
  const { colors, model } = componentsOf(entity);

  if (model === undefined) {
    return placeholder;
  }

  const source =
    entity.components.model === undefined
      ? entity.prefab
      : `${entity.prefab}:${Hash.hash(model)}`;

  const painted: PaintedModel = {
    key: `${source}|${colorsKey(colors)}`,
    parts: Arr.map(model.parts, (part) => ({
      forms: part.forms,
      glow: part.glow === true,
      hex: partHex(part, colors),
    })),
    pose: model.pose,
  };

  return painted;
};

const solidGeometry = (solid: typeof Solid.Type) => {
  if ("box" in solid) {
    return Option.some<BufferGeometry>(new BoxGeometry(...solid.box));
  }

  if ("cylinder" in solid) {
    return Option.some<BufferGeometry>(new CylinderGeometry(...solid.cylinder));
  }

  if ("cone" in solid) {
    return Option.some<BufferGeometry>(new ConeGeometry(...solid.cone));
  }

  if ("ball" in solid) {
    return Option.some<BufferGeometry>(new IcosahedronGeometry(...solid.ball));
  }

  return Option.none<BufferGeometry>();
};

const formGeometry = (hex: string, form: typeof Form.Type) =>
  Option.map(solidGeometry(form.solid), (primitive) => {
    const geometry =
      primitive.index === null ? primitive : primitive.toNonIndexed();

    geometry.deleteAttribute("uv");

    const [x, y, z] = form.at ?? [0, 0, 0];
    const [rx, ry, rz] = form.turn ?? [0, 0, 0];
    const [sx, sy, sz] = form.scale ?? [1, 1, 1];

    geometry.applyMatrix4(
      new Matrix4().compose(
        new Vector3(x, y, z),
        new Quaternion().setFromEuler(new Euler(rx, ry, rz)),
        new Vector3(sx, sy, sz)
      )
    );

    const color = new Color(hex).multiplyScalar(form.tone ?? 1);
    const { count } = geometry.getAttribute("position");
    const colors = new Float32Array(count * 3);

    for (let vertex = 0; vertex < count; vertex += 1) {
      colors.set([color.r, color.g, color.b], vertex * 3);
    }

    geometry.setAttribute("color", new Float32BufferAttribute(colors, 3));

    return geometry;
  });

const merged = (parts: readonly PaintedPart[]) => {
  const pieces = Arr.flatMap(parts, (part) =>
    Arr.getSomes(Arr.map(part.forms, (form) => formGeometry(part.hex, form)))
  );

  return pieces.length === 0
    ? Option.none<BufferGeometry>()
    : Option.fromNullishOr(mergeGeometries(pieces));
};

const topOf = (geometry: Option.Option<BufferGeometry>) =>
  Option.match(geometry, {
    onNone: () => 0,
    onSome: (found) => {
      found.computeBoundingBox();

      return found.boundingBox?.max.y ?? 0;
    },
  });

const buildGeometry = (model: PaintedModel) => {
  const lit = merged(Arr.filter(model.parts, (part) => !part.glow));
  const glowing = merged(Arr.filter(model.parts, (part) => part.glow));

  return {
    glowing,
    height: Math.max(0, topOf(lit), topOf(glowing)),
    lit,
  } satisfies ModelGeometry;
};

const built = new Map<string, ModelGeometry>();

/**
 * The merged geometry of a painted model, with colors baked into its
 * vertices, built once per key and then shared. Cell-filling solids are
 * left out: floors and liquids draw them.
 */
export const modelGeometry = (model: PaintedModel) => {
  const cached = built.get(model.key);

  if (cached !== undefined) {
    return cached;
  }

  const geometry = buildGeometry(model);
  built.set(model.key, geometry);

  return geometry;
};
