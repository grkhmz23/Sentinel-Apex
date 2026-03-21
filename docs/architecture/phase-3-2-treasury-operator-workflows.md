# Phase 3.2 Treasury Operator Workflows

Date: 2026-03-21

## Overview

Phase 3.2 deepens Atlas Treasury from "controllable" to "operationally inspectable".

This pass does not add allocator behavior or live connectors. It adds:

- treasury action detail and execution detail read surfaces
- recommendation -> action -> execution -> venue drill-through
- structured blocked-reason categories with operator guidance
- venue readiness and connector capability visibility
- onboarding and live-enable runbooks for future real treasury connectors

## Operator Drill-Through Model

### Action Detail

Each treasury action detail view now combines:

- the persisted action row
- latest linked runtime command
- append-only execution history for that action
- timeline entries synthesized from action and execution state
- linked venue readiness metadata
- latest treasury summary and policy context

This gives operators one place to answer:

- why the action exists
- why it is blocked or actionable
- who approved it
- whether it has been queued or executed
- what venue constraints applied

### Execution Detail

Each treasury execution detail view now combines:

- the persisted execution attempt
- the linked treasury action, when available
- the linked runtime command, when available
- the linked venue capability snapshot, when available
- the action timeline for audit interpretation

This gives operators one place to answer:

- what command and actor initiated the execution
- whether execution was simulated or live
- what blocked reasons or failures were persisted
- what connector reference was returned

### Venue Detail

Each treasury venue detail view now combines:

- latest venue capability/readiness snapshot
- latest treasury summary and policy context
- recent actions for that venue
- recent executions for that venue

This is the first operator-facing connector onboarding surface for Atlas Treasury.

## Read Model Shape

### Structured Blocked Reasons

Blocked reasons now include:

- `code`
- `category`
- `message`
- `operatorAction`
- `details`

Categories are intentionally small and practical:

- `action_size`
- `liquidity`
- `reserve`
- `concentration`
- `venue_eligibility`
- `venue_health`
- `venue_capability`
- `capacity`
- `execution_mode`

### Venue Readiness

Venue capability/readiness metadata now includes:

- execution support
- allocation/reduction support
- read-only flag
- simulated vs real mode
- approved-for-live-use flag
- onboarding state
- missing prerequisites

The model is honest about boundaries:

- simulated is not production-ready
- read-only is not execution-capable
- execution-capable is not automatically approved for live use

## API Surface

Phase 3.2 adds or deepens these treasury read surfaces:

- `GET /api/v1/treasury/actions/:actionId`
- `GET /api/v1/treasury/executions/:executionId`
- `GET /api/v1/treasury/venues`
- `GET /api/v1/treasury/venues/:venueId`

Mutation semantics remain unchanged from Phase 3.1:

- `POST /api/v1/treasury/evaluate`
- `POST /api/v1/treasury/actions/:actionId/approve`
- `POST /api/v1/treasury/actions/:actionId/execute`

## Dashboard Model

The dashboard now has four treasury workflow layers:

1. Treasury overview
2. Treasury action detail
3. Treasury execution detail
4. Treasury venue inventory and venue detail

This keeps control actions thin while giving operators enough drill-through to audit state without leaving the repo's internal control plane.
