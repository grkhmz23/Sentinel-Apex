# Devnet Execution Path

Date: 2026-04-04

## Purpose

This runbook documents the only real execution path supported in Phase 6.0.

Supported path:

- connector: `drift-solana-devnet-carry`
- cluster: devnet
- sleeve: carry
- action: operator-approved `reduce_carry_exposure`
- order scope: BTC-PERP reduce-only market orders
- confirmation contract:
  - persisted Solana transaction signature
  - strongly correlated Drift `OrderActionRecord` fill evidence
  - valid post-trade position delta from refreshed venue truth

## Required Environment

Use a dedicated devnet environment. Do not reuse a mainnet read-only shell.

```bash
export EXECUTION_MODE=live
export FEATURE_FLAG_LIVE_EXECUTION=true

export DRIFT_RPC_ENDPOINT=https://api.devnet.solana.com
export DRIFT_READONLY_ENV=devnet

export DRIFT_EXECUTION_ENV=devnet
export DRIFT_PRIVATE_KEY=replace-with-devnet-secret-key
export DRIFT_EXECUTION_SUBACCOUNT_ID=0
export DRIFT_EXECUTION_ACCOUNT_LABEL="Hackathon Devnet Carry"
```

Also required:

- local Postgres migrated
- API and runtime worker running
- dashboard operator account available

## Wallet And Account Prerequisites

Before requesting promotion or execution:

- fund the devnet authority wallet with SOL for fees
- create or reuse the Drift devnet subaccount for `DRIFT_PRIVATE_KEY`
- deposit collateral to that Drift devnet account
- open a small BTC-PERP position out-of-band on Drift devnet

Important:

- Phase 6.0 does not support opening new exposure through Sentinel Apex
- the repo only supports reducing an already-existing BTC-PERP position

## Promotion Workflow

1. Start the API, runtime worker, and ops dashboard.
2. Open `/venues/drift-solana-devnet-carry`.
3. Confirm the venue detail shows:
   - real truth
   - execution-capable devnet posture
   - `execution_capable_unapproved` effective posture before review
   - no missing prerequisites
   - fresh and healthy evidence
4. Request promotion as an `operator`.
5. Approve promotion as an `admin`.
6. Re-check `/api/v1/venues/drift-solana-devnet-carry/promotion/eligibility` or the dashboard evidence panel before executing.

## Supported Execution Flow

This phase reuses the existing carry command rail. It does not add a generic order ticket.

Supported operator flow:

1. Produce or select a `reduce_carry_exposure` carry action.
2. Approve that carry action through the existing carry workflow.
3. Let the runtime worker execute the queued `execute_carry_action` command.
4. Inspect `/carry/executions/:executionId` for:
   - execution status
   - execution mode
   - step-level execution reference
   - aggregate execution reference
   - event correlation status and confidence
   - evidence basis (`event_and_position`, `event_only`, `position_only`, or blocked conflict states)

Expected real reference:

- a Solana transaction signature persisted as the venue execution reference

Expected full confirmation:

- `confirmed_full`
- strong Drift fill correlation
- valid full reduce-only position delta

## Unsupported Flow

The following remain unsupported and must not be used in demos:

- increase-carry-exposure through the real connector
- treasury-native real execution
- mainnet execution
- spot orders
- non-BTC perp orders
- limit/post-only orders
- silent fallback from real to simulated

## Safe Demo Flow

Use this sequence for hackathon demos:

1. Configure only devnet env values.
2. Seed a small BTC-PERP position on Drift devnet outside Sentinel Apex.
3. Verify venue truth and promotion evidence on `/venues/drift-solana-devnet-carry`.
4. Request and approve promotion through the existing workflow.
5. Approve a carry reduction action through the existing action flow.
6. Show the resulting carry execution detail with the persisted Solana signature.
7. Show that the same flow blocks again if promotion is suspended or evidence degrades.

## Rollback And Failure Handling

If execution is blocked:

- inspect venue promotion status
- inspect current eligibility blockers
- inspect carry action and carry execution blocked reasons
- correct config or truth freshness issues before retrying

If execution submitted but downstream truth is delayed:

- use the persisted Solana signature only as one leg of evidence
- wait for Drift event ingestion plus the next truth refresh and reconciliation cycle
- do not assume fill completion from submission alone
- readiness remains blocked for states such as:
  - `pending_event`
  - `pending_position_delta`
  - `confirmed_partial_event_only`
  - `confirmed_partial_position_only`
  - `conflicting_event`
  - `conflicting_event_vs_position`

If the connector should no longer be used:

- suspend promotion
- set `FEATURE_FLAG_LIVE_EXECUTION=false`
- return `EXECUTION_MODE` to `dry-run`

## Validation

Recommended targeted validation for this path:

```bash
pnpm --filter @sentinel-apex/config test -- src/__tests__/env.test.ts
pnpm --filter @sentinel-apex/venue-adapters test -- src/__tests__/drift-devnet-carry-adapter.test.ts
pnpm --filter @sentinel-apex/runtime test -- src/__tests__/devnet-execution-path.test.ts
pnpm --filter @sentinel-apex/api test -- src/__tests__/runtime-api.test.ts
pnpm --filter @sentinel-apex/ops-dashboard test -- src/test/phase-6-devnet-execution-pages.test.tsx
```
