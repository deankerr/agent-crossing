import type { Item } from "@agent-crossing/world/entity";
import type { Colour } from "@agent-crossing/world/values";
import * as Arr from "effect/Array";
import * as Record from "effect/Record";
import {
  BoxGeometry,
  CylinderGeometry,
  IcosahedronGeometry,
  MeshLambertMaterial,
} from "three";

import { palette } from "../colours.ts";

export const BLOCK_SIZE = 0.78;
const PETALS = 5;
const PETAL_RING = 0.11;
const STEM_HEIGHT = 0.36;

const blockGeometry = new BoxGeometry(BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE);
const stemGeometry = new CylinderGeometry(0.025, 0.03, STEM_HEIGHT, 6);
const leafGeometry = new BoxGeometry(0.16, 0.025, 0.07);
const petalGeometry = new IcosahedronGeometry(0.085, 0);
const heartGeometry = new IcosahedronGeometry(0.06, 0);
const postGeometry = new BoxGeometry(0.09, 0.62, 0.09);
const boardGeometry = new BoxGeometry(0.66, 0.4, 0.07);

const colourMaterials = Record.map(
  palette,
  (colour) => new MeshLambertMaterial({ color: colour })
);

const stemMaterial = new MeshLambertMaterial({ color: "#5fae5a" });
const heartMaterial = new MeshLambertMaterial({ color: "#ffd84d" });
const paleHeartMaterial = new MeshLambertMaterial({ color: "#f29b4b" });
const postMaterial = new MeshLambertMaterial({ color: "#a0754c" });
const boardMaterial = new MeshLambertMaterial({ color: "#e8c48f" });

const petalAngles = Arr.makeBy(
  PETALS,
  (index) => (index / PETALS) * Math.PI * 2
);

const BlockModel = ({ colour }: { readonly colour: Colour }) => (
  <mesh
    castShadow
    geometry={blockGeometry}
    material={colourMaterials[colour]}
    position={[0, BLOCK_SIZE / 2, 0]}
    receiveShadow
  />
);

const FlowerModel = ({ colour }: { readonly colour: Colour }) => (
  <group>
    <mesh
      castShadow
      geometry={stemGeometry}
      material={stemMaterial}
      position={[0, STEM_HEIGHT / 2, 0]}
    />
    <mesh
      geometry={leafGeometry}
      material={stemMaterial}
      position={[0.08, 0.12, 0]}
      rotation={[0, 0, 0.5]}
    />
    <mesh
      geometry={leafGeometry}
      material={stemMaterial}
      position={[-0.08, 0.18, 0]}
      rotation={[0, 0, -0.5]}
    />
    <group position={[0, STEM_HEIGHT, 0]} rotation={[0.5, 0, 0]}>
      {Arr.map(petalAngles, (angle) => (
        <mesh
          castShadow
          geometry={petalGeometry}
          key={angle}
          material={colourMaterials[colour]}
          position={[
            Math.cos(angle) * PETAL_RING,
            0,
            Math.sin(angle) * PETAL_RING,
          ]}
          scale={[1, 0.6, 1]}
        />
      ))}
      <mesh
        geometry={heartGeometry}
        material={colour === "yellow" ? paleHeartMaterial : heartMaterial}
        position={[0, 0.03, 0]}
      />
    </group>
  </group>
);

const SignModel = () => (
  <group>
    <mesh
      castShadow
      geometry={postGeometry}
      material={postMaterial}
      position={[0, 0.31, 0]}
    />
    <mesh
      castShadow
      geometry={boardGeometry}
      material={boardMaterial}
      position={[0, 0.56, 0.05]}
      receiveShadow
    />
  </group>
);

export const ItemModel = ({ item }: { readonly item: Item }) => {
  if (item._tag === "Sign") {
    return <SignModel />;
  }

  if (item._tag === "Block") {
    return <BlockModel colour={item.colour} />;
  }

  return <FlowerModel colour={item.colour} />;
};
