import type { Entity, EntityId } from "@agent-crossing/world/entity";
import { allEntities } from "@agent-crossing/world/world";
import { useCursor } from "@react-three/drei";
import * as Arr from "effect/Array";
import * as Option from "effect/Option";
import { useState } from "react";

import { sceneX, sceneZ, surfaceAt } from "../layout.ts";
import { useViewerState } from "../viewer-context.ts";
import { ItemModel } from "./item-model.tsx";
import { Overlay } from "./overlay.tsx";

const SIGN_CARD_HEIGHT = 1.05;

const SignCard = ({ text }: { readonly text: string }) => (
  <Overlay center position={[0, SIGN_CARD_HEIGHT, 0]} zIndexRange={[60, 50]}>
    <div className="sign-card">{text}</div>
  </Overlay>
);

const GroundEntity = ({
  entity,
  hovered,
  onHover,
  onSelect,
  selected,
}: {
  readonly entity: Entity;
  readonly hovered: boolean;
  readonly selected: boolean;
  readonly onHover: (id: Option.Option<EntityId>) => void;
  readonly onSelect: (id: EntityId) => void;
}) => {
  if (entity.location._tag !== "Ground") {
    return null;
  }

  const { tile } = entity.location;
  const { item } = entity;
  const isSign = item._tag === "Sign";

  return (
    <group
      onClick={(event) => {
        if (isSign) {
          event.stopPropagation();
          onSelect(entity.id);
        }
      }}
      onPointerOut={() => {
        if (isSign) {
          onHover(Option.none());
        }
      }}
      onPointerOver={(event) => {
        if (isSign) {
          event.stopPropagation();
          onHover(Option.some(entity.id));
        }
      }}
      position={[sceneX(tile.x), surfaceAt(tile), sceneZ(tile.y)]}
    >
      <ItemModel item={item} />
      {item._tag === "Sign" && (hovered || selected) ? (
        <SignCard text={item.text} />
      ) : null}
    </group>
  );
};

export const Entities = ({
  onSelectSign,
  selectedSign,
}: {
  readonly selectedSign: Option.Option<EntityId>;
  readonly onSelectSign: (id: EntityId) => void;
}) => {
  const { synced } = useViewerState();
  const [hovered, setHovered] = useState(Option.none<EntityId>());

  useCursor(Option.isSome(hovered));

  return Option.match(synced, {
    onNone: () => null,
    onSome: ({ world }) => (
      <group>
        {Arr.map(allEntities(world), (entity) => (
          <GroundEntity
            entity={entity}
            hovered={Option.contains(hovered, entity.id)}
            key={entity.id}
            onHover={setHovered}
            onSelect={onSelectSign}
            selected={Option.contains(selectedSign, entity.id)}
          />
        ))}
      </group>
    ),
  });
};
