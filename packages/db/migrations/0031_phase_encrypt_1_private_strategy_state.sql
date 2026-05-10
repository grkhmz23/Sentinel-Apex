CREATE TABLE IF NOT EXISTS encrypted_strategy_states (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  state_id text NOT NULL UNIQUE,
  strategy_id text NOT NULL,
  vault_asset_symbol text NOT NULL,
  vault_asset_mint text NOT NULL,
  encrypt_enabled boolean NOT NULL DEFAULT false,
  encrypt_cluster text NOT NULL,
  pre_alpha_mode boolean NOT NULL DEFAULT true,
  production_privacy_ready boolean NOT NULL DEFAULT false,
  real_encryption boolean NOT NULL DEFAULT false,
  adapter_mode text NOT NULL,
  strategy_commitment text NOT NULL,
  ciphertext_refs jsonb NOT NULL DEFAULT '{}',
  ciphertext_status text NOT NULL,
  public_risk_status text NOT NULL,
  public_summary jsonb NOT NULL DEFAULT '{}',
  audit_evidence jsonb NOT NULL DEFAULT '{}',
  created_by text,
  updated_by text,
  last_update_slot text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS encrypted_strategy_states_strategy_id_idx
  ON encrypted_strategy_states (strategy_id);
CREATE INDEX IF NOT EXISTS encrypted_strategy_states_updated_at_idx
  ON encrypted_strategy_states (updated_at);

CREATE TABLE IF NOT EXISTS encrypted_strategy_reveal_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id text NOT NULL UNIQUE,
  strategy_state_id text NOT NULL,
  requested_by text NOT NULL,
  reason text NOT NULL,
  status text NOT NULL DEFAULT 'reveal_requested',
  audit_evidence jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS encrypted_strategy_reveal_requests_state_idx
  ON encrypted_strategy_reveal_requests (strategy_state_id);
CREATE INDEX IF NOT EXISTS encrypted_strategy_reveal_requests_created_at_idx
  ON encrypted_strategy_reveal_requests (created_at);

CREATE TABLE IF NOT EXISTS encrypted_strategy_audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id text NOT NULL UNIQUE,
  strategy_state_id text,
  event_type text NOT NULL,
  actor_id text NOT NULL,
  evidence jsonb NOT NULL DEFAULT '{}',
  occurred_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS encrypted_strategy_audit_events_state_idx
  ON encrypted_strategy_audit_events (strategy_state_id);
CREATE INDEX IF NOT EXISTS encrypted_strategy_audit_events_occurred_at_idx
  ON encrypted_strategy_audit_events (occurred_at);
