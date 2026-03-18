# ADR 0006: Event-Sourced Audit Trail as Primary Audit Mechanism

**Status:** Accepted
**Date:** 2026-03-18
**Deciders:** Engineering Lead

---

## Context

Sentinel Apex deploys capital programmatically and autonomously. Every position entry, every order submission, every risk limit check, every allocation change, and every manual operator action must be attributable, explainable, and non-repudiable. This is not merely a good engineering practice — it is a fundamental requirement for operating an institutional-grade capital management system.

The specific audit requirements are:

1. **Completeness:** Every state change to every tracked entity must be recorded. There must be no gaps in the audit trail.
2. **Immutability:** Audit records cannot be modified or deleted after creation. This is required for non-repudiation and for detecting unauthorized changes to historical records.
3. **Explainability:** For any entity state at any point in time, it must be possible to reconstruct exactly how that state was reached by replaying the recorded events.
4. **Query efficiency:** The audit log must be queryable by entity, time range, actor, and event type without full-table scans.
5. **Transactional consistency:** The audit record of a state change must be written atomically with the state change itself. It must be impossible for a state change to occur without a corresponding audit event.

Several approaches to audit logging were evaluated:

**Option A: Application-level logging only.** State changes are logged as structured log lines. Logs are shipped to a log aggregation service.

Issues: Logs are not transactionally consistent with state changes (the state change can commit but the log write can fail, or vice versa). Logs are not queryable as structured data without additional tooling. Logs are typically not designed as append-only systems with deletion controls. This option does not meet the immutability or transactional consistency requirements.

**Option B: PostgreSQL trigger-based audit.** Database triggers automatically capture row changes to a shadow audit table.

Issues: Trigger-based auditing captures the raw row delta (before/after column values) but not the business context (why the change was made, what actor made it, what correlation ID links it to the originating signal). Triggers operate outside application transaction logic, making it difficult to attach business-level metadata. Triggers can be dropped by a sufficiently privileged database user, which undermines the immutability guarantee.

**Option C: Application-level event sourcing with atomic writes.** The application explicitly constructs a typed `AuditEvent` for every state change, and writes the event to the `audit_events` table within the same database transaction as the state change. The application database role is granted INSERT on `audit_events` but not UPDATE or DELETE.

This option provides transactional consistency, business context, immutability (enforced at the database permission level), and structured queryability.

**Option D: Full event sourcing (no current-state tables).** All state is derived by replaying events; no current-state tables exist. Any read requires replaying the event log for the entity.

Issues: This is architecturally correct for some domains but impractical for a trading system where read performance is critical (pre-trade risk checks must complete in < 50ms). Replaying 6 months of position events to answer "what is the current position size" on every pre-trade check is not acceptable. A hybrid approach — event log for audit + materialized current-state tables — is more appropriate.

---

## Decision

Sentinel Apex uses **application-level event sourcing for audit purposes** (Option C), combined with materialized current-state tables for query efficiency. This is sometimes called a "write model / read model" separation in CQRS terms, though Sentinel Apex does not implement full CQRS.

### Event Writing Contract

Every function in the system that performs a state change must:

1. Construct the new entity state
2. Construct an `AuditEvent` record with the previous state, new state, actor, and metadata
3. Execute both the entity state update and the audit event insert within a single database transaction

The transaction either commits both or rolls back both. There is no code path that writes state without writing an audit event.

This contract is enforced structurally: all database write operations go through repository functions in `packages/domain` that accept a `WriteContext` argument containing the transaction, actor identity, and correlation ID. Functions that take a plain database connection (outside of `WriteContext`) are only permitted for read operations.

### AuditEvent Schema

```sql
CREATE TABLE audit_events (
  id             UUID PRIMARY KEY,              -- UUID v7 (time-ordered)
  correlation_id UUID NOT NULL,                 -- Propagated from originating operation
  entity_type    VARCHAR(64) NOT NULL,          -- 'order' | 'position' | 'portfolio' | ...
  entity_id      UUID NOT NULL,
  event_type     VARCHAR(128) NOT NULL,         -- e.g. 'order.filled'
  previous_state JSONB,                         -- NULL for creation events
  next_state     JSONB NOT NULL,
  actor          VARCHAR(255) NOT NULL,         -- 'system:carry' | 'operator:<id>'
  occurred_at    TIMESTAMPTZ NOT NULL,
  metadata       JSONB NOT NULL DEFAULT '{}'::jsonb,

  -- No updated_at, no soft delete columns, no is_deleted flag
);

-- Indexes for common query patterns
CREATE INDEX idx_audit_events_entity ON audit_events (entity_type, entity_id, occurred_at DESC);
CREATE INDEX idx_audit_events_event_type ON audit_events (event_type, occurred_at DESC);
CREATE INDEX idx_audit_events_actor ON audit_events (actor, occurred_at DESC);
CREATE INDEX idx_audit_events_correlation ON audit_events (correlation_id);

-- Partition by month for long-term manageability
-- (partition implementation uses pg_partman or manual partition creation)
```

Database permissions for the application role:

```sql
GRANT SELECT, INSERT ON audit_events TO sentinel_app_role;
-- UPDATE and DELETE are explicitly NOT granted
```

### Immutability Guarantee

The immutability guarantee has two layers:

1. **Permission layer:** The application database role cannot execute UPDATE or DELETE on `audit_events`. Even a code bug cannot delete an audit record.
2. **Application layer:** Repository functions that write audit events have no update or delete methods. There is no `deleteAuditEvent()` function.

For the guarantee to hold in production, the application database role must be the only role used by the running application. The ability to grant broader permissions to a superuser role for maintenance is a separate concern addressed by the operational runbooks (audit log maintenance operations require DBA-level access and produce their own audit records).

### Querying the Audit Log

The `apps/api` exposes the following audit log query endpoints:

- `GET /audit/entities/:entityType/:entityId` — full event history for a single entity
- `GET /audit/events?type=order.filled&from=...&to=...` — events by type and time range
- `GET /audit/actors/:actorId?from=...&to=...` — all events by a specific actor
- `GET /audit/correlations/:correlationId` — all events in a single operation chain

The ops dashboard displays audit events in a paginated, filterable table.

### Event Replay

The event log can be replayed to reconstruct entity state at any point in time. This is used for:
- Debugging: "what was the portfolio state at 14:23:05 UTC when this circuit breaker tripped?"
- Reconciliation investigations: replay position events to verify that current state matches recorded fill history
- Testing: verify that a new event processor produces correct output given a historical event sequence

A replay utility in `packages/domain` takes an entity ID and a target timestamp, fetches all events for that entity up to that timestamp, and returns the reconstructed state.

---

## Consequences

**Positive:**
- Every state change is attributable with full context: who made it, why, what the state was before and after, and what operation chain it belongs to
- Immutability is enforced at the database permission level, not just by convention
- The correlation ID propagation allows reconstructing the full causal chain from a market signal through opportunity detection, risk check, order submission, and fill
- Audit events are structured data (JSONB), not unstructured log strings — they are queryable without log parsing
- Transactional consistency guarantees there is never a state change without a corresponding audit event
- The audit trail satisfies institutional requirements for operational transparency

**Negative:**
- Every write operation requires constructing an `AuditEvent` in addition to the entity state change. This adds approximately 10–20% more code per write operation.
- The `audit_events` table grows unboundedly over time. Monthly partitioning and a retention policy (e.g., archive partitions older than 2 years to cold storage) must be defined and operated.
- JSONB `previous_state` and `next_state` fields can become large for entities with many fields (e.g., a Portfolio snapshot). This increases storage per event. Mitigation: only store fields that changed, not the full entity, for large entities.

**Neutral:**
- The audit trail does not replace operational logs. Structured logs (from `packages/observability`) remain the primary tool for debugging runtime behavior. The audit trail is specifically for business-level state transitions.
- The event replay utility is not a real-time system; it is a diagnostic tool for investigation and reconciliation.
