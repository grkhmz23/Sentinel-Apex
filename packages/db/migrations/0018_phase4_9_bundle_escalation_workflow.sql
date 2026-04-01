ALTER TABLE "allocator_rebalance_bundles"
  ADD COLUMN "latest_escalation_id" uuid,
  ADD COLUMN "escalation_status" text,
  ADD COLUMN "escalation_owner_id" text,
  ADD COLUMN "escalation_assigned_at" timestamptz,
  ADD COLUMN "escalation_due_at" timestamptz,
  ADD COLUMN "escalation_summary" text;

CREATE INDEX "allocator_rebalance_bundles_escalation_status_idx"
  ON "allocator_rebalance_bundles" ("escalation_status");

CREATE TABLE "allocator_rebalance_bundle_escalations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "bundle_id" uuid NOT NULL REFERENCES "allocator_rebalance_bundles" ("id"),
  "proposal_id" uuid NOT NULL REFERENCES "allocator_rebalance_proposals" ("id"),
  "source_resolution_action_id" uuid,
  "status" text NOT NULL DEFAULT 'open',
  "owner_id" text,
  "assigned_by" text,
  "assigned_at" timestamptz,
  "acknowledged_by" text,
  "acknowledged_at" timestamptz,
  "due_at" timestamptz,
  "handoff_note" text,
  "review_note" text,
  "resolution_note" text,
  "closed_by" text,
  "closed_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX "allocator_rebalance_bundle_escalations_bundle_id_idx"
  ON "allocator_rebalance_bundle_escalations" ("bundle_id");
CREATE INDEX "allocator_rebalance_bundle_escalations_proposal_id_idx"
  ON "allocator_rebalance_bundle_escalations" ("proposal_id");
CREATE INDEX "allocator_rebalance_bundle_escalations_status_idx"
  ON "allocator_rebalance_bundle_escalations" ("status");
CREATE INDEX "allocator_rebalance_bundle_escalations_created_at_idx"
  ON "allocator_rebalance_bundle_escalations" ("created_at");

CREATE TABLE "allocator_rebalance_bundle_escalation_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "escalation_id" uuid NOT NULL REFERENCES "allocator_rebalance_bundle_escalations" ("id"),
  "bundle_id" uuid NOT NULL REFERENCES "allocator_rebalance_bundles" ("id"),
  "proposal_id" uuid NOT NULL REFERENCES "allocator_rebalance_proposals" ("id"),
  "event_type" text NOT NULL,
  "from_status" text,
  "to_status" text NOT NULL,
  "actor_id" text NOT NULL,
  "owner_id" text,
  "note" text,
  "due_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX "allocator_rebalance_bundle_escalation_events_escalation_id_idx"
  ON "allocator_rebalance_bundle_escalation_events" ("escalation_id");
CREATE INDEX "allocator_rebalance_bundle_escalation_events_bundle_id_idx"
  ON "allocator_rebalance_bundle_escalation_events" ("bundle_id");
CREATE INDEX "allocator_rebalance_bundle_escalation_events_proposal_id_idx"
  ON "allocator_rebalance_bundle_escalation_events" ("proposal_id");
CREATE INDEX "allocator_rebalance_bundle_escalation_events_created_at_idx"
  ON "allocator_rebalance_bundle_escalation_events" ("created_at");
