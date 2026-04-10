-- Neon SQL editor script
-- Purpose: apply Phase 1 optimizer evaluation persistence manually
-- Safe to run more than once

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS "strategy_opportunity_evaluations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "opportunity_id" text NOT NULL UNIQUE REFERENCES "strategy_opportunities"("opportunity_id"),
  "run_id" text NOT NULL REFERENCES "strategy_runs"("run_id"),
  "sleeve_id" text NOT NULL,
  "asset" text NOT NULL,
  "approved" boolean NOT NULL,
  "evaluation_stage" text,
  "evaluation_reason" text,
  "portfolio_score" text,
  "portfolio_score_breakdown" jsonb,
  "optimizer_rationale" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "planned_notional_usd" text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "strategy_opp_evals_opportunity_id_idx"
  ON "strategy_opportunity_evaluations" ("opportunity_id");

CREATE INDEX IF NOT EXISTS "strategy_opp_evals_run_id_idx"
  ON "strategy_opportunity_evaluations" ("run_id");

CREATE INDEX IF NOT EXISTS "strategy_opp_evals_sleeve_id_idx"
  ON "strategy_opportunity_evaluations" ("sleeve_id");

CREATE INDEX IF NOT EXISTS "strategy_opp_evals_approved_idx"
  ON "strategy_opportunity_evaluations" ("approved");

CREATE INDEX IF NOT EXISTS "strategy_opp_evals_created_at_idx"
  ON "strategy_opportunity_evaluations" ("created_at" DESC);

CREATE TABLE IF NOT EXISTS "schema_migrations" (
  "filename" text PRIMARY KEY,
  "applied_at" timestamptz NOT NULL DEFAULT now()
);

INSERT INTO "schema_migrations" ("filename")
VALUES ('0029_strategy_opportunity_evaluations.sql')
ON CONFLICT ("filename") DO NOTHING;

COMMIT;
