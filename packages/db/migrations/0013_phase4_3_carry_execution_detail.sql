CREATE TABLE carry_execution_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  carry_execution_id UUID NOT NULL REFERENCES carry_action_executions(id),
  carry_action_id UUID NOT NULL REFERENCES carry_actions(id),
  strategy_run_id TEXT REFERENCES strategy_runs(run_id),
  planned_order_id UUID REFERENCES carry_action_order_intents(id),
  intent_id TEXT NOT NULL,
  venue_id TEXT NOT NULL,
  venue_mode TEXT NOT NULL DEFAULT 'simulated',
  execution_supported BOOLEAN NOT NULL DEFAULT FALSE,
  read_only BOOLEAN NOT NULL DEFAULT FALSE,
  approved_for_live_use BOOLEAN NOT NULL DEFAULT FALSE,
  onboarding_state TEXT NOT NULL DEFAULT 'simulated',
  asset TEXT NOT NULL,
  side TEXT NOT NULL,
  order_type TEXT NOT NULL,
  requested_size TEXT NOT NULL,
  requested_price TEXT,
  reduce_only BOOLEAN NOT NULL DEFAULT FALSE,
  client_order_id TEXT,
  venue_order_id TEXT,
  execution_reference TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  simulated BOOLEAN NOT NULL DEFAULT TRUE,
  filled_size TEXT,
  average_fill_price TEXT,
  outcome_summary TEXT,
  outcome JSONB NOT NULL DEFAULT '{}'::jsonb,
  last_error TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX carry_execution_steps_execution_id_idx ON carry_execution_steps(carry_execution_id);
CREATE INDEX carry_execution_steps_action_id_idx ON carry_execution_steps(carry_action_id);
CREATE INDEX carry_execution_steps_strategy_run_id_idx ON carry_execution_steps(strategy_run_id);
CREATE INDEX carry_execution_steps_planned_order_id_idx ON carry_execution_steps(planned_order_id);
CREATE INDEX carry_execution_steps_intent_id_idx ON carry_execution_steps(intent_id);
CREATE INDEX carry_execution_steps_status_idx ON carry_execution_steps(status);
