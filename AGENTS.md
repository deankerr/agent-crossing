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

`pnpm check` runs [Ultracite](https://www.ultracite.ai) (Oxlint + Oxfmt) with type-aware linting, so it also reports TypeScript errors and the Effect diagnostics from `@effect/tsgo`. The Effect diagnostics are errors, and they are reported by Oxlint only: the language service plugin in `tsconfig.base.json` has `diagnostics` off so they do not appear twice.

Rules that are off in `oxlint.config.ts` are the ones that conflict with idiomatic Effect or Alchemy code. Comments are banned by lint, so each group of disabled rules is a named constant that says what it is for.

A rule that is right in general but wrong at one boundary stays on and is suppressed at that line, with the reason: `// oxlint-disable-next-line <rule> -- <reason>`. This is the one comment form to use for it: the Effect language service's own `@effect-diagnostics-next-line` directive is rejected by the no-comments rule. A directive that suppresses nothing is an error. For example, an Alchemy resource whose outer Effect does work and then returns the per-instance Effect suppresses `effecttsgo/return-effect-in-gen` on that `return`. Unstable Effect modules must be allow-listed in `tsconfig.base.json` under `allowedUnstableApis`.
