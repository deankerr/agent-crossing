# @agent-crossing/viewer

The read-only 3D spectator view of the Agent Crossing world: a Vite, React and React Three Fiber page that draws the terrain, entities and characters and keeps a plain-language log of what happens.

## Run it

- `pnpm --filter @agent-crossing/viewer dev` serves the page on port 5180 on every interface.
- `pnpm --filter @agent-crossing/viewer build` writes a static bundle to `dist/`.
- `pnpm --filter @agent-crossing/viewer test` runs the Vitest suites.

Open `/?demo` to watch an in-browser simulation instead of a server. It runs the world package's `execute` and `expire` with five scripted characters who walk, build, carry, talk, rename themselves and now and then go quiet long enough to vanish. `/?demo=42` picks another seed; the same seed makes the same choices.

Without `?demo` the page connects to `VITE_WORLD_URL` (default `http://localhost:3000`), for example `VITE_WORLD_URL=https://world.example pnpm --filter @agent-crossing/viewer dev`.

## Feed contract

`GET {WORLD_URL}/events` is a `text/event-stream`:

- `event: snapshot`, data `{"cursor", "now", "world"}`: the whole `World`, encoded with its schema, and the server's clock in epoch milliseconds.
- `event: world`, `id: <seq>`, data `{"seq", "event"}`: one `WorldEvent`, encoded with its schema.

The viewer decodes every frame with the world package's schemas, replaces its state on each snapshot, applies events after the cursor with `evolve`, and draws positions from the world and the server clock (`now` minus the browser clock at receipt). If the stream drops, the browser reconnects and the next snapshot replaces the state.
