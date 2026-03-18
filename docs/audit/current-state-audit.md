# Current State Audit

Date: 2026-03-18
Repo: `/workspaces/Sentinel-Apex`

## What Exists

- Monorepo tooling: `pnpm`, Turborepo, TypeScript, ESLint, Prettier, Vitest.
- Apps: `apps/api`, `apps/runtime-worker`.
- Packages: `carry`, `config`, `db`, `domain`, `execution`, `observability`, `risk-engine`, `runtime`, `shared`, `strategy-engine`, `venue-adapters`.
- Docs: `docs/prd`, `docs/architecture`, `docs/adr`, `docs/risk`, `docs/strategy`, `docs/audit`.
- Infra: `docker-compose.yml`, `infra/docker/Dockerfile.api`, `infra/docker/docker-compose.local-db.yml`.

## What Works

- Core domain, carry, risk, execution, venue-adapter, strategy-engine, runtime, and API packages build and test.
- `packages/db` now has:
  - committed SQL migrations `0001_phase1_runtime_foundation.sql` and `0002_phase1_5_operational_hardening.sql`
  - typed Drizzle schema for runtime facts and current projections
  - PostgreSQL and PGlite connection support
  - executable migration tooling
- `packages/runtime` now provides:
  - explicit bootstrap and shutdown semantics
  - persisted runtime lifecycle state
  - persisted worker lifecycle and scheduler state
  - durable runtime commands for one-shot cycles and projection rebuilds
  - durable mismatch and recovery event history
  - deterministic projection rebuild from persisted records
  - startup restoration of adapter state from persisted fills
  - operator-safe pause, resume, cycle-run command, and projection-rebuild command controls
- `apps/api` serves portfolio, risk, orders, positions, opportunities, events, runtime status, worker status, mismatch history, and control surfaces from persisted runtime-backed state.
- `apps/runtime-worker` executes scheduled cycles, processes runtime commands, and persists scheduler/recovery visibility independently of the API process.
- Local/dev Postgres workflow now exists through `pnpm db:start`, `pnpm db:health`, `pnpm db:migrate`, `pnpm db:reset`, and `pnpm db:stop`.
- Deterministic carry simulation is now materially more credible:
  - funding opportunities use mark price instead of placeholder price `1`
  - minimum funding-rate threshold is enforced
  - strategy sizing respects projected gross exposure and open-position constraints

## What Is Partial

- Runtime projection updates still happen inline inside the runtime execution path rather than a separate projector process.
- The runtime is still an internal Phase 1 paper-trading service, but scheduled execution now runs in a dedicated worker instead of the API process.
- Local/dev Postgres workflow is now first-class, but production deployment wiring, secret management, and hosted operational automation are still out of scope.
- The API remains an internal control-plane API. There is still no operator UI.

## What Is Broken

- `apps/ops-dashboard` does not exist.
- Allocator, treasury, and backtest packages still do not exist.
- Mismatch handling is now durable and operator-visible, but automatic remediation remains intentionally limited to explicit rebuild/cycle commands.
- API startup in this sandbox still cannot bind to `0.0.0.0` because of environment `listen EPERM` restrictions rather than an application defect.

## What Is Missing

- Operational dashboards and richer operator workflows.
- Production-grade live venue integration.
- Allocator, treasury, and backtest foundations.

## Validation Results

Commands run against the real repo state:

- `CI=1 pnpm build`
- `CI=1 pnpm typecheck`
- `CI=1 pnpm lint`
- `CI=1 pnpm test`

Targeted validation also run during implementation:

- `pnpm --filter @sentinel-apex/runtime build`
- `pnpm --filter @sentinel-apex/api build`
- `pnpm --filter @sentinel-apex/carry test`
- `pnpm --filter @sentinel-apex/strategy-engine test`
- `pnpm --filter @sentinel-apex/runtime test`
- `pnpm --filter @sentinel-apex/api test`

Results:

- Build passes.
- Typecheck passes.
- Tests pass.
- Lint passes with existing `import/no-named-as-default` warnings in some packages but no lint errors.
- During implementation, API tests briefly failed because `@sentinel-apex/api` consumed a stale `@sentinel-apex/runtime/dist` build artifact that still generated non-UUID position IDs. Rebuilding the runtime package fixed the issue.

## Recommended Next Actions

1. Add stronger reconciliation detectors that compare external venue state against persisted internal execution state.
2. Decide whether rebuild commands should remain worker-executed commands or become an isolated maintenance process.
3. Add a durable projection checkpoint model if projection fan-out becomes asynchronous in the next pass.
4. Build `apps/ops-dashboard` against the now-truthful runtime/control-plane API.
5. Start allocator and treasury work only after the runtime worker and reconciliation surfaces are stable.
