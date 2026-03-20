# ADR 0013: Phase 1.9 Reconciliation-Driven Mismatch Engine

Date: 2026-03-20
Status: Accepted

## Context

Phases 1.7 and 1.8 introduced a durable mismatch lifecycle and mismatch-scoped remediation attempts, but mismatch creation still leaned heavily on workflow incidents such as command failures and projection-source checks. The runtime lacked a first-class model for durable reconciliation runs and findings.

## Decision

Introduce two new runtime persistence models:

- `runtime_reconciliation_runs`
- `runtime_reconciliation_findings`

and make reconciliation findings the primary driver for state-integrity mismatches.

Findings are append-only per run and linked to mismatches by stable dedupe key. Mismatches remain the canonical incident record and remediation anchor.

## Rationale

- The runtime already has enough durable state to compute real discrepancies.
- Operators need auditable evidence of what was checked and what was found.
- A run/finding model is the smallest correct abstraction that supports:
  - durable visibility
  - mismatch linkage
  - repeated detection history
  - future dashboard read models

## Consequences

- Reconciliation becomes an explicit worker/runtime capability rather than an implicit side effect.
- The system gains durable evidence for both active and resolved discrepancies.
- Mismatches can now be clearly categorized as workflow-driven or reconciliation-driven.
- The schema grows modestly, but the operational model becomes materially clearer and more extensible.
