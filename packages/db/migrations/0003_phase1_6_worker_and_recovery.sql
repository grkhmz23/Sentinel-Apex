ALTER TABLE portfolio_snapshots
  ADD COLUMN IF NOT EXISTS source_run_id TEXT;

ALTER TABLE portfolio_current
  ADD COLUMN IF NOT EXISTS source_run_id TEXT;

ALTER TABLE runtime_state
  ADD COLUMN IF NOT EXISTS risk_limits JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE TABLE IF NOT EXISTS runtime_worker_state (
  id TEXT PRIMARY KEY,
  worker_id TEXT NOT NULL,
  lifecycle_state TEXT NOT NULL DEFAULT 'stopped',
  scheduler_state TEXT NOT NULL DEFAULT 'idle',
  current_operation TEXT,
  current_command_id TEXT,
  current_run_id TEXT,
  cycle_interval_ms INTEGER NOT NULL DEFAULT 60000,
  process_id INTEGER,
  hostname TEXT,
  last_heartbeat_at TIMESTAMPTZ,
  last_started_at TIMESTAMPTZ,
  last_stopped_at TIMESTAMPTZ,
  last_run_started_at TIMESTAMPTZ,
  last_run_completed_at TIMESTAMPTZ,
  last_success_at TIMESTAMPTZ,
  last_failure_at TIMESTAMPTZ,
  last_failure_reason TEXT,
  next_scheduled_run_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS runtime_commands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  command_id TEXT NOT NULL UNIQUE,
  command_type TEXT NOT NULL,
  status TEXT NOT NULL,
  requested_by TEXT NOT NULL,
  claimed_by TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  result JSONB NOT NULL DEFAULT '{}'::jsonb,
  error_message TEXT,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS runtime_commands_command_id_idx ON runtime_commands (command_id);
CREATE INDEX IF NOT EXISTS runtime_commands_status_idx ON runtime_commands (status);
CREATE INDEX IF NOT EXISTS runtime_commands_requested_at_idx ON runtime_commands (requested_at);

CREATE TABLE IF NOT EXISTS runtime_mismatches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dedupe_key TEXT NOT NULL UNIQUE,
  category TEXT NOT NULL,
  severity TEXT NOT NULL,
  source_component TEXT NOT NULL,
  entity_type TEXT,
  entity_id TEXT,
  summary TEXT NOT NULL,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'open',
  first_detected_at TIMESTAMPTZ NOT NULL,
  last_detected_at TIMESTAMPTZ NOT NULL,
  occurrence_count INTEGER NOT NULL DEFAULT 1,
  acknowledged_at TIMESTAMPTZ,
  acknowledged_by TEXT,
  resolved_at TIMESTAMPTZ,
  resolved_by TEXT,
  resolution_summary TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS runtime_mismatches_dedupe_key_idx ON runtime_mismatches (dedupe_key);
CREATE INDEX IF NOT EXISTS runtime_mismatches_status_idx ON runtime_mismatches (status);
CREATE INDEX IF NOT EXISTS runtime_mismatches_category_idx ON runtime_mismatches (category);
CREATE INDEX IF NOT EXISTS runtime_mismatches_last_detected_at_idx ON runtime_mismatches (last_detected_at);

CREATE TABLE IF NOT EXISTS runtime_recovery_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mismatch_id UUID REFERENCES runtime_mismatches (id),
  command_id TEXT,
  run_id TEXT REFERENCES strategy_runs (run_id),
  event_type TEXT NOT NULL,
  status TEXT NOT NULL,
  source_component TEXT NOT NULL,
  actor_id TEXT,
  message TEXT NOT NULL,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS runtime_recovery_events_mismatch_id_idx
  ON runtime_recovery_events (mismatch_id);
CREATE INDEX IF NOT EXISTS runtime_recovery_events_command_id_idx
  ON runtime_recovery_events (command_id);
CREATE INDEX IF NOT EXISTS runtime_recovery_events_occurred_at_idx
  ON runtime_recovery_events (occurred_at);
