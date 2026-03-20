# Sentinel Apex

Sentinel Apex is a TypeScript monorepo for the Phase 1 institutional Solana yield control plane. The current repo includes the internal API, a dedicated runtime worker, an internal ops dashboard, core strategy/risk/execution packages, durable recovery visibility, reconciliation-driven mismatch detection, mismatch-scoped remediation actions, and a Postgres-first local/dev workflow.

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

Queue an explicit reconciliation run against current persisted and venue-backed state:

```bash
curl -X POST http://localhost:3000/api/v1/runtime/reconciliation/run \
  -H "X-API-Key: ${API_SECRET_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"triggeredBy":"local-operator","trigger":"manual"}'
```

Start the API:

```bash
pnpm --filter @sentinel-apex/api dev
```

Start the dedicated runtime worker:

```bash
pnpm --filter @sentinel-apex/runtime-worker dev
```

Start the internal ops dashboard:

```bash
export OPS_DASHBOARD_API_BASE_URL=http://localhost:3000
export OPS_DASHBOARD_API_KEY=${API_SECRET_KEY}
export OPS_DASHBOARD_DEFAULT_ACTOR=local-operator
PORT=3100 pnpm --filter @sentinel-apex/ops-dashboard dev
```

The API is now the control-plane and read surface. Scheduled cycle execution, command processing, recovery work, and reconciliation continue to run in the backend services. The ops dashboard is a thin internal UI over those existing API contracts.

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
- `apps/ops-dashboard` is the internal operator UI for runtime, mismatch, reconciliation, recovery, and command inspection.
- Runtime lifecycle, replay, current projections, worker state, and recovery persistence are in `packages/runtime`.
- Runtime mismatches now support acknowledge, recover, resolve, verify, and reopen lifecycle actions with durable recovery history.
- Runtime reconciliation now persists explicit runs and findings, and can create or update mismatches from real discrepancies across projections, commands, orders, and positions.
- Runtime mismatches also support first-class remediation attempts for `rebuild_projections` and `run_cycle`, with durable linkage to commands and recovery outcomes.
- The API exposes reconciliation runs, findings, summary, and mismatch-linked finding history for operator workflows.
- Dry-run remains the default and supported operating mode.
- Live execution is still opt-in and separately gated.
- Allocator, treasury, and backtest are not implemented yet.
