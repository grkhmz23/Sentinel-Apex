-- =============================================================================
-- Migration: Ranger Vault Integration
-- Phase: R1 - Ranger Earn + Vault Foundation
-- =============================================================================

-- On-chain vault addresses for submission verification
CREATE TABLE IF NOT EXISTS vault_on_chain_addresses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vault_id TEXT NOT NULL REFERENCES vault_current(id),
    chain TEXT NOT NULL DEFAULT 'solana',
    vault_address TEXT NOT NULL,
    vault_program_id TEXT,
    share_token_mint TEXT,
    strategy_program_id TEXT,
    authority_address TEXT NOT NULL,
    creation_signature TEXT,
    creation_block_time TIMESTAMP WITH TIME ZONE,
    verification_status TEXT NOT NULL DEFAULT 'pending',
    verified_at TIMESTAMP WITH TIME ZONE,
    verification_notes TEXT,
    metadata JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS vault_on_chain_addresses_vault_id_idx 
    ON vault_on_chain_addresses(vault_id);
CREATE INDEX IF NOT EXISTS vault_on_chain_addresses_vault_address_idx 
    ON vault_on_chain_addresses(vault_address);
CREATE INDEX IF NOT EXISTS vault_on_chain_addresses_verification_status_idx 
    ON vault_on_chain_addresses(verification_status);

-- Ranger integration state tracking
CREATE TABLE IF NOT EXISTS ranger_vault_state (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vault_id TEXT NOT NULL UNIQUE REFERENCES vault_current(id),
    ranger_vault_id TEXT,
    integration_mode TEXT NOT NULL DEFAULT 'simulated',
    sdk_available BOOLEAN NOT NULL DEFAULT FALSE,
    factory_configured BOOLEAN NOT NULL DEFAULT FALSE,
    strategy_adapter_configured BOOLEAN NOT NULL DEFAULT FALSE,
    vault_status TEXT NOT NULL DEFAULT 'initializing',
    total_shares TEXT NOT NULL DEFAULT '0',
    total_aum TEXT NOT NULL DEFAULT '0',
    share_price TEXT NOT NULL DEFAULT '1',
    last_sync_at TIMESTAMP WITH TIME ZONE,
    sync_error TEXT,
    metadata JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ranger_vault_state_vault_id_idx 
    ON ranger_vault_state(vault_id);
CREATE INDEX IF NOT EXISTS ranger_vault_state_integration_mode_idx 
    ON ranger_vault_state(integration_mode);
CREATE INDEX IF NOT EXISTS ranger_vault_state_vault_status_idx 
    ON ranger_vault_state(vault_status);

-- On-chain deposit receipts
CREATE TABLE IF NOT EXISTS vault_on_chain_deposits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vault_id TEXT NOT NULL REFERENCES vault_current(id),
    deposit_lot_id UUID REFERENCES vault_deposit_lots(id),
    deposit_id TEXT NOT NULL,
    depositor_address TEXT NOT NULL,
    amount TEXT NOT NULL,
    shares_minted TEXT NOT NULL,
    share_price TEXT NOT NULL,
    lock_expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    transaction_signature TEXT NOT NULL,
    block_time TIMESTAMP WITH TIME ZONE NOT NULL,
    confirmation_status TEXT NOT NULL DEFAULT 'confirmed',
    metadata JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS vault_on_chain_deposits_vault_id_idx 
    ON vault_on_chain_deposits(vault_id);
CREATE INDEX IF NOT EXISTS vault_on_chain_deposits_depositor_idx 
    ON vault_on_chain_deposits(depositor_address);
CREATE INDEX IF NOT EXISTS vault_on_chain_deposits_signature_idx 
    ON vault_on_chain_deposits(transaction_signature);
CREATE INDEX IF NOT EXISTS vault_on_chain_deposits_block_time_idx 
    ON vault_on_chain_deposits(block_time);

-- On-chain withdrawal receipts
CREATE TABLE IF NOT EXISTS vault_on_chain_withdrawals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vault_id TEXT NOT NULL REFERENCES vault_current(id),
    redemption_request_id UUID REFERENCES vault_redemption_requests(id),
    withdrawal_id TEXT NOT NULL,
    shareholder_address TEXT NOT NULL,
    shares_burned TEXT NOT NULL,
    amount_returned TEXT NOT NULL,
    share_price TEXT NOT NULL,
    transaction_signature TEXT NOT NULL,
    block_time TIMESTAMP WITH TIME ZONE NOT NULL,
    confirmation_status TEXT NOT NULL DEFAULT 'completed',
    metadata JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS vault_on_chain_withdrawals_vault_id_idx 
    ON vault_on_chain_withdrawals(vault_id);
CREATE INDEX IF NOT EXISTS vault_on_chain_withdrawals_shareholder_idx 
    ON vault_on_chain_withdrawals(shareholder_address);
CREATE INDEX IF NOT EXISTS vault_on_chain_withdrawals_signature_idx 
    ON vault_on_chain_withdrawals(transaction_signature);

-- Submission verification tracking
CREATE TABLE IF NOT EXISTS vault_submission_verification (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    submission_profile_id TEXT NOT NULL REFERENCES vault_submission_profiles(id),
    verification_type TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    verification_data JSONB NOT NULL DEFAULT '{}',
    verified_at TIMESTAMP WITH TIME ZONE,
    verified_by TEXT,
    verification_notes TEXT,
    metadata JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS vault_submission_verification_profile_id_idx 
    ON vault_submission_verification(submission_profile_id);
CREATE INDEX IF NOT EXISTS vault_submission_verification_type_idx 
    ON vault_submission_verification(verification_type);
CREATE INDEX IF NOT EXISTS vault_submission_verification_status_idx 
    ON vault_submission_verification(status);

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_vault_on_chain_addresses_updated_at
    BEFORE UPDATE ON vault_on_chain_addresses
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_ranger_vault_state_updated_at
    BEFORE UPDATE ON ranger_vault_state
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_vault_on_chain_deposits_updated_at
    BEFORE UPDATE ON vault_on_chain_deposits
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_vault_on_chain_withdrawals_updated_at
    BEFORE UPDATE ON vault_on_chain_withdrawals
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_vault_submission_verification_updated_at
    BEFORE UPDATE ON vault_submission_verification
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
