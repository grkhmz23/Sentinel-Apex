# Sentinel Apex

Sentinel Apex is a TypeScript monorepo for the Phase 1 institutional Solana yield control plane. The current repo includes the internal API, core strategy/risk/execution packages, a runtime orchestration layer, and a Postgres-first local/dev workflow.

## Local Dev Workflow

Minimum environment:

```bash
export NODE_ENV=development
export DATABASE_URL=postgresql://sentinel:sentinel@localhost:5432/sentinel_apex
export API_SECRET_KEY=replace-with-at-least-32-characters
export EXECUTION_MODE=dry-run
export FEATURE_FLAG_LIVE_EXECUTION=false
```

Start local Postgres and apply migrations:

```bash
pnpm db:start
pnpm db:health
pnpm db:migrate
```

Run one deterministic runtime cycle:

```bash
pnpm --filter @sentinel-apex/runtime dev:run-cycle
```

Rebuild current projections from durable state:

```bash
pnpm --filter @sentinel-apex/runtime dev:rebuild-projections
```

Start the API:

```bash
pnpm --filter @sentinel-apex/api dev
```

Stop or reset local Postgres:

```bash
pnpm db:stop
pnpm db:reset
```

## Validation

```bash
pnpm build
pnpm typecheck
pnpm lint
pnpm test
```

## Current Scope

- `apps/api` is the only application surface implemented today.
- Runtime lifecycle, replay, and current projections are in `packages/runtime`.
- Dry-run remains the default and supported operating mode.
- Live execution is still opt-in and separately gated.
- Ops dashboard, allocator, treasury, and backtest are not implemented yet.
