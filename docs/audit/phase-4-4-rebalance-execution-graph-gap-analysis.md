# Phase 4.4 Rebalance Execution Graph Gap Analysis

Date: 2026-03-30
Repo: `/workspaces/Sentinel-Apex`

## 1. Current Rebalance Drill-Through Model

Before this pass, rebalance proposal detail already persisted:

- proposal summary and approval state
- proposal intents
- linked rebalance execution attempts
- linked command id on the proposal
- downstream carry action ids in rebalance execution outcome payloads

Carry action and execution detail were already strong in isolation, but proposal drill-through still depended on extra client-side composition.

## 2. Backend Linkage Strengths and Gaps

Strengths:

- proposal -> command linkage is durable
- proposal -> rebalance execution linkage is durable
- proposal -> downstream carry action linkage is durable via `carry_actions.linked_rebalance_proposal_id`
- carry action -> carry execution linkage is durable

Gaps before this pass:

- no dedicated proposal-scoped execution graph read model
- no backend-native grouped downstream sleeve sections
- no unified proposal timeline across proposal, command, rebalance execution, and downstream carry work
- treasury participation remained implicit when a proposal only changed approved budget state without creating proposal-linked treasury actions

## 3. Target Execution Graph Design

Phase 4.4 adds a proposal-scoped execution graph containing:

- proposal detail
- originating allocator decision
- linked commands
- grouped downstream carry section
- grouped downstream treasury section
- downstream rollups
- ordered timeline

The treasury section remains honest:

- if no proposal-linked treasury actions exist, the graph says so explicitly
- budget-state application remains visible from rebalance execution outcome and current state

## 4. Required Changes

Runtime / query layer:

- add a dedicated `RebalanceExecutionGraphView`
- derive grouped downstream carry nodes
- expose explicit treasury downstream note when no linked treasury actions exist
- derive a unified ordered timeline

API:

- add `GET /api/v1/allocator/rebalance-proposals/:proposalId/execution-graph`
- add `GET /api/v1/allocator/rebalance-proposals/:proposalId/timeline`

Dashboard:

- switch proposal detail to a single backend-native graph response
- remove client-side downstream carry composition from the proposal page

## 5. Implementation Plan Priority

1. Add proposal-scoped graph and timeline types in `packages/runtime`.
2. Implement store/control-plane query methods over existing linkage.
3. Expose allocator API graph/timeline endpoints.
4. Refactor dashboard proposal detail to consume the graph directly.
5. Add runtime/API/dashboard coverage for proposal-scoped downstream drill-through.
