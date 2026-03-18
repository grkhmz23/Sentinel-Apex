# Phase 1 Runtime Gap Analysis

Date: 2026-03-18

## Current Stub Endpoints

Before this pass, these API groups returned hard-coded or empty data:

- `GET /api/v1/portfolio`
- `GET /api/v1/portfolio/snapshots`
- `GET /api/v1/portfolio/pnl`
- `GET /api/v1/risk/summary`
- `GET /api/v1/risk/limits`
- `GET /api/v1/risk/breaches`
- `GET /api/v1/risk/circuit-breakers`
- `GET /api/v1/orders`
- `GET /api/v1/orders/:clientOrderId`
- `GET /api/v1/positions`
- `GET /api/v1/positions/:id`
- `GET /api/v1/opportunities`
- `POST /api/v1/control/kill-switch`
- `POST /api/v1/control/resume`
- `GET /api/v1/control/mode`
- `POST /api/v1/control/mode`

The health route was already real. Business routes were not.

## Target Real Endpoints

Implemented in this pass:

- `GET /api/v1/portfolio`
- `GET /api/v1/portfolio/snapshots`
- `GET /api/v1/portfolio/pnl`
- `GET /api/v1/risk/summary`
- `GET /api/v1/risk/limits`
- `GET /api/v1/risk/breaches`
- `GET /api/v1/risk/circuit-breakers`
- `GET /api/v1/orders`
- `GET /api/v1/orders/:clientOrderId`
- `GET /api/v1/positions`
- `GET /api/v1/positions/:id`
- `GET /api/v1/opportunities`
- `GET /api/v1/events`
- `GET /api/v1/runtime/status`
- `POST /api/v1/runtime/cycles/run`
- `POST /api/v1/control/kill-switch`
- `POST /api/v1/control/resume`
- `GET /api/v1/control/mode`
- `POST /api/v1/control/mode`

## Required Tables, Entities, Events, And Projections

Phase 1 minimum durable entities:

- `strategy_runs`
- `strategy_opportunities`
- `strategy_intents`
- `orders`
- `fills`
- `execution_events`
- `positions`
- `portfolio_snapshots`
- `risk_snapshots`
- `risk_breaches`
- `audit_events`
- `runtime_state`

Projection/read-model responsibilities:

- Portfolio summary: latest `portfolio_snapshots` row
- Risk summary: latest `risk_snapshots` row
- Orders: `orders`
- Positions: `positions`
- Opportunities: `strategy_opportunities`
- Recent events: `audit_events`
- Runtime status/control: `runtime_state` plus latest `strategy_runs`

## Implementation Plan In Priority Order

1. Add a real migration and a DB runner instead of schema-only Drizzle definitions.
2. Introduce one runtime package that owns orchestration and read-model queries.
3. Reuse existing `strategy-engine`, `risk-engine`, `execution`, and simulated `venue-adapters` for a deterministic paper path.
4. Persist strategy decisions, risk results, execution records, snapshots, and audit events in one inspectable flow.
5. Replace API stubs with thin runtime-backed handlers.
6. Add one safe developer trigger for a deterministic cycle.
7. Add integration tests proving runtime persistence and API queryability.
