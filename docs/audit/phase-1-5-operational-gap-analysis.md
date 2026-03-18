# Phase 1.5 Operational Gap Analysis

Date: 2026-03-18

## Current Lifecycle Behavior

Before this pass:

- runtime startup happened implicitly when the API created the in-process runtime
- runtime shutdown only disconnected adapters and closed the DB connection
- lifecycle semantics were minimal and not explicitly modeled beyond halt state
- last cycle metadata and projection freshness were not explicit operator-facing concepts

Now implemented:

- explicit runtime bootstrap via `SentinelRuntime.start()`
- explicit runtime shutdown via `SentinelRuntime.close()`
- persisted lifecycle states: `starting`, `ready`, `paused`, `stopped`, `degraded`
- persisted projection status: `fresh`, `rebuilding`, `stale`
- persisted cycle metadata: last run, last successful run, cycle start/completion timestamps, projection source run, projection rebuild timestamp

## Current Persistence And Recovery Behavior

Before this pass:

- runtime facts were durable
- read models existed
- runtime restored only minimally from persisted state
- there was no explicit rebuild capability for current projections

Now implemented:

- startup restoration replays persisted fills into simulated venue adapters
- current risk and portfolio projections can be rebuilt from latest durable snapshots
- current positions are rebuilt from restored adapter state
- rebuild is deterministic and idempotent
- runtime status records the latest successful projection source and rebuild timestamp

## Current Local DB Workflow

Before this pass:

- docs still pointed mostly at PGlite-first local usage
- Postgres existed conceptually but not as a clear day-to-day local workflow
- scripts were not standardized around start/stop/reset/health/migrate actions

Now implemented:

- Dockerized local Postgres in `infra/docker/docker-compose.local-db.yml`
- root scripts:
  - `pnpm db:start`
  - `pnpm db:stop`
  - `pnpm db:reset`
  - `pnpm db:health`
  - `pnpm db:migrate`
- root runbook and repo entrypoints updated to make Postgres the default local/dev path

## Current Operator Controls

Already present before or during this pass:

- `POST /api/v1/control/kill-switch`
- `POST /api/v1/control/resume`
- `GET /api/v1/control/mode`
- `POST /api/v1/control/mode`
- `GET /api/v1/runtime/status`
- `POST /api/v1/runtime/cycles/run`

Added in this pass:

- `POST /api/v1/runtime/projections/rebuild`

Operator actions remain internal/dev-focused, authenticated, and dry-run oriented.

## Current Simulation Limitations

Before this pass:

- funding opportunities used an unrealistic placeholder price path
- sizing did not fully account for projected exposure consumption across multiple generated intents
- local deterministic scenario was technically useful but economically weak

Now improved:

- funding opportunities use venue mark price
- funding opportunities must clear `minFundingRateAnnualized`
- strategy sizing now applies incremental projected exposure and open-position budgeting
- deterministic venue prices and funding curves create more plausible carry and spread outputs

Still limited:

- no stochastic market path
- no time-series carry accrual model
- no realistic borrow inventory, funding regime shifts, or venue outages

## Recommended Implementation Plan In Priority Order

1. Keep runtime lifecycle, projections, and operator controls stable under full-root validation.
2. Add a dedicated scheduler/worker so runtime operation is no longer tied to API process lifetime.
3. Add reconciliation mismatch capture and replay-safe recovery surfaces.
4. If runtime concurrency grows, split inline projection rebuild from cycle execution with explicit checkpoints.
5. Build an operator UI only after lifecycle and reconciliation semantics are stable.
