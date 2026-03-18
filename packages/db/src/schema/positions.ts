import { pgTable, text, timestamp, uuid, index } from 'drizzle-orm/pg-core';

// positions table
export const positions = pgTable(
  'positions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    sleeveId: text('sleeve_id').notNull(),
    venueId: text('venue_id').notNull(),
    asset: text('asset').notNull(),
    side: text('side').notNull(),
    size: text('size').notNull(),
    entryPrice: text('entry_price').notNull(),
    markPrice: text('mark_price').notNull(),
    unrealizedPnl: text('unrealized_pnl').notNull().default('0'),
    realizedPnl: text('realized_pnl').notNull().default('0'),
    fundingAccrued: text('funding_accrued').notNull().default('0'),
    hedgeState: text('hedge_state').notNull().default('unhedged'),
    status: text('status').notNull(),
    openedAt: timestamp('opened_at', { withTimezone: true }).notNull(),
    closedAt: timestamp('closed_at', { withTimezone: true }),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    sleeveIdIdx: index('positions_sleeve_id_idx').on(t.sleeveId),
    statusIdx: index('positions_status_idx').on(t.status),
    venueAssetIdx: index('positions_venue_asset_idx').on(t.venueId, t.asset),
  }),
);
