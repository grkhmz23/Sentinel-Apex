-- =============================================================================
-- Migration: 0028_performance_reports.sql
-- Purpose: Performance report persistence for submission dossier
-- Phase: R3 Part 5 - Submission Dossier, Evidence Pipeline, and Performance Reporting
-- =============================================================================

-- =============================================================================
-- Performance Reports Table
-- Stores generated performance reports for submission/evidence
-- =============================================================================

CREATE TABLE IF NOT EXISTS "performance_reports" (
  "id" text PRIMARY KEY,
  "report_name" text NOT NULL,
  "status" text NOT NULL DEFAULT 'pending',
  "format" text NOT NULL DEFAULT 'json',
  "date_range_start" timestamptz NOT NULL,
  "date_range_end" timestamptz NOT NULL,
  "generated_at" timestamptz NOT NULL DEFAULT now(),
  "generated_by" text,
  "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "summary" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "multi_leg_summary" jsonb,
  "content" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "content_markdown" text,
  "download_url" text,
  "expires_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "performance_reports_status_idx" ON "performance_reports" ("status");
CREATE INDEX IF NOT EXISTS "performance_reports_generated_at_idx" ON "performance_reports" ("generated_at" DESC);
CREATE INDEX IF NOT EXISTS "performance_reports_date_range_idx" ON "performance_reports" ("date_range_start", "date_range_end");

-- =============================================================================
-- Multi-Leg Evidence Summary View (materialized)
-- Pre-computed aggregations for submission evidence
-- =============================================================================

CREATE TABLE IF NOT EXISTS "multi_leg_evidence_summary" (
  "id" text PRIMARY KEY,
  "plan_id" text NOT NULL,
  "carry_action_id" text NOT NULL,
  "submission_dossier_id" text,
  "asset" text NOT NULL,
  "notional_usd" text NOT NULL,
  "leg_count" integer NOT NULL,
  "status" text NOT NULL,
  "hedge_deviation_pct" text,
  "is_within_tolerance" boolean,
  "executed_at" timestamptz,
  "completed_at" timestamptz,
  "evidence_label" text,
  "evidence_status" text NOT NULL DEFAULT 'pending',
  "notes" text,
  "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  UNIQUE("plan_id", "submission_dossier_id")
);

CREATE INDEX IF NOT EXISTS "multi_leg_evidence_summary_plan_id_idx" ON "multi_leg_evidence_summary" ("plan_id");
CREATE INDEX IF NOT EXISTS "multi_leg_evidence_summary_action_id_idx" ON "multi_leg_evidence_summary" ("carry_action_id");
CREATE INDEX IF NOT EXISTS "multi_leg_evidence_summary_dossier_id_idx" ON "multi_leg_evidence_summary" ("submission_dossier_id");
CREATE INDEX IF NOT EXISTS "multi_leg_evidence_summary_status_idx" ON "multi_leg_evidence_summary" ("evidence_status");

-- =============================================================================
-- Submission Evidence Categories (reference table)
-- Tracks completeness requirements by category
-- =============================================================================

CREATE TABLE IF NOT EXISTS "submission_evidence_categories" (
  "id" text PRIMARY KEY,
  "category" text NOT NULL UNIQUE,
  "display_name" text NOT NULL,
  "description" text,
  "required_for_track" text NOT NULL DEFAULT 'any',
  "completeness_weight" decimal(5,4) NOT NULL DEFAULT 0.1,
  "sort_order" integer NOT NULL DEFAULT 0,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

-- Seed reference data
INSERT INTO "submission_evidence_categories" ("id", "category", "display_name", "description", "required_for_track", "completeness_weight", "sort_order")
VALUES
  ('cat_vault', 'vault_identity', 'Vault Identity', 'On-chain vault address and verification', 'any', 0.15, 1),
  ('cat_strategy', 'strategy_config', 'Strategy Configuration', 'Strategy parameters and eligibility', 'any', 0.10, 2),
  ('cat_execution', 'execution_evidence', 'Execution Evidence', 'Real execution records with references', 'any', 0.25, 3),
  ('cat_multileg', 'multi_leg_evidence', 'Multi-Leg Evidence', 'Delta-neutral multi-leg execution proof', 'any', 0.15, 4),
  ('cat_performance', 'performance_metrics', 'Performance Metrics', 'PnL, APY, and performance evidence', 'any', 0.20, 5),
  ('cat_cex', 'cex_verification', 'CEX Verification', 'CEX trade history and read-only API', 'any', 0.10, 6),
  ('cat_risk', 'risk_posture', 'Risk/Guardrail Posture', 'Risk configuration and violation history', 'any', 0.05, 7)
ON CONFLICT ("id") DO NOTHING;

-- =============================================================================
-- Submission Evidence Items (reference table)
-- Specific items required within each category
-- =============================================================================

CREATE TABLE IF NOT EXISTS "submission_evidence_items" (
  "id" text PRIMARY KEY,
  "category_id" text NOT NULL REFERENCES "submission_evidence_categories"("id"),
  "item_key" text NOT NULL,
  "display_name" text NOT NULL,
  "description" text,
  "required" boolean NOT NULL DEFAULT true,
  "evidence_type" text,
  "sort_order" integer NOT NULL DEFAULT 0,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  UNIQUE("category_id", "item_key")
);

-- Seed reference data
INSERT INTO "submission_evidence_items" ("id", "category_id", "item_key", "display_name", "description", "required", "evidence_type", "sort_order")
VALUES
  -- Vault Identity
  ('item_vault_addr', 'cat_vault', 'vault_address', 'Vault Address', 'Verified vault on-chain address', true, 'on_chain', 1),
  ('item_wallet_addr', 'cat_vault', 'wallet_address', 'Wallet Address', 'Manager wallet address', true, 'on_chain', 2),
  ('item_depositors', 'cat_vault', 'depositor_count', 'Depositor Count', 'Number of depositors', false, 'vault_state', 3),
  
  -- Strategy
  ('item_strategy_id', 'cat_strategy', 'strategy_id', 'Strategy ID', 'Registered strategy identifier', true, 'strategy_config', 1),
  ('item_eligibility', 'cat_strategy', 'eligibility_status', 'Eligibility Status', 'Strategy eligibility check', true, 'strategy_config', 2),
  ('item_env', 'cat_strategy', 'environment', 'Execution Environment', 'devnet/mainnet/simulated', true, 'strategy_config', 3),
  
  -- Execution
  ('item_real_exec', 'cat_execution', 'real_executions', 'Real Executions', 'Non-simulated execution records', true, 'execution_record', 1),
  ('item_exec_refs', 'cat_execution', 'execution_references', 'On-Chain References', 'Transaction signatures', true, 'on_chain', 2),
  
  -- Multi-Leg
  ('item_ml_plans', 'cat_multileg', 'multi_leg_plans', 'Multi-Leg Plans', 'Delta-neutral plan records', false, 'multi_leg_plan', 1),
  ('item_hedge_state', 'cat_multileg', 'hedge_deviation', 'Hedge Deviation', 'Hedge state tracking', false, 'hedge_state', 2),
  
  -- Performance
  ('item_apy', 'cat_performance', 'realized_apy', 'Realized APY', 'Actual APY achieved', true, 'performance_metric', 1),
  ('item_pnl', 'cat_performance', 'realized_pnl', 'Realized PnL', 'Actual profit/loss', false, 'performance_metric', 2),
  ('item_report', 'cat_performance', 'performance_report', 'Performance Report', 'Generated performance report', false, 'performance_report', 3),
  
  -- CEX
  ('item_cex_hist', 'cat_cex', 'trade_history', 'Trade History', 'CEX trade history export', false, 'cex_trade_history', 1),
  ('item_cex_api', 'cat_cex', 'read_only_api', 'Read-Only API', 'CEX read-only API key', false, 'cex_read_only_api', 2),
  
  -- Risk
  ('item_kill_switch', 'cat_risk', 'kill_switch', 'Kill Switch', 'Emergency stop capability', false, 'guardrail_config', 1),
  ('item_guardrails', 'cat_risk', 'guardrail_violations', 'Guardrail Compliance', 'Violation history', false, 'guardrail_violation', 2)
ON CONFLICT ("id") DO NOTHING;
