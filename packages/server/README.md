# @agent-crossing/server

The shell around `@agent-crossing/world`: one `World` Rivet Durable Object that holds the world in memory and in SQLite, and a Bun HTTP service in front of it with the admin MCP server and the spectator event stream. Both run on the local Docker swarm.

## Run it locally

```sh
docker swarm init --advertise-addr 127.0.0.1 --listen-addr 127.0.0.1:2377   # once per machine
cd packages/server
cp .env.example .env            # then put real tokens in it
pnpm exec alchemy deploy --no-input --yes
```

The service listens on `http://localhost:3000`. The Rivet engine runs on `localhost:6420` and the World object on a pool node, all as swarm services. `pnpm exec alchemy destroy` removes them.

A deploy rebuilds the Api image when `src/api.ts` changes. A change only in a module it imports may plan nothing for it; force it with `pnpm exec alchemy deploy --no-input --yes --force --include Api`. The World object runs in the `DefaultNodes` image, which `--include Api` does not rebuild; after changing `src/world-object.ts` or anything it imports, deploy with `--force` alone. Alchemy keeps its state in `.alchemy/` (git-ignored) next to this file: deploy from the checkout that holds it, or copy it across.

## Admin tokens

`AGENT_CROSSING_ADMIN_TOKENS` lists who may edit the world as comma-separated `name:token` pairs, for example `dean:<token>,claude:<token>`. Names are 1-24 characters and must differ ignoring case; the name is recorded as the editor of every event made with that token. Tokens are at least 16 characters of letters, digits, `_ . ~ -`; make one with `openssl rand -hex 24`. Alchemy reads the variable from `.env` (git-ignored) or the environment at deploy time and passes it to the Api service. A malformed value fails the deploy and the service start with a message saying what is wrong.

## Endpoints

**`GET /events`** The spectator stream, unauthenticated, as server-sent events with `Access-Control-Allow-Origin: *` and a `: keep-alive` comment every 15 s. Each event is an unnamed `message` whose `data` is one `FeedFrame` of `@agent-crossing/world/feed` as JSON:

1. `{"_tag":"Reset"}`: start from the empty world.
2. `{"_tag":"Changes","changes":[...]}`: the current world as `Change`s, at most 1000 per frame, ground row by row, then entities, then the spawn count. Apply them in order.
3. `{"_tag":"Ready","cursor":<seq>}`: the world so far is complete; it includes every event up to `cursor`.
4. `{"_tag":"Happened","seq":<seq>,"event":<WorldEvent>}` for every later edit, with `id: <seq>`. Evolve the world with `changesOf`/`evolve`.

No event is lost or repeated between the snapshot and the live events. A reconnect simply gets a new `Reset` and snapshot.

**`POST /mcp`** The admin MCP server `agent-crossing-admin` over Streamable HTTP, protocol revisions 2024-11-05 to 2026-07-28. Send `Authorization: Bearer <token>`; anything else gets `401`.

## Tools

Coordinates are plain integers: x grows east, y grows south. A region is `{"type":"rect","x1":0,"y1":0,"x2":9,"y2":9}`, `{"type":"disc","x":5,"y":5,"radius":3}` or `{"type":"cells","cells":[{"x":1,"y":2}]}`, at most 65,536 cells.

Queries:

- `world_summary` the extent, ground and entity counts, and the number of events.
- `view_map {x1?, y1?, x2?, y2?}` a glyph map, a height map and a legend; the whole world when no rectangle is given; at most 128 × 128 cells, and it says when it cuts.
- `view_as_agent {x, y, radius?}` what an agent standing there would be told.
- `inspect_cell {x, y}` the ground and every entity on a cell, with ids and effective components.
- `find_entities {region?, kind?, limit?}` entities with ids, kinds and cells, oldest first; default 100, at most 500, and it says how many there are in all.
- `list_kinds` every ground kind and entity kind with glyphs, traits and default components.
- `history {limit?}` the latest events with sequence number, time and editor; default 20, at most 200.

Edits, each answered with what happened and a map of the affected area (its bounding box plus 2 cells, at most 48 × 48, saying when it cuts). A refused edit is a tool error saying why and what would work; malformed arguments are a JSON-RPC invalid-params error naming the field.

- `paint_ground {region, kind?, height?}`
- `erase_ground {region}`
- `spawn {kind, x, y, components?}`, for example `{"kind":"sign","x":4,"y":3,"components":{"text":"Welcome"}}`
- `scatter {kinds, region, density, seed?, components?}`
- `move_entity {id, x, y}`
- `change_entity {id, components}` replaces the entity's own components
- `remove_entities {ids}` or `{region, kind?}`
- `generate_world {width, height, x?, y?, seed?}` 8 to 256 cells a side, from the north-west corner `(x, y)`, default `(0, 0)`

## Connect Claude Code

```sh
claude mcp add --transport http agent-crossing-admin http://localhost:3000/mcp \
  --header "Authorization: Bearer <token>"
```

## The command-line client

`scripts/admin.ts` calls the admin MCP server over HTTP and prints the tool's text, for an AI painting the world from a shell:

```sh
cd packages/server
bun scripts/admin.ts tools                      # every tool and its arguments
bun scripts/admin.ts schema spawn               # one tool's JSON input schema
bun scripts/admin.ts world_summary
bun scripts/admin.ts view_map '{"x1":0,"y1":0,"x2":40,"y2":20}'
bun scripts/admin.ts spawn '{"kind":"sign","x":4,"y":3,"components":{"text":"Welcome"}}'
```

`pnpm admin <tool> '<json>'` does the same. It reads `AGENT_CROSSING_URL` (default `http://localhost:3000`) and the token from the environment or from `packages/server/.env`: `AGENT_CROSSING_ADMIN_TOKEN`, or else the pair in `AGENT_CROSSING_ADMIN_TOKENS` named by `AGENT_CROSSING_EDITOR` (default the first pair). It exits 0 when the tool answered, 1 when the tool refused the edit (the reason is on stderr) and 2 when the call itself failed: unreachable server, bad token, arguments that are not a JSON object, or invalid parameters.

## How the World object works

The whole world lives in memory as a `World` from `@agent-crossing/world`. SQLite holds it as rows: `ground (x, y, kind, height)`, `entities (id, kind, x, y, components JSON)`, `meta (spawned)` and the history `events (seq, at, by, event JSON)`. On wake the rows are parsed with Schema into a snapshot and the world is rebuilt from it.

Commands run one at a time. `decide` turns a command into events; for each event, inside one transaction for the whole command, the event row is inserted, `changesOf` gives its `Change`s, `statementsOf` (in `src/rows.ts`, the only SQL writer) turns them into upserts and deletes, and `apply` updates the in-memory world. The events are then published to the live feed. Read tools answer from memory; only `history` reads SQL.

## Notes on the stack

- `@alchemy.run/docker@2.0.0-beta.87` is patched in `patches/`. Unpatched, it records an empty driver for a new swarm network and then tries to replace the in-use network on every later deploy ([alchemy-run/alchemy#3679](https://github.com/alchemy-run/alchemy/issues/3679)). Drop the patch once a release fixes it.
- The service and the pool node run in `oven/bun` containers. `@effect/platform-bun` is a dependency so that it is bundled; without it Bun downloads it from npm each time a container starts.
- After a node restart or a deploy that changes the World object, the first call can hang for about 45 seconds before Rivet reschedules the object. Open streams close and reconnect.

## Layout

- `src/world-object.ts` the Durable Object: the world in memory, commits, queries and the feed.
- `src/rows.ts` the tables, `Change` to SQL statements, and parsing rows back.
- `src/api.ts` the HTTP service: MCP, `/events`, authentication.
- `src/tools.ts` the MCP tools; `src/inputs.ts` their inputs and the commands they become.
- `src/queries.ts`, `src/replies.ts`, `src/refusal.ts` the text the tools answer with.
- `src/affected.ts` the area an edit touched; `src/wire.ts` what crosses RPC and the opening frames; `src/sse.ts`; `src/tokens.ts`; `src/instructions.ts`.
- `scripts/admin.ts` the command-line client.
