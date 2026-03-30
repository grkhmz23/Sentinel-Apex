# ADR 0017: Phase 4.1 Operator-Approved Rebalance Workflow

Date: 2026-03-30
Status: Accepted

## Context

Phase 4.0 introduced allocator decisions, targets, and recommendations, but there was still no controlled bridge from allocator output to explicit sleeve-level action.

The repo already had a good operator workflow pattern in treasury:

- recommendation
- approval
- queued runtime command
- worker execution
- durable outcome

Carry did not have an equivalent allocator-facing execution surface.

## Decision

Introduce a dedicated allocator rebalance workflow with:

- rebalance proposals
- sleeve-specific rebalance intents
- proposal approval / rejection
- explicit rebalance command execution
- durable rebalance execution records
- current approved rebalance state

Execution in this phase is budget-state oriented:

- dry-run persists outcomes without changing current approved budget state
- live applies current approved budget state
- neither mode silently routes venue actions

## Rationale

This keeps the system:

- explicit
- operator-approved
- auditable
- compatible with existing runtime command rails
- honest about current carry and treasury execution boundaries

## Consequences

Positive:

- allocator outputs now have an actionable operator workflow
- proposal, approval, command, and outcome state are all durable
- later phases can safely connect approved budget state to treasury or carry execution without replacing the current lifecycle

Negative:

- rebalance execution stops at approved budget state rather than venue routing
- operators may still need separate treasury actions to free capital before some carry increases become actionable
