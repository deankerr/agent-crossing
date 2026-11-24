import type { World } from "@agent-crossing/world/world";
import * as Arr from "effect/Array";
import * as Option from "effect/Option";
import { useMemo } from "react";
import {
  MeshBasicMaterial,
  MeshLambertMaterial,
  Quaternion,
  Vector3,
} from "three";

import { entityInstances } from "../entity-instances.ts";
import type { EntityInstance } from "../entity-instances.ts";
import { palette } from "../palette.ts";
import { Instances } from "./instanced.tsx";
import type { Paint, Place } from "./instanced.tsx";
import { modelGeometry } from "./model-geometry.ts";

const lit = new MeshLambertMaterial({ flatShading: true, vertexColors: true });

const glowing = new MeshBasicMaterial({
  toneMapped: false,
  vertexColors: true,
});

const UP = new Vector3(0, 1, 0);
const position = new Vector3();
const turn = new Quaternion();
const size = new Vector3();

const placeEntity: Place<EntityInstance> = (instance, matrix) => {
  matrix.compose(
    position.set(instance.x, instance.y, instance.z),
    turn.setFromAxisAngle(UP, instance.heading),
    size.setScalar(instance.scale)
  );
};

const shadeEntity: Paint<EntityInstance> = (instance, colour) => {
  colour.setScalar(instance.shade);
};

const tintEntity: Paint<EntityInstance> = (instance, colour) => {
  colour.set(palette[instance.tint]).multiplyScalar(instance.shade);
};

const unshaded: Paint<EntityInstance> = (_instance, colour) => {
  colour.setScalar(1);
};

const ModelInstances = ({
  instances,
  model,
}: {
  readonly model: string;
  readonly instances: readonly EntityInstance[];
}) => {
  const geometry = modelGeometry(model);

  return (
    <>
      {Option.isSome(geometry.fixed) ? (
        <Instances
          castShadow
          geometry={geometry.fixed.value}
          items={instances}
          material={lit}
          paint={shadeEntity}
          place={placeEntity}
          receiveShadow
        />
      ) : null}
      {Option.isSome(geometry.tinted) ? (
        <Instances
          castShadow
          geometry={geometry.tinted.value}
          items={instances}
          material={lit}
          paint={tintEntity}
          place={placeEntity}
          receiveShadow
        />
      ) : null}
      {Option.isSome(geometry.glowing) ? (
        <Instances
          geometry={geometry.glowing.value}
          items={instances}
          material={glowing}
          paint={unshaded}
          place={placeEntity}
        />
      ) : null}
    </>
  );
};

/**
 * Every entity, drawn with one instanced mesh per model and way of colouring
 * rather than one component per entity. Rebuilt only when entities or
 * ground change.
 */
export const Entities = ({ world }: { readonly world: World }) => {
  const { entities, ground } = world;

  const groups = useMemo(
    () => entityInstances({ entities, ground }),
    [entities, ground]
  );

  return (
    <group>
      {Arr.map([...groups], ([model, instances]) => (
        <ModelInstances instances={instances} key={model} model={model} />
      ))}
    </group>
  );
};
