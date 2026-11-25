# @agent-crossing/spectator

The read-only 3D spectator view of the Agent Crossing world: a Vite, React and React Three Fiber page that draws every floor, liquid and everything standing on them, lets you inspect any cell, shows exactly what an agent standing there would be told, and keeps a plain-language history of edits.

## Run it

- `pnpm --filter @agent-crossing/spectator dev` serves the page on port 5180 on every interface.
- `pnpm --filter @agent-crossing/spectator build` writes a static bundle to `dist/`.

Without `?demo` the page connects to `VITE_WORLD_URL`, for example `VITE_WORLD_URL=https://world.example pnpm --filter @agent-crossing/spectator dev`. The host's stack deploys the page with `VITE_WORLD_URL` set to its Api Worker.

### Demo mode

Open `/?demo` to watch without the host. The page runs the world package's `decide` with a `Generate` command, folds the events into a world, and feeds it through the same snapshot frames the host would send. Every 3.5 seconds a few editors make a scripted edit (signs, flower patches, lanterns, paths, benches, recolored blocks, campfires, mushrooms, fences), up to 80 edits, so the history and live updates can be seen.

- `seed`: the landscape seed, an integer. Default `20261124`.
- `size`: `N` for a square or `WxH`, each 8 to 256. Default `64`.

The landscape is centered on 0,0, so half of it has negative coordinates. For example `/?demo&seed=7&size=128x48`. Values the rules refuse fall back to the defaults.

## Feed contract

`GET {WORLD_URL}/events` is a `text/event-stream` whose `data` lines are JSON `FeedFrame`s from `@agent-crossing/world/feed/frame`, encoded with their schema. Unnamed `message` events are read, and so are events named after a frame's tag (`Reset`, `Changes`, `Ready`, `Happened`).

1. `Reset` starts a new snapshot from the empty world.
2. `Changes` batches are applied with `apply`.
3. `Ready { cursor }` makes the snapshot the shown world. Until then the stage says it is loading. After a reconnect the previous world stays on screen, marked "Reloading", until the new snapshot is ready.
4. `Happened { seq, event }` is evolved into the shown world at once and added to the history with `eventText`. Events at or before the cursor are ignored.

Frames that do not decode are logged and dropped. When the browser gives up on a dropped stream, the spectator view opens a new one after 1, 2, 4… seconds, up to 30. Each new stream starts again with `Reset`.

## Inside

- `src/feed/` is where the world comes from: `live-feed.ts` (the host's stream), `demo.ts` and `demo-feed.ts` (the `?demo` world), and `feed-state.ts`, the pure reducer from frames to the connection, the shown world and the history.
- `src/scene/` is what is drawn. `layout.ts`, `hash.ts`, `floor-columns.ts` and `entity-instances.ts` are pure: they derive the boxes and model instances from a world. Brightness variation, jitter and offsets come from cell coordinates and entity ids, so nothing is stored.
- Every model comes from the entity's effective components and the palette in `@agent-crossing/world/schema/palette`. `model-geometry.ts` turns parts and forms into geometry: a part is painted its shade, or the entity's `colors` override for that part, times each form's `tone`. Entities without a model draw a magenta placeholder.
- Floors and liquids are drawn from their `slab` and `fill` solids as instanced cell-filling boxes, one mesh per material; water is translucent over the floor beneath it. Everything else is drawn with one `InstancedMesh` per painted model and material, never one component per entity, and stands on its floor, or at the top of the liquid when there is one. Buffers are rebuilt only when the world changes.
- `src/ui/` is the app shell, side panel, store, keys and styles.
