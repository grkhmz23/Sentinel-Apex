# Phase 5.1 Validation Hardening

## Decision

Sentinel Apex now treats root workspace validation as a first-class contract instead of an informal collection of targeted commands.

The canonical contract is:

- `pnpm build`
- `pnpm typecheck`
- `pnpm lint`
- `pnpm test`
- `pnpm validate`
- `pnpm validate:ci`
- `pnpm release:check`

## Design

### Root contract

- package/app scripts remain the source of truth for build, typecheck, lint, and test behavior
- root scripts orchestrate those package/app scripts through Turbo
- `validate` is the canonical sequential gate for local confidence
- `validate:ci` is the same contract with `CI=1`
- `release:check` adds formatting verification on top of the CI contract

### Turbo strategy

- Turbo task inputs now use `$TURBO_DEFAULT$` rather than hand-maintained `src/**`-only patterns
- root config files such as `tsconfig.base.json`, `vitest.shared.ts`, `.eslintrc.cjs`, and `pnpm-lock.yaml` are declared as global dependencies
- this favors deterministic invalidation over brittle micro-optimization

### Lint strategy

- real lint defects remain errors
- the repo disables `import/no-named-as-default` because it generates recurring false-positive noise for the current `decimal.js` import style
- this keeps `pnpm lint` useful as a gate without forcing churn across many already-correct files

### Test strategy

- `pnpm test` via Turbo is the canonical repo-wide test gate
- `pnpm test:workspace` exists as an optional direct Vitest workspace run
- the root Vitest workspace now reflects the actual apps/packages instead of a partial subset

## Non-Goals

- no autonomous CI policy matrix
- no live connector validation expansion
- no product-surface changes
- no attempt to hide sandbox-specific runtime limitations
