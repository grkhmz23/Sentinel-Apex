-- Migration: Realized APY Tracking
-- Purpose: Track realized PnL and compute actual APY from executed trades
-- Created: 2026-04-04

-- =============================================================================
-- Trade-level realized PnL tracking
-- =============================================================================

CREATE TABLE IF NOT EXISTS "realized_trade_pnl" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "trade_id" text NOT NULL UNIQUE,
  "position_id" text,
  "sleeve_id" text NOT NULL,
  "venue_id" text NOT NULL,
  "asset" text NOT NULL,
  "side" text NOT NULL,
  "instrument_type" text NOT NULL DEFAULT 'perpetual',
  "entry_price" text NOT NULL,
  "exit_price" text NOT NULL,
  "size" text NOT NULL,
  "notional_usd" text NOT NULL,
  "gross_pnl" text NOT NULL,
  "funding_pnl" text NOT NULL DEFAULT '0',
  "fee_cost" text NOT NULL,
  "net_pnl" text NOT NULL,
  "opened_at" timestamptz NOT NULL,
  "closed_at" timestamptz NOT NULL,
  "holding_period_days" decimal NOT NULL,
  "execution_reference" text,
  "confirmed" boolean NOT NULL DEFAULT false,
  "confirmed_at" timestamptz,
  "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "realized_trade_pnl_trade_id_idx" ON "realized_trade_pnl" ("trade_id");
CREATE INDEX IF NOT EXISTS "realized_trade_pnl_position_id_idx" ON "realized_trade_pnl" ("position_id");
CREATE INDEX IF NOT EXISTS "realized_trade_pnl_sleeve_id_idx" ON "realized_trade_pnl" ("sleeve_id");
CREATE INDEX IF NOT EXISTS "realized_trade_pnl_asset_idx" ON "realized_trade_pnl" ("asset");
CREATE INDEX IF NOT EXISTS "realized_trade_pnl_closed_at_idx" ON "realized_trade_pnl" ("closed_at");
CREATE INDEX IF NOT EXISTS "realized_trade_pnl_confirmed_idx" ON "realized_trade_pnl" ("confirmed", "closed_at");

-- =============================================================================
-- Daily APY snapshots for time-series performance tracking
-- =============================================================================

CREATE TABLE IF NOT EXISTS "apy_daily_snapshots" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "snapshot_date" date NOT NULL,
  "sleeve_id" text NOT NULL,
  "strategy_id" text NOT NULL,
  "total_capital_usd" text NOT NULL,
  "deployed_capital_usd" text NOT NULL,
  "idle_capital_usd" text NOT NULL,
  "daily_pnl_usd" text NOT NULL,
  "daily_return_pct" text NOT NULL,
  "cumulative_pnl_usd" text NOT NULL,
  "cumulative_return_pct" text NOT NULL,
  "realized_apy_7d" text,
  "realized_apy_30d" text,
  "realized_apy_lifetime" text,
  "trades_closed_count" integer NOT NULL DEFAULT 0,
  "trades_winning_count" integer NOT NULL DEFAULT 0,
  "trades_losing_count" integer NOT NULL DEFAULT 0,
  "avg_trade_pnl_usd" text,
  "avg_holding_period_days" decimal,
  "funding_pnl_usd" text NOT NULL DEFAULT '0',
  "price_pnl_usd" text NOT NULL DEFAULT '0',
  "fee_cost_usd" text NOT NULL DEFAULT '0',
  "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  UNIQUE ("snapshot_date", "sleeve_id")
);

CREATE INDEX IF NOT EXISTS "apy_daily_snapshots_date_idx" ON "apy_daily_snapshots" ("snapshot_date");
CREATE INDEX IF NOT EXISTS "apy_daily_snapshots_sleeve_id_idx" ON "apy_daily_snapshots" ("sleeve_id");
CREATE INDEX IF NOT EXISTS "apy_daily_snapshots_strategy_id_idx" ON "apy_daily_snapshots" ("strategy_id");
CREATE INDEX IF NOT EXISTS "apy_daily_snapshots_date_sleeve_idx" ON "apy_daily_snapshots" ("snapshot_date", "sleeve_id");

-- =============================================================================
-- Current APY state (projection table)
-- =============================================================================

CREATE TABLE IF NOT EXISTS "apy_current" (
  "id" text PRIMARY KEY,
  "sleeve_id" text NOT NULL,
  "strategy_id" text NOT NULL,
  "latest_snapshot_id" uuid REFERENCES "apy_daily_snapshots"("id"),
  "latest_snapshot_date" date,
  "realized_apy_7d" text,
  "realized_apy_30d" text,
  "realized_apy_lifetime" text,
  "target_apy_pct" text NOT NULL,
  "projected_apy_pct" text,
  "target_met" boolean,
  "target_gap_pct" text,
  "total_trades_closed" integer NOT NULL DEFAULT 0,
  "total_pnl_usd" text NOT NULL DEFAULT '0',
  "total_funding_pnl_usd" text NOT NULL DEFAULT '0',
  "total_fees_usd" text NOT NULL DEFAULT '0',
  "avg_trade_pnl_usd" text,
  "win_rate_pct" text,
  "first_trade_at" timestamptz,
  "calculation_basis" text NOT NULL DEFAULT 'insufficient_data',
  "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "apy_current_sleeve_id_idx" ON "apy_current" ("sleeve_id");
CREATE INDEX IF NOT EXISTS "apy_current_strategy_id_idx" ON "apy_current" ("strategy_id");

-- =============================================================================
-- Strategy performance summary (for quick API responses)
-- =============================================================================

CREATE TABLE IF NOT EXISTS "strategy_performance_summary" (
  "id" text PRIMARY KEY,
  "strategy_id" text NOT NULL,
  "sleeve_id" text NOT NULL,
  "period_1d" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "period_7d" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "period_30d" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "period_90d" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "period_lifetime" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "current_apy" text,
  "target_apy" text NOT NULL,
  "target_status" text NOT NULL DEFAULT 'unknown',
  "last_updated_at" timestamptz NOT NULL DEFAULT now(),
  "last_trade_at" timestamptz,
  "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS "strategy_performance_summary_strategy_id_idx" ON "strategy_performance_summary" ("strategy_id");
CREATE INDEX IF NOT EXISTS "strategy_performance_summary_sleeve_id_idx" ON "strategy_performance_summary" ("sleeve_id");

-- =============================================================================
-- Open position PnL (unrealized, for current portfolio view)
-- =============================================================================

CREATE TABLE IF NOT EXISTS "open_position_pnl" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "position_id" text NOT NULL UNIQUE,
  "sleeve_id" text NOT NULL,
  "venue_id" text NOT NULL,
  "asset" text NOT NULL,
  "side" text NOT NULL,
  "instrument_type" text NOT NULL DEFAULT 'perpetual',
  "entry_price" text NOT NULL,
  "current_price" text NOT NULL,
  "size" text NOT NULL,
  "notional_usd" text NOT NULL,
  "unrealized_pnl" text NOT NULL,
  "unrealized_pnl_pct" text NOT NULL,
  "funding_pnl" text NOT NULL DEFAULT '0',
  "fee_cost" text NOT NULL DEFAULT '0',
  "net_unrealized_pnl" text NOT NULL,
  "opened_at" timestamptz NOT NULL,
  "holding_period_days" decimal NOT NULL,
  "projected_annual_funding" text,
  "projected_apy" text,
  "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "created_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "open_position_pnl_position_id_idx" ON "open_position_pnl" ("position_id");
CREATE INDEX IF NOT EXISTS "open_position_pnl_sleeve_id_idx" ON "open_position_pnl" ("sleeve_id");
CREATE INDEX IF NOT EXISTS "open_position_pnl_asset_idx" ON "open_position_pnl" ("asset");

-- =============================================================================
-- Triggers for updated_at
-- =============================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $func$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$func$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_realized_trade_pnl_updated_at ON "realized_trade_pnl";
CREATE TRIGGER update_realized_trade_pnl_updated_at
  BEFORE UPDATE ON "realized_trade_pnl"
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_apy_daily_snapshots_updated_at ON "apy_daily_snapshots";
CREATE TRIGGER update_apy_daily_snapshots_updated_at
  BEFORE UPDATE ON "apy_daily_snapshots"
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_apy_current_updated_at ON "apy_current";
CREATE TRIGGER update_apy_current_updated_at
  BEFORE UPDATE ON "apy_current"
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_strategy_performance_summary_updated_at ON "strategy_performance_summary";
CREATE TRIGGER update_strategy_performance_summary_updated_at
  BEFORE UPDATE ON "strategy_performance_summary"
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_open_position_pnl_updated_at ON "open_position_pnl";
CREATE TRIGGER update_open_position_pnl_updated_at
  BEFORE UPDATE ON "open_position_pnl"
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
