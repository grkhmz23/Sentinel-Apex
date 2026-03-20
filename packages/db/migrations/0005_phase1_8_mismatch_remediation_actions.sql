CREATE TABLE IF NOT EXISTS runtime_mismatch_remediations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mismatch_id UUID NOT NULL REFERENCES runtime_mismatches (id),
  attempt_sequence INTEGER NOT NULL,
  remediation_type TEXT NOT NULL,
  command_id TEXT NOT NULL REFERENCES runtime_commands (command_id),
  status TEXT NOT NULL,
  requested_by TEXT NOT NULL,
  requested_summary TEXT,
  outcome_summary TEXT,
  latest_recovery_event_id UUID,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS runtime_mismatch_remediations_mismatch_id_idx
  ON runtime_mismatch_remediations (mismatch_id);
CREATE INDEX IF NOT EXISTS runtime_mismatch_remediations_command_id_idx
  ON runtime_mismatch_remediations (command_id);
CREATE INDEX IF NOT EXISTS runtime_mismatch_remediations_status_idx
  ON runtime_mismatch_remediations (status);
CREATE INDEX IF NOT EXISTS runtime_mismatch_remediations_requested_at_idx
  ON runtime_mismatch_remediations (requested_at);
