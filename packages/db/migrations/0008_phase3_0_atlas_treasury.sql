CREATE TABLE IF NOT EXISTS treasury_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  treasury_run_id text NOT NULL UNIQUE,
  source_run_id text REFERENCES strategy_runs (run_id),
  sleeve_id text NOT NULL,
  simulated boolean NOT NULL DEFAULT true,
  policy jsonb NOT NULL,
  summary jsonb NOT NULL,
  total_capital_usd text NOT NULL,
  idle_capital_usd text NOT NULL,
  allocated_capital_usd text NOT NULL,
  required_reserve_usd text NOT NULL,
  available_reserve_usd text NOT NULL,
  reserve_shortfall_usd text NOT NULL,
  surplus_capital_usd text NOT NULL,
  concentration_limit_breached boolean NOT NULL DEFAULT false,
  action_count integer NOT NULL DEFAULT 0,
  evaluated_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS treasury_runs_treasury_run_id_idx ON treasury_runs (treasury_run_id);
CREATE INDEX IF NOT EXISTS treasury_runs_source_run_id_idx ON treasury_runs (source_run_id);
CREATE INDEX IF NOT EXISTS treasury_runs_evaluated_at_idx ON treasury_runs (evaluated_at);

CREATE TABLE IF NOT EXISTS treasury_venue_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  treasury_run_id text NOT NULL REFERENCES treasury_runs (treasury_run_id),
  venue_id text NOT NULL,
  venue_name text NOT NULL,
  venue_mode text NOT NULL,
  liquidity_tier text NOT NULL,
  healthy boolean NOT NULL DEFAULT true,
  apr_bps integer NOT NULL,
  current_allocation_usd text NOT NULL,
  withdrawal_available_usd text NOT NULL,
  available_capacity_usd text NOT NULL,
  concentration_pct text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS treasury_venue_snapshots_treasury_run_id_idx ON treasury_venue_snapshots (treasury_run_id);
CREATE INDEX IF NOT EXISTS treasury_venue_snapshots_venue_id_idx ON treasury_venue_snapshots (venue_id);

CREATE TABLE IF NOT EXISTS treasury_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  treasury_run_id text NOT NULL REFERENCES treasury_runs (treasury_run_id),
  action_type text NOT NULL,
  status text NOT NULL DEFAULT 'recommended',
  venue_id text,
  amount_usd text NOT NULL,
  reason_code text NOT NULL,
  summary text NOT NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  actor_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS treasury_actions_treasury_run_id_idx ON treasury_actions (treasury_run_id);
CREATE INDEX IF NOT EXISTS treasury_actions_venue_id_idx ON treasury_actions (venue_id);
CREATE INDEX IF NOT EXISTS treasury_actions_created_at_idx ON treasury_actions (created_at);

CREATE TABLE IF NOT EXISTS treasury_current (
  id text PRIMARY KEY,
  latest_treasury_run_id text NOT NULL REFERENCES treasury_runs (treasury_run_id),
  policy jsonb NOT NULL,
  summary jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
