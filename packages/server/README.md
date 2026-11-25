# @agent-crossing/server

The shell around `@agent-crossing/world`: one `World` Rivet Durable Object that holds the world in memory and in SQLite, and a Cloudflare Worker in front of it with the admin MCP server and the spectator event stream. The stack also deploys the viewer as a Cloudflare site. The World object's nodes run on Rivet Cloud.

Deploying is described in the [root README](../../README.md#deploy-a-stage).

## Admin tokens

`AGENT_CROSSING_ADMIN_TOKENS` lists who may edit the world as comma-separated `name:token` pairs, for example `dean:<token>,claude:<token>`. Names are 1-24 characters and must differ ignoring case; the name is recorded as the editor of every event made with that token. Tokens are at least 16 characters of letters, digits, `_ . ~ -`; make one with `openssl rand -hex 24`. Alchemy reads the variable from the `.env` (git-ignored) at the root of the repository or the environment at deploy time and binds it to the Api Worker as a secret. A malformed value fails the deploy and the Worker with a message saying what is wrong.

## Endpoints

**`GET /events`** The spectator stream, unauthenticated, as server-sent events with `Access-Control-Allow-Origin: *` and a `: keep-alive` comment every 15 s. Each event is an unnamed `message` whose `data` is one `FeedFrame` of `@agent-crossing/world/engine/feed` as JSON:

1. `{"_tag":"Reset"}`: start from the empty world.
2. `{"_tag":"Changes","changes":[...]}`: the current world as `Change`s, at most 1000 per frame, entities oldest first (floors and liquids among them), then the spawn count. Apply them in order.
3. `{"_tag":"Ready","cursor":<seq>}`: the world so far is complete; it includes every event up to `cursor`.
4. `{"_tag":"Happened","seq":<seq>,"event":<WorldEvent>}` for every later edit, with `id: <seq>`. Evolve the world with `changesOf`/`evolve` from `@agent-crossing/world/engine/editing/event`.

No event is lost or repeated between the snapshot and the live events. A reconnect simply gets a new `Reset` and snapshot.

**`POST /mcp`** The admin MCP server `agent-crossing-admin` over Streamable HTTP, protocol revisions 2024-11-05 to 2026-07-28. Send `Authorization: Bearer <token>`; anything else gets `401`.

## Tools

Coordinates are plain integers: x grows east, y grows south. A region is `{"type":"rect","x1":0,"y1":0,"x2":9,"y2":9}`, `{"type":"disc","x":5,"y":5,"radius":3}` or `{"type":"cells","cells":[{"x":1,"y":2}]}`, at most 65,536 cells.

Queries:

- `world_summary` the extent, floor, water and entity counts, and the number of events.
- `view_map {x1?, y1?, x2?, y2?}` a glyph map, a level map and a legend; the whole world when no rectangle is given; at most 128 × 128 cells, and it says when it cuts.
- `view_as_agent {x, y, radius?}` what an agent standing there would be told.
- `inspect_cell {x, y}` the floor, any liquid and every other entity on a cell, with ids, levels and effective components.
- `find_entities {region?, prefab?, limit?}` entities with ids, prefabs and cells, oldest first; every entity but floors and liquids unless a prefab is given; default 100, at most 500, and it says how many there are in all.
- `list_prefabs` every prefab with its glyph, name, label, layer and habitat.
- `history {limit?}` the latest events with sequence number, time and editor; default 20, at most 200.

Edits, each answered with what happened and a map of the affected area (its bounding box plus 2 cells, at most 48 × 48, saying when it cuts). A refused edit is a tool error saying why and what would work; malformed arguments are a JSON-RPC invalid-params error naming the field.

- `paint_floor {region, floor?, level?}` lays or changes floors
- `pour_liquid {region, liquid, bed?}` turns land into water, sinking the floor one level
- `erase_floor {region}` removes everything there, floors included
- `spawn {prefab, x, y, components?}`, for example `{"prefab":"sign","x":4,"y":3,"components":{"text":"Welcome"}}`
- `scatter {prefabs, region, density, seed?, components?}`
- `move_entity {id, x, y}`
- `change_entity {id, components}` replaces the entity's own components
- `remove_entities {ids}` or `{region, prefab?}`; without a prefab the floors and liquids stay
- `generate_world {width, height, x?, y?, seed?}` 8 to 256 cells a side, from the north-west corner `(x, y)`, default `(0, 0)`

## Connect Claude Code

```sh
claude mcp add --transport http agent-crossing-admin https://<api address>/mcp \
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
bun scripts/admin.ts spawn '{"prefab":"sign","x":4,"y":3,"components":{"text":"Welcome"}}'
```

`pnpm admin <tool> '<json>'` does the same. It reads `AGENT_CROSSING_URL`, the `api` address the deploy prints, and the token from the environment or from the `.env` at the root of the repository: `AGENT_CROSSING_ADMIN_TOKEN`, or else the pair in `AGENT_CROSSING_ADMIN_TOKENS` named by `AGENT_CROSSING_EDITOR` (default the first pair). It exits 0 when the tool answered, 1 when the tool refused the edit (the reason is on stderr) and 2 when the call itself failed: unreachable server, bad token, arguments that are not a JSON object, or invalid parameters.

## How the World object works

The whole world lives in memory as a `World` from `@agent-crossing/world/engine/state/world`. SQLite holds it as rows: `entities (id, prefab, x, y, components JSON)`, one per entity with floors and liquids among them (each storing its `level` in its components), `meta (spawned)` and the history `events (seq, at, by, event JSON)`. The Api addresses the object by the instance name `WORLD_NAME`; changing it starts a fresh world with empty tables. On wake the rows are parsed with Schema into a snapshot and the world is rebuilt from it.

Commands run one at a time. `decide` turns a command into events; for each event, inside one transaction for the whole command, the event row is inserted, `changesOf` gives its `Change`s, `statementsOf` (in `src/storage/rows.ts`, the only SQL writer) turns them into upserts and deletes, and `apply` updates the in-memory world. The events are then published to the live feed. Read tools answer from memory; only `history` reads SQL.

## Notes on the stack

- `@effect/platform-bun` is a dependency for `scripts/admin.ts`.
- After a node restart or a deploy that changes the World object, the first call can hang for about 45 seconds before Rivet reschedules the object. Open streams close and reconnect.

## Layout

- `src/api.ts` the Worker: MCP, `/events`, authentication; `src/cluster.ts` the Rivet cluster and pool.
- `src/storage/world-object.ts` the Durable Object: the world in memory, commits, queries and the feed.
- `src/storage/rows.ts` the tables, `Change` to SQL statements, and parsing rows back.
- `src/admin/tools.ts` the MCP tools; `src/admin/inputs.ts` their inputs and the commands they become.
- `src/admin/queries.ts`, `src/admin/replies.ts`, `src/admin/refusal.ts` the text the tools answer with.
- `src/admin/affected.ts` the area an edit touched; `src/admin/tokens.ts`; `src/admin/instructions.ts`.
- `src/feed/wire.ts` what crosses RPC and the opening frames; `src/feed/sse.ts` the frames as server-sent events.
- `scripts/admin.ts` the command-line client.
