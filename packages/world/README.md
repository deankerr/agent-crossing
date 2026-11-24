# @agent-crossing/world

The shared grid world as pure, deterministic functions: no I/O, no clock, no unseeded randomness. Time and editor names arrive as arguments. Every type that crosses a boundary is an Effect `Schema` that encodes to JSON.

The world is ground plus entities. A cell is in the world iff it has ground; there is no fixed size. Entities are a kind (a named bundle of default components) plus the few components of their own that differ. Admins edit the world with commands; `decide` turns a command into events, `changesOf` turns an event into the smallest state writes, and `apply` is the only function that modifies a world. The server persists the same changes as rows.

Run the tests with `pnpm --filter @agent-crossing/world test`.

## Modules

Each module is an entrypoint, for example `@agent-crossing/world/rules`. `seeded-random` stays internal.

- `values` Editor names, timestamps, text, nouns, glyphs and the colour palette.
- `cell` Bounded cells, cell keys, neighbours and Chebyshev distance.
- `region` Rectangles, discs and cell lists with an area cap, and `cellsOf`.
- `ground` The ground catalogue (walkable, wet, noun, glyph), heights 0..7 and tiles.
- `components` The closed bag of optional components and how they overlay.
- `kind` The kind table: plain data, parsed by `Components` in the tests.
- `entity` Entity ids, entities and their effective components.
- `change` The smallest state writes.
- `world` The in-memory world, `apply` and the queries.
- `snapshot` The JSON snapshot and the changes that rebuild a world.
- `event` World events with `changesOf` and `evolve`.
- `placement` Whether an entity may stand on a cell.
- `rejection` Why a command does nothing.
- `command` Admin commands.
- `generate` The seeded landscape generator.
- `rules` `decide`.
- `text` Maps and descriptions for agents, and one sentence per event for the history log.
- `feed` Frames of the spectator stream.
