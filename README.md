# Sentinel Apex

Sentinel Apex is a TypeScript monorepo for the Phase 1 institutional Solana yield control plane. The current repo includes the internal API, a dedicated runtime worker, core strategy/risk/execution packages, durable recovery visibility, and a Postgres-first local/dev workflow.

## Local Dev Workflow

Minimum environment:

```bash
export NODE_ENV=development
export DATABASE_URL=postgresql://sentinel:sentinel@localhost:5432/sentinel_apex
export API_SECRET_KEY=replace-with-at-least-32-characters
export EXECUTION_MODE=dry-run
export FEATURE_FLAG_LIVE_EXECUTION=false
export RUNTIME_WORKER_CYCLE_INTERVAL_MS=60000
```

Start local Postgres and apply migrations:

```bash
pnpm db:start
pnpm db:health
pnpm db:migrate
```

Run one deterministic runtime cycle from the package directly:

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

Start the dedicated runtime worker:

```bash
pnpm --filter @sentinel-apex/runtime-worker dev
```

The API is now the control-plane and read surface. Scheduled cycle execution, command processing, and recovery work run in the worker process.

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

- `apps/api` is the control-plane and read API.
- `apps/runtime-worker` is the dedicated scheduler and cycle executor.
- Runtime lifecycle, replay, current projections, worker state, and recovery persistence are in `packages/runtime`.
- Dry-run remains the default and supported operating mode.
- Live execution is still opt-in and separately gated.
- Ops dashboard, allocator, treasury, and backtest are not implemented yet.
