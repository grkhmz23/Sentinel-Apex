ALTER TABLE runtime_mismatches
  ADD COLUMN IF NOT EXISTS source_kind TEXT NOT NULL DEFAULT 'workflow';

CREATE TABLE IF NOT EXISTS runtime_reconciliation_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_type TEXT NOT NULL,
  trigger TEXT NOT NULL,
  trigger_reference TEXT,
  source_component TEXT NOT NULL,
  triggered_by TEXT,
  status TEXT NOT NULL,
  finding_count INTEGER NOT NULL DEFAULT 0,
  linked_mismatch_count INTEGER NOT NULL DEFAULT 0,
  summary JSONB NOT NULL DEFAULT '{}'::jsonb,
  error_message TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS runtime_reconciliation_runs_run_type_idx
  ON runtime_reconciliation_runs (run_type);
CREATE INDEX IF NOT EXISTS runtime_reconciliation_runs_trigger_idx
  ON runtime_reconciliation_runs (trigger);
CREATE INDEX IF NOT EXISTS runtime_reconciliation_runs_status_idx
  ON runtime_reconciliation_runs (status);
CREATE INDEX IF NOT EXISTS runtime_reconciliation_runs_started_at_idx
  ON runtime_reconciliation_runs (started_at);

CREATE TABLE IF NOT EXISTS runtime_reconciliation_findings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reconciliation_run_id UUID NOT NULL REFERENCES runtime_reconciliation_runs (id),
  dedupe_key TEXT NOT NULL,
  finding_type TEXT NOT NULL,
  severity TEXT NOT NULL,
  status TEXT NOT NULL,
  source_component TEXT NOT NULL,
  subsystem TEXT NOT NULL,
  venue_id TEXT,
  entity_type TEXT,
  entity_id TEXT,
  mismatch_id UUID REFERENCES runtime_mismatches (id),
  summary TEXT NOT NULL,
  expected_state JSONB NOT NULL DEFAULT '{}'::jsonb,
  actual_state JSONB NOT NULL DEFAULT '{}'::jsonb,
  delta JSONB NOT NULL DEFAULT '{}'::jsonb,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  detected_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS runtime_reconciliation_findings_run_id_idx
  ON runtime_reconciliation_findings (reconciliation_run_id);
CREATE INDEX IF NOT EXISTS runtime_reconciliation_findings_dedupe_key_idx
  ON runtime_reconciliation_findings (dedupe_key);
CREATE INDEX IF NOT EXISTS runtime_reconciliation_findings_finding_type_idx
  ON runtime_reconciliation_findings (finding_type);
CREATE INDEX IF NOT EXISTS runtime_reconciliation_findings_severity_idx
  ON runtime_reconciliation_findings (severity);
CREATE INDEX IF NOT EXISTS runtime_reconciliation_findings_status_idx
  ON runtime_reconciliation_findings (status);
CREATE INDEX IF NOT EXISTS runtime_reconciliation_findings_mismatch_id_idx
  ON runtime_reconciliation_findings (mismatch_id);
CREATE INDEX IF NOT EXISTS runtime_reconciliation_findings_detected_at_idx
  ON runtime_reconciliation_findings (detected_at);
