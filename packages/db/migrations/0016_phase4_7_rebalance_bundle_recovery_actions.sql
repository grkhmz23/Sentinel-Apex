CREATE TABLE "allocator_rebalance_bundle_recovery_actions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "bundle_id" uuid NOT NULL REFERENCES "allocator_rebalance_bundles"("id"),
  "proposal_id" uuid NOT NULL REFERENCES "allocator_rebalance_proposals"("id"),
  "recovery_action_type" text NOT NULL,
  "target_child_type" text NOT NULL,
  "target_child_id" text NOT NULL,
  "target_child_status" text NOT NULL,
  "target_child_summary" text NOT NULL,
  "eligibility_state" text NOT NULL DEFAULT 'blocked',
  "blocked_reasons" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "approval_requirement" text NOT NULL DEFAULT 'operator',
  "status" text NOT NULL DEFAULT 'requested',
  "requested_by" text NOT NULL,
  "note" text,
  "linked_command_id" text,
  "target_command_type" text,
  "linked_carry_action_id" uuid,
  "linked_treasury_action_id" uuid,
  "outcome_summary" text,
  "outcome" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "last_error" text,
  "execution_mode" text NOT NULL DEFAULT 'dry-run',
  "simulated" boolean NOT NULL DEFAULT true,
  "requested_at" timestamp with time zone NOT NULL DEFAULT now(),
  "queued_at" timestamp with time zone,
  "started_at" timestamp with time zone,
  "completed_at" timestamp with time zone,
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX "allocator_rebalance_bundle_recovery_actions_bundle_id_idx"
  ON "allocator_rebalance_bundle_recovery_actions" ("bundle_id");
CREATE INDEX "allocator_rebalance_bundle_recovery_actions_proposal_id_idx"
  ON "allocator_rebalance_bundle_recovery_actions" ("proposal_id");
CREATE INDEX "allocator_rebalance_bundle_recovery_actions_status_idx"
  ON "allocator_rebalance_bundle_recovery_actions" ("status");
CREATE INDEX "allocator_rebalance_bundle_recovery_actions_target_child_idx"
  ON "allocator_rebalance_bundle_recovery_actions" ("target_child_type", "target_child_id");
CREATE INDEX "allocator_rebalance_bundle_recovery_actions_requested_at_idx"
  ON "allocator_rebalance_bundle_recovery_actions" ("requested_at");
CREATE INDEX "allocator_rebalance_bundle_recovery_actions_linked_command_id_idx"
  ON "allocator_rebalance_bundle_recovery_actions" ("linked_command_id");
