CREATE TABLE "internal_derivative_snapshots" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "venue_id" text NOT NULL,
  "venue_name" text NOT NULL,
  "source_component" text NOT NULL,
  "source_run_id" text,
  "source_reference" text,
  "account_state" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "position_state" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "health_state" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "order_state" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "coverage" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "captured_at" timestamptz NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX "internal_derivative_snapshots_venue_id_idx"
  ON "internal_derivative_snapshots" ("venue_id");
CREATE INDEX "internal_derivative_snapshots_source_run_id_idx"
  ON "internal_derivative_snapshots" ("source_run_id");
CREATE INDEX "internal_derivative_snapshots_captured_at_idx"
  ON "internal_derivative_snapshots" ("captured_at");

CREATE TABLE "internal_derivative_current" (
  "venue_id" text PRIMARY KEY,
  "venue_name" text NOT NULL,
  "latest_snapshot_id" uuid REFERENCES "internal_derivative_snapshots"("id"),
  "source_component" text NOT NULL,
  "source_run_id" text,
  "source_reference" text,
  "account_state" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "position_state" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "health_state" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "order_state" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "coverage" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "captured_at" timestamptz NOT NULL,
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX "internal_derivative_current_latest_snapshot_id_idx"
  ON "internal_derivative_current" ("latest_snapshot_id");
CREATE INDEX "internal_derivative_current_source_run_id_idx"
  ON "internal_derivative_current" ("source_run_id");
CREATE INDEX "internal_derivative_current_captured_at_idx"
  ON "internal_derivative_current" ("captured_at");
