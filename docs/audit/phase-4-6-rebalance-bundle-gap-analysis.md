# Phase 4.6 Rebalance Bundle Gap Analysis

Date: 2026-03-30

## 1. Current Rebalance Coordination Model

Before Phase 4.6, the repo already had:

- durable rebalance proposals
- proposal-linked runtime commands
- rebalance execution records
- downstream carry action/execution linkage
- downstream treasury action/execution linkage
- backend-native proposal execution graph and ordered timeline

That graph was the implicit coordination model.

## 2. Current Partial-Failure Limitations

The main gap was not missing child truth. The gap was missing bundle truth.

- no durable rebalance bundle record
- no first-class bundle status
- no durable rollup of completed vs blocked vs failed child work
- no operator-facing intervention recommendation
- no explicit finalization semantics for partially applied bundles
- proposal detail still required operators to infer “safe complete” vs “partial application” from raw downstream nodes

## 3. Target Bundle Coordination Design

Phase 4.6 adds a proposal-scoped rebalance bundle as the coordinated execution unit.

The bundle model is intentionally narrow:

- one bundle per rebalance proposal
- status is derived from persisted proposal, execution, carry, and treasury truth
- bundle rollups are durable and queryable
- timeline remains aligned to the existing execution graph
- no hidden retries or autonomous recovery

Bundle statuses used in this pass:

- `proposed`
- `queued`
- `executing`
- `completed`
- `partially_completed`
- `blocked`
- `failed`
- `requires_intervention`
- `rejected`

Operator recommendations used in this pass:

- `no_action_needed`
- `wait_for_inflight_children`
- `inspect_child_failures`
- `operator_review_required`
- `unresolved_partial_application`

## 4. Required Changes

Schema:

- add `allocator_rebalance_bundles`

Runtime/store:

- add bundle read-model types
- add deterministic bundle rollup/finalization logic
- create bundle records when proposals are created
- sync bundle state on proposal lifecycle changes and linked carry/treasury execution changes

API:

- add bundle list/detail/timeline/proposal-linkage endpoints

Dashboard:

- proposal detail consumes proposal-scoped bundle detail
- add dedicated bundle detail page

## 5. Implementation Priority

1. Add durable bundle schema and runtime types.
2. Add store sync logic that derives bundle state from existing proposal graph truth.
3. Wire proposal execution and linked sleeve execution updates into bundle sync.
4. Expose bundle detail/list/proposal linkage in allocator API.
5. Refactor proposal detail and add dedicated bundle page in the dashboard.
6. Add runtime/API/dashboard tests for partial application and intervention semantics.
