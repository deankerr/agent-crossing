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

- **Develop**: `pnpm dev` runs everything on this machine, with Rivet on the local Docker swarm
- **Deploy the persistent world**: `pnpm exec alchemy deploy --stage persistent`, to Rivet Cloud and Cloudflare; preview with `pnpm exec alchemy plan --stage persistent`

## Module structure

- **Module**: one file named for the one noun it is about, in PascalCase (`World.ts`, `Command.ts`). Import it as a namespace, as Effect's modules are: `import * as Command from "@agent-crossing/world/Command"`. Names inside stay short and read with their noun at the call site (`World.apply`, `Region.cells`), and the module's main shape shares its name (`Cell.Cell`).
- **Public modules**: each package names them one by one in its `package.json` `exports`. Everything else is internal to its package and lives under `internal/`. A new `exports` entry is a design decision, so say why in the commit.
- **Names**: a name read without its module says what it is. A command or an event is a verb and a glossary noun (`PlaceEntities`, `EntityMoved`), and an MCP tool takes its command's name in snake case.
- **Composition files** (the World object, the MCP tools, the Worker route) wire: decode the input, call one module, map the answer. Rules and wording live in the modules they call.

These are guidelines. An exception is fine when the commit says why.

## Packages

One world, kept in one place and reached over MCP. Each package's `package.json` `exports` lists its public modules.

- `packages/definitions` The vocabulary that definitions are written in, and the prefabs written in it, as data
- `packages/world` What exists and how it changes, as pure functions: cells, regions, entities, the world, commands, events and refusals
- `packages/views` The world in words, as pure functions from the world or its events to text: each view, and the reply to an accepted command
- `packages/generator` A generator: the biomes, the landscape they make, and a script that sends it to the live world over MCP as ordinary commands
- `packages/server` Where the one live world is kept and served: the World Durable Object (`WorldObject`), the MCP tools built from the commands and views (`McpServer`), and the event stream (`EventStream`), routed by a Cloudflare Worker (`Api`)
- `packages/web` The web app, holding the 3D spectator view

Imports point one way: `definitions` ← `world` ← `views` ← `server`. `web` reads `world`, `views` and the server's stream frames. `generator` reads `definitions` and `world`, and reaches the live world only over MCP. The world package holds no wording, and no text in `views` names an MCP tool.
