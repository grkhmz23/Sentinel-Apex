import { boolean, index, integer, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

import { strategyRuns } from './runtime.js';

// orders table: one row per OrderIntent
export const orders = pgTable(
  'orders',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    clientOrderId: text('client_order_id').notNull().unique(),
    strategyRunId: text('strategy_run_id').references(() => strategyRuns.runId),
    sleeveId: text('sleeve_id').notNull(),
    opportunityId: text('opportunity_id'),
    venueId: text('venue_id').notNull(),
    venueOrderId: text('venue_order_id'),
    asset: text('asset').notNull(),
    side: text('side').notNull(),          // 'buy' | 'sell'
    orderType: text('order_type').notNull(),
    executionMode: text('execution_mode').notNull().default('dry-run'),
    reduceOnly: boolean('reduce_only').notNull().default(false),
    requestedSize: text('requested_size').notNull(),
    requestedPrice: text('requested_price'),
    filledSize: text('filled_size').notNull().default('0'),
    averageFillPrice: text('average_fill_price'),
    status: text('status').notNull(),
    attemptCount: integer('attempt_count').notNull().default(0),
    lastError: text('last_error'),
    metadata: jsonb('metadata').notNull().default({}),
    submittedAt: timestamp('submitted_at', { withTimezone: true }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    clientOrderIdIdx: index('orders_client_order_id_idx').on(t.clientOrderId),
    strategyRunIdIdx: index('orders_strategy_run_id_idx').on(t.strategyRunId),
    statusIdx: index('orders_status_idx').on(t.status),
    sleeveIdIdx: index('orders_sleeve_id_idx').on(t.sleeveId),
    venueIdIdx: index('orders_venue_id_idx').on(t.venueId),
    createdAtIdx: index('orders_created_at_idx').on(t.createdAt),
  }),
);

// fills table: one row per fill event
export const fills = pgTable(
  'fills',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orderId: uuid('order_id')
      .notNull()
      .references(() => orders.id),
    clientOrderId: text('client_order_id').notNull(),
    venueOrderId: text('venue_order_id').notNull(),
    fillId: text('fill_id'),
    size: text('size').notNull(),
    price: text('price').notNull(),
    fee: text('fee').notNull(),
    side: text('side').notNull(),
    feeAsset: text('fee_asset'),
    filledAt: timestamp('filled_at', { withTimezone: true }).notNull(),
    metadata: jsonb('metadata').notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    orderIdIdx: index('fills_order_id_idx').on(t.orderId),
    clientOrderIdIdx: index('fills_client_order_id_idx').on(t.clientOrderId),
  }),
);
