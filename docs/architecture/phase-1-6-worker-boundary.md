# Phase 1.6 Worker Boundary

Date: 2026-03-18

## Boundary

- `apps/api`
  - read API for portfolio, risk, orders, positions, opportunities, events
  - operator controls for pause/resume/mode changes
  - durable command submission for one-shot cycle runs and projection rebuilds
  - visibility over runtime overview, worker state, mismatches, recovery events, and command status
- `apps/runtime-worker`
  - boots the runtime from durable state
  - schedules recurring cycle execution
  - claims and processes durable runtime commands
  - persists worker heartbeat, scheduler metadata, and command progress
- `packages/runtime`
  - shared runtime engine
  - control-plane facade
  - scheduler implementation
  - mismatch/recovery persistence and reconciliation checks

## Execution Model

- One worker process executes one operation at a time.
- The worker polls durable commands and the schedule loop on a short poll interval.
- Scheduled cycles are skipped while paused and never overlap with an in-flight command or cycle.
- One-shot operator actions are represented as durable commands rather than inline API execution.
- Rebuilds and manual cycles therefore remain inspectable even if the API process exits after accepting the request.

## Durable State

- `runtime_state`
  - runtime lifecycle, last run metadata, projection freshness, effective risk limits
- `runtime_worker_state`
  - worker lifecycle, scheduler state, heartbeat, current operation, next scheduled run
- `runtime_commands`
  - pending/running/completed/failed one-shot execution and rebuild commands
- `runtime_mismatches`
  - open/acknowledged/resolved recovery issues with dedupe keys and operator references
- `runtime_recovery_events`
  - append-only history of worker lifecycle, command progress, mismatch detection, and resolution

## Recovery Visibility

- Projection consistency checks compare `runtime_state`, `risk_current`, and `portfolio_current` against the latest successful run.
- Execution consistency checks compare approved intents against persisted orders for a run.
- Failed runtime commands create durable mismatch records instead of disappearing into logs.
- Operators can acknowledge mismatches while preserving the full recovery event history.
