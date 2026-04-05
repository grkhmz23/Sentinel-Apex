-- =============================================================================
-- Migration: Multi-Leg Carry Orchestration
-- Phase: R2 - Execution + Multi-Leg Carry Orchestration
-- =============================================================================

-- Multi-leg orchestration plans for coordinated execution
CREATE TABLE IF NOT EXISTS carry_multi_leg_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    carry_action_id UUID NOT NULL REFERENCES carry_actions(id),
    strategy_run_id TEXT REFERENCES strategy_runs(run_id),
    plan_type TEXT NOT NULL DEFAULT 'delta_neutral_carry', -- delta_neutral_carry, custom
    asset TEXT NOT NULL,
    notional_usd TEXT NOT NULL,
    leg_count INTEGER NOT NULL DEFAULT 2,
    coordination_config JSONB NOT NULL DEFAULT '{}',
    status TEXT NOT NULL DEFAULT 'pending', -- pending, executing, completed, partial, failed, cancelled
    execution_order TEXT[] NOT NULL DEFAULT '{}', -- Array of leg IDs in execution sequence
    hedge_deviation_pct TEXT,
    max_hedge_deviation_pct TEXT NOT NULL DEFAULT '1.0',
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    failed_at TIMESTAMP WITH TIME ZONE,
    cancelled_at TIMESTAMP WITH TIME ZONE,
    outcome_summary TEXT,
    outcome JSONB NOT NULL DEFAULT '{}',
    blocked_reasons JSONB NOT NULL DEFAULT '[]',
    metadata JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS carry_multi_leg_plans_action_id_idx ON carry_multi_leg_plans(carry_action_id);
CREATE INDEX IF NOT EXISTS carry_multi_leg_plans_status_idx ON carry_multi_leg_plans(status);
CREATE INDEX IF NOT EXISTS carry_multi_leg_plans_asset_idx ON carry_multi_leg_plans(asset);
CREATE INDEX IF NOT EXISTS carry_multi_leg_plans_created_at_idx ON carry_multi_leg_plans(created_at);

-- Individual legs within a multi-leg plan
CREATE TABLE IF NOT EXISTS carry_leg_executions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plan_id UUID NOT NULL REFERENCES carry_multi_leg_plans(id),
    carry_action_id UUID NOT NULL REFERENCES carry_actions(id),
    leg_sequence INTEGER NOT NULL, -- Order in execution sequence (1, 2, 3...)
    parent_leg_id UUID REFERENCES carry_leg_executions(id), -- For retry chains
    
    -- Leg definition
    leg_type TEXT NOT NULL, -- spot, perp, futures
    side TEXT NOT NULL, -- long, short
    venue_id TEXT NOT NULL,
    asset TEXT NOT NULL,
    market_symbol TEXT,
    
    -- Sizing
    target_size TEXT NOT NULL,
    target_notional_usd TEXT NOT NULL,
    executed_size TEXT,
    executed_notional_usd TEXT,
    
    -- Execution
    status TEXT NOT NULL DEFAULT 'pending', -- pending, executing, completed, failed, skipped, cancelled
    execution_mode TEXT NOT NULL DEFAULT 'dry-run',
    simulated BOOLEAN NOT NULL DEFAULT true,
    
    -- Linked records
    planned_order_id UUID REFERENCES carry_action_order_intents(id),
    execution_step_id UUID REFERENCES carry_execution_steps(id),
    
    -- References
    venue_execution_reference TEXT, -- Transaction signature
    client_order_id TEXT,
    venue_order_id TEXT,
    
    -- Outcome
    filled_size TEXT,
    average_fill_price TEXT,
    fill_count INTEGER DEFAULT 0,
    last_fill_at TIMESTAMP WITH TIME ZONE,
    
    -- Timing
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    failed_at TIMESTAMP WITH TIME ZONE,
    
    -- Error handling
    last_error TEXT,
    retry_count INTEGER NOT NULL DEFAULT 0,
    max_retries INTEGER NOT NULL DEFAULT 3,
    
    -- Metadata
    outcome JSONB NOT NULL DEFAULT '{}',
    metadata JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS carry_leg_executions_plan_id_idx ON carry_leg_executions(plan_id);
CREATE INDEX IF NOT EXISTS carry_leg_executions_action_id_idx ON carry_leg_executions(carry_action_id);
CREATE INDEX IF NOT EXISTS carry_leg_executions_status_idx ON carry_leg_executions(status);
CREATE INDEX IF NOT EXISTS carry_leg_executions_leg_sequence_idx ON carry_leg_executions(leg_sequence);
CREATE INDEX IF NOT EXISTS carry_leg_executions_venue_id_idx ON carry_leg_executions(venue_id);

-- Hedge state tracking for delta-neutral positions
CREATE TABLE IF NOT EXISTS carry_hedge_state (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plan_id UUID NOT NULL REFERENCES carry_multi_leg_plans(id),
    carry_action_id UUID NOT NULL REFERENCES carry_actions(id),
    
    -- Asset and pair info
    asset TEXT NOT NULL,
    pair_type TEXT NOT NULL DEFAULT 'spot_perp', -- spot_perp, perp_perp, etc.
    
    -- Spot leg state
    spot_leg_id UUID REFERENCES carry_leg_executions(id),
    spot_venue_id TEXT,
    spot_side TEXT,
    spot_target_size TEXT,
    spot_executed_size TEXT,
    spot_average_price TEXT,
    
    -- Perp leg state
    perp_leg_id UUID REFERENCES carry_leg_executions(id),
    perp_venue_id TEXT,
    perp_side TEXT,
    perp_target_size TEXT,
    perp_executed_size TEXT,
    perp_average_price TEXT,
    
    -- Hedge metrics
    notional_usd TEXT NOT NULL,
    hedge_deviation_pct TEXT, -- Current deviation from perfect hedge
    max_allowed_deviation_pct TEXT NOT NULL DEFAULT '1.0',
    
    -- Status
    status TEXT NOT NULL DEFAULT 'pending', -- pending, balanced, imbalanced, rebalancing, closed
    imbalance_direction TEXT, -- spot_heavy, perp_heavy
    imbalance_threshold_breached BOOLEAN NOT NULL DEFAULT false,
    
    -- Rebalancing
    rebalance_triggered_at TIMESTAMP WITH TIME ZONE,
    rebalance_plan_id UUID REFERENCES carry_multi_leg_plans(id),
    
    -- Tracking
    last_calculated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    metadata JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS carry_hedge_state_plan_id_idx ON carry_hedge_state(plan_id);
CREATE INDEX IF NOT EXISTS carry_hedge_state_action_id_idx ON carry_hedge_state(carry_action_id);
CREATE INDEX IF NOT EXISTS carry_hedge_state_status_idx ON carry_hedge_state(status);
CREATE INDEX IF NOT EXISTS carry_hedge_state_asset_idx ON carry_hedge_state(asset);

-- Execution guardrails configuration
CREATE TABLE IF NOT EXISTS execution_guardrails_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Scope
    scope_type TEXT NOT NULL, -- global, venue, sleeve, strategy
    scope_id TEXT NOT NULL,
    
    -- Notional limits
    max_single_action_notional_usd TEXT,
    max_daily_notional_usd TEXT,
    max_position_notional_usd TEXT,
    min_action_notional_usd TEXT,
    
    -- Concurrency limits
    max_concurrent_executions INTEGER,
    max_concurrent_legs INTEGER,
    
    -- Circuit breaker settings
    circuit_breaker_enabled BOOLEAN NOT NULL DEFAULT true,
    max_failures_before_breaker INTEGER DEFAULT 3,
    circuit_breaker_reset_minutes INTEGER DEFAULT 30,
    
    -- Kill switch
    kill_switch_enabled BOOLEAN NOT NULL DEFAULT true,
    kill_switch_triggered BOOLEAN NOT NULL DEFAULT false,
    kill_switch_triggered_at TIMESTAMP WITH TIME ZONE,
    kill_switch_triggered_by TEXT,
    kill_switch_reason TEXT,
    
    -- Partial fill handling
    partial_fill_action TEXT NOT NULL DEFAULT 'continue', -- continue, block, rollback
    min_fill_pct_required TEXT NOT NULL DEFAULT '95.0',
    
    -- Timing
    max_execution_time_seconds INTEGER DEFAULT 300,
    leg_timeout_seconds INTEGER DEFAULT 60,
    
    -- Metadata
    created_by TEXT NOT NULL,
    updated_by TEXT NOT NULL,
    metadata JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    
    UNIQUE(scope_type, scope_id)
);

CREATE INDEX IF NOT EXISTS execution_guardrails_scope_idx ON execution_guardrails_config(scope_type, scope_id);
CREATE INDEX IF NOT EXISTS execution_guardrails_kill_switch_idx ON execution_guardrails_config(kill_switch_triggered);

-- Execution guardrail violations log
CREATE TABLE IF NOT EXISTS execution_guardrail_violations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    guardrail_config_id UUID NOT NULL REFERENCES execution_guardrails_config(id),
    
    -- What was blocked
    violation_type TEXT NOT NULL, -- max_notional, circuit_breaker, kill_switch, partial_fill, timeout
    carry_action_id UUID REFERENCES carry_actions(id),
    plan_id UUID REFERENCES carry_multi_leg_plans(id),
    leg_id UUID REFERENCES carry_leg_executions(id),
    
    -- Violation details
    attempted_notional_usd TEXT,
    limit_notional_usd TEXT,
    violation_message TEXT NOT NULL,
    violation_details JSONB NOT NULL DEFAULT '{}',
    
    -- Resolution
    blocked BOOLEAN NOT NULL DEFAULT true,
    overridden BOOLEAN NOT NULL DEFAULT false,
    overridden_by TEXT,
    overridden_at TIMESTAMP WITH TIME ZONE,
    override_reason TEXT,
    
    metadata JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS guardrail_violations_config_id_idx ON execution_guardrail_violations(guardrail_config_id);
CREATE INDEX IF NOT EXISTS guardrail_violations_type_idx ON execution_guardrail_violations(violation_type);
CREATE INDEX IF NOT EXISTS guardrail_violations_action_id_idx ON execution_guardrail_violations(carry_action_id);
CREATE INDEX IF NOT EXISTS guardrail_violations_created_at_idx ON execution_guardrail_violations(created_at);

-- Update carry_actions to support multi-leg
ALTER TABLE carry_actions 
ADD COLUMN IF NOT EXISTS orchestration_plan_id UUID REFERENCES carry_multi_leg_plans(id),
ADD COLUMN IF NOT EXISTS is_multi_leg BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS leg_count INTEGER DEFAULT 1;

-- Update carry_execution_steps to support leg sequencing
ALTER TABLE carry_execution_steps
ADD COLUMN IF NOT EXISTS leg_sequence INTEGER,
ADD COLUMN IF NOT EXISTS parent_leg_id UUID REFERENCES carry_execution_steps(id),
ADD COLUMN IF NOT EXISTS plan_id UUID REFERENCES carry_multi_leg_plans(id),
ADD COLUMN IF NOT EXISTS is_part_of_orchestration BOOLEAN NOT NULL DEFAULT false;

-- Create indexes for new columns
CREATE INDEX IF NOT EXISTS carry_actions_orchestration_plan_id_idx ON carry_actions(orchestration_plan_id);
CREATE INDEX IF NOT EXISTS carry_actions_is_multi_leg_idx ON carry_actions(is_multi_leg);
CREATE INDEX IF NOT EXISTS carry_execution_steps_plan_id_idx ON carry_execution_steps(plan_id);
CREATE INDEX IF NOT EXISTS carry_execution_steps_leg_sequence_idx ON carry_execution_steps(leg_sequence);

-- Triggers for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_carry_multi_leg_plans_updated_at
    BEFORE UPDATE ON carry_multi_leg_plans
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_carry_leg_executions_updated_at
    BEFORE UPDATE ON carry_leg_executions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_carry_hedge_state_updated_at
    BEFORE UPDATE ON carry_hedge_state
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_execution_guardrails_config_updated_at
    BEFORE UPDATE ON execution_guardrails_config
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert default global guardrail config
INSERT INTO execution_guardrails_config (
    scope_type,
    scope_id,
    max_single_action_notional_usd,
    max_daily_notional_usd,
    max_position_notional_usd,
    min_action_notional_usd,
    max_concurrent_executions,
    max_concurrent_legs,
    partial_fill_action,
    min_fill_pct_required,
    created_by,
    updated_by
) VALUES (
    'global',
    'default',
    '100000',    -- $100k max single action
    '500000',    -- $500k max daily
    '1000000',   -- $1M max position
    '1000',      -- $1k min action
    3,           -- 3 concurrent executions
    6,           -- 6 concurrent legs
    'continue',  -- Continue on partial fill
    '95.0',      -- 95% min fill
    'system',
    'system'
) ON CONFLICT (scope_type, scope_id) DO NOTHING;
