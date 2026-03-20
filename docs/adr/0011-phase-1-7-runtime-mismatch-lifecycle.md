# ADR 0011: Formal Runtime Mismatch Lifecycle

Date: 2026-03-20
Status: Accepted

## Context

Phase 1.6 introduced durable mismatches and recovery events, but the mismatch record only supported `open`, `acknowledged`, and `resolved`.

That was not sufficient for a real operator incident workflow because it could not distinguish:

- seen vs actively being worked
- resolved vs verified
- closed vs reopened

## Decision

Sentinel Apex will model runtime mismatch workflow with the following lifecycle:

- `open`
- `acknowledged`
- `recovering`
- `resolved`
- `verified`
- `reopened`

The mismatch record is the source of truth for current lifecycle state.
`runtime_recovery_events` remains the append-only audit trail for lifecycle and recovery history.

## Consequences

### Positive

- operator workflow becomes explicit and auditable
- invalid lifecycle transitions can be rejected centrally
- future UI work can consume current state directly
- command and recovery-event linkage can be stored durably on the mismatch

### Negative

- mismatch persistence becomes more stateful
- automatic reconciliation logic must now respect a richer lifecycle model
- additional fields are required in the schema and migration chain

## Notes

- Automatic system reconciliation may mark a mismatch `resolved`, but verification remains explicit.
- Re-detection of a closed mismatch reopens it as `reopened` rather than silently replacing history.
- Dry-run remains the default operating mode; this ADR does not alter live execution gating.
