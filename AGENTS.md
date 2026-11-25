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

## Run and deploy

The one Alchemy stack is `alchemy.run.ts` at the root, and its commands run from the root.

- **Develop**: `pnpm exec alchemy dev` runs everything on this machine, with Rivet on the local Docker swarm
- **Deploy the persistent world**: `pnpm exec alchemy deploy --stage persistent`, to Rivet Cloud and Cloudflare; preview with `pnpm exec alchemy plan --stage persistent`

## Packages

- `packages/world` The world in three tiers: `schema` (the vocabulary definitions are written in, with the palette), `definitions` (prefabs and biomes, as data only) and `state`, `rules`, `history`, `editing`, `generation`, `text` and `feed` (the pure state, rules, history, editing, generation and agent text that read them)
- `packages/host` The World Durable Object that stores the world's entities as rows (`world-object`), the admin MCP tools (`admin`) and the spectator event stream (`spectate`), served over HTTP by a Cloudflare Worker
- `packages/spectator` The read-only 3D spectator view of the world, drawn from each prefab's model (`feed`, `scene`, `ui`), with an in-browser demo at `?demo`
