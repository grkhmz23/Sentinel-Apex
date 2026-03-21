# Treasury Connector Onboarding Runbook

Date: 2026-03-21

## Purpose

This runbook defines what a new Atlas Treasury connector must provide before it can be considered usable by operators.

Documentation is not integration. Completing this runbook means the connector is structured for review, not that it is automatically approved for live capital.

## Required Interface Contract

A treasury connector must implement the treasury adapter contract in `packages/venue-adapters` and provide:

- venue identity and mode
- venue state snapshot
- current treasury position snapshot
- capability metadata
- explicit treasury execution method

## Required Capability Metadata

Every connector must report:

- `venueId`
- `venueMode`
- `supportsAllocation`
- `supportsReduction`
- `executionSupported`
- `readOnly`
- `approvedForLiveUse`
- `onboardingState`
- `missingPrerequisites`
- `healthy`
- connector-specific metadata

If this metadata is missing or dishonest, the connector is not ready for treasury operator use.

## Read-Only Vs Execution-Capable

### Read-Only Connector

A read-only connector may:

- publish venue state
- publish positions and balances
- expose readiness metadata

It may not:

- claim execution support
- be presented as live execution-capable

### Execution-Capable Connector

An execution-capable connector must:

- expose deterministic request/response semantics
- return a venue execution reference
- distinguish dry-run vs live mode
- fail explicitly when live mode is disabled or unsupported
- persist honest metadata for operator audit

## Simulated Vs Live Expectations

### Simulated

- may be execution-capable
- must always declare simulated mode
- must never be described as production deployment

### Live

- must be explicitly marked as real
- must remain unapproved for live use until operator signoff is complete
- must still respect global live-mode gating and treasury approval rules

## Minimum Technical Validation

Before review, the connector owner must prove:

- snapshots are deterministic enough for tests and operator interpretation
- execution failures are explicit and do not silently no-op
- dry-run behavior is supported or intentionally rejected with a clear error
- capability metadata matches actual implementation behavior
- package-level and integration tests pass

## Required Operator Review Inputs

Before treasury operators review a connector, provide:

- connector owner
- target venue and product scope
- read-only vs execution scope
- supported treasury action types
- expected venue execution reference format
- failure modes and retry expectations
- external dependency or credential requirements
- known missing prerequisites

## Signoff Checklist

Operator signoff should confirm:

- capability metadata is truthful
- simulated vs real boundary is explicit
- live mode is still gated
- blocked reasons remain meaningful for connector constraints
- venue appears correctly in treasury venue inventory and detail views

Final live enablement is controlled by the separate treasury live-enable checklist.
