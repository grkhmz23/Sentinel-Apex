CREATE TABLE "venue_connector_snapshots" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "venue_id" text NOT NULL,
  "venue_name" text NOT NULL,
  "connector_type" text NOT NULL,
  "sleeve_applicability" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "truth_mode" text NOT NULL,
  "read_only_support" boolean NOT NULL DEFAULT false,
  "execution_support" boolean NOT NULL DEFAULT false,
  "approved_for_live_use" boolean NOT NULL DEFAULT false,
  "onboarding_state" text NOT NULL DEFAULT 'simulated',
  "missing_prerequisites" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "auth_requirements_summary" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "healthy" boolean NOT NULL DEFAULT true,
  "health_state" text NOT NULL DEFAULT 'healthy',
  "degraded_reason" text,
  "snapshot_type" text NOT NULL,
  "snapshot_successful" boolean NOT NULL DEFAULT true,
  "snapshot_summary" text NOT NULL,
  "snapshot_payload" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "error_message" text,
  "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "captured_at" timestamptz NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX "venue_connector_snapshots_venue_id_idx"
  ON "venue_connector_snapshots" ("venue_id");
CREATE INDEX "venue_connector_snapshots_connector_type_idx"
  ON "venue_connector_snapshots" ("connector_type");
CREATE INDEX "venue_connector_snapshots_truth_mode_idx"
  ON "venue_connector_snapshots" ("truth_mode");
CREATE INDEX "venue_connector_snapshots_health_state_idx"
  ON "venue_connector_snapshots" ("health_state");
CREATE INDEX "venue_connector_snapshots_captured_at_idx"
  ON "venue_connector_snapshots" ("captured_at");
