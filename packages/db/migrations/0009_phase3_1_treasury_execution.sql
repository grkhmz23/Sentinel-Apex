ALTER TABLE treasury_actions
  ADD COLUMN IF NOT EXISTS venue_name text,
  ADD COLUMN IF NOT EXISTS venue_mode text NOT NULL DEFAULT 'simulated',
  ADD COLUMN IF NOT EXISTS readiness text NOT NULL DEFAULT 'blocked',
  ADD COLUMN IF NOT EXISTS executable boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS blocked_reasons jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS approval_requirement text NOT NULL DEFAULT 'operator',
  ADD COLUMN IF NOT EXISTS execution_mode text NOT NULL DEFAULT 'dry-run',
  ADD COLUMN IF NOT EXISTS simulated boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS execution_plan jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS approved_by text,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS execution_requested_by text,
  ADD COLUMN IF NOT EXISTS execution_requested_at timestamptz,
  ADD COLUMN IF NOT EXISTS queued_at timestamptz,
  ADD COLUMN IF NOT EXISTS executing_at timestamptz,
  ADD COLUMN IF NOT EXISTS completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS failed_at timestamptz,
  ADD COLUMN IF NOT EXISTS cancelled_at timestamptz,
  ADD COLUMN IF NOT EXISTS linked_command_id text,
  ADD COLUMN IF NOT EXISTS latest_execution_id text,
  ADD COLUMN IF NOT EXISTS last_error text,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE treasury_current
  ADD COLUMN IF NOT EXISTS cash_balance_usd text NOT NULL DEFAULT '0';

CREATE INDEX IF NOT EXISTS treasury_actions_status_idx ON treasury_actions (status);

CREATE TABLE IF NOT EXISTS treasury_action_executions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  treasury_action_id uuid NOT NULL REFERENCES treasury_actions (id),
  treasury_run_id text NOT NULL REFERENCES treasury_runs (treasury_run_id),
  command_id text,
  status text NOT NULL,
  execution_mode text NOT NULL,
  venue_mode text NOT NULL,
  simulated boolean NOT NULL DEFAULT true,
  requested_by text NOT NULL,
  started_by text,
  blocked_reasons jsonb NOT NULL DEFAULT '[]'::jsonb,
  outcome_summary text,
  outcome jsonb NOT NULL DEFAULT '{}'::jsonb,
  venue_execution_reference text,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS treasury_action_executions_action_id_idx
  ON treasury_action_executions (treasury_action_id);
CREATE INDEX IF NOT EXISTS treasury_action_executions_run_id_idx
  ON treasury_action_executions (treasury_run_id);
CREATE INDEX IF NOT EXISTS treasury_action_executions_command_id_idx
  ON treasury_action_executions (command_id);
CREATE INDEX IF NOT EXISTS treasury_action_executions_status_idx
  ON treasury_action_executions (status);
CREATE INDEX IF NOT EXISTS treasury_action_executions_created_at_idx
  ON treasury_action_executions (created_at);
