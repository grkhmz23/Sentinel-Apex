-- =============================================================================
-- CREATE OPERATOR - Run this in Neon SQL Editor
-- =============================================================================
-- This creates the operator account for dashboard login
-- =============================================================================

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
)
VALUES (
    gen_random_uuid(),
    'operator-1',
    'gorkhmazb23@gmail.com',
    'Operator',
    'scrypt$16384$8$1$437dcac54bba2a7602419cdb76e800d0e8b658f61bb495da4311d640e565dfea$8e3956d5a08666e3fcd510f7237835af44ae35b8d26b5189479e8046165d024667248d9926a7b39dac4be35e95507b1270b563db22b729fb0f5cc6909e02f5fb',
    'operator',
    true,
    NOW(),
    NOW()
)
ON CONFLICT (email) DO UPDATE SET
    password_hash = EXCLUDED.password_hash,
    active = true,
    updated_at = NOW();

-- Verify the operator was created
SELECT 
    operator_id,
    email,
    display_name,
    role,
    active,
    created_at
FROM ops_operators 
WHERE email = 'gorkhmazb23@gmail.com';
