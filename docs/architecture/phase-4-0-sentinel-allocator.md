# Phase 4.0 Sentinel Allocator

Date: 2026-03-30

## Overview

Sentinel is the portfolio allocator above the existing Carry and Treasury sleeves.

This phase does not add autonomous cross-sleeve execution. It adds:

- deterministic sleeve budgeting
- portfolio-level pressure and regime interpretation
- explicit current-vs-target allocation outputs
- persisted allocator decisions and recommendations
- operator visibility into why the portfolio budget shifted

## Architectural Boundary

- `packages/allocator` owns:
  - allocator domain model
  - sleeve registry
  - policy evaluation
  - recommendation and rationale generation
- `packages/runtime` owns:
  - building allocator inputs from runtime, carry, reconciliation, and treasury state
  - persisting allocator outputs
  - scheduling allocator evaluation during cycles and explicit commands
- `apps/api` and `apps/ops-dashboard` remain thin read/action layers over those backend contracts

## Sleeve Model

The first pass supports two sleeves only:

- `carry`
- `treasury`

Each sleeve is translated into a common allocator snapshot with:

- current allocation
- current allocation percentage
- min/max budget band
- capacity
- health/status
- throttle state
- actionability
- opportunity score where available

Carry and Treasury keep their own internal models. Sentinel only depends on the normalized sleeve snapshot.

## System-State Inputs

The first allocator pass uses a deliberately small set of inputs:

- runtime lifecycle / halted state
- mismatch pressure and critical mismatch count
- degraded reason count
- recent reconciliation issue count
- treasury reserve coverage and reserve shortfall
- carry opportunity count and normalized carry opportunity score

This is enough to make sensible, inspectable budgeting decisions without pretending a full market regime engine already exists.

## Decision Model

Allocator evaluation produces:

- `regimeState`
- `pressureLevel`
- `targets`
  - current allocation
  - target allocation
  - delta
  - sleeve-specific rationale
- `recommendations`
- `constraints`
- top-level rationale

The current decision rules are intentionally explicit:

- start from a baseline carry/treasury split
- enforce a treasury floor
- cap carry when reserve coverage is weak
- cap carry under degraded runtime / mismatch pressure
- cap carry when sleeve health is degraded or throttled
- modestly uplift carry when opportunity quality is strong and system pressure is normal

## Persistence Model

Allocator state is persisted in dedicated tables:

- allocator runs
- allocator sleeve targets
- allocator recommendations
- allocator current summary

This keeps the allocator auditable and queryable without mixing portfolio-budget decisions into unrelated read models.

## Runtime Integration

Allocator evaluation runs in two ways:

- automatically during regular runtime cycles
- explicitly through a worker command

Outputs remain recommendation-oriented. This phase does not automatically translate allocator decisions into Treasury or Carry execution side effects.
