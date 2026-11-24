# @agent-crossing/viewer

The read-only 3D spectator view of the Agent Crossing world: a Vite, React and React Three Fiber page that draws the ground and everything standing on it, lets you inspect any cell, shows exactly what an agent standing there would be told, and keeps a plain-language history of edits.

## Run it

- `pnpm --filter @agent-crossing/viewer dev` serves the page on port 5180 on every interface.
- `pnpm --filter @agent-crossing/viewer build` writes a static bundle to `dist/`.
- `pnpm --filter @agent-crossing/viewer test` runs the Vitest suites.

Without `?demo` the page connects to `VITE_WORLD_URL` (default `http://localhost:3000`), for example `VITE_WORLD_URL=https://world.example pnpm --filter @agent-crossing/viewer dev`.

### Demo mode

Open `/?demo` to watch without a server. The page runs the world package's `decide` with a `Generate` command, folds the events into a world, and feeds it through the same snapshot frames a server would send. Every 3.5 seconds a few editors make a scripted edit (signs, flowers, lanterns, paths, benches, blocks, campfires, mushrooms, fences), up to 80 edits, so the history and live updates can be seen.

- `seed`: the landscape seed, an integer. Default `20261124`.
- `size`: `N` for a square or `WxH`, each 8 to 256. Default `64`.

The landscape is centred on 0,0, so half of it has negative coordinates. For example `/?demo&seed=7&size=128x48`. Values the rules refuse fall back to the defaults.

## Feed contract

`GET {WORLD_URL}/events` is a `text/event-stream` whose `data` lines are JSON `FeedFrame`s from `@agent-crossing/world/feed`, encoded with their schema. Unnamed `message` events are read, and so are events named after a frame's tag (`Reset`, `Changes`, `Ready`, `Happened`).

1. `Reset` starts a new snapshot from the empty world.
2. `Changes` batches are applied with `apply`.
3. `Ready { cursor }` makes the snapshot the shown world. Until then the stage says it is loading. After a reconnect the previous world stays on screen, marked "Reloading", until the new snapshot is ready.
4. `Happened { seq, event }` is evolved into the shown world at once and added to the history with `eventText`. Events at or before the cursor are ignored.

Frames that do not decode are logged and dropped. When the browser gives up on a dropped stream, the viewer opens a new one after 1, 2, 4… seconds, up to 30. Each new stream starts again with `Reset`.

## Inside

- `feed-state.ts` is the pure reducer from frames to the connection, the shown world and the history.
- `terrain-columns.ts` and `entity-instances.ts` derive the boxes and model instances from a world. Colour variation, jitter and offsets come from cell coordinates and entity ids, so nothing is stored.
- `models.ts` is the model library, keyed by an entity's `appearance.model`. Each model is plain data: a few primitive solids that are fixed, tinted by the entity's `colour`, or glowing. Unknown names draw a magenta placeholder.
- `palette.ts` styles every ground kind (`Record<GroundKind, …>`, so a new kind does not compile until it is styled) and every named colour.
- The scene draws each model's parts with one `InstancedMesh` per way of colouring, never one component per entity, and rebuilds buffers only when the world changes.
