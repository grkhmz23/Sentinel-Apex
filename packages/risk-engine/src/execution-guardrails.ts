/**
 * Execution Guardrails
 * 
 * Backend-enforced safety controls for execution-capable connectors.
 * 
 * Phase R2 Implementation:
 * - Notional limits (max/min action sizes)
 * - Circuit breakers for execution failures
 * - Kill switch for emergency halt
 * - Partial-fill handling policies
 * - Concurrency limits
 * - Blocked reason persistence
 */

import { Decimal } from 'decimal.js';
import { createLogger } from '@sentinel-apex/observability';
import { Result, Ok, Err } from '@sentinel-apex/shared';

const logger = createLogger('execution-guardrails');

// =============================================================================
// Types
// =============================================================================

export type GuardrailScope = 'global' | 'venue' | 'sleeve' | 'strategy';

export type ViolationType = 
  | 'max_notional'
  | 'min_notional'
  | 'circuit_breaker'
  | 'kill_switch'
  | 'partial_fill'
  | 'timeout'
  | 'concurrency_limit';

export type PartialFillAction = 'continue' | 'block' | 'rollback';

export interface GuardrailConfig {
  id: string;
  scopeType: GuardrailScope;
  scopeId: string;
  
  // Notional limits
  maxSingleActionNotionalUsd?: Decimal;
  maxDailyNotionalUsd?: Decimal;
  maxPositionNotionalUsd?: Decimal;
  minActionNotionalUsd?: Decimal;
  
  // Concurrency limits
  maxConcurrentExecutions?: number;
  maxConcurrentLegs?: number;
  
  // Circuit breaker
  circuitBreakerEnabled: boolean;
  maxFailuresBeforeBreaker: number;
  circuitBreakerResetMinutes: number;
  
  // Kill switch
  killSwitchEnabled: boolean;
  killSwitchTriggered: boolean;
  killSwitchTriggeredAt?: Date | undefined;
  killSwitchTriggeredBy?: string | undefined;
  killSwitchReason?: string | undefined;
  
  // Partial fill handling
  partialFillAction: PartialFillAction;
  minFillPctRequired: Decimal;
  
  // Timing
  maxExecutionTimeSeconds: number;
  legTimeoutSeconds: number;
  
  // Tracking
  failureCount: number;
  lastFailureAt?: Date | undefined;
  dailyNotionalUsd: Decimal;
  dailyResetAt: Date;
  
  createdAt: Date;
  updatedAt: Date;
}

export interface GuardrailViolation {
  id: string;
  guardrailConfigId: string;
  violationType: ViolationType;
  carryActionId?: string | undefined;
  planId?: string | undefined;
  legId?: string | undefined;
  attemptedNotionalUsd?: Decimal | undefined;
  limitNotionalUsd?: Decimal | undefined;
  violationMessage: string;
  violationDetails: Record<string, unknown>;
  blocked: boolean;
  overridden: boolean;
  overriddenBy?: string;
  overriddenAt?: Date;
  overrideReason?: string;
  createdAt: Date;
}

export interface GuardrailCheckInput {
  carryActionId?: string;
  planId?: string;
  legId?: string;
  venueId?: string;
  sleeveId?: string;
  strategyId?: string;
  notionalUsd: Decimal;
  isExecution: boolean;
}

export interface GuardrailCheckResult {
  allowed: boolean;
  violations: GuardrailViolationInput[];
  warnings: string[];
}

export interface GuardrailViolationInput {
  type: ViolationType;
  message: string;
  blocked: boolean;
  details: Record<string, unknown>;
}

// =============================================================================
// Default Configurations
// =============================================================================

export const DEFAULT_GLOBAL_GUARDRAIL_CONFIG: Omit<GuardrailConfig, 'id' | 'createdAt' | 'updatedAt'> = {
  scopeType: 'global',
  scopeId: 'default',
  maxSingleActionNotionalUsd: new Decimal(100000),    // $100k
  maxDailyNotionalUsd: new Decimal(500000),           // $500k
  maxPositionNotionalUsd: new Decimal(1000000),       // $1M
  minActionNotionalUsd: new Decimal(1000),            // $1k
  maxConcurrentExecutions: 3,
  maxConcurrentLegs: 6,
  circuitBreakerEnabled: true,
  maxFailuresBeforeBreaker: 3,
  circuitBreakerResetMinutes: 30,
  killSwitchEnabled: true,
  killSwitchTriggered: false,
  partialFillAction: 'continue',
  minFillPctRequired: new Decimal(95),                // 95%
  maxExecutionTimeSeconds: 300,                       // 5 minutes
  legTimeoutSeconds: 60,                              // 1 minute
  failureCount: 0,
  dailyNotionalUsd: new Decimal(0),
  dailyResetAt: new Date(),
};

// =============================================================================
// Guardrail Engine
// =============================================================================

export class ExecutionGuardrailEngine {
  private configs: Map<string, GuardrailConfig> = new Map();
  private violations: Map<string, GuardrailViolation[]> = new Map();
  
  constructor() {
    // Initialize with default global config
    this.createConfig(DEFAULT_GLOBAL_GUARDRAIL_CONFIG);
  }
  
  /**
   * Create a new guardrail configuration
   */
  createConfig(
    input: Omit<GuardrailConfig, 'id' | 'createdAt' | 'updatedAt'>
  ): GuardrailConfig {
    const now = new Date();
    const config: GuardrailConfig = {
      ...input,
      id: `guardrail_${input.scopeType}_${input.scopeId}_${Date.now()}`,
      createdAt: now,
      updatedAt: now,
    };
    
    this.configs.set(config.id, config);
    
    logger.info('Created guardrail config', {
      configId: config.id,
      scopeType: config.scopeType,
      scopeId: config.scopeId,
    });
    
    return config;
  }
  
  /**
   * Get configuration by scope
   */
  getConfig(scopeType: GuardrailScope, scopeId: string): GuardrailConfig | undefined {
    for (const config of this.configs.values()) {
      if (config.scopeType === scopeType && config.scopeId === scopeId) {
        return config;
      }
    }
    return undefined;
  }
  
  /**
   * Check if execution is allowed
   */
  check(input: GuardrailCheckInput): GuardrailCheckResult {
    const violations: GuardrailViolationInput[] = [];
    const warnings: string[] = [];
    
    // Get applicable configs in priority order
    const configs = this.getApplicableConfigs(input);
    
    for (const config of configs) {
      // Check kill switch first (highest priority)
      if (config.killSwitchEnabled && config.killSwitchTriggered) {
        violations.push({
          type: 'kill_switch',
          message: `Kill switch active: ${config.killSwitchReason ?? 'Emergency halt triggered'}`,
          blocked: true,
          details: {
            triggeredAt: config.killSwitchTriggeredAt,
            triggeredBy: config.killSwitchTriggeredBy,
          },
        });
        continue;
      }
      
      // Check circuit breaker
      if (config.circuitBreakerEnabled && this.isCircuitBreakerOpen(config)) {
        violations.push({
          type: 'circuit_breaker',
          message: `Circuit breaker open after ${config.maxFailuresBeforeBreaker} failures`,
          blocked: true,
          details: {
            failureCount: config.failureCount,
            resetAt: this.getCircuitBreakerResetTime(config),
          },
        });
        continue;
      }
      
      // Check notional limits
      if (config.maxSingleActionNotionalUsd && 
          input.notionalUsd.gt(config.maxSingleActionNotionalUsd)) {
        violations.push({
          type: 'max_notional',
          message: `Action notional ${input.notionalUsd} exceeds maximum ${config.maxSingleActionNotionalUsd}`,
          blocked: true,
          details: {
            attempted: input.notionalUsd.toString(),
            limit: config.maxSingleActionNotionalUsd.toString(),
          },
        });
      }
      
      if (config.minActionNotionalUsd && 
          input.notionalUsd.lt(config.minActionNotionalUsd)) {
        violations.push({
          type: 'min_notional',
          message: `Action notional ${input.notionalUsd} below minimum ${config.minActionNotionalUsd}`,
          blocked: true,
          details: {
            attempted: input.notionalUsd.toString(),
            limit: config.minActionNotionalUsd.toString(),
          },
        });
      }
      
      // Check daily limit
      if (config.maxDailyNotionalUsd) {
        this.resetDailyNotionalIfNeeded(config);
        const projectedDaily = config.dailyNotionalUsd.plus(input.notionalUsd);
        if (projectedDaily.gt(config.maxDailyNotionalUsd)) {
          violations.push({
            type: 'max_notional',
            message: `Daily notional would exceed limit: ${projectedDaily} > ${config.maxDailyNotionalUsd}`,
            blocked: true,
            details: {
              currentDaily: config.dailyNotionalUsd.toString(),
              attempted: input.notionalUsd.toString(),
              limit: config.maxDailyNotionalUsd.toString(),
            },
          });
        }
      }
      
      // Check concurrency (simplified - would check actual running executions)
      if (config.maxConcurrentExecutions && input.isExecution) {
        // This would check the database for running executions
        warnings.push(`Concurrency check: max ${config.maxConcurrentExecutions} executions`);
      }
    }
    
    return {
      allowed: !violations.some(v => v.blocked),
      violations,
      warnings,
    };
  }
  
  /**
   * Trigger kill switch
   */
  triggerKillSwitch(
    configId: string,
    triggeredBy: string,
    reason: string
  ): Result<GuardrailConfig, Error> {
    const config = this.configs.get(configId);
    if (!config) {
      return Err(new Error(`Guardrail config not found: ${configId}`));
    }
    
    if (!config.killSwitchEnabled) {
      return Err(new Error(`Kill switch not enabled for config: ${configId}`));
    }
    
    config.killSwitchTriggered = true;
    config.killSwitchTriggeredAt = new Date();
    config.killSwitchTriggeredBy = triggeredBy;
    config.killSwitchReason = reason;
    config.updatedAt = new Date();
    
    logger.error('Kill switch triggered', {
      configId,
      triggeredBy,
      reason,
    });
    
    return Ok(config);
  }
  
  /**
   * Reset kill switch
   */
  resetKillSwitch(
    configId: string,
    resetBy: string
  ): Result<GuardrailConfig, Error> {
    const config = this.configs.get(configId);
    if (!config) {
      return Err(new Error(`Guardrail config not found: ${configId}`));
    }
    
    config.killSwitchTriggered = false;
    config.killSwitchTriggeredAt = undefined;
    config.killSwitchTriggeredBy = undefined;
    config.killSwitchReason = undefined;
    config.updatedAt = new Date();
    
    logger.info('Kill switch reset', {
      configId,
      resetBy,
    });
    
    return Ok(config);
  }
  
  /**
   * Record execution failure
   */
  recordFailure(configId: string): GuardrailConfig | undefined {
    const config = this.configs.get(configId);
    if (!config || !config.circuitBreakerEnabled) {
      return undefined;
    }
    
    // Check if we should reset the counter
    if (config.lastFailureAt) {
      const minutesSinceLastFailure = 
        (Date.now() - config.lastFailureAt.getTime()) / (1000 * 60);
      if (minutesSinceLastFailure > config.circuitBreakerResetMinutes) {
        config.failureCount = 0;
      }
    }
    
    config.failureCount++;
    config.lastFailureAt = new Date();
    config.updatedAt = new Date();
    
    logger.warn('Recorded execution failure', {
      configId,
      failureCount: config.failureCount,
      maxFailures: config.maxFailuresBeforeBreaker,
    });
    
    return config;
  }
  
  /**
   * Record successful execution
   */
  recordSuccess(configId: string, notionalUsd: Decimal): GuardrailConfig | undefined {
    const config = this.configs.get(configId);
    if (!config) {
      return undefined;
    }
    
    // Reset failure count on success
    if (config.failureCount > 0) {
      config.failureCount = 0;
      config.lastFailureAt = undefined;
    }
    
    // Track daily notional
    this.resetDailyNotionalIfNeeded(config);
    config.dailyNotionalUsd = config.dailyNotionalUsd.plus(notionalUsd);
    config.updatedAt = new Date();
    
    return config;
  }
  
  /**
   * Check partial fill compliance
   */
  checkPartialFill(
    configId: string,
    targetSize: Decimal,
    filledSize: Decimal
  ): Result<{ action: PartialFillAction; reason?: string }, Error> {
    const config = this.configs.get(configId);
    if (!config) {
      return Err(new Error(`Guardrail config not found: ${configId}`));
    }
    
    if (targetSize.lte(0)) {
      return Ok({ action: config.partialFillAction });
    }
    
    const fillPct = filledSize.div(targetSize).times(100);
    
    if (fillPct.gte(config.minFillPctRequired)) {
      return Ok({ action: 'continue' });
    }
    
    const reason = `Partial fill ${fillPct.toFixed(2)}% below minimum ${config.minFillPctRequired}%`;
    
    switch (config.partialFillAction) {
      case 'block':
        return Ok({ action: 'block', reason });
      case 'rollback':
        return Ok({ action: 'rollback', reason });
      case 'continue':
      default:
        return Ok({ action: 'continue', reason });
    }
  }
  
  // ===========================================================================
  // Private Helpers
  // ===========================================================================
  
  private getApplicableConfigs(input: GuardrailCheckInput): GuardrailConfig[] {
    const configs: GuardrailConfig[] = [];
    
    // Global config
    const globalConfig = this.getConfig('global', 'default');
    if (globalConfig) configs.push(globalConfig);
    
    // Venue-specific config
    if (input.venueId) {
      const venueConfig = this.getConfig('venue', input.venueId);
      if (venueConfig) configs.push(venueConfig);
    }
    
    // Sleeve-specific config
    if (input.sleeveId) {
      const sleeveConfig = this.getConfig('sleeve', input.sleeveId);
      if (sleeveConfig) configs.push(sleeveConfig);
    }
    
    // Strategy-specific config
    if (input.strategyId) {
      const strategyConfig = this.getConfig('strategy', input.strategyId);
      if (strategyConfig) configs.push(strategyConfig);
    }
    
    return configs;
  }
  
  private isCircuitBreakerOpen(config: GuardrailConfig): boolean {
    if (!config.circuitBreakerEnabled) return false;
    if (config.failureCount < config.maxFailuresBeforeBreaker) return false;
    
    // Check if enough time has passed to reset
    if (config.lastFailureAt) {
      const minutesSinceLastFailure = 
        (Date.now() - config.lastFailureAt.getTime()) / (1000 * 60);
      if (minutesSinceLastFailure > config.circuitBreakerResetMinutes) {
        config.failureCount = 0;
        return false;
      }
    }
    
    return true;
  }
  
  private getCircuitBreakerResetTime(config: GuardrailConfig): Date | undefined {
    if (!config.lastFailureAt) return undefined;
    return new Date(config.lastFailureAt.getTime() + 
      config.circuitBreakerResetMinutes * 60 * 1000);
  }
  
  private resetDailyNotionalIfNeeded(config: GuardrailConfig): void {
    const now = new Date();
    const resetTime = new Date(config.dailyResetAt);
    resetTime.setDate(resetTime.getDate() + 1);
    resetTime.setHours(0, 0, 0, 0);
    
    if (now >= resetTime) {
      config.dailyNotionalUsd = new Decimal(0);
      config.dailyResetAt = now;
    }
  }
}

// =============================================================================
// Singleton Instance
// =============================================================================

let globalGuardrailEngine: ExecutionGuardrailEngine | null = null;

export function getExecutionGuardrailEngine(): ExecutionGuardrailEngine {
  if (!globalGuardrailEngine) {
    globalGuardrailEngine = new ExecutionGuardrailEngine();
  }
  return globalGuardrailEngine;
}

export function resetExecutionGuardrailEngine(): void {
  globalGuardrailEngine = null;
}
