# Phase 6.0 First Devnet Execution Connector

## Purpose

Phase 6.0 adds the first honest real execution path to Sentinel Apex without broad live rollout.

The new path is intentionally narrow:

- connector: `drift-solana-devnet-carry`
- venue posture: real, execution-capable, devnet-only
- sleeve: carry
- supported action: reduce-only BTC-PERP market orders

This phase proves that the existing promotion, approval, command-rail, persistence, and drill-through model can gate one real connector end to end.

## Connector Contract

The Drift devnet carry adapter exposes an explicit contract instead of implied support:

- connector type: `drift_native_devnet_execution`
- truth mode: `real`
- read-only support: `true`
- execution support: `true`
- execution posture metadata: `devnet_execution_capable`
- connector mode metadata: `execution_capable_devnet`
- execution reference kind: `solana_signature`

Supported execution scope:

- devnet only
- carry sleeve only
- BTC-PERP only
- market orders only
- reduce-only only

Unsupported execution scope:

- mainnet-beta execution
- increase-exposure execution
- spot orders
- non-BTC perp markets
- limit/post-only orders
- silent simulated fallback

## Truth And Evidence Model

The connector reuses the existing Drift-native truth foundation.

Read-only behavior:

- if only `DRIFT_RPC_ENDPOINT` is configured, the connector can still capture connectivity-level truth
- if `DRIFT_PRIVATE_KEY` is also configured, it derives the execution authority and Drift user account and captures account-level truth
- account truth uses the same Drift-native read-only decode depth already established in earlier phases

Execution readiness evidence is intentionally minimal and explicit:

- `endpointConfigured`
- `privateKeyConfigured`
- `authorityAddressConfigured`
- `accountAddressConfigured`
- `driftEnv=devnet`
- declared supported and unsupported execution scope

Promotion eligibility continues to use the Phase 5.9 model:

- capability class
- promotion status
- current evidence freshness, health, completeness, and blockers

`approved_for_live` in platform posture still means "approved for sensitive real execution within the connector's declared contract." For this connector, that contract remains devnet-only.

## Runtime And Command-Rail Integration

Phase 6.0 does not create a new execution system.

It reuses the existing carry flow:

1. carry action becomes actionable
2. operator approval queues `execute_carry_action`
3. worker executes the command
4. runtime checks connector posture and promotion/evidence gates again at execution time
5. the adapter submits the real Drift devnet order only if all gates still pass

Execution remains blocked unless all of the following are true:

- connector is execution-capable and not read-only
- durable promotion status allows use
- current evidence is eligible
- runtime is in live mode and live execution is enabled
- backend authorization and actor propagation are present

Blocked attempts are still persisted with explicit reasons.

## Persistence Model

No new Phase 6.0 schema or migration was required.

The existing carry execution model already had the durable fields needed:

- carry execution aggregate venue reference
- step-level `venueExecutionReference`
- step and execution outcome payloads

Phase 6.0 uses those existing records to persist:

- real transaction signature
- execution mode (`real` or `simulated`)
- connector-specific blocked reasons and outcome detail

## API And Dashboard Surfaces

Phase 6.0 extends existing surfaces rather than adding parallel ones.

Venue inspection:

- `/api/v1/venues/:venueId`
- `/api/v1/venues/:venueId/promotion`
- `/api/v1/venues/:venueId/promotion/eligibility`

Carry drill-through:

- `/api/v1/carry/actions/:actionId`
- `/api/v1/carry/executions/:executionId`

Dashboard:

- venue detail shows connector posture, connector mode, supported scope, unsupported scope, and promotion evidence
- carry execution detail shows real execution mode and persisted references

## Honest Boundary

Phase 6.0 does not claim:

- broad real carry trading
- treasury-native real execution
- mainnet execution
- generic manual order entry
- automatic promotion
- approval without current evidence

It adds one narrow devnet-safe path and keeps every broader scope explicitly blocked.
