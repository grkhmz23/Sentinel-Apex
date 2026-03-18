import { index, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

// portfolio_snapshots: periodic snapshots of full portfolio state
export const portfolioSnapshots = pgTable(
  'portfolio_snapshots',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    snapshotAt: timestamp('snapshot_at', { withTimezone: true }).notNull(),
    totalNav: text('total_nav').notNull(),
    grossExposure: text('gross_exposure').notNull(),
    netExposure: text('net_exposure').notNull(),
    liquidityReserve: text('liquidity_reserve').notNull(),
    openPositionCount: text('open_position_count').notNull().default('0'),
    dailyPnl: text('daily_pnl').notNull(),
    cumulativePnl: text('cumulative_pnl').notNull(),
    sleeveAllocations: jsonb('sleeve_allocations').notNull(), // {sleeveId: {nav, pct}}
    venueExposures: jsonb('venue_exposures').notNull().default({}),
    assetExposures: jsonb('asset_exposures').notNull().default({}),
    riskMetrics: jsonb('risk_metrics').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    snapshotAtIdx: index('portfolio_snapshots_at_idx').on(t.snapshotAt),
  }),
);

export const portfolioCurrent = pgTable('portfolio_current', {
  id: text('id').primaryKey(),
  sourceSnapshotAt: timestamp('source_snapshot_at', { withTimezone: true }).notNull(),
  totalNav: text('total_nav').notNull(),
  grossExposure: text('gross_exposure').notNull(),
  netExposure: text('net_exposure').notNull(),
  liquidityReserve: text('liquidity_reserve').notNull(),
  openPositionCount: text('open_position_count').notNull().default('0'),
  dailyPnl: text('daily_pnl').notNull(),
  cumulativePnl: text('cumulative_pnl').notNull(),
  sleeveAllocations: jsonb('sleeve_allocations').notNull(),
  venueExposures: jsonb('venue_exposures').notNull().default({}),
  assetExposures: jsonb('asset_exposures').notNull().default({}),
  riskMetrics: jsonb('risk_metrics').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// risk_breaches
export const riskBreaches = pgTable('risk_breaches', {
  id: uuid('id').primaryKey().defaultRandom(),
  breachType: text('breach_type').notNull(),
  severity: text('severity').notNull(),
  description: text('description').notNull(),
  triggeredAt: timestamp('triggered_at', { withTimezone: true }).notNull(),
  resolvedAt: timestamp('resolved_at', { withTimezone: true }),
  details: jsonb('details').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
