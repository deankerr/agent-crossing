import type * as Cell from "@agent-crossing/world/Cell";
import * as World from "@agent-crossing/world/World";
import { Canvas } from "@react-three/fiber";
import * as Option from "effect/Option";
import { useEffect, useState } from "react";

import { VIEW_DIRECTION } from "../scene/camera-rig.tsx";
import type { FocusRequest } from "../scene/camera-rig.tsx";
import { levelSurface, standingSurfaceAt } from "../scene/layout.ts";
import { OverlayContext } from "../scene/overlay.tsx";
import { WorldScene } from "../scene/world-scene.tsx";
import { statusOf } from "../stream/stream-state.ts";
import type { StreamState } from "../stream/stream-state.ts";
import { SidePanel } from "./side-panel.tsx";
import { useStreamState } from "./store.ts";

type At = typeof Cell.Cell.Type;

const INITIAL_DISTANCE = 40;

const TEXT_FIELDS = new Set(["INPUT", "SELECT", "TEXTAREA"]);

const takesTyping = (target: EventTarget | null) =>
  target instanceof HTMLElement &&
  (target.isContentEditable || TEXT_FIELDS.has(target.tagName));

const focusPoint = (world: World.World, cell: At) =>
  [
    cell.x,
    Option.getOrElse(standingSurfaceAt(world, cell), () => levelSurface(0)),
    cell.y,
  ] as const;

const stageNotice = (state: StreamState) =>
  Option.match(state.shown, {
    onNone: () =>
      Option.some(
        statusOf(state) === "reconnecting"
          ? "Looking for the world… it will appear once the Api answers."
          : "Loading the world…"
      ),
    onSome: ({ world }) =>
      World.cellCount(world) === 0
        ? Option.some(
            "Nothing painted yet. The world appears here as soon as someone paints a floor."
          )
        : Option.none<string>(),
  });

export const App = () => {
  const state = useStreamState();
  const [selected, setSelected] = useState(Option.none<At>());
  const [focus, setFocus] = useState(Option.none<FocusRequest>());
  const [overlay, setOverlay] = useState<HTMLElement | null>(null);
  const notice = stageNotice(state);

  useEffect(() => {
    const clearOnEscape = (event: KeyboardEvent) => {
      if (
        event.key === "Escape" &&
        !event.isComposing &&
        !takesTyping(event.target)
      ) {
        setSelected(Option.none());
      }
    };

    window.addEventListener("keydown", clearOnEscape);

    return () => {
      window.removeEventListener("keydown", clearOnEscape);
    };
  }, []);

  const pick = (cell: At) => {
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
