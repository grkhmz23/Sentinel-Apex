# ADR 0007: Drizzle ORM as the Database Access Layer

**Status:** Accepted
**Date:** 2026-03-18
**Deciders:** Engineering Lead

---

## Context

Sentinel Apex uses PostgreSQL as its primary datastore (ADR-0003). The application layer requires a typed interface for constructing and executing SQL queries. The options evaluated were:

1. **Raw SQL (node-postgres / pg):** Write all SQL as template strings. Full control, no abstraction overhead. Loses type safety: query results are `Record<string, any>` unless manually typed. Schema changes break queries silently at runtime, not at compile time.

2. **Prisma:** The most widely used TypeScript ORM. Auto-generates TypeScript types from a schema file. Provides a rich query API with relations, filters, and pagination. Has the following characteristics that were evaluated negatively for this use case:
   - Prisma Client generates at build time from `schema.prisma`; the generated client is a large runtime artifact
   - Prisma queries use a proprietary query DSL (`findMany`, `create`, `upsert`) that abstracts away SQL. For complex financial queries involving window functions, CTEs, and custom aggregations, the Prisma DSL is insufficient and raw SQL is required — breaking the consistency of the query layer
   - Prisma Migrate generates migration SQL but does not expose the underlying SQL directly in the schema definition; the schema is defined in `.prisma` format, not TypeScript
   - Prisma's type system, while good, does not provide column-level TypeScript types that compose naturally with the rest of the codebase's type patterns

3. **Drizzle ORM:** A TypeScript-first ORM where the schema is defined as TypeScript code, the query builder produces typed SQL, and the generated types are plain TypeScript interfaces with no runtime overhead. Key characteristics:
   - Schema is defined in TypeScript (not a separate `.prisma` file), making it part of the normal TypeScript compilation and refactoring workflow
   - The query builder is a thin, typed wrapper over SQL; it produces SQL that closely mirrors what you would write by hand
   - Complex queries (CTEs, window functions, raw SQL fragments) compose naturally with the typed query builder — there is no context switch between ORM queries and raw SQL
   - Zero runtime code generation: the types are inferred at compile time from the schema definition
   - Drizzle's output is always SQL; you can always inspect the generated SQL, and the behavior is predictable
   - Migrations are generated as `.sql` files (plain SQL), not as proprietary migration format files

4. **Kysely:** A strongly-typed SQL query builder (not a full ORM). Very similar philosophy to Drizzle in terms of TypeScript-first design. Does not include a schema definition layer or migration tooling; schema types must be defined manually.

---

## Decision

**Drizzle ORM is used as the database access layer for all PostgreSQL interactions.**

### Schema Definition

Database tables are defined as TypeScript objects in `packages/domain/src/db/schema/`. Example:

```typescript
// packages/domain/src/db/schema/orders.ts
import { pgTable, uuid, varchar, numeric, timestamp, index } from 'drizzle-orm/pg-core';

export const orders = pgTable('orders', {
  id: uuid('id').primaryKey(),
  correlationId: uuid('correlation_id').notNull(),
  portfolioId: uuid('portfolio_id').notNull().references(() => portfolios.id),
  sleeveId: uuid('sleeve_id').notNull().references(() => sleeves.id),
  venueId: uuid('venue_id').notNull().references(() => venues.id),
  assetId: uuid('asset_id').notNull().references(() => assets.id),
  side: varchar('side', { length: 10 }).notNull(), // 'buy' | 'sell'
  orderType: varchar('order_type', { length: 20 }).notNull(),
  status: varchar('status', { length: 40 }).notNull(),
  intentQty: numeric('intent_qty', { precision: 28, scale: 10 }).notNull(),
  submittedQty: numeric('submitted_qty', { precision: 28, scale: 10 }).notNull(),
  filledQty: numeric('filled_qty', { precision: 28, scale: 10 }).notNull().default('0'),
  limitPrice: numeric('limit_price', { precision: 28, scale: 10 }),
  venueOrderId: varchar('venue_order_id', { length: 255 }),
  riskCheckResultId: uuid('risk_check_result_id').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
  submittedAt: timestamp('submitted_at', { withTimezone: true }),
  completedAt: timestamp('completed_at', { withTimezone: true }),
}, (table) => ({
  statusCreatedIdx: index('idx_orders_status_created').on(table.status, table.createdAt),
  venueOrderIdx: index('idx_orders_venue_order_id').on(table.venueId, table.venueOrderId),
  correlationIdx: index('idx_orders_correlation').on(table.correlationId),
}));

// Inferred TypeScript types — no code generation required
export type Order = typeof orders.$inferSelect;
export type NewOrder = typeof orders.$inferInsert;
```

### Query Patterns

**Simple typed query:**

```typescript
const order = await db.query.orders.findFirst({
  where: eq(orders.id, orderId),
  with: { fills: true },
});
// order is typed as Order & { fills: Fill[] } | undefined
```

**Complex query with window function (raw SQL fragment in typed context):**

```typescript
const recentFundingRates = await db
  .select({
    venueId: fundingRates.venueId,
    assetId: fundingRates.assetId,
    rate: fundingRates.rate,
    recordedAt: fundingRates.recordedAt,
  })
  .from(fundingRates)
  .where(
    and(
      inArray(fundingRates.venueId, activeVenueIds),
      gt(fundingRates.recordedAt, sql`NOW() - INTERVAL '2 hours'`)
    )
  )
  .orderBy(desc(fundingRates.recordedAt));
// Result is typed as { venueId: string; assetId: string; rate: string; recordedAt: Date }[]
```

**Transaction with audit event:**

```typescript
await db.transaction(async (tx) => {
  // Update order state
  await tx.update(orders)
    .set({ status: 'filled', filledQty: fill.quantity, completedAt: fill.filledAt })
    .where(eq(orders.id, orderId));

  // Insert fill
  await tx.insert(fills).values(fill);

  // Insert audit event (within same transaction)
  await tx.insert(auditEvents).values({
    id: generateUUIDv7(),
    correlationId: context.correlationId,
    entityType: 'order',
    entityId: orderId,
    eventType: 'order.filled',
    previousState: previousOrderState,
    nextState: newOrderState,
    actor: context.actor,
    occurredAt: new Date(),
    metadata: { fillId: fill.id },
  });
});
```

### Migration Management

Drizzle generates migrations as plain `.sql` files using `drizzle-kit generate`. Generated migrations are committed to the repository in `packages/domain/migrations/`. Each migration file is reviewed before being applied to any environment.

Migration naming convention: `{timestamp}_{description}.sql` (e.g., `20260318120000_add_orders_table.sql`).

In development: migrations run automatically at application startup.
In production: migrations run manually before application deployment, never automatically.

### Numeric Type Handling

PostgreSQL `NUMERIC` columns are returned as `string` by node-postgres (to preserve precision beyond JavaScript's `number` range). Drizzle propagates this: numeric columns have TypeScript type `string`. All numeric values are immediately wrapped in `new Decimal(value)` upon reading from the database. This is enforced by a utility function that all repository reads use:

```typescript
function toDecimal(value: string | null | undefined): Decimal | null {
  if (value == null) return null;
  return new Decimal(value);
}
```

Drizzle's `.$type<Decimal>()` column modifier is used to annotate numeric columns with the domain type for better inference at the repository layer.

---

## Consequences

**Positive:**
- Schema changes in TypeScript are immediately reflected in query types; a column rename produces TypeScript type errors in all queries that reference the old column name, at compile time
- No build-time code generation step: the types are inferred directly from the schema definition using TypeScript's type inference
- The query builder produces SQL that is predictable and inspectable; there are no magical ORM behaviors that produce unexpected SQL
- Complex SQL (CTEs, window functions, lateral joins) composes with the typed query builder without switching to an entirely different API
- Migrations are plain SQL files; they can be reviewed, modified, and understood without ORM-specific knowledge
- Drizzle has no runtime overhead for schema or client initialization (contrast with Prisma's generated client)

**Negative:**
- Drizzle's relational query API (`db.query.*`) requires an explicit `relations` definition in addition to the schema. This is an additional declaration step that Prisma infers automatically from foreign keys.
- Drizzle is a younger library than Prisma; its ecosystem (plugins, adapters, community resources) is less mature. Breaking API changes may occur between versions.
- Numeric columns returning as `string` (rather than Prisma's plugin-based decimal coercion) requires consistent application of the `toDecimal()` utility; missing a call would produce a string in a context expecting a Decimal, which TypeScript would catch if the Decimal type annotation is applied correctly.

**Neutral:**
- Drizzle Studio (a database browser) is available for development use; it reads the schema definition directly and provides a typed interface to the database without a separate configuration step.
- The `drizzle-kit` CLI tool handles migration generation and introspection; it is a development dependency, not a runtime dependency.
