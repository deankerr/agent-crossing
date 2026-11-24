import type { Cell } from "@agent-crossing/world/cell";
import { formatCell } from "@agent-crossing/world/cell";
import { componentsOf } from "@agent-crossing/world/entity";
import { traitsOf } from "@agent-crossing/world/ground";
import { entitiesAt, groundAt } from "@agent-crossing/world/world";
import type { World } from "@agent-crossing/world/world";
import { Edges } from "@react-three/drei";
import * as Arr from "effect/Array";
import { constVoid } from "effect/Function";
import * as Option from "effect/Option";
import { BoxGeometry, MeshBasicMaterial } from "three";

import { landSurface, surfaceOf } from "../layout.ts";
import { modelNameOf, modelSpecOf } from "../models.ts";
import { Overlay } from "./overlay.tsx";

export type MarkerTone = "hover" | "selected";

const LIFT = 0.03;
const LABEL_GAP = 0.25;

const slab = new BoxGeometry(1.04, 0.06, 1.04);

const tones: Readonly<
  Record<
    MarkerTone,
    { readonly fill: MeshBasicMaterial; readonly edge: string }
  >
> = {
  hover: {
    edge: "#fffdf6",
    fill: new MeshBasicMaterial({
      color: "#fffdf6",
      depthWrite: false,
      opacity: 0.3,
      transparent: true,
    }),
  },
  selected: {
    edge: "#ffb238",
    fill: new MeshBasicMaterial({
      color: "#ffc85c",
      depthWrite: false,
      opacity: 0.4,
      transparent: true,
    }),
  },
};

const cellLabel = (world: World, cell: Cell) => {
  const entities = entitiesAt(world, cell);
  const ground = groundAt(world, cell);

  return {
    noun: Option.match(ground, {
      onNone: () => "no ground",
      onSome: (found) => traitsOf(found.kind).noun,
    }),
    surface: Option.match(ground, {
      onNone: () => landSurface(0),
      onSome: surfaceOf,
    }),
    tallest: Math.max(
      0,
      ...Arr.map(
        entities,
        (entity) =>
          modelSpecOf(modelNameOf(componentsOf(entity).appearance?.model))
            .height
      )
    ),
    writing: Arr.getSomes(
      Arr.map(entities, (entity) =>
        Option.fromNullishOr(componentsOf(entity).text)
      )
    ),
  };
};

/** A highlight on one cell, with its coordinates and any writing on it. */
export const CellMarker = ({
  cell,
  tone,
  world,
}: {
  readonly cell: Cell;
  readonly tone: MarkerTone;
  readonly world: World;
}) => {
  const label = cellLabel(world, cell);
  const { edge, fill } = tones[tone];

  return (
    <group position={[cell.x, label.surface, cell.y]}>
      <mesh
        geometry={slab}
        material={fill}
        position={[0, LIFT, 0]}
        raycast={constVoid}
        renderOrder={2}
      >
        <Edges color={edge} />
      </mesh>
      <Overlay
        center
        position={[0, label.tallest + LABEL_GAP, 0]}
        zIndexRange={tone === "selected" ? [60, 50] : [40, 30]}
      >
        <div className={`cell-label cell-label-${tone}`}>
          {Arr.map(label.writing, (text, index) => (
            <p className="sign-card" key={`${index}:${text}`}>
              {text}
            </p>
          ))}
          {tone === "hover" ? (
            <span className="cell-chip">
              {formatCell(cell)} · {label.noun}
            </span>
          ) : null}
        </div>
      </Overlay>
    </group>
  );
};
