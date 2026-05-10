ALTER TABLE vault_current
  ADD COLUMN IF NOT EXISTS base_asset_mint text,
  ADD COLUMN IF NOT EXISTS base_asset_decimals integer;

CREATE TABLE IF NOT EXISTS pusd_vault_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_id text NOT NULL UNIQUE,
  source_run_id text REFERENCES strategy_runs (run_id),
  base_asset_symbol text NOT NULL,
  base_asset_mint text NOT NULL,
  base_asset_decimals integer NOT NULL,
  vault_owner_address text,
  balance_raw text NOT NULL,
  balance_amount text NOT NULL,
  nav_amount text NOT NULL,
  treasury_state jsonb NOT NULL DEFAULT '{}',
  risk_status text NOT NULL,
  read_status text NOT NULL,
  read_error text,
  captured_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS pusd_vault_snapshots_source_run_id_idx
  ON pusd_vault_snapshots (source_run_id);
CREATE INDEX IF NOT EXISTS pusd_vault_snapshots_captured_at_idx
  ON pusd_vault_snapshots (captured_at);

CREATE TABLE IF NOT EXISTS pusd_operator_intents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  intent_id text NOT NULL UNIQUE,
  intent_type text NOT NULL,
  asset text NOT NULL,
  amount text NOT NULL,
  status text NOT NULL DEFAULT 'requested',
  requested_by text NOT NULL,
  reason text,
  payload jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS pusd_operator_intents_type_idx
  ON pusd_operator_intents (intent_type);
CREATE INDEX IF NOT EXISTS pusd_operator_intents_status_idx
  ON pusd_operator_intents (status);
CREATE INDEX IF NOT EXISTS pusd_operator_intents_created_at_idx
  ON pusd_operator_intents (created_at);
