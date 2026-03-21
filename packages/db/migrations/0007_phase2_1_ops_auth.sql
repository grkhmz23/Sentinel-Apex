CREATE TABLE IF NOT EXISTS ops_operators (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  operator_id text NOT NULL UNIQUE,
  email text NOT NULL UNIQUE,
  display_name text NOT NULL,
  role text NOT NULL,
  password_hash text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  last_authenticated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ops_operators_operator_id_idx ON ops_operators (operator_id);
CREATE INDEX IF NOT EXISTS ops_operators_email_idx ON ops_operators (email);
CREATE INDEX IF NOT EXISTS ops_operators_role_idx ON ops_operators (role);
CREATE INDEX IF NOT EXISTS ops_operators_active_idx ON ops_operators (active);

CREATE TABLE IF NOT EXISTS ops_operator_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id text NOT NULL UNIQUE,
  operator_id text NOT NULL REFERENCES ops_operators (operator_id),
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ops_operator_sessions_session_id_idx ON ops_operator_sessions (session_id);
CREATE INDEX IF NOT EXISTS ops_operator_sessions_operator_id_idx ON ops_operator_sessions (operator_id);
CREATE INDEX IF NOT EXISTS ops_operator_sessions_token_hash_idx ON ops_operator_sessions (token_hash);
CREATE INDEX IF NOT EXISTS ops_operator_sessions_expires_at_idx ON ops_operator_sessions (expires_at);
