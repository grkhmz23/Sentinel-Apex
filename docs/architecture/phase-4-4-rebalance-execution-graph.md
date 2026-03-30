# Phase 4.4 Rebalance Execution Graph

Date: 2026-03-30

## Goal

Expose rebalance proposal drill-through as a backend-native read model rather than requiring the dashboard to compose downstream sleeve relationships itself.

## Read Model

Phase 4.4 adds:

- `RebalanceExecutionGraphView`
- `RebalanceExecutionTimelineEntry`
- grouped downstream sleeve sections for carry and treasury
- downstream rollups for operator summary

The graph is proposal-scoped and contains:

- proposal detail
- originating allocator decision
- linked runtime commands
- grouped carry downstream actions and executions
- grouped treasury downstream actions and executions
- an ordered workflow timeline

## Current Truth Boundary

Carry currently has real proposal-linked downstream action and execution records, so the graph includes them directly.

Treasury currently does not create proposal-linked downstream treasury action records during rebalance execution. The graph therefore exposes:

- an empty treasury action list when none exist
- an explicit treasury note explaining that current participation is represented by approved budget-state application, not by proposal-linked treasury actions

This keeps the graph truthful without fabricating unsupported linkage.

## Timeline Semantics

Timeline entries are derived from persisted proposal, command, rebalance execution, and downstream sleeve records.

Current timeline coverage includes:

- proposal persisted
- proposal approved or rejected
- linked command recorded
- rebalance execution recorded / started / completed / failed
- approved budget state applied
- downstream carry action recorded
- downstream carry execution recorded

The model is intentionally operator-focused, not a generic workflow engine.

## API Surfaces

Allocator now exposes:

- `GET /api/v1/allocator/rebalance-proposals/:proposalId/execution-graph`
- `GET /api/v1/allocator/rebalance-proposals/:proposalId/timeline`

The dashboard proposal page should rely on the graph endpoint as the primary drill-through surface.

## No Schema Churn

Phase 4.4 does not add new schema by default because the required linkage already exists for proposal, command, rebalance execution, and carry downstream records.

If treasury later gains proposal-linked downstream action persistence, the graph model can expand without changing its top-level contract.
