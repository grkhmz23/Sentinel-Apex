# ADR 0003: PostgreSQL as Primary Datastore (No Redis)

**Status:** Accepted
**Date:** 2026-03-18
**Deciders:** Engineering Lead

---

## Context

Sentinel Apex requires durable persistence for the following data categories:

- **State:** Current positions, orders, portfolio NAV, sleeve allocations, risk state
- **Events:** Immutable audit log of every entity state transition
- **Time series:** Funding rate history, NAV snapshots, risk metric snapshots
- **Configuration:** Risk limits, venue parameters, strategy configuration
- **Reference data:** Asset definitions, venue definitions

Additionally, the system requires some degree of fast in-memory access for:
- Current risk metrics during pre-trade checks (must be < 50ms)
- Funding rate data during signal evaluation (must be < 500ms per cycle)
- Current position state during reconciliation

The default assumption in modern distributed systems is to reach for Redis (or a Redis-compatible service) whenever "fast access" is mentioned. The team evaluated whether this assumption holds for Sentinel Apex's actual access patterns.

### Access Pattern Analysis

**Pre-trade risk checks:** The risk engine reads current portfolio metrics (gross exposure, net exposure, drawdown, venue concentrations) for every order intent. These checks must complete in < 50ms. The portfolio metrics table has at most one row per portfolio (or one snapshot per portfolio per cycle). A PostgreSQL query with a proper index on `portfolio_id` returns a single row in < 1ms on local hardware. Under production load (order rate estimated at < 5 orders/second), this is not a bottleneck.

**Funding rate signal evaluation:** The carry engine reads the most recent funding rate per venue (< 10 rows) every 30 seconds. This is not a high-frequency read pattern. A PostgreSQL query against an indexed `venue_funding_rates` table with the latest record per venue completes in < 5ms.

**Order state:** The execution engine reads order state during reconciliation and fill processing. Orders are looked up by ID (primary key) or by `venueOrderId` (indexed). Both patterns complete in < 1ms.

**Position state:** Positions are read during pre-trade checks and portfolio recomputation. The number of open positions at any time is bounded (< 100 under normal operation). A full scan of open positions is < 5ms.

**Write load:** The system is not write-intensive. Order submission, fill recording, and risk state snapshots occur at a rate of < 10 writes/second in normal operation.

### Why Redis Was Considered

Redis would primarily add value for:
1. Sub-millisecond read latency for frequently accessed data
2. Pub/sub for real-time event streaming between processes
3. Distributed locking for concurrent write safety

Evaluating each:

1. **Sub-millisecond latency:** The analysis above shows that PostgreSQL query latency is well within acceptable bounds for all identified access patterns. Sub-millisecond is not required. Adding Redis to achieve 0.3ms instead of 1ms for pre-trade checks does not materially affect system performance or safety.

2. **Pub/sub:** The system runs as a single process (single-writer design per ADR-0001). In-process event emission is sufficient. A PostgreSQL `LISTEN/NOTIFY` mechanism or a simple in-process event bus covers cross-component communication without introducing a second stateful service.

3. **Distributed locking:** Because the core engine is single-process, distributed locking is not required for correctness. The API is read-heavy and stateless; it does not contend with the engine for write locks.

### Operational Costs of Redis

Adding Redis introduces:
- A second stateful service to deploy, monitor, back up, and operate
- A second failure mode (Redis unavailability)
- Data synchronization risk (Redis cache diverging from PostgreSQL source of truth)
- Cache invalidation complexity for financial state (incorrect cached risk metrics are capital loss events, not merely stale UI)
- Additional configuration, secrets management, and connection pooling concerns

For a system where PostgreSQL alone meets all latency requirements, these costs are not justified.

---

## Decision

**PostgreSQL is the single primary datastore.** Redis is not used and is not planned.

Any future proposal to introduce Redis must demonstrate a specific, measured latency or throughput bottleneck that PostgreSQL cannot address through schema optimization, indexing, query tuning, or connection pooling — not a theoretical concern.

### PostgreSQL Configuration Principles

**Connection pooling:** PgBouncer in transaction mode is used between the application and PostgreSQL. The application does not open connections directly to PostgreSQL. Maximum pool size per application instance: 20 connections.

**Schema design:**
- All monetary values: `NUMERIC(28, 10)` — no `FLOAT` or `REAL` columns for financial data
- All timestamps: `TIMESTAMPTZ` — all times stored in UTC
- Primary keys: UUID v7 (time-ordered) for all domain entities — provides both uniqueness and approximate insert ordering without a sequence bottleneck
- Enums: Stored as `VARCHAR` with a `CHECK` constraint, not as PostgreSQL `ENUM` types (PostgreSQL ENUMs are difficult to extend without `ALTER TYPE`)

**Indexing strategy:**
- Every foreign key has an index
- Status and timestamp columns used in common queries are indexed (e.g., `orders(status, created_at)`)
- The `audit_events` table is indexed on `(entity_type, entity_id, occurred_at)` for efficient entity history queries
- Partial indexes are used where most queries filter on a specific status (e.g., `WHERE status = 'open'` on positions)

**Audit log design:**
- The `audit_events` table is partitioned by month to keep query performance acceptable as the log grows
- Application role grants: `SELECT`, `INSERT` only on `audit_events` — `UPDATE` and `DELETE` are not granted to the application role

**Migrations:**
- All schema changes are managed through versioned migration files in `packages/domain/migrations/`
- Migrations run at application startup in development; run manually (with review) in production
- No DDL is executed by the ORM at runtime

### In-Process Event Bus

For real-time communication between system components (e.g., notifying the risk engine of a new fill, triggering treasury rebalance on allocation change), the system uses an in-process typed event emitter (Node.js `EventEmitter` wrapped with TypeScript types). Events are emitted after the corresponding database write is committed to prevent subscribers from acting on state that is not yet durable.

---

## Consequences

**Positive:**
- Single datastore: one service to deploy, monitor, back up, and reason about
- No cache invalidation complexity: the database is always the source of truth
- PostgreSQL transactions provide strong consistency guarantees across entity state changes and the audit log insert — they happen atomically or not at all
- Existing team expertise in PostgreSQL; no new technology stack to learn
- Backup, point-in-time recovery, and restore procedures are well-understood for PostgreSQL
- The audit log's append-only guarantee is enforceable at the database permission level

**Negative:**
- If the system's write throughput scales significantly (e.g., tick-by-tick price storage, high-frequency order flow), PostgreSQL may become a bottleneck. This scenario would require revisiting this decision with measured data.
- Connection pool management adds a dependency on PgBouncer.
- Time-series data (NAV snapshots, funding rate history) stored in PostgreSQL is less efficient than a purpose-built time-series database (e.g., TimescaleDB). For the current volume, this is acceptable. TimescaleDB (which runs on PostgreSQL) is a compatible upgrade path if needed.

**Neutral:**
- Drizzle ORM is used as the query builder (see ADR-0007); it does not abstract away SQL or impose an ORM pattern that would prevent raw SQL for complex queries
- PostgreSQL version: 16 or higher (for improved JSON operators and performance)
