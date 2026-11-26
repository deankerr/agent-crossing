# @agent-crossing/server

Where the one live world is kept and served: one `World` Rivet Durable Object that holds the world of `@agent-crossing/world` in memory and in SQLite, and a Cloudflare Worker in front of it with a door for each role, the MCP server for editors and the event stream for spectators. The stack also serves the spectator view. The World object's nodes run on the local Docker swarm under `alchemy dev` and on Rivet Cloud when deployed.

Running and deploying are described in the [root README](../../README.md#develop-locally).

## Endpoints

**`GET /events`** The spectator stream, unauthenticated, as server-sent events with `Access-Control-Allow-Origin: *` and a `: keep-alive` comment every 15 s. Each event is an unnamed `message` whose `data` is one `FeedFrame` of `@agent-crossing/world/feed/frame` as JSON:

1. `{"_tag":"Reset"}`: start from the empty world.
2. `{"_tag":"Changes","changes":[...]}`: the current world as `Change`s, at most 1000 per frame, entities oldest first (floors and liquids among them), then the spawn count. Apply them in order.
3. `{"_tag":"Ready","cursor":<seq>}`: the world so far is complete; it includes every event up to `cursor`.
4. `{"_tag":"Happened","seq":<seq>,"event":<WorldEvent>}` for every later edit, with `id: <seq>`. Evolve the world with `changesOf`/`evolve` from `@agent-crossing/world/history/event`.

No event is lost or repeated between the snapshot and the live events. A reconnect simply gets a new `Reset` and snapshot.

**`POST /mcp`** The MCP server `agent-crossing` over Streamable HTTP, protocol revision 2026-07-28 only, served statelessly with each request its own. Effect's MCP layer answers a request in any other revision with `400` and a JSON-RPC error: `-32020` when it sends no `MCP-Protocol-Version` header, `-32602` when it sends the header but not the 2026-07-28 request metadata, and `-32022`, naming the supported revision, when its metadata asks for another. The endpoint is open: anyone who can reach the Api can edit the world.

## Tools

The tools take the world's own shapes. A cell is `{"x":1,"y":2}`: x grows east, y grows south. A region is `{"_tag":"Rect","from":{"x":0,"y":0},"to":{"x":9,"y":9}}`, `{"_tag":"Disc","center":{"x":5,"y":5},"radius":3}` or `{"_tag":"Cells","cells":[{"x":1,"y":2}]}`, at most 65,536 cells. Arguments that do not parse are an MCP invalid-params error that names the field.

Queries:

- `world_summary` the extent, floor, water and entity counts, and the number of events.
- `view_map {rect?}` a glyph map, a level map and a legend of a `Rect`; the whole world when no rectangle is given; at most 128 × 128 cells, and it says when it cuts.
- `inspect_cell {cell}` the floor, any liquid and every other entity on a cell, with ids, levels and effective components.
- `find_entities {region?, prefab?, limit?}` entities with ids, prefabs and cells, oldest first; every entity but floors and liquids unless a prefab is given; default 100, at most 500, and it says how many there are in all.
- `list_prefabs` every prefab with its glyph, name, label, layer and habitat.
- `history {limit?}` the latest events with sequence number and time; default 20, at most 200.

Edits: one tool for each command of `@agent-crossing/world/Command`, named for it in snake case, taking the command's own fields (without its `_tag`) and described by it. Each is answered with what happened and a map of the affected area (its bounding box plus 2 cells, at most 48 × 48, saying when it cuts). A refused edit is a tool error saying why and what would work.

- `place_entities {entities}` places a list of `{prefab, cell, components?}` in order, or none if any may not be placed; for example `{"entities":[{"prefab":"sign","cell":{"x":4,"y":3},"components":{"text":"Welcome"}}]}`
- `fill_region {region, prefab, components?}` puts a prefab in every cell where it may be: lays or replaces floors, pours a liquid over land (the floor sinking one level), or places anything else
- `scatter_entities {prefabs, region, density, seed, components?}`
- `move_entity {entity, to}`
- `change_entity {entity, components}` replaces the entity's own components
- `remove_entities {entities}` removes the listed entities
- `clear_region {region, removing?}` removes what stands on the terrain; with `{"_tag":"Prefab","prefab":"oak"}` only that prefab; with `{"_tag":"Terrain"}` the terrain too, so the cells leave the world
- `generate_world {seed, width, height, origin}` 8 to 256 cells a side, from the north-west corner `origin`

## Connect Claude Code

```sh
claude mcp add --transport http agent-crossing https://<api address>/mcp
```

## The command-line client

`scripts/mcp.ts` calls the MCP server with Effect's MCP client and prints the tool's text, for an AI painting the world from a shell:

```sh
cd packages/server
bun scripts/mcp.ts tools                      # every tool and its description
bun scripts/mcp.ts schema place_entities      # one tool's JSON input schema
bun scripts/mcp.ts world_summary
bun scripts/mcp.ts view_map '{"rect":{"_tag":"Rect","from":{"x":0,"y":0},"to":{"x":40,"y":20}}}'
bun scripts/mcp.ts place_entities '{"entities":[{"prefab":"sign","cell":{"x":4,"y":3},"components":{"text":"Welcome"}}]}'
```

`pnpm mcp <tool> '<json>'` does the same. It reads `AGENT_CROSSING_URL`, the Api's address (`http://localhost:1337` under `alchemy dev`, or the `api` address a deploy prints), from the environment or from the `.env` at the root of the repository. It exits 0 when the tool answered, 1 when the tool reported an error, which is a refused edit (the reason is on stderr), and 2 when the call itself failed: unreachable Api, arguments the tool does not accept, arguments that are not a JSON object, an unknown tool or a malformed command line.

## How the World object works

The whole world lives in memory as a `World` from `@agent-crossing/world/state/world`. SQLite holds it as rows: `entities (id, prefab, x, y, components JSON)`, one per entity with floors and liquids among them (each storing its `level` in its components), `meta (spawned)` and the history `events (seq, event JSON)`, each event carrying its own time. The Api addresses the object by the instance name `WORLD_NAME`; changing it starts a fresh world with empty tables. On wake the rows are parsed with Schema into a snapshot and the world is rebuilt from it.

Commands run one at a time. `decide(world, command, now)` turns a command into events; for each event, inside one transaction for the whole command, the event row is inserted, `changesOf` gives its `Change`s, `statementsOf` (in `src/world-object/rows.ts`, the only SQL writer) turns them into upserts and deletes, and `apply` updates the in-memory world. The events are then published to the live feed. Read tools answer from memory; only `history` reads SQL. The object writes its answers with `@agent-crossing/world/text`, because the world is in its memory and too large to send to the Worker.

## Notes on the stack

- `@effect/platform-bun` is a dependency for `scripts/mcp.ts`.
- After a node restart or a deploy that changes the World object, the first call can hang for about 45 seconds before Rivet reschedules the object. Open streams close and reconnect.

## Layout

Imports point one way: `world-object` reads only the world package, `mcp` and `stream` read `world-object`, and `api.ts` reads all three. `no-restricted-imports` overrides in `oxlint.config.ts` enforce it, and keep the world package from reading `server` or `web`.

- `src/api.ts` the Worker, which only routes: `/mcp` to the MCP handler and `/events` to the event stream.
- `src/cluster.ts` where the World object runs: the local Docker swarm under `alchemy dev`, the Rivet Cloud cluster `agent-crossing` when deployed.
- `src/world-object/` keeping the world:
  - `world-object.ts` the Durable Object: the world in memory, commits, reads and the feed.
  - `rows.ts` the tables, `Change` to SQL statements, and parsing rows back.
  - `wire.ts` what crosses its calls: the verdict on a command and the items of the feed.
  - `client.ts` the `WorldClient` service, the object as typed calls, which is all that `mcp` and `stream` see of it. `api.ts` provides its layer once, on the Worker's construction effect.
- `src/mcp/` the editor's door:
  - `server.ts` the MCP endpoint, with the tools' `instructions.ts`.
  - `tools/` the tools: `commands.ts` builds one tool for each command from the command's schema, with its hints; each query tool has its own file, named after it (`view-map.ts` for `view_map`). `tools/index.ts` registers the queries and the command tools, in the order they are listed to clients, with every answer as text.
  - `tool.ts` what every tool shares: `queryTool` and `editTool`, which make a tool answering in text that may refuse and give it its MCP annotations, and the refusal; `edit.ts` the common path of an edit, from parsing the command to the reply.
  - `replies.ts` and `refusal.ts` the sentences that are the MCP tools' own: what an edit did, and what to try after a refusal.
- `src/stream/` the spectator's door: `stream.ts` the `/events` response and `sse.ts` the frames as server-sent events.
- `scripts/mcp.ts` the command-line client.
