CREATE TABLE "vault_current" (
  "id" text PRIMARY KEY,
  "vault_name" text NOT NULL,
  "strategy_id" text NOT NULL,
  "strategy_name" text NOT NULL,
  "manager_name" text,
  "manager_wallet_address" text,
  "base_asset" text NOT NULL,
  "lock_period_months" integer NOT NULL,
  "rolling" boolean NOT NULL DEFAULT true,
  "reassessment_cadence_months" integer NOT NULL,
  "target_apy_floor_pct" text NOT NULL,
  "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX "vault_current_strategy_id_idx"
  ON "vault_current" ("strategy_id");
CREATE INDEX "vault_current_updated_at_idx"
  ON "vault_current" ("updated_at");

CREATE TABLE "vault_depositors" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "investor_id" text NOT NULL,
  "display_name" text NOT NULL,
  "wallet_address" text NOT NULL,
  "status" text NOT NULL DEFAULT 'active',
  "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX "vault_depositors_investor_id_idx"
  ON "vault_depositors" ("investor_id");
CREATE INDEX "vault_depositors_wallet_address_idx"
  ON "vault_depositors" ("wallet_address");
CREATE INDEX "vault_depositors_status_idx"
  ON "vault_depositors" ("status");

CREATE TABLE "vault_deposit_lots" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "vault_id" text NOT NULL REFERENCES "vault_current"("id"),
  "depositor_id" uuid NOT NULL REFERENCES "vault_depositors"("id"),
  "asset" text NOT NULL,
  "deposited_amount" text NOT NULL,
  "minted_shares" text NOT NULL,
  "share_price" text NOT NULL,
  "deposited_at" timestamptz NOT NULL,
  "lock_expires_at" timestamptz NOT NULL,
  "redeemed_at" timestamptz,
  "status" text NOT NULL DEFAULT 'active',
  "note" text,
  "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX "vault_deposit_lots_vault_id_idx"
  ON "vault_deposit_lots" ("vault_id");
CREATE INDEX "vault_deposit_lots_depositor_id_idx"
  ON "vault_deposit_lots" ("depositor_id");
CREATE INDEX "vault_deposit_lots_status_idx"
  ON "vault_deposit_lots" ("status");
CREATE INDEX "vault_deposit_lots_deposited_at_idx"
  ON "vault_deposit_lots" ("deposited_at");
CREATE INDEX "vault_deposit_lots_lock_expires_at_idx"
  ON "vault_deposit_lots" ("lock_expires_at");

CREATE TABLE "vault_redemption_requests" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "vault_id" text NOT NULL REFERENCES "vault_current"("id"),
  "depositor_id" uuid NOT NULL REFERENCES "vault_depositors"("id"),
  "requested_shares" text NOT NULL,
  "estimated_assets" text NOT NULL,
  "share_price" text NOT NULL,
  "requested_at" timestamptz NOT NULL,
  "eligible_at" timestamptz NOT NULL,
  "fulfilled_at" timestamptz,
  "status" text NOT NULL,
  "note" text,
  "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX "vault_redemption_requests_vault_id_idx"
  ON "vault_redemption_requests" ("vault_id");
CREATE INDEX "vault_redemption_requests_depositor_id_idx"
  ON "vault_redemption_requests" ("depositor_id");
CREATE INDEX "vault_redemption_requests_status_idx"
  ON "vault_redemption_requests" ("status");
CREATE INDEX "vault_redemption_requests_requested_at_idx"
  ON "vault_redemption_requests" ("requested_at");
CREATE INDEX "vault_redemption_requests_eligible_at_idx"
  ON "vault_redemption_requests" ("eligible_at");
