CREATE TABLE allocator_rebalance_proposals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  allocator_run_id TEXT NOT NULL REFERENCES allocator_runs(allocator_run_id),
  action_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'proposed',
  summary TEXT NOT NULL,
  execution_mode TEXT NOT NULL DEFAULT 'dry-run',
  simulated BOOLEAN NOT NULL DEFAULT TRUE,
  executable BOOLEAN NOT NULL DEFAULT FALSE,
  approval_requirement TEXT NOT NULL DEFAULT 'operator',
  rationale JSONB NOT NULL DEFAULT '[]'::jsonb,
  blocked_reasons JSONB NOT NULL DEFAULT '[]'::jsonb,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  approved_by TEXT,
  approved_at TIMESTAMPTZ,
  rejected_by TEXT,
  rejected_at TIMESTAMPTZ,
  rejection_reason TEXT,
  linked_command_id TEXT,
  latest_execution_id UUID,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX allocator_rebalance_proposals_allocator_run_id_idx
  ON allocator_rebalance_proposals (allocator_run_id);
CREATE INDEX allocator_rebalance_proposals_status_idx
  ON allocator_rebalance_proposals (status);
CREATE INDEX allocator_rebalance_proposals_created_at_idx
  ON allocator_rebalance_proposals (created_at);

CREATE TABLE allocator_rebalance_proposal_intents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id UUID NOT NULL REFERENCES allocator_rebalance_proposals(id),
  sleeve_id TEXT NOT NULL,
  source_sleeve_id TEXT,
  target_sleeve_id TEXT,
  action_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'proposed',
  readiness TEXT NOT NULL DEFAULT 'blocked',
  executable BOOLEAN NOT NULL DEFAULT FALSE,
  current_allocation_usd TEXT NOT NULL,
  current_allocation_pct TEXT NOT NULL,
  target_allocation_usd TEXT NOT NULL,
  target_allocation_pct TEXT NOT NULL,
  delta_usd TEXT NOT NULL,
  rationale JSONB NOT NULL DEFAULT '[]'::jsonb,
  blocked_reasons JSONB NOT NULL DEFAULT '[]'::jsonb,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX allocator_rebalance_proposal_intents_proposal_id_idx
  ON allocator_rebalance_proposal_intents (proposal_id);
CREATE INDEX allocator_rebalance_proposal_intents_sleeve_id_idx
  ON allocator_rebalance_proposal_intents (sleeve_id);
CREATE INDEX allocator_rebalance_proposal_intents_action_type_idx
  ON allocator_rebalance_proposal_intents (action_type);

CREATE TABLE allocator_rebalance_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id UUID NOT NULL REFERENCES allocator_rebalance_proposals(id),
  command_id TEXT,
  status TEXT NOT NULL,
  execution_mode TEXT NOT NULL,
  simulated BOOLEAN NOT NULL DEFAULT TRUE,
  requested_by TEXT NOT NULL,
  started_by TEXT,
  outcome_summary TEXT,
  outcome JSONB NOT NULL DEFAULT '{}'::jsonb,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX allocator_rebalance_executions_proposal_id_idx
  ON allocator_rebalance_executions (proposal_id);
CREATE INDEX allocator_rebalance_executions_command_id_idx
  ON allocator_rebalance_executions (command_id);
CREATE INDEX allocator_rebalance_executions_status_idx
  ON allocator_rebalance_executions (status);

CREATE TABLE allocator_rebalance_current (
  id TEXT PRIMARY KEY,
  latest_proposal_id UUID REFERENCES allocator_rebalance_proposals(id),
  allocator_run_id TEXT NOT NULL REFERENCES allocator_runs(allocator_run_id),
  carry_target_allocation_usd TEXT NOT NULL,
  carry_target_allocation_pct TEXT NOT NULL,
  treasury_target_allocation_usd TEXT NOT NULL,
  treasury_target_allocation_pct TEXT NOT NULL,
  applied_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
