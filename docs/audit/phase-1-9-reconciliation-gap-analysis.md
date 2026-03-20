# Phase 1.9 Reconciliation Gap Analysis

Date: 2026-03-20
Repo: `/workspaces/Sentinel-Apex`

## Current Reconciliation Capabilities

- The runtime already has limited integrity checks in [`packages/runtime/src/health-monitor.ts`](../../packages/runtime/src/health-monitor.ts):
  - execution consistency: approved intent count vs persisted order count for a strategy run
  - projection consistency: `runtime_state`, `risk_current`, and `portfolio_current` source-run alignment
  - runtime failure detection and recovery resolution
- Existing mismatch creation/update is durable and centralized through:
  - `runtime_mismatches`
  - `runtime_recovery_events`
  - `runtime_mismatch_remediations`
- The worker already owns durable command execution and failure capture.
- The runtime can already reconstruct simulated-venue state from persisted fills through adapter replay in [`packages/runtime/src/runtime.ts`](../../packages/runtime/src/runtime.ts).
- The execution package already contains a real `Reconciler` abstraction for order and position comparison against venue state, but the runtime does not yet persist reconciliation runs/findings from it.

## Actual State Sources That Already Exist

- Venue-reconstructed order state from `VenueAdapter.getOrder()` for adapters available to the runtime.
- Venue-reconstructed position state from `VenueAdapter.getPositions()`.
- Replayed simulated venue state rebuilt from persisted fills via `restoreAdaptersFromPersistence()`.
- Persisted runtime command state in `runtime_commands`.
- Persisted strategy run / intent / order / fill records in:
  - `strategy_runs`
  - `strategy_intents`
  - `orders`
  - `fills`
- Persisted current read models and historical snapshots in:
  - `portfolio_current`
  - `portfolio_snapshots`
  - `risk_current`
  - `risk_snapshots`
- Persisted position projection state in `positions`.

## Expected State Sources That Already Exist

- Expected order state: persisted `orders` rows plus strategy-run / execution-event linkage.
- Expected position and exposure state: persisted `positions`, `portfolio_current`, and `risk_current`.
- Expected projection state: latest successful strategy run plus the latest portfolio/risk snapshots.
- Expected command outcome state:
  - completed `run_cycle` commands should reference a durable strategy run outcome
  - completed `rebuild_projections` commands should leave runtime projection state fresh and linked to a valid source run where applicable

## What Can Already Be Computed With Confidence

- Order lifecycle discrepancies between persisted order rows and adapter-visible order state.
- Position / exposure discrepancies between persisted projected positions and adapter-visible positions.
- Projection discrepancies between:
  - latest successful run
  - latest snapshot rows
  - current projection tables
  - runtime projection freshness metadata
- Command outcome discrepancies between completed runtime commands and the downstream durable state they claim to have produced.

## Current Gaps

- No durable reconciliation run record exists.
- No durable reconciliation finding record exists.
- Reconciliation results are not queryable as first-class operator data.
- Existing mismatch classes are still weighted toward workflow/command incidents rather than state discrepancies.
- There is no explicit linkage of:
  - reconciliation run
  - reconciliation finding
  - mismatch
  - remediation path
- The API exposes mismatch/recovery state, but not reconciliation visibility.
- Runtime overview has no reconciliation health contract for future dashboard work.

## Target Reconciliation-Driven Model

- The runtime persists explicit reconciliation runs.
- Each run persists durable findings with:
  - stable discrepancy class
  - severity
  - active vs resolved status
  - expected state
  - actual state
  - delta/details
  - entity linkage
  - optional mismatch linkage
- Reconciliation findings, not only command failures, become the primary source for integrity-driven mismatches.
- Findings that represent real integrity defects create or update one durable mismatch by dedupe key.
- Healthy subsequent reconciliation produces a resolved finding and resolves the linked mismatch without erasing history.
- Operators can inspect reconciliation runs/findings directly and then follow linked mismatches/remediations.

## Candidate Discrepancy Classes

- `order_state_mismatch`
  - persisted order lifecycle disagrees with venue-visible order lifecycle
  - creates or updates mismatches
- `position_exposure_mismatch`
  - persisted projected positions disagree with venue-reconstructed positions
  - creates or updates mismatches
- `projection_state_mismatch`
  - `portfolio_current` or `risk_current` disagrees with latest durable projection source
  - creates or updates mismatches
- `stale_projection_state`
  - runtime metadata marks projections stale/rebuilding when they should be fresh, or the current projection source is missing
  - creates or updates mismatches
- `command_outcome_mismatch`
  - a completed runtime command does not line up with the durable state/result it claims to have produced
  - creates or updates mismatches

Informational-only findings are intentionally out of scope for the first pass. The bounded Phase 1.9 set should focus on integrity defects that merit incident visibility.

## Required Schema / State Changes

- Add `runtime_reconciliation_runs`
  - run metadata, trigger/source, status, timestamps, counts, summary, error message
- Add `runtime_reconciliation_findings`
  - run linkage
  - dedupe key
  - finding type
  - severity
  - status
  - source subsystem / venue
  - entity references
  - expected / actual / delta payloads
  - linked mismatch id
  - detected timestamp
- Add explicit mismatch source kind so workflow-driven and reconciliation-driven incidents can be distinguished cleanly.
- Extend runtime queries and views for:
  - reconciliation runs
  - findings
  - findings by mismatch
  - latest reconciliation summary
  - mismatch detail with linked findings

## Where Reconciliation Should Run

Priority order:

1. After successful runtime cycle completion.
2. After successful projection rebuild.
3. On explicit operator-triggered reconciliation command processed by the worker.

This keeps reconciliation close to the durable worker/runtime boundary and avoids placing correctness logic in API routes.

## Findings That Should Create / Update Mismatches

- High and medium integrity discrepancies in the initial discrepancy set should create or update mismatches.
- Repeat detections should deduplicate into one mismatch per stable discrepancy key.
- Subsequent healthy reconciliation should resolve, not delete, the mismatch.
- Verification and reopen remain operator-meaningful on top of reconciliation-driven resolution.

## Implementation Plan

1. Add the reconciliation persistence model and mismatch source-kind metadata.
2. Implement a runtime reconciliation engine that works from current persisted/runtime state and existing adapters.
3. Persist reconciliation runs and findings, including active and resolved outcomes.
4. Route active/resolved findings into mismatch create/update/resolve logic with durable recovery-event linkage.
5. Add worker/runtime execution hooks and an explicit reconciliation command path.
6. Expose API/query surfaces for reconciliation runs, findings, summary, and mismatch-linked findings.
7. Enrich mismatch detail and runtime overview with reconciliation context for future dashboard work.
8. Add deterministic worker/runtime/API integration tests covering discrepancy detection, persistence, mismatch linkage, and remediation continuity.
