# agent-crossing

@VISION.md

@GLOSSARY.md

## Stack Reference

### Repos

- `~/repos/effect` Effect 4
- `~/repos/alchemy` Alchemy 2
- `~/repos/rivet` Rivet 3
- `~/repos/rat-stack` Idiomatic Effect, Alchemy, software design patterns

### Guides

- `https://alchemy.run/rivet/` Alchemy & Rivet

## Checks

- **Lint, format and typecheck**: `pnpm check`
- **Fix what can be fixed**: `pnpm fix`
- **Test every package**: `pnpm test`

Turn a lint rule off in `oxlint.config.ts` only when it conflicts with idiomatic Effect or Alchemy code.

## Testing

Keep testing light for now. This is an experimental project in its very early stages and in constant flux: we are still iterating on its foundational elements, and tests would bake in assumptions we have not settled. Don't add tests as a matter of course.

## Run and deploy

The one Alchemy stack is `alchemy.run.ts` at the root, and its commands run from the root.

- **Develop**: `pnpm exec alchemy dev` runs everything on this machine, with Rivet on the local Docker swarm
- **Deploy the persistent world**: `pnpm exec alchemy deploy --stage persistent`, to Rivet Cloud and Cloudflare; preview with `pnpm exec alchemy plan --stage persistent`

## Module structure

- **Module**: one file named for the one noun it is about, in PascalCase (`World.ts`, `Command.ts`). Import it as a namespace, as Effect's modules are: `import * as Command from "@agent-crossing/world/Command"`. Names inside stay short and read with their noun at the call site (`World.apply`, `Region.cells`), and the module's main shape shares its name (`Cell.Cell`).
- **Public modules**: each package names them one by one in its `package.json` `exports`. Everything else is internal to its package and lives under `internal/`. A new `exports` entry is a design decision, so say why in the commit.
- **Names**: a name read without its module says what it is. A command or an event is a verb and a glossary noun (`PlaceEntity`, `EntityMoved`), and an MCP tool takes its command's name in snake case.
- **Composition files** (the World object, the MCP tools, the Worker route) wire: decode the input, call one module, map the answer. Rules and wording live in the modules they call.

These are guidelines. An exception is fine when the commit says why.

## Packages

One world, kept in one place, with a door for each role: a spectator watches and an editor shapes it.

- `packages/definitions` The vocabulary definitions are written in and the prefabs written in it, as data: `Components`, `Level`, `Model`, `Palette`, `Prefab` and `Prefabs`
- `packages/world` What the world is and how it changes, as pure functions: `Cell`, `Region`, `Entity`, `World`, `Command` (with `decide`), `Event` and `Refusal`; still in folders until they move out: `generation` and the biomes
- `packages/views` The world in words, as pure functions from the world or its events to text: `View` (what can be asked to see, and the one function that renders any of it), `SummaryView`, `CellView`, `EventText` (one event as a sentence) and `ReplyView` (the reply to an accepted command); the other views are internal
- `packages/server` Where the one live world is kept and served: the World Durable Object that orders commands and stores rows (`WorldObject`, called through `WorldClient`), the MCP tools (`McpServer`) and the event stream (`EventStream`) with its frames (`StreamFrame`, the package's one public module), routed by a Cloudflare Worker (`Api`) on the cluster of `Cluster`
- `packages/web` The read-only 3D spectator view of the world, drawn from each prefab's model (`stream`, `scene`, `ui`)

Imports point one way: `definitions` ← `world` ← `views` ← `server/WorldObject` ← `server/McpServer` and `server/EventStream` ← `server/Api`, and `web` reads `world`, `views` and `server/StreamFrame`. The world package holds no wording, and no text in `views` names an MCP tool.
