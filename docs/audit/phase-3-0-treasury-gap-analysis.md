# Phase 3.0 Treasury Gap Analysis

Date: 2026-03-21
Repo: `/workspaces/Sentinel-Apex`

## 1. Current Product and Runtime Structure

- `packages/carry` contains the only strategy sleeve with executable planning logic before this pass.
- `packages/runtime` orchestrates cycles, persistence, reconciliation, mismatch handling, and operator workflows.
- `packages/venue-adapters` previously modeled execution venues only.
- `apps/api` and `apps/ops-dashboard` are thin read/control surfaces over runtime and store contracts.
- `packages/db` already provides durable runtime facts, projections, reconciliation, remediation, and operator session storage.

## 2. Target Treasury Sleeve Design

- Add a dedicated `packages/treasury` package for treasury-specific policy evaluation and recommendation logic.
- Keep treasury separate from carry:
  - carry remains opportunity and order generation for funding/cross-venue trades
  - treasury evaluates idle capital, reserve coverage, venue concentration, and capital parking recommendations
- Use explicit simulated treasury venue adapters until real treasury connectors exist.
- Persist treasury evaluations, venue snapshots, and recommended actions as durable runtime-backed read models.
- Integrate treasury into the existing runtime cycle so operators get treasury state automatically after carry cycles.

## 3. Required Changes

### Domain and Package

- Add `packages/treasury` with:
  - treasury policy model
  - reserve/concentration evaluation
  - deterministic recommendation generation

### Runtime

- Extend `SentinelRuntime` to maintain treasury adapters and a treasury policy engine.
- Run treasury evaluation from the real runtime cycle and via an explicit runtime command.
- Expose treasury summary, allocations, policy, and actions through the control plane.

### Venue Adapters

- Add treasury-specific venue interfaces.
- Add explicit simulated treasury venue adapters with honest `simulated` mode labeling.

### Persistence

- Add tables for:
  - `treasury_runs`
  - `treasury_venue_snapshots`
  - `treasury_actions`
  - `treasury_current`

### API

- Add treasury routes for summary, allocations, policy, actions, and explicit evaluation.

### Dashboard

- Add a treasury page and treasury overview visibility in `apps/ops-dashboard`.

## 4. Implementation Plan in Priority Order

1. Add treasury package and policy engine with deterministic tests.
2. Add treasury venue adapter abstractions and simulated implementations.
3. Add DB schema and migration for treasury read models.
4. Wire treasury evaluation into runtime cycle and explicit runtime command execution.
5. Expose treasury state through control-plane and API routes.
6. Add treasury dashboard visibility and a safe evaluation action.
7. Add integration tests across runtime, API, and dashboard.
8. Update audit, architecture, strategy, and README documentation.
