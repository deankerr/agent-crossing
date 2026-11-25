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

## Packages

- `packages/world` The world in three tiers: `schema` (the vocabulary definitions are written in, with the palette), `definitions` (prefabs and biomes, as data only) and `engine` (the pure state, rules, editing, generation and agent text that read them)
- `packages/server` The World Durable Object that stores the world's entities as rows (`storage`), the admin MCP tools (`admin`) and the spectator event stream (`feed`), served over HTTP on local Docker
- `packages/viewer` The read-only 3D spectator view of the world, drawn from each prefab's model (`feed`, `scene`, `ui`), with an in-browser demo at `?demo`
