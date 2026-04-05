CREATE TABLE "vault_submission_profiles" (
  "id" text PRIMARY KEY,
  "submission_name" text NOT NULL,
  "track" text NOT NULL,
  "vault_id" text NOT NULL REFERENCES "vault_current"("id"),
  "strategy_id" text NOT NULL,
  "build_window_start" timestamptz NOT NULL,
  "build_window_end" timestamptz NOT NULL,
  "cluster" text NOT NULL DEFAULT 'unknown',
  "wallet_address" text,
  "vault_address" text,
  "cex_execution_used" boolean NOT NULL DEFAULT false,
  "cex_venues" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "cex_trade_history_provided" boolean NOT NULL DEFAULT false,
  "cex_read_only_api_key_provided" boolean NOT NULL DEFAULT false,
  "notes" text,
  "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX "vault_submission_profiles_track_idx"
  ON "vault_submission_profiles" ("track");
CREATE INDEX "vault_submission_profiles_vault_id_idx"
  ON "vault_submission_profiles" ("vault_id");
CREATE INDEX "vault_submission_profiles_strategy_id_idx"
  ON "vault_submission_profiles" ("strategy_id");
CREATE INDEX "vault_submission_profiles_updated_at_idx"
  ON "vault_submission_profiles" ("updated_at");
