ALTER TABLE treasury_actions
ADD COLUMN linked_rebalance_proposal_id uuid;

CREATE INDEX treasury_actions_rebalance_proposal_id_idx
  ON treasury_actions (linked_rebalance_proposal_id);
