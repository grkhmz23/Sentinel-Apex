CREATE TABLE "allocator_rebalance_bundles" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "proposal_id" uuid NOT NULL UNIQUE REFERENCES "allocator_rebalance_proposals"("id"),
  "status" text NOT NULL DEFAULT 'proposed',
  "completion_state" text NOT NULL DEFAULT 'open',
  "outcome_classification" text NOT NULL DEFAULT 'pending',
  "intervention_recommendation" text NOT NULL DEFAULT 'operator_review_required',
  "total_child_count" integer NOT NULL DEFAULT 0,
  "blocked_child_count" integer NOT NULL DEFAULT 0,
  "failed_child_count" integer NOT NULL DEFAULT 0,
  "completed_child_count" integer NOT NULL DEFAULT 0,
  "pending_child_count" integer NOT NULL DEFAULT 0,
  "child_rollup" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "finalization_reason" text,
  "finalized_at" timestamp with time zone,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX "allocator_rebalance_bundles_proposal_id_idx"
  ON "allocator_rebalance_bundles" ("proposal_id");
CREATE INDEX "allocator_rebalance_bundles_status_idx"
  ON "allocator_rebalance_bundles" ("status");
CREATE INDEX "allocator_rebalance_bundles_created_at_idx"
  ON "allocator_rebalance_bundles" ("created_at");
