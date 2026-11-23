import type { EntityId } from "@agent-crossing/world/entity";
import type { Tile } from "@agent-crossing/world/grid";
import { Canvas } from "@react-three/fiber";
import * as Option from "effect/Option";
import { useState } from "react";

import { CAMERA_OFFSET } from "./scene/camera-rig.tsx";
import type { FocusRequest } from "./scene/camera-rig.tsx";
import { OverlayContext } from "./scene/overlay.tsx";
import { WorldScene } from "./scene/world-scene.tsx";
import { SidePanel } from "./side-panel.tsx";
import type { ViewerStore } from "./store.ts";
import { ViewerContext } from "./viewer-context.ts";

export const PANEL_WIDTH = 360;
const MAP_SPAN = 38;
const MAP_DEPTH = 30;

const fittingZoom = (width: number, height: number) =>
  Math.min((width - PANEL_WIDTH) / MAP_SPAN, height / MAP_DEPTH);

export const App = ({ store }: { readonly store: ViewerStore }) => {
  const [focus, setFocus] = useState(Option.none<FocusRequest>());
  const [selectedSign, setSelectedSign] = useState(Option.none<EntityId>());
  const [overlay, setOverlay] = useState<HTMLElement | null>(null);

  const focusOn = (tile: Tile) => {
    setFocus((previous) =>
      Option.some({
        serial: Option.match(previous, {
          onNone: () => 0,
          onSome: (request) => request.serial + 1,
        }),
        tile,
      })
    );
  };

  return (
    <ViewerContext value={Option.some(store)}>
      <OverlayContext value={Option.fromNullishOr(overlay)}>
        <div className="app">
          <main className="stage">
            <Canvas
              camera={{
                far: 200,
                near: 0.1,
                position: CAMERA_OFFSET.toArray(),
                zoom: fittingZoom(window.innerWidth, window.innerHeight),
              }}
              dpr={[1, 2]}
              flat
              onPointerMissed={() => {
                setSelectedSign(Option.none());
              }}
              orthographic
              shadows="percentage"
            >
              <WorldScene
                focus={focus}
                onSelectSign={(id) => {
                  setSelectedSign((previous) =>
                    Option.contains(previous, id)
                      ? Option.none()
                      : Option.some(id)
                  );
                }}
                selectedSign={selectedSign}
              />
            </Canvas>
            <div className="overlay" ref={setOverlay} />
            <p className="hint">
              Drag to pan · scroll to zoom · hover a sign to read it
            </p>
          </main>
          <SidePanel
            onFocus={focusOn}
            onSelectSign={(id, tile) => {
              setSelectedSign(Option.some(id));
              focusOn(tile);
            }}
          />
        </div>
      </OverlayContext>
    </ViewerContext>
  );
};
