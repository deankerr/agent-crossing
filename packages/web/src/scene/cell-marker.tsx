import * as Cell from "@agent-crossing/world/Cell";
import * as Entity from "@agent-crossing/world/Entity";
import * as World from "@agent-crossing/world/World";
import { Edges } from "@react-three/drei";
import * as Arr from "effect/Array";
import { constVoid } from "effect/Function";
import * as Option from "effect/Option";
import { BoxGeometry, MeshBasicMaterial } from "three";

import { levelSurface, standingSurfaceAt } from "./layout.ts";
import { modelGeometry, paintedModelOf } from "./model-geometry.ts";
import { Overlay } from "./overlay.tsx";

type MarkerTone = "hover" | "selected";

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

const cellLabel = (world: World.World, cell: typeof Cell.Cell.Type) => {
  const entities = Arr.filter(
    World.entitiesAt(world, cell),
    (entity) => !Entity.isFloor(entity) && !Entity.isLiquid(entity)
  );

  return {
    noun: Arr.join(
      [
        Option.match(World.floorAt(world, cell), {
          onNone: () => "no floor",
          onSome: Entity.nounOf,
        }),
        ...Arr.map(Arr.fromOption(World.liquidAt(world, cell)), Entity.nounOf),
      ],
      " · "
    ),
    surface: Option.getOrElse(standingSurfaceAt(world, cell), () =>
      levelSurface(0)
    ),
    tallest: Math.max(
      0,
      ...Arr.map(
        entities,
        (entity) => modelGeometry(paintedModelOf(entity)).height
      )
    ),
    writing: Arr.getSomes(
      Arr.map(entities, (entity) =>
        Option.fromNullishOr(Entity.components(entity).text)
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
  readonly cell: typeof Cell.Cell.Type;
  readonly tone: MarkerTone;
  readonly world: World.World;
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
        <div className="cell-label">
          {Arr.map(label.writing, (text, index) => (
            <p className="sign-card" key={`${index}:${text}`}>
              {text}
            </p>
          ))}
          {tone === "hover" ? (
            <span className="cell-chip">
              {Cell.format(cell)} · {label.noun}
            </span>
          ) : null}
        </div>
      </Overlay>
    </group>
  );
};
