CREATE TABLE IF NOT EXISTS audit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id TEXT NOT NULL UNIQUE,
  event_type TEXT NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL,
  actor_type TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  sleeve_id TEXT,
  correlation_id TEXT,
  data JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS audit_events_event_type_idx ON audit_events (event_type);
CREATE INDEX IF NOT EXISTS audit_events_event_id_idx ON audit_events (event_id);
CREATE INDEX IF NOT EXISTS audit_events_occurred_at_idx ON audit_events (occurred_at);
CREATE INDEX IF NOT EXISTS audit_events_sleeve_id_idx ON audit_events (sleeve_id);
CREATE INDEX IF NOT EXISTS audit_events_correlation_id_idx ON audit_events (correlation_id);

CREATE TABLE IF NOT EXISTS strategy_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id TEXT NOT NULL UNIQUE,
  sleeve_id TEXT NOT NULL,
  execution_mode TEXT NOT NULL,
  trigger_source TEXT NOT NULL,
  status TEXT NOT NULL,
  opportunities_detected INTEGER NOT NULL DEFAULT 0,
  opportunities_approved INTEGER NOT NULL DEFAULT 0,
  intents_generated INTEGER NOT NULL DEFAULT 0,
  intents_approved INTEGER NOT NULL DEFAULT 0,
  intents_rejected INTEGER NOT NULL DEFAULT 0,
  intents_executed INTEGER NOT NULL DEFAULT 0,
  started_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ,
  error_message TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS strategy_runs_run_id_idx ON strategy_runs (run_id);
CREATE INDEX IF NOT EXISTS strategy_runs_sleeve_id_idx ON strategy_runs (sleeve_id);
CREATE INDEX IF NOT EXISTS strategy_runs_status_idx ON strategy_runs (status);
CREATE INDEX IF NOT EXISTS strategy_runs_started_at_idx ON strategy_runs (started_at);

CREATE TABLE IF NOT EXISTS strategy_opportunities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id TEXT NOT NULL UNIQUE,
  run_id TEXT NOT NULL REFERENCES strategy_runs (run_id),
  sleeve_id TEXT NOT NULL,
  asset TEXT NOT NULL,
  opportunity_type TEXT NOT NULL,
  expected_annual_yield_pct TEXT NOT NULL,
  net_yield_pct TEXT NOT NULL,
  confidence_score TEXT NOT NULL,
  detected_at TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  approved BOOLEAN NOT NULL,
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS strategy_opportunities_run_id_idx ON strategy_opportunities (run_id);
CREATE INDEX IF NOT EXISTS strategy_opportunities_sleeve_id_idx ON strategy_opportunities (sleeve_id);
CREATE INDEX IF NOT EXISTS strategy_opportunities_detected_at_idx ON strategy_opportunities (detected_at);

CREATE TABLE IF NOT EXISTS strategy_intents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  intent_id TEXT NOT NULL UNIQUE,
  run_id TEXT NOT NULL REFERENCES strategy_runs (run_id),
  opportunity_id TEXT NOT NULL REFERENCES strategy_opportunities (opportunity_id),
  sleeve_id TEXT NOT NULL,
  venue_id TEXT NOT NULL,
  asset TEXT NOT NULL,
  side TEXT NOT NULL,
  order_type TEXT NOT NULL,
  requested_size TEXT NOT NULL,
  requested_price TEXT,
  reduce_only BOOLEAN NOT NULL DEFAULT FALSE,
  position_size_usd TEXT,
  risk_status TEXT NOT NULL,
  approved BOOLEAN NOT NULL,
  execution_disposition TEXT NOT NULL,
  risk_assessment JSONB NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS strategy_intents_run_id_idx ON strategy_intents (run_id);
CREATE INDEX IF NOT EXISTS strategy_intents_opportunity_id_idx ON strategy_intents (opportunity_id);
CREATE INDEX IF NOT EXISTS strategy_intents_approved_idx ON strategy_intents (approved);
CREATE INDEX IF NOT EXISTS strategy_intents_created_at_idx ON strategy_intents (created_at);

CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_order_id TEXT NOT NULL UNIQUE,
  strategy_run_id TEXT REFERENCES strategy_runs (run_id),
  sleeve_id TEXT NOT NULL,
  opportunity_id TEXT,
  venue_id TEXT NOT NULL,
  venue_order_id TEXT,
  asset TEXT NOT NULL,
  side TEXT NOT NULL,
  order_type TEXT NOT NULL,
  execution_mode TEXT NOT NULL DEFAULT 'dry-run',
  reduce_only BOOLEAN NOT NULL DEFAULT FALSE,
  requested_size TEXT NOT NULL,
  requested_price TEXT,
  filled_size TEXT NOT NULL DEFAULT '0',
  average_fill_price TEXT,
  status TEXT NOT NULL,
  attempt_count INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  submitted_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS orders_client_order_id_idx ON orders (client_order_id);
CREATE INDEX IF NOT EXISTS orders_strategy_run_id_idx ON orders (strategy_run_id);
CREATE INDEX IF NOT EXISTS orders_status_idx ON orders (status);
CREATE INDEX IF NOT EXISTS orders_sleeve_id_idx ON orders (sleeve_id);
CREATE INDEX IF NOT EXISTS orders_venue_id_idx ON orders (venue_id);
CREATE INDEX IF NOT EXISTS orders_created_at_idx ON orders (created_at);

CREATE TABLE IF NOT EXISTS fills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders (id),
  client_order_id TEXT NOT NULL,
  venue_order_id TEXT NOT NULL,
  fill_id TEXT,
  size TEXT NOT NULL,
  price TEXT NOT NULL,
  fee TEXT NOT NULL,
  side TEXT NOT NULL,
  fee_asset TEXT,
  filled_at TIMESTAMPTZ NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS fills_order_id_idx ON fills (order_id);
CREATE INDEX IF NOT EXISTS fills_client_order_id_idx ON fills (client_order_id);

CREATE TABLE IF NOT EXISTS execution_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id TEXT NOT NULL UNIQUE,
  run_id TEXT NOT NULL REFERENCES strategy_runs (run_id),
  intent_id TEXT NOT NULL REFERENCES strategy_intents (intent_id),
  client_order_id TEXT,
  venue_order_id TEXT,
  event_type TEXT NOT NULL,
  status TEXT NOT NULL,
  payload JSONB NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS execution_events_run_id_idx ON execution_events (run_id);
CREATE INDEX IF NOT EXISTS execution_events_intent_id_idx ON execution_events (intent_id);
CREATE INDEX IF NOT EXISTS execution_events_occurred_at_idx ON execution_events (occurred_at);

CREATE TABLE IF NOT EXISTS positions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sleeve_id TEXT NOT NULL,
  venue_id TEXT NOT NULL,
  asset TEXT NOT NULL,
  side TEXT NOT NULL,
  size TEXT NOT NULL,
  entry_price TEXT NOT NULL,
  mark_price TEXT NOT NULL,
  unrealized_pnl TEXT NOT NULL DEFAULT '0',
  realized_pnl TEXT NOT NULL DEFAULT '0',
  funding_accrued TEXT NOT NULL DEFAULT '0',
  hedge_state TEXT NOT NULL DEFAULT 'unhedged',
  status TEXT NOT NULL,
  opened_at TIMESTAMPTZ NOT NULL,
  closed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS positions_sleeve_id_idx ON positions (sleeve_id);
CREATE INDEX IF NOT EXISTS positions_status_idx ON positions (status);
CREATE INDEX IF NOT EXISTS positions_venue_asset_idx ON positions (venue_id, asset);

CREATE TABLE IF NOT EXISTS risk_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id TEXT NOT NULL REFERENCES strategy_runs (run_id),
  sleeve_id TEXT NOT NULL,
  summary JSONB NOT NULL,
  approved_intent_count INTEGER NOT NULL DEFAULT 0,
  rejected_intent_count INTEGER NOT NULL DEFAULT 0,
  open_circuit_breakers JSONB NOT NULL DEFAULT '[]'::jsonb,
  captured_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS risk_snapshots_run_id_idx ON risk_snapshots (run_id);
CREATE INDEX IF NOT EXISTS risk_snapshots_sleeve_id_idx ON risk_snapshots (sleeve_id);
CREATE INDEX IF NOT EXISTS risk_snapshots_captured_at_idx ON risk_snapshots (captured_at);

CREATE TABLE IF NOT EXISTS portfolio_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_at TIMESTAMPTZ NOT NULL,
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
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS portfolio_snapshots_at_idx ON portfolio_snapshots (snapshot_at);

CREATE TABLE IF NOT EXISTS risk_breaches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  breach_type TEXT NOT NULL,
  severity TEXT NOT NULL,
  description TEXT NOT NULL,
  triggered_at TIMESTAMPTZ NOT NULL,
  resolved_at TIMESTAMPTZ,
  details JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS runtime_state (
  id TEXT PRIMARY KEY,
  execution_mode TEXT NOT NULL,
  live_execution_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  halted BOOLEAN NOT NULL DEFAULT FALSE,
  last_run_id TEXT,
  last_run_status TEXT,
  last_error TEXT,
  last_updated_by TEXT NOT NULL,
  reason TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
