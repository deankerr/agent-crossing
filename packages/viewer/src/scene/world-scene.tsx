import type { EntityId } from "@agent-crossing/world/entity";
import type * as Option from "effect/Option";

import { CameraRig } from "./camera-rig.tsx";
import type { FocusRequest } from "./camera-rig.tsx";
import { Characters } from "./characters.tsx";
import { Entities } from "./entities.tsx";
import { Terrain } from "./terrain.tsx";

const SHADOW_REACH = 22;

export const WorldScene = ({
  focus,
  onSelectSign,
  selectedSign,
}: {
  readonly focus: Option.Option<FocusRequest>;
  readonly selectedSign: Option.Option<EntityId>;
  readonly onSelectSign: (id: EntityId) => void;
}) => (
  <>
    <color args={["#cdeef8"]} attach="background" />
    <hemisphereLight args={["#fffaf0", "#9cc78a", 1.6]} />
    <directionalLight
      castShadow
      color="#fff4e0"
      intensity={2.1}
      position={[-18, 22, 10]}
      shadow-bias={-0.0005}
      shadow-camera-bottom={-SHADOW_REACH}
      shadow-camera-far={80}
      shadow-camera-left={-SHADOW_REACH}
      shadow-camera-right={SHADOW_REACH}
      shadow-camera-top={SHADOW_REACH}
      shadow-mapSize={[2048, 2048]}
      shadow-normalBias={0.03}
    />
    <Terrain />
    <Entities onSelectSign={onSelectSign} selectedSign={selectedSign} />
    <Characters />
    <CameraRig focus={focus} />
  </>
);
