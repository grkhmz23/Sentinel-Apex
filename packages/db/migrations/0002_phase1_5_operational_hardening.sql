CREATE TABLE IF NOT EXISTS portfolio_current (
  id TEXT PRIMARY KEY,
  source_snapshot_at TIMESTAMPTZ NOT NULL,
  total_nav TEXT NOT NULL,
  gross_exposure TEXT NOT NULL,
  net_exposure TEXT NOT NULL,
  liquidity_reserve TEXT NOT NULL,
  open_position_count TEXT NOT NULL DEFAULT '0',
  daily_pnl TEXT NOT NULL,
  cumulative_pnl TEXT NOT NULL,
  sleeve_allocations JSONB NOT NULL,
  venue_exposures JSONB NOT NULL DEFAULT '{}'::jsonb,
  asset_exposures JSONB NOT NULL DEFAULT '{}'::jsonb,
  risk_metrics JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS risk_current (
  id TEXT PRIMARY KEY,
  source_run_id TEXT NOT NULL REFERENCES strategy_runs (run_id),
  sleeve_id TEXT NOT NULL,
  summary JSONB NOT NULL,
  approved_intent_count INTEGER NOT NULL DEFAULT 0,
  rejected_intent_count INTEGER NOT NULL DEFAULT 0,
  open_circuit_breakers JSONB NOT NULL DEFAULT '[]'::jsonb,
  captured_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE runtime_state
  ADD COLUMN IF NOT EXISTS lifecycle_state TEXT NOT NULL DEFAULT 'starting';

ALTER TABLE runtime_state
  ADD COLUMN IF NOT EXISTS projection_status TEXT NOT NULL DEFAULT 'stale';

ALTER TABLE runtime_state
  ADD COLUMN IF NOT EXISTS last_successful_run_id TEXT;

ALTER TABLE runtime_state
  ADD COLUMN IF NOT EXISTS last_cycle_started_at TIMESTAMPTZ;

ALTER TABLE runtime_state
  ADD COLUMN IF NOT EXISTS last_cycle_completed_at TIMESTAMPTZ;

ALTER TABLE runtime_state
  ADD COLUMN IF NOT EXISTS last_projection_rebuild_at TIMESTAMPTZ;

ALTER TABLE runtime_state
  ADD COLUMN IF NOT EXISTS last_projection_source_run_id TEXT;

ALTER TABLE runtime_state
  ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ;

ALTER TABLE runtime_state
  ADD COLUMN IF NOT EXISTS ready_at TIMESTAMPTZ;

ALTER TABLE runtime_state
  ADD COLUMN IF NOT EXISTS stopped_at TIMESTAMPTZ;
