ALTER TABLE allocator_rebalance_bundles
  ADD COLUMN resolution_state text NOT NULL DEFAULT 'unresolved',
  ADD COLUMN latest_resolution_action_id uuid,
  ADD COLUMN resolution_summary text,
  ADD COLUMN resolved_by text,
  ADD COLUMN resolved_at timestamptz;

CREATE INDEX allocator_rebalance_bundles_resolution_state_idx
  ON allocator_rebalance_bundles (resolution_state);

CREATE TABLE allocator_rebalance_bundle_resolution_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bundle_id uuid NOT NULL REFERENCES allocator_rebalance_bundles (id),
  proposal_id uuid NOT NULL REFERENCES allocator_rebalance_proposals (id),
  resolution_action_type text NOT NULL,
  status text NOT NULL DEFAULT 'completed',
  resolution_state text NOT NULL DEFAULT 'unresolved',
  note text NOT NULL,
  acknowledged_partial_application boolean NOT NULL DEFAULT false,
  escalated boolean NOT NULL DEFAULT false,
  affected_child_summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  linked_recovery_action_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  blocked_reasons jsonb NOT NULL DEFAULT '[]'::jsonb,
  outcome_summary text,
  requested_by text NOT NULL,
  completed_by text,
  requested_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX allocator_rebalance_bundle_resolution_actions_bundle_id_idx
  ON allocator_rebalance_bundle_resolution_actions (bundle_id);

CREATE INDEX allocator_rebalance_bundle_resolution_actions_proposal_id_idx
  ON allocator_rebalance_bundle_resolution_actions (proposal_id);

CREATE INDEX allocator_rebalance_bundle_resolution_actions_resolution_state_idx
  ON allocator_rebalance_bundle_resolution_actions (resolution_state);

CREATE INDEX allocator_rebalance_bundle_resolution_actions_status_idx
  ON allocator_rebalance_bundle_resolution_actions (status);

CREATE INDEX allocator_rebalance_bundle_resolution_actions_requested_at_idx
  ON allocator_rebalance_bundle_resolution_actions (requested_at);
