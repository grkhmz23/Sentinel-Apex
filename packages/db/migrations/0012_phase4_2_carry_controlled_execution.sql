CREATE TABLE carry_venue_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  strategy_run_id TEXT NOT NULL REFERENCES strategy_runs(run_id),
  venue_id TEXT NOT NULL,
  venue_mode TEXT NOT NULL DEFAULT 'simulated',
  execution_supported BOOLEAN NOT NULL DEFAULT FALSE,
  supports_increase_exposure BOOLEAN NOT NULL DEFAULT FALSE,
  supports_reduce_exposure BOOLEAN NOT NULL DEFAULT FALSE,
  read_only BOOLEAN NOT NULL DEFAULT FALSE,
  approved_for_live_use BOOLEAN NOT NULL DEFAULT FALSE,
  healthy BOOLEAN NOT NULL DEFAULT TRUE,
  onboarding_state TEXT NOT NULL DEFAULT 'simulated',
  missing_prerequisites JSONB NOT NULL DEFAULT '[]'::jsonb,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX carry_venue_snapshots_strategy_run_id_idx ON carry_venue_snapshots(strategy_run_id);
CREATE INDEX carry_venue_snapshots_venue_id_idx ON carry_venue_snapshots(venue_id);

CREATE TABLE carry_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  strategy_run_id TEXT REFERENCES strategy_runs(run_id),
  linked_rebalance_proposal_id UUID,
  action_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'recommended',
  source_kind TEXT NOT NULL,
  source_reference TEXT,
  opportunity_id TEXT,
  asset TEXT,
  summary TEXT NOT NULL,
  notional_usd TEXT NOT NULL,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  readiness TEXT NOT NULL DEFAULT 'blocked',
  executable BOOLEAN NOT NULL DEFAULT FALSE,
  blocked_reasons JSONB NOT NULL DEFAULT '[]'::jsonb,
  approval_requirement TEXT NOT NULL DEFAULT 'operator',
  execution_mode TEXT NOT NULL DEFAULT 'dry-run',
  simulated BOOLEAN NOT NULL DEFAULT TRUE,
  execution_plan JSONB NOT NULL DEFAULT '{}'::jsonb,
  approved_by TEXT,
  approved_at TIMESTAMPTZ,
  execution_requested_by TEXT,
  execution_requested_at TIMESTAMPTZ,
  queued_at TIMESTAMPTZ,
  executing_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  linked_command_id TEXT,
  latest_execution_id TEXT,
  last_error TEXT,
  actor_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX carry_actions_strategy_run_id_idx ON carry_actions(strategy_run_id);
CREATE INDEX carry_actions_rebalance_proposal_id_idx ON carry_actions(linked_rebalance_proposal_id);
CREATE INDEX carry_actions_status_idx ON carry_actions(status);
CREATE INDEX carry_actions_created_at_idx ON carry_actions(created_at);

CREATE TABLE carry_action_order_intents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  carry_action_id UUID NOT NULL REFERENCES carry_actions(id),
  intent_id TEXT NOT NULL,
  venue_id TEXT NOT NULL,
  asset TEXT NOT NULL,
  side TEXT NOT NULL,
  order_type TEXT NOT NULL,
  requested_size TEXT NOT NULL,
  requested_price TEXT,
  reduce_only BOOLEAN NOT NULL DEFAULT FALSE,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX carry_action_order_intents_action_id_idx ON carry_action_order_intents(carry_action_id);
CREATE INDEX carry_action_order_intents_intent_id_idx ON carry_action_order_intents(intent_id);

CREATE TABLE carry_action_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  carry_action_id UUID NOT NULL REFERENCES carry_actions(id),
  strategy_run_id TEXT REFERENCES strategy_runs(run_id),
  command_id TEXT,
  status TEXT NOT NULL,
  execution_mode TEXT NOT NULL,
  simulated BOOLEAN NOT NULL DEFAULT TRUE,
  requested_by TEXT NOT NULL,
  started_by TEXT,
  blocked_reasons JSONB NOT NULL DEFAULT '[]'::jsonb,
  outcome_summary TEXT,
  outcome JSONB NOT NULL DEFAULT '{}'::jsonb,
  venue_execution_reference TEXT,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX carry_action_executions_action_id_idx ON carry_action_executions(carry_action_id);
CREATE INDEX carry_action_executions_strategy_run_id_idx ON carry_action_executions(strategy_run_id);
CREATE INDEX carry_action_executions_status_idx ON carry_action_executions(status);
