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

## Packages

One world, kept in one place, with a door for each role: a spectator watches and an editor shapes it.

- `packages/world` What the world is and how it changes, as pure functions: `schema` (the vocabulary definitions are written in), `definitions` (prefabs and biomes, as data only), `state` and `rules` (what exists and what may), `history` (events), `editing` (the editor's commands), `generation`, `text` (the world in words) and `feed` (the frames spectators receive)
- `packages/host` Where the one live world is kept and served: the World Durable Object that orders commands and stores rows (`world-object`), the admin MCP tools (`admin`) and the spectator event stream (`spectate`), routed by a Cloudflare Worker (`api.ts`)
- `packages/spectator` The read-only 3D spectator view of the world, drawn from each prefab's model (`feed`, `scene`, `ui`), with an in-browser demo at `?demo`

Imports point one way: `world` ← `host/world-object` ← `host/admin` and `host/spectate` ← `host/api.ts`. The world package holds no sentence that names an admin tool.
