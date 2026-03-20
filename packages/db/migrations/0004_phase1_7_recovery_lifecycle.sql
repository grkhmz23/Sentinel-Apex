ALTER TABLE runtime_mismatches
  ADD COLUMN IF NOT EXISTS recovery_started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS recovery_started_by TEXT,
  ADD COLUMN IF NOT EXISTS recovery_summary TEXT,
  ADD COLUMN IF NOT EXISTS linked_command_id TEXT,
  ADD COLUMN IF NOT EXISTS linked_recovery_event_id TEXT,
  ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS verified_by TEXT,
  ADD COLUMN IF NOT EXISTS verification_summary TEXT,
  ADD COLUMN IF NOT EXISTS verification_outcome TEXT,
  ADD COLUMN IF NOT EXISTS reopened_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reopened_by TEXT,
  ADD COLUMN IF NOT EXISTS reopen_summary TEXT,
  ADD COLUMN IF NOT EXISTS last_status_change_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

UPDATE runtime_mismatches
SET last_status_change_at = COALESCE(
  verified_at,
  resolved_at,
  recovery_started_at,
  acknowledged_at,
  last_detected_at,
  created_at,
  NOW()
)
WHERE last_status_change_at IS NULL;
