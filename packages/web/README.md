# @agent-crossing/web

The read-only 3D spectator view of the Agent Crossing world: a Vite, React and React Three Fiber page that draws every floor, liquid and everything standing on them, lets you inspect any cell and keeps a plain-language history of the latest edits.

## Run it

From the repository root, `pnpm exec alchemy dev` serves the page on Vite's dev server on `http://localhost:1338`, connected to the Api on `http://localhost:1337`, and reloads it on every save. `pnpm exec alchemy deploy --stage persistent` builds it and deploys it as a Cloudflare Worker. The stack is the only way to run it.

The page connects to the Api at `VITE_WORLD_URL`, which the stack in `alchemy.run.ts` sets. A page built without a valid address there says so and connects nowhere. Vite's dev server accepts requests for `.ts.net` hosts, so the page can be watched through Tailscale Serve.

## Stream contract

`GET {WORLD_URL}/events` is a `text/event-stream` whose `data` lines are JSON `StreamFrame`s from `@agent-crossing/server/StreamFrame`, the one module this package reads from the server, encoded with their schema. Unnamed `message` events are read, and so are events named after a frame's tag (`Reset`, `Changes`, `Ready`, `Happened`).

1. `Reset` starts a new snapshot from the empty world.
2. `Changes` batches are applied with `applyAll`.
3. `Ready { cursor }` makes the snapshot the shown world. Until then the stage says it is loading. After a reconnect the previous world stays on screen, marked "Reloading", until the new snapshot is ready.
4. `Happened { seq, event }` is evolved into the shown world at once and added to the history with `eventText`. Events at or before the cursor are ignored.

Frames that do not decode are logged and dropped. When the browser gives up on a dropped stream, the spectator view opens a new one after 1, 2, 4… seconds, up to 30. Each new stream starts again with `Reset`.

## Inside

- `src/stream/` is where the world comes from: `live-stream.ts` (the server's stream) and `stream-state.ts`, the pure reducer from frames to the connection, the shown world and the history.
- `src/scene/` is what is drawn. `layout.ts`, `hash.ts`, `floor-columns.ts` and `entity-instances.ts` are pure: they derive the boxes and model instances from a world. Brightness variation, jitter and offsets come from cell coordinates and entity ids, so nothing is stored.
- Every model comes from the entity's effective components and the palette in `@agent-crossing/definitions/Palette`. `model-geometry.ts` turns parts and forms into geometry: a part is painted its shade, or the entity's `colors` override for that part, times each form's `tone`.
- Floors and liquids are drawn from their `slab` and `fill` solids as instanced cell-filling boxes: every floor shares one opaque material, and each liquid opacity has its own, so water is translucent over the floor beneath it. Everything else is drawn with one `InstancedMesh` per painted model and material, never one component per entity, and stands on its floor, or at the top of the liquid when there is one. Buffers are rebuilt only when the world changes.
- `src/ui/` is the app shell, side panel, store and styles. The side panel shows the world package's own words: `summaryText` for the world, and `inspectText` for the selected cell.
