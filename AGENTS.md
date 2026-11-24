# agent-crossing

@VISION.md

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

- `packages/world` The pure model of the world: ground per cell, entities as kinds plus components, changes, events, edit commands and the text an agent reads
- `packages/server` The World Durable Object that stores the world as rows, and the HTTP service with the admin MCP tools and the spectator event stream, on local Docker
- `packages/viewer` The read-only 3D spectator view of the world, with an in-browser demo at `?demo`
