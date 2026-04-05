-- =============================================================================
-- Bootstrap Operator - Run this in your Neon SQL Editor
-- =============================================================================
-- This creates the operator account for gorkhmazb23@gmail.com
-- Password: Leon070124!!
-- =============================================================================

-- Check if table exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'ops_operators') THEN
        RAISE EXCEPTION 'ops_operators table does not exist. Run migrations first: pnpm db:migrate';
    END IF;
END $$;

-- Insert or update operator
INSERT INTO ops_operators (
    id,
    operator_id,
    email,
    display_name,
    password_hash,
    role,
    active,
    created_at,
    updated_at
) VALUES (
    gen_random_uuid(),
    'operator-1',
    'gorkhmazb23@gmail.com',
    'Operator',
    'scrypt$16384$8$1$c2d06f2270a964c3750247a54afaccb2f0f82696956ab08dfd0d39cb8a1c9201$157610ee5f2b9670ca37c12e03fa46fa213055fa18563ad187b2271269ff7bff3d80f6725eb0ff3fbc198ecb064fa2d0b511201633e5e5272a3d0b8044fefc80',
    'operator',
    true,
    NOW(),
    NOW()
)
ON CONFLICT (email) DO UPDATE SET
    password_hash = EXCLUDED.password_hash,
    active = true,
    updated_at = NOW();

-- Verify
SELECT 
    operator_id,
    email,
    display_name,
    role,
    active,
    created_at
FROM ops_operators 
WHERE email = 'gorkhmazb23@gmail.com';
