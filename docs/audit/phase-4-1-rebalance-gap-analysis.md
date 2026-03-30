# Phase 4.1 Rebalance Gap Analysis

Date: 2026-03-30

## 1. Current Allocator Decision Model

Phase 4.0 already persisted:

- allocator runs
- sleeve targets
- allocator recommendations
- allocator current summary

Allocator decisions already expose:

- current vs target carry / treasury budget
- explicit sleeve deltas
- rationale and binding constraints
- regime and pressure state

What was missing was the controlled bridge from those outputs into an operator-approved action workflow.

## 2. Current Sleeve Execution Capabilities

### Carry

- Carry already had opportunity detection, sizing, runtime orchestration, and paper execution.
- Carry did not have an explicit allocator-facing rebalance intent or budget approval workflow.
- Carry also did not have an honest way to say “budget change approved, but venue deployment is not autonomously executed here”.

### Treasury

- Treasury already had explicit recommendations, approval requirements, blocked reasons, queueable execution commands, execution history, and venue readiness.
- Treasury execution is still venue-centric rather than portfolio-budget-centric.
- That means Treasury could execute venue allocation changes, but allocator recommendations still lacked a portfolio-level approved rebalance envelope.

### Reusable Rails

The repo already had the right control-plane pattern:

- persisted recommendation/action records
- approve -> queue command -> worker execute
- backend authorization
- actor propagation
- audit event persistence

## 3. Target Rebalance Workflow

Phase 4.1 adds:

- allocator decision
- durable rebalance proposal
- sleeve-specific rebalance intents
- operator approval or rejection
- explicit rebalance command
- worker/runtime execution
- durable execution outcome
- current approved sleeve-budget state

Important scope boundary:

- this phase remains budget-first and explicit
- no hidden autonomous carry or treasury routing was added
- dry-run remains default
- live mode only applies to whether the approved budget state is actually applied, not to hidden venue routing

## 4. Required Changes

### Domain

- add rebalance proposal, intent, blocked-reason, approval, and execution types
- add deterministic rebalance planner from allocator targets

### Runtime

- generate rebalance proposals from allocator evaluations
- expose proposal list/detail/current state
- approve and reject proposals through control-plane methods
- queue explicit `execute_rebalance_proposal` commands
- execute proposals through the worker/runtime with audit linkage

### Schema

- add proposal, intent, execution, and current-state tables for allocator rebalancing

### API

- list proposals
- get proposal detail
- list proposals by allocator decision
- approve proposal
- reject proposal

### Dashboard

- show recent rebalance proposals on allocator overview
- show decision-linked proposals on allocator decision detail
- add proposal detail page with rationale, blocked reasons, intents, approval controls, and execution state

## 5. Priority-Ordered Implementation Plan

1. Add rebalance domain model and planner in `packages/allocator`.
2. Add durable rebalance schema and runtime store mappings.
3. Generate rebalance proposals during allocator evaluation.
4. Add approval / rejection / execution flow on the existing command rail.
5. Add backend policy checks and current approved budget state.
6. Add API surfaces.
7. Add dashboard proposal visibility and controls.
8. Add runtime/API/dashboard tests.
9. Update architecture, strategy, risk, audit, and README docs.
