# Phase 5.6 Internal Derivative State

## Purpose

Phase 5.5 established strong external Drift-native read-only truth. Phase 5.6 adds the missing internal side: a durable internal derivative state model that the runtime can compare against that external truth without pretending unsupported coverage exists.

This pass does not expand execution capability. It adds comparison truth.

## Design Principles

- internal and external state stay separate
- canonical and derived internal sections are marked explicitly
- comparison only happens where both sides are genuinely comparable
- unsupported stays explicit instead of collapsing into empty or null data
- dashboard and API surfaces stay thin over runtime/store contracts

## Canonical Internal Model

The internal model is stored as a typed snapshot with four sections:

- `accountState`
- `positionState`
- `healthState`
- `orderState`

Each section carries:

- coverage status
- reason and limitations when partial or unsupported
- provenance classification
- methodology notes

### Account State

Account state is canonical internal data.

Source:

- runtime operator configuration

Supported fields:

- venue id and name
- locator mode
- configured account address when provided
- configured authority address when provided
- configured subaccount id when provided
- operator-facing account label

This is intentionally internal identity, not venue truth. It answers: which Drift account does Sentinel Apex believe it is tracking?

### Position State

Position state is a durable internal derived section.

Source:

- persisted fills
- joined to canonical runtime orders for market-type hints

Supported fields:

- position key
- asset
- market type
- side
- net quantity
- average entry price
- executed buy quantity
- executed sell quantity
- fill count
- source order count
- first and last fill timestamps

This section is derived from internal runtime facts, not copied from the venue. That keeps internal intent/execution history separate from external venue-native truth.

Current comparison granularity:

- `asset + marketType`

Current non-goals:

- exact Drift market-index parity
- liquidations, funding accrual, or margin-side accounting

### Order State

Order state is canonical internal data.

Source:

- persisted runtime orders

Supported fields:

- order key
- client order id
- venue order id when known
- asset
- market type
- side
- status
- requested size
- filled size
- remaining size
- requested price
- reduce-only
- execution mode
- timestamps

Comparison rule:

- only orders with a known venue order id are directly comparable to external Drift open-order inventory

Orders without a venue order id remain canonical internally, but comparison coverage is marked partial.

### Health State

Health state remains explicitly unsupported internally.

Reason:

- the runtime does not yet maintain a truthful internal Drift health or margin model
- allocator and risk summaries are not venue-native health state and must not be repurposed as if they were

The internal snapshot still carries a health section so the unsupported boundary is explicit and operator-visible.

## Persistence Model

Phase 5.6 adds:

- `internal_derivative_snapshots`
  - append-only history
- `internal_derivative_current`
  - latest view by venue

Why both exist:

- history supports auditability and debugging
- current state supports operator read paths and reconciliation without rebuilding the world on each request

## Refresh Lifecycle

Internal derivative state is refreshed from real runtime flows:

- cycle runs
- projection rebuilds
- carry execution updates

This keeps the internal model aligned with the same durable order and fill facts the runtime already owns.

No external venue truth is copied into the internal snapshot.

## Comparison Model

Comparison is built from:

- latest internal derivative current state
- latest external venue snapshot
- section-aware comparison logic

Supported comparisons:

- account identity
- position inventory
- open-order inventory

Unsupported direct comparison:

- health / margin

Comparison statuses:

- `matched`
- `mismatched`
- `internal_only`
- `external_only`
- `not_comparable`

Section-level comparison coverage stays explicit so operators can tell the difference between:

- a real mismatch
- a stale side
- missing state
- structurally unsupported comparison

## Reconciliation Semantics

Phase 5.6 adds truthful derivative findings only where comparison is valid:

- `drift_subaccount_identity_mismatch`
- `drift_position_mismatch`
- `drift_order_inventory_mismatch`
- `drift_truth_comparison_gap`
- `stale_internal_derivative_state`

The runtime still does not emit a health mismatch class because internal health remains unsupported.

## Operator Surfaces

The runtime now exposes:

- internal derivative state summary by venue
- external derivative truth summary by venue
- comparison summary
- comparison detail

The API exposes those views directly, and the dashboard renders them without rebuilding comparison logic in the UI.

## Honest Boundaries

Phase 5.6 improves comparison truth, but it does not provide:

- live execution expansion
- canonical internal Drift health state
- full Drift market-index reconciliation
- comparison for internal orders that do not yet have a venue order id
- portfolio-level multi-account Drift aggregation
