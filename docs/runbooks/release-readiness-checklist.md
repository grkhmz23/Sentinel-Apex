# Release Readiness Checklist

## Required Validation Gates

Before merging a release-bound change set or preparing a release candidate, run:

```bash
pnpm release:check
```

This implies:

- `CI=1 pnpm build`
- `CI=1 pnpm typecheck`
- `CI=1 pnpm lint`
- `CI=1 pnpm test`
- `pnpm format:check`

## Required Operator Truth

Confirm the repo still tells the truth in:

- `README.md`
- `docs/audit/current-state-audit.md`
- any phase-specific audit/architecture docs touched by the change

## Required Runtime/Mode Truth

Confirm these statements remain accurate:

- dry-run is the default operating mode
- live execution remains separately gated
- simulated and budget-state-only execution paths are labeled honestly
- operator overlays do not mutate execution truth implicitly

## When Targeted Validation Is Not Enough

Do not rely only on targeted validation when:

- root Turbo or workspace configuration changed
- shared package contracts changed
- root docs or release claims changed
- API/runtime/dashboard changes span multiple workspaces

## Known Limits To Record Honestly

If a command fails for sandbox reasons rather than repo reasons, record that explicitly in the implementation summary. Do not report root validation as passing unless the command actually completed successfully in the current environment.
