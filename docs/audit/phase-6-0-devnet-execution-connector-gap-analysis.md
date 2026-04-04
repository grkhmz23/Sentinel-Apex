# Phase 6.0 Devnet Execution Connector Gap Analysis

Date: 2026-04-04
Repo: `/workspaces/Sentinel-Apex`

## Phase 6.1 Follow-On: Hackathon Strategy Eligibility Layer

The repo now adds a separate strategy-policy layer on top of the Phase 6.0 connector work.

What this follow-on adds:

- one first-class strategy profile: `Apex USDC Delta-Neutral Carry`
- `USDC` base-asset enforcement
- 3-month rolling tenor enforcement
- target APY floor defaulted to `10%`
- explicit rejection of:
  - circular yield-bearing stable dependencies
  - junior tranche / insurance pool designs
  - DEX LP vaults
  - unsafe looping leverage below `1.05` on non-hardcoded oracle dependencies
- carry action snapshots and carry API/dashboard surfaces that explain:
  - whether the strategy is eligible in principle
  - whether the execution path is currently supported
  - what remains blocked

What it still does not add:

- mainnet readiness
- generic Ranger vault integration
- widened execution scope beyond the existing Drift devnet reduction path

## 1. Candidate Connector Options

### Option A: Treasury-side real allocation/deallocation connector

Current fit:

- not a good first candidate
- Atlas Treasury already has controlled execution records and drill-through, but the current real connector work in-repo is concentrated in Drift carry truth, not treasury-native venue execution
- the repo does not yet have a narrow, honest treasury adapter that can submit one real devnet-safe venue action end to end

Primary gap:

- this would require inventing a new real treasury connector path and onboarding model instead of reusing the existing strongest real venue foundation

### Option B: Carry-side Drift devnet increase-exposure execution

Current fit:

- not acceptable for the first honest path
- the repo can already model carry opportunities and planned orders, but increase-exposure execution would widen operational risk immediately
- the current carry action and market-identity flow is not yet broad enough to claim safe arbitrary live market selection or broad opening-order support

Primary gap:

- opening exposure is materially riskier than reducing it
- broadening into increase-exposure or multi-market support would outrun the current explicit identity, readiness, and operator-control envelope

### Option C: Carry-side Drift devnet reduce-only execution

Current fit:

- best first candidate
- reuses the existing strongest real venue foundation:
  - Drift SDK dependency already present
  - Drift-native read-only truth already present
  - promotion/evidence workflow already present
  - carry approval and runtime command rail already present
  - carry execution reference persistence and drill-through already present
- can stay narrow and honest:
  - one venue
  - one cluster
  - one market
  - one action class

Chosen scope:

- `drift-solana-devnet-carry`
- carry sleeve only
- real BTC-PERP reduce-only market orders on Drift devnet

## 2. Chosen First Execution-Capable Connector And Why

The first execution-capable connector is `drift-solana-devnet-carry`.

Why this path wins:

- it is the only path that can honestly reuse existing real venue truth plus current operator workflow without inventing a parallel execution system
- it keeps the first real path devnet-scoped and operator-approved
- it proves the Phase 5.9 promotion workflow gates a real connector instead of a simulated one
- it minimizes blast radius by allowing only reduction of existing exposure

This is intentionally a carry-side connector, not a treasury-side connector.

## 3. Supported Devnet Execution Scope

Phase 6.0 supports only this narrow real execution contract:

- venue: Drift devnet
- connector id: `drift-solana-devnet-carry`
- sleeve: carry
- action family: operator-approved `reduce_carry_exposure`
- order type: market only
- market scope: BTC-PERP only
- risk posture: reduce-only only
- execution reference: real Solana transaction signature persisted as the venue execution reference
- mode boundary:
  - simulated execution remains explicit when using simulated connectors
  - this connector never silently falls back to simulated execution when asked to execute for real

## 4. Unsupported Scope That Must Remain Blocked

Phase 6.0 still blocks all of the following:

- mainnet-beta execution
- treasury-native real execution
- carry increase-exposure execution through the real connector
- spot orders
- non-BTC perp markets
- limit or post-only orders
- autonomous promotion
- hidden execution shortcuts outside the existing carry approval and runtime command rail
- silent simulated fallback when the operator expected real execution

## 5. Required Runtime, API, Dashboard, Config, And Doc Changes

### Runtime And Connector Layer

- add an explicit execution-capable Drift devnet carry adapter
- ingest venue-native Drift execution events with the official SDK `EventSubscriber`
- encode connector posture and narrow supported scope in capability metadata
- persist explicit execution references and execution mode details for carry steps and execution outcomes
- persist correlated Drift event evidence and duplicate-suppressed raw event rows
- keep live gating dependent on:
  - connector execution support
  - durable promotion status
  - current evidence eligibility
  - runtime live mode
  - operator authorization

### Readiness Evidence

- reuse existing promotion evidence model
- add connector metadata that records:
  - `driftEnv`
  - endpoint/private-key readiness
  - authority/account derivation readiness
  - execution posture
  - supported and unsupported execution scope
- keep missing, stale, degraded, or incomplete evidence blocking sensitive execution

### API And Dashboard

- extend existing venue detail and promotion surfaces to expose the new connector posture truth
- extend existing carry execution detail surfaces to expose real execution references, event correlation, and evidence basis
- avoid a new parallel API or dashboard subsystem

### Persistence

- no new schema expansion was required
- existing carry execution records already had the durable fields needed for:
  - step-level `venueExecutionReference`
  - execution-level aggregate reference
  - outcome payload detail
- existing `execution_events` storage can hold raw correlated venue event rows without widening the generic execution model

### Config And Runbooks

- add explicit devnet execution env variables and guidance
- document that devnet execution requires:
  - `DRIFT_RPC_ENDPOINT` pointed at devnet
  - `DRIFT_READONLY_ENV=devnet`
  - `DRIFT_EXECUTION_ENV=devnet`
  - `DRIFT_PRIVATE_KEY`
  - a funded Drift devnet account with an existing BTC-PERP position to reduce

## 6. Implementation Plan In Priority Order

1. Reuse the existing Drift read-only truth foundation and implement one narrow execution-capable Drift devnet carry adapter.
2. Make the connector contract explicit in capability metadata, truth snapshots, and blocked reasons.
3. Wire the adapter into the existing runtime bootstrap and carry execution rail without broadening venue discovery scope.
4. Persist real execution references and execution mode through the existing carry execution records.
5. Prove promotion workflow gating still blocks the connector until approval and current evidence both pass.
6. Expose the connector posture and execution references through the existing API and dashboard detail surfaces.
7. Add runbooks for devnet-safe operation, promotion, and demo use.
8. Add targeted connector, runtime, API, and dashboard tests, then run targeted validation and repo-wide validation.
