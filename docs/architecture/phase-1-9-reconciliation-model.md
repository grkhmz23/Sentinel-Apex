# Phase 1.9 Reconciliation Model

Date: 2026-03-20

## Goal

Phase 1.9 makes reconciliation a first-class runtime capability. The runtime should persist what it checked, what it found, and how those findings map into the existing mismatch and remediation workflow.

## Scope

This phase is intentionally bounded to discrepancies that can be computed from real state already present in the repository:

- persisted orders vs venue-visible order state
- persisted projected positions vs venue-visible positions
- current projection tables vs their durable source snapshots / runtime metadata
- command outcomes vs the durable state they claim to have produced

No fake external integrations or placeholder venue adapters are introduced.

## Core Model

### Reconciliation Run

A reconciliation run is one durable execution of the reconciliation engine.

It records:

- trigger and source component
- optional trigger reference
- status: `running | completed | failed`
- timestamps
- total finding count
- total linked mismatch count
- summary counts by severity / type / status
- error message if the run fails

### Reconciliation Finding

A reconciliation finding is a durable record emitted by a reconciliation run.

It records:

- the run that emitted it
- a stable `dedupeKey`
- finding type
- severity
- finding status: `active | resolved`
- source component / subsystem / venue
- relevant entity type and entity id
- expected state payload
- actual state payload
- delta payload
- summary/details
- detection timestamp
- linked mismatch id when the finding corresponds to a mismatch

Findings are append-only. Repeat detections across runs create additional durable findings with the same `dedupeKey`, while mismatches deduplicate on that key.

## Initial Finding Types

- `order_state_mismatch`
- `position_exposure_mismatch`
- `projection_state_mismatch`
- `stale_projection_state`
- `command_outcome_mismatch`

## Mismatch Linkage

The mismatch system remains the incident model.

The reconciliation engine is responsible for:

- opening or redetecting a mismatch when an active finding appears
- reopening a previously resolved/verified mismatch when the discrepancy returns
- resolving a mismatch when a later reconciliation run confirms the discrepancy is gone

The remediation system remains unchanged in principle:

- mismatch -> remediation attempt -> runtime command -> recovery event

Phase 1.9 only adds clean finding linkage into that chain.

## Source Kind

`runtime_mismatches` gains explicit source kind:

- `workflow`
- `reconciliation`

This allows future operator surfaces to distinguish:

- workflow/command incidents
- state-integrity incidents

without inferring from category strings alone.

## Execution Model

Reconciliation runs execute inside the runtime/worker boundary.

Initial execution points:

1. after successful cycle completion
2. after successful projection rebuild
3. when an explicit reconciliation command is processed by the worker

This preserves the dedicated-worker boundary and keeps correctness logic out of API handlers.

## Resolution Model

Reconciliation does not erase history.

When a discrepancy disappears:

- the engine persists a resolved finding
- the linked mismatch moves to `resolved`
- recovery events record that resolution path

Operators can still:

- verify the mismatch
- reopen it manually
- remediate it if a later run detects the discrepancy again

## Read Model Surfaces

The backend contract exposed by this phase includes:

- list/detail of reconciliation runs
- list/detail of reconciliation findings
- findings linked to a mismatch
- latest reconciliation summary
- mismatch detail with related findings
- runtime overview with latest reconciliation health context

## Design Constraints

- append-only finding history, not mutable “current state only” findings
- smallest useful schema, not a generic observability platform
- no changes that weaken dry-run defaults or live-mode gating
- no dashboard or treasury work in this phase
