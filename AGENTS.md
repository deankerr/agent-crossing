# agent-crossing

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

- `packages/hello-world` The Alchemy Rivet tutorial with its rooms on Rivet Cloud and its API on local Docker
- `packages/viewer` The read-only 3D spectator view of the world, with an in-browser demo at `?demo`
- `packages/world` The pure rules of the shared grid world: terrain, commands, events, presence and perception
- `packages/server` The World Durable Object and the HTTP service with its MCP tools and event stream, on local Docker
