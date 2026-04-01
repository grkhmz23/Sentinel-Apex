# Monorepo Validation

## Canonical Commands

Use these root commands as the source of truth:

- `pnpm build`
- `pnpm typecheck`
- `pnpm lint`
- `pnpm test`
- `pnpm validate`
- `pnpm validate:ci`
- `pnpm release:check`

## When To Use Which Command

Use targeted validation while iterating:

- `pnpm --filter @sentinel-apex/runtime test`
- `pnpm --filter @sentinel-apex/api typecheck`
- `pnpm --filter @sentinel-apex/ops-dashboard build`

Use root validation before merge when:

- a change touches multiple packages or apps
- Turbo/task wiring changed
- shared runtime/control-plane contracts changed
- docs claim repo-wide validation truth

Use release validation before a release candidate or manual promotion:

- `pnpm release:check`

## Expected Semantics

- `pnpm build` builds every workspace with a `build` script
- `pnpm typecheck` runs every workspace `typecheck` script
- `pnpm lint` runs every workspace `lint` script
- `pnpm test` runs every workspace `test` script
- `pnpm validate` runs build, typecheck, lint, and test in that order
- `pnpm validate:ci` runs the same contract with `CI=1`

## Known Limits

- runtime/API integration tests are intentionally slower than leaf-package unit tests
- direct manual server boot in this sandbox can hit `listen EPERM`; prefer test/build/typecheck/lint commands for validation truth
- live connector execution remains intentionally outside the supported validation surface

## Troubleshooting

If a root command fails:

1. identify the failing workspace from Turbo output
2. rerun that workspace task directly with `pnpm --filter <workspace> <task>`
3. if the issue looks like stale outputs, rerun the dependency workspace build and then rerun the failing task
4. only treat the issue as environment-specific after confirming the failing step is not a repo-owned config or script problem
