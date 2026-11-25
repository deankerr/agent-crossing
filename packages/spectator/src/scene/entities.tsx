import type { World } from "@agent-crossing/world/state/world";
import * as Arr from "effect/Array";
import * as Option from "effect/Option";
import { useMemo } from "react";
import {
  MeshBasicMaterial,
  MeshLambertMaterial,
  Quaternion,
  Vector3,
} from "three";

import { entityInstances } from "./entity-instances.ts";
import type { EntityInstance, ModelGroup } from "./entity-instances.ts";
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

const shadeEntity: Paint<EntityInstance> = (instance, color) => {
  color.setScalar(instance.shade);
};

const unshaded: Paint<EntityInstance> = (_instance, color) => {
  color.setScalar(1);
};

const ModelInstances = ({ group }: { readonly group: ModelGroup }) => {
  const geometry = modelGeometry(group.model);

  return (
    <>
      {Option.isSome(geometry.lit) ? (
        <Instances
          castShadow
          geometry={geometry.lit.value}
          items={group.instances}
          material={lit}
          paint={shadeEntity}
          place={placeEntity}
          receiveShadow
        />
      ) : null}
      {Option.isSome(geometry.glowing) ? (
        <Instances
          geometry={geometry.glowing.value}
          items={group.instances}
          material={glowing}
          paint={unshaded}
          place={placeEntity}
        />
      ) : null}
    </>
  );
};

/**
 * Every entity but the floors and liquids, drawn with one instanced mesh per
 * painted model and material rather than one component per entity. Rebuilt
 * only when the entities change.
 */
export const Entities = ({ world }: { readonly world: World }) => {
  const { entities } = world;
  const groups = useMemo(() => entityInstances({ entities }), [entities]);

  return (
    <group>
      {Arr.map(groups, (group) => (
        <ModelInstances group={group} key={group.model.key} />
      ))}
    </group>
  );
};
