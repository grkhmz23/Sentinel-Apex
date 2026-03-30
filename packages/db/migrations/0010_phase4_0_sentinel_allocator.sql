CREATE TABLE allocator_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  allocator_run_id TEXT NOT NULL UNIQUE,
  source_run_id TEXT REFERENCES strategy_runs(run_id),
  trigger TEXT NOT NULL,
  triggered_by TEXT,
  regime_state TEXT NOT NULL,
  pressure_level TEXT NOT NULL,
  total_capital_usd TEXT NOT NULL,
  reserve_constrained_capital_usd TEXT NOT NULL,
  allocatable_capital_usd TEXT NOT NULL,
  input_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  policy_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  rationale JSONB NOT NULL DEFAULT '[]'::jsonb,
  constraints JSONB NOT NULL DEFAULT '[]'::jsonb,
  summary JSONB NOT NULL DEFAULT '{}'::jsonb,
  recommendation_count INTEGER NOT NULL DEFAULT 0,
  evaluated_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX allocator_runs_allocator_run_id_idx ON allocator_runs (allocator_run_id);
CREATE INDEX allocator_runs_source_run_id_idx ON allocator_runs (source_run_id);
CREATE INDEX allocator_runs_trigger_idx ON allocator_runs (trigger);
CREATE INDEX allocator_runs_evaluated_at_idx ON allocator_runs (evaluated_at);

CREATE TABLE allocator_sleeve_targets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  allocator_run_id TEXT NOT NULL REFERENCES allocator_runs(allocator_run_id),
  sleeve_id TEXT NOT NULL,
  sleeve_kind TEXT NOT NULL,
  sleeve_name TEXT NOT NULL,
  status TEXT NOT NULL,
  throttle_state TEXT NOT NULL,
  current_allocation_usd TEXT NOT NULL,
  current_allocation_pct TEXT NOT NULL,
  target_allocation_usd TEXT NOT NULL,
  target_allocation_pct TEXT NOT NULL,
  min_allocation_pct TEXT NOT NULL,
  max_allocation_pct TEXT NOT NULL,
  delta_usd TEXT NOT NULL,
  opportunity_score TEXT,
  capacity_usd TEXT,
  rationale JSONB NOT NULL DEFAULT '[]'::jsonb,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX allocator_sleeve_targets_allocator_run_id_idx ON allocator_sleeve_targets (allocator_run_id);
CREATE INDEX allocator_sleeve_targets_sleeve_id_idx ON allocator_sleeve_targets (sleeve_id);

CREATE TABLE allocator_recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  allocator_run_id TEXT NOT NULL REFERENCES allocator_runs(allocator_run_id),
  sleeve_id TEXT NOT NULL,
  recommendation_type TEXT NOT NULL,
  priority TEXT NOT NULL,
  summary TEXT NOT NULL,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  rationale JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX allocator_recommendations_allocator_run_id_idx ON allocator_recommendations (allocator_run_id);
CREATE INDEX allocator_recommendations_sleeve_id_idx ON allocator_recommendations (sleeve_id);
CREATE INDEX allocator_recommendations_priority_idx ON allocator_recommendations (priority);

CREATE TABLE allocator_current (
  id TEXT PRIMARY KEY,
  latest_allocator_run_id TEXT NOT NULL REFERENCES allocator_runs(allocator_run_id),
  summary JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
