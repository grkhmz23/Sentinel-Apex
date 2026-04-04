CREATE TABLE "venue_connector_promotions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "venue_id" text NOT NULL,
  "venue_name" text NOT NULL,
  "connector_type" text NOT NULL,
  "requested_target_posture" text NOT NULL,
  "capability_class" text NOT NULL,
  "promotion_status" text NOT NULL,
  "effective_posture" text NOT NULL,
  "approved_for_live_use" boolean NOT NULL DEFAULT false,
  "sensitive_execution_eligible" boolean NOT NULL DEFAULT false,
  "readiness_evidence" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "missing_prerequisites_snapshot" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "blockers_snapshot" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "last_truth_snapshot_at" timestamptz,
  "last_successful_truth_snapshot_at" timestamptz,
  "snapshot_freshness" text,
  "snapshot_completeness" text,
  "health_state" text,
  "degraded_reason" text,
  "requested_by" text NOT NULL,
  "requested_at" timestamptz NOT NULL,
  "reviewed_by" text,
  "reviewed_at" timestamptz,
  "approved_by" text,
  "approved_at" timestamptz,
  "rejected_by" text,
  "rejected_at" timestamptz,
  "suspended_by" text,
  "suspended_at" timestamptz,
  "decision_note" text,
  "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX "venue_connector_promotions_venue_id_idx"
  ON "venue_connector_promotions" ("venue_id");
CREATE INDEX "venue_connector_promotions_connector_type_idx"
  ON "venue_connector_promotions" ("connector_type");
CREATE INDEX "venue_connector_promotions_status_idx"
  ON "venue_connector_promotions" ("promotion_status");
CREATE INDEX "venue_connector_promotions_requested_at_idx"
  ON "venue_connector_promotions" ("requested_at");
CREATE INDEX "venue_connector_promotions_updated_at_idx"
  ON "venue_connector_promotions" ("updated_at");

CREATE TABLE "venue_connector_promotion_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "promotion_id" uuid NOT NULL REFERENCES "venue_connector_promotions"("id"),
  "venue_id" text NOT NULL,
  "event_type" text NOT NULL,
  "from_status" text,
  "to_status" text NOT NULL,
  "effective_posture" text NOT NULL,
  "requested_target_posture" text NOT NULL,
  "actor_id" text NOT NULL,
  "note" text,
  "readiness_evidence" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "missing_prerequisites_snapshot" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "blockers_snapshot" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "occurred_at" timestamptz NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX "venue_connector_promotion_events_promotion_id_idx"
  ON "venue_connector_promotion_events" ("promotion_id");
CREATE INDEX "venue_connector_promotion_events_venue_id_idx"
  ON "venue_connector_promotion_events" ("venue_id");
CREATE INDEX "venue_connector_promotion_events_event_type_idx"
  ON "venue_connector_promotion_events" ("event_type");
CREATE INDEX "venue_connector_promotion_events_occurred_at_idx"
  ON "venue_connector_promotion_events" ("occurred_at");
