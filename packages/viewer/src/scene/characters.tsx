import type { Item } from "@agent-crossing/world/entity";
import { carriedBy } from "@agent-crossing/world/world";
import type { Character } from "@agent-crossing/world/world";
import { useFrame } from "@react-three/fiber";
import * as Arr from "effect/Array";
import * as Option from "effect/Option";
import * as Record from "effect/Record";
import { useMemo, useRef } from "react";
import { BoxGeometry, MeshLambertMaterial } from "three";
import type { Group } from "three";

import { characterColour, characterShade, hueOf } from "../colours.ts";
import { placementAt } from "../glide.ts";
import { landSurface, levelAt, sceneX, sceneZ } from "../layout.ts";
import { useViewerState, useViewerStore } from "../viewer-context.ts";
import {
  isShown,
  lastSaid,
  presenceScale,
  serverNowOf,
  speechAt,
} from "../viewer-state.ts";
import { ItemModel } from "./item-model.tsx";
import { Overlay } from "./overlay.tsx";

const LEG_HEIGHT = 0.22;
const BODY_HEIGHT = 0.34;
const HEAD_HEIGHT = 0.42;
const HEAD_TOP = LEG_HEIGHT + BODY_HEIGHT + HEAD_HEIGHT;
const CARRY_HEIGHT = HEAD_TOP + 0.12;
const CARRY_SCALE = 0.5;
const LABEL_GAP = 0.32;
const STRIDE_SWING = 0.45;
const BOB = 0.05;
const HIDDEN_SCALE = 0.001;
const FIGURE_SCALE = 1.25;

const legGeometry = new BoxGeometry(0.13, LEG_HEIGHT, 0.14);
const bodyGeometry = new BoxGeometry(0.42, BODY_HEIGHT, 0.3);
const headGeometry = new BoxGeometry(0.5, HEAD_HEIGHT, 0.42);
const eyeGeometry = new BoxGeometry(0.07, 0.1, 0.02);
const eyeMaterial = new MeshLambertMaterial({ color: "#3b2f2f" });

const labelHeight = (carrying: boolean) =>
  HEAD_TOP + LABEL_GAP + (carrying ? 0.5 : 0);

const Figure = ({
  carrying,
  character,
  speech,
}: {
  readonly character: Character;
  readonly carrying: Option.Option<Item>;
  readonly speech: Option.Option<string>;
}) => {
  const store = useViewerStore();
  const { username } = character;
  const root = useRef<Group>(null);
  const leftLeg = useRef<Group>(null);
  const rightLeg = useRef<Group>(null);
  const label = useRef<HTMLDivElement>(null);
  const bubble = useRef<HTMLDivElement>(null);

  const materials = useMemo(
    () => ({
      body: new MeshLambertMaterial({ color: characterColour(username) }),
      head: new MeshLambertMaterial({
        color: `hsl(${hueOf(username)}, 70%, 82%)`,
      }),
      legs: new MeshLambertMaterial({ color: characterShade(username) }),
    }),
    [username]
  );

  useFrame(() => {
    const figure = root.current;
    const state = store.getState();

    if (figure === null) {
      return;
    }

    Option.match(
      Option.flatMap(state.synced, (synced) =>
        Option.map(
          Record.get(synced.world.characters, username),
          (current) => ({
            current,
            now: serverNowOf(synced, store.clock()),
          })
        )
      ),
      {
        onNone: () => {
          figure.visible = false;
        },
        onSome: ({ current, now }) => {
          const placement = placementAt(current.motion, now, levelAt);

          const swing = placement.walking
            ? Math.sin(placement.stride * Math.PI) * STRIDE_SWING
            : 0;

          const bob = placement.walking
            ? Math.abs(Math.sin(placement.stride * Math.PI)) * BOB
            : 0;

          const scale = presenceScale(current, state.log, now);
          const visible = scale > HIDDEN_SCALE;

          figure.position.set(
            sceneX(placement.x),
            landSurface(placement.level) + bob,
            sceneZ(placement.y)
          );
          figure.rotation.y = placement.heading;
          figure.scale.setScalar(FIGURE_SCALE * Math.max(HIDDEN_SCALE, scale));
          figure.visible = visible;
          leftLeg.current?.rotation.set(swing, 0, 0);
          rightLeg.current?.rotation.set(-swing, 0, 0);

          if (label.current !== null) {
            label.current.style.opacity = String(Math.min(1, scale));
            label.current.style.display = visible ? "" : "none";
          }

          if (bubble.current !== null) {
            bubble.current.style.display =
              visible && Option.isSome(speechAt(state.log, username, now))
                ? ""
                : "none";
          }
        },
      }
    );
  });

  return (
    <group ref={root} visible={false}>
      <group position={[-0.11, LEG_HEIGHT, 0]} ref={leftLeg}>
        <mesh
          castShadow
          geometry={legGeometry}
          material={materials.legs}
          position={[0, -LEG_HEIGHT / 2, 0]}
        />
      </group>
      <group position={[0.11, LEG_HEIGHT, 0]} ref={rightLeg}>
        <mesh
          castShadow
          geometry={legGeometry}
          material={materials.legs}
          position={[0, -LEG_HEIGHT / 2, 0]}
        />
      </group>
      <mesh
        castShadow
        geometry={bodyGeometry}
        material={materials.body}
        position={[0, LEG_HEIGHT + BODY_HEIGHT / 2, 0]}
      />
      <mesh
        castShadow
        geometry={headGeometry}
        material={materials.head}
        position={[0, LEG_HEIGHT + BODY_HEIGHT + HEAD_HEIGHT / 2, 0]}
      />
      <mesh
        geometry={eyeGeometry}
        material={eyeMaterial}
        position={[-0.11, LEG_HEIGHT + BODY_HEIGHT + 0.22, 0.211]}
      />
      <mesh
        geometry={eyeGeometry}
        material={eyeMaterial}
        position={[0.11, LEG_HEIGHT + BODY_HEIGHT + 0.22, 0.211]}
      />
      {Option.isSome(carrying) ? (
        <group position={[0, CARRY_HEIGHT, 0]} scale={CARRY_SCALE}>
          <ItemModel item={carrying.value} />
        </group>
      ) : null}
      <Overlay
        center
        position={[0, labelHeight(Option.isSome(carrying)), 0]}
        ref={label}
        zIndexRange={[40, 20]}
      >
        <div
          className="name-tag"
          style={{ borderColor: characterColour(username) }}
        >
          {character.displayName}
        </div>
      </Overlay>
      {Option.isSome(speech) ? (
        <Overlay
          position={[0, labelHeight(Option.isSome(carrying)) + 0.3, 0]}
          ref={bubble}
          zIndexRange={[45, 41]}
        >
          <div className="speech">{speech.value}</div>
        </Overlay>
      ) : null}
    </group>
  );
};

export const Characters = () => {
  const { log, synced } = useViewerState();

  return Option.match(synced, {
    onNone: () => null,
    onSome: ({ world }) => (
      <group>
        {Arr.map(
          Arr.filter(Record.values(world.characters), (character) =>
            isShown(character, log)
          ),
          (character) => (
            <Figure
              carrying={Option.map(
                carriedBy(world, character.username),
                (entity) => entity.item
              )}
              character={character}
              key={character.username}
              speech={Option.map(
                lastSaid(log, character.username),
                (said) => said.text
              )}
            />
          )
        )}
      </group>
    ),
  });
};
