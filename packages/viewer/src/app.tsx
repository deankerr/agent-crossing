import type { Cell } from "@agent-crossing/world/cell";
import { cellCount, groundAt } from "@agent-crossing/world/world";
import type { World } from "@agent-crossing/world/world";
import { Canvas } from "@react-three/fiber";
import * as Option from "effect/Option";
import { useState } from "react";

import { statusOf } from "./feed-state.ts";
import type { FeedState } from "./feed-state.ts";
import { landSurface, surfaceOf } from "./layout.ts";
import { VIEW_DIRECTION } from "./scene/camera-rig.tsx";
import type { FocusRequest } from "./scene/camera-rig.tsx";
import { OverlayContext } from "./scene/overlay.tsx";
import { WorldScene } from "./scene/world-scene.tsx";
import { SidePanel } from "./side-panel.tsx";
import { useFeedState } from "./store.ts";

const INITIAL_DISTANCE = 40;

const focusPoint = (world: World, cell: Cell) =>
  [
    cell.x,
    Option.match(groundAt(world, cell), {
      onNone: () => landSurface(0),
      onSome: surfaceOf,
    }),
    cell.y,
  ] as const;

const stageNotice = (state: FeedState) =>
  Option.match(state.shown, {
    onNone: () =>
      Option.some(
        statusOf(state) === "reconnecting"
          ? "Looking for the world… it will appear once the server answers."
          : "Loading the world…"
      ),
    onSome: ({ world }) =>
      cellCount(world) === 0
        ? Option.some(
            "Nothing painted yet. The world appears here as soon as someone paints some ground."
          )
        : Option.none<string>(),
  });

export const App = () => {
  const state = useFeedState();
  const [selected, setSelected] = useState(Option.none<Cell>());
  const [focus, setFocus] = useState(Option.none<FocusRequest>());
  const [overlay, setOverlay] = useState<HTMLElement | null>(null);
  const notice = stageNotice(state);

  const pick = (cell: Cell) => {
    setSelected(Option.some(cell));

    Option.map(state.shown, ({ world }) => {
      setFocus((previous) =>
        Option.some({
          point: focusPoint(world, cell),
          serial: Option.match(previous, {
            onNone: () => 0,
            onSome: (request) => request.serial + 1,
          }),
        })
      );
    });
  };

  return (
    <OverlayContext value={Option.fromNullishOr(overlay)}>
      <div className="app">
        <main className="stage">
          <Canvas
            camera={{
              far: 400,
              near: 0.1,
              position: VIEW_DIRECTION.clone()
                .multiplyScalar(INITIAL_DISTANCE)
                .toArray(),
              zoom: 12,
            }}
            dpr={[1, 2]}
            flat
            gl={{ alpha: true, antialias: true }}
            onPointerMissed={() => {
              setSelected(Option.none());
            }}
            orthographic
            shadows="percentage"
          >
            {Option.isSome(state.shown) ? (
              <WorldScene
                focus={focus}
                onSelect={(cell) => {
                  setSelected(Option.some(cell));
                }}
                selected={selected}
                world={state.shown.value.world}
              />
            ) : null}
          </Canvas>
          <div className="overlay" ref={setOverlay} />
          {Option.isSome(notice) ? (
            <p className="stage-notice">{notice.value}</p>
          ) : null}
          <p className="hint">
            Drag to pan · right-drag to turn · scroll to zoom · click a cell
          </p>
        </main>
        <SidePanel
          onClose={() => {
            setSelected(Option.none());
          }}
          onPick={pick}
          selected={selected}
          state={state}
        />
      </div>
    </OverlayContext>
  );
};
