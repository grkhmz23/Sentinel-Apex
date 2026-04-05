import { describe, it, expect, beforeEach } from 'vitest';
import { Decimal } from 'decimal.js';

import {
  ExecutionGuardrailEngine,
  DEFAULT_GLOBAL_GUARDRAIL_CONFIG,
  resetExecutionGuardrailEngine,
  type GuardrailCheckInput,
} from '../execution-guardrails.js';

describe('ExecutionGuardrailEngine', () => {
  let engine: ExecutionGuardrailEngine;
  
  beforeEach(() => {
    resetExecutionGuardrailEngine();
    engine = new ExecutionGuardrailEngine();
  });
  
  describe('check', () => {
    it('should allow execution within limits', () => {
      const input: GuardrailCheckInput = {
        notionalUsd: new Decimal(50000), // Within $100k limit
        isExecution: true,
      };
      
      const result = engine.check(input);
      
      expect(result.allowed).toBe(true);
      expect(result.violations).toHaveLength(0);
    });
    
    it('should block execution exceeding max notional', () => {
      const input: GuardrailCheckInput = {
        notionalUsd: new Decimal(150000), // Exceeds $100k limit
        isExecution: true,
      };
      
      const result = engine.check(input);
      
      expect(result.allowed).toBe(false);
      expect(result.violations.some(v => v.type === 'max_notional')).toBe(true);
    });
    
    it('should block execution below min notional', () => {
      const input: GuardrailCheckInput = {
        notionalUsd: new Decimal(500), // Below $1k limit
        isExecution: true,
      };
      
      const result = engine.check(input);
      
      expect(result.allowed).toBe(false);
      expect(result.violations.some(v => v.type === 'min_notional')).toBe(true);
    });
  });
  
  describe('kill switch', () => {
    it('should block execution when kill switch triggered', () => {
      const config = engine.createConfig(DEFAULT_GLOBAL_GUARDRAIL_CONFIG);
      
      // Trigger kill switch
      const triggerResult = engine.triggerKillSwitch(
        config.id,
        'test_operator',
        'Emergency market conditions'
      );
      expect(triggerResult.ok).toBe(true);
      
      const input: GuardrailCheckInput = {
        notionalUsd: new Decimal(10000),
        isExecution: true,
      };
      
      const result = engine.check(input);
      
      expect(result.allowed).toBe(false);
      expect(result.violations.some(v => v.type === 'kill_switch')).toBe(true);
    });
    
    it('should allow execution after kill switch reset', () => {
      const config = engine.createConfig(DEFAULT_GLOBAL_GUARDRAIL_CONFIG);
      
      // Trigger and then reset
      engine.triggerKillSwitch(config.id, 'test_operator', 'Test');
      engine.resetKillSwitch(config.id, 'test_admin');
      
      const input: GuardrailCheckInput = {
        notionalUsd: new Decimal(10000),
        isExecution: true,
      };
      
      const result = engine.check(input);
      
      expect(result.allowed).toBe(true);
    });
  });
  
  describe('circuit breaker', () => {
    it('should block execution after max failures', () => {
      const config = engine.createConfig({
        ...DEFAULT_GLOBAL_GUARDRAIL_CONFIG,
        maxFailuresBeforeBreaker: 3,
      });
      
      // Record 3 failures
      engine.recordFailure(config.id);
      engine.recordFailure(config.id);
      engine.recordFailure(config.id);
      
      const input: GuardrailCheckInput = {
        notionalUsd: new Decimal(10000),
        isExecution: true,
      };
      
      const result = engine.check(input);
      
      expect(result.allowed).toBe(false);
      expect(result.violations.some(v => v.type === 'circuit_breaker')).toBe(true);
    });
    
    it('should allow execution before max failures', () => {
      const config = engine.createConfig({
        ...DEFAULT_GLOBAL_GUARDRAIL_CONFIG,
        maxFailuresBeforeBreaker: 3,
      });
      
      // Record only 2 failures
      engine.recordFailure(config.id);
      engine.recordFailure(config.id);
      
      const input: GuardrailCheckInput = {
        notionalUsd: new Decimal(10000),
        isExecution: true,
      };
      
      const result = engine.check(input);
      
      expect(result.allowed).toBe(true);
    });
  });
  
  describe('partial fill handling', () => {
    it('should continue on sufficient fill', () => {
      const config = engine.createConfig({
        ...DEFAULT_GLOBAL_GUARDRAIL_CONFIG,
        partialFillAction: 'block',
        minFillPctRequired: new Decimal(95),
      });
      
      const result = engine.checkPartialFill(
        config.id,
        new Decimal(100),
        new Decimal(96) // 96% fill
      );
      
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.action).toBe('continue');
      }
    });
    
    it('should block on insufficient fill when configured', () => {
      const config = engine.createConfig({
        ...DEFAULT_GLOBAL_GUARDRAIL_CONFIG,
        partialFillAction: 'block',
        minFillPctRequired: new Decimal(95),
      });
      
      const result = engine.checkPartialFill(
        config.id,
        new Decimal(100),
        new Decimal(90) // 90% fill
      );
      
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.action).toBe('block');
        expect(result.value.reason).toContain('below minimum');
      }
    });
    
    it('should continue on insufficient fill when configured', () => {
      const config = engine.createConfig({
        ...DEFAULT_GLOBAL_GUARDRAIL_CONFIG,
        partialFillAction: 'continue',
        minFillPctRequired: new Decimal(95),
      });
      
      const result = engine.checkPartialFill(
        config.id,
        new Decimal(100),
        new Decimal(90) // 90% fill
      );
      
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.action).toBe('continue');
      }
    });
  });
  
  describe('daily notional tracking', () => {
    it('should accumulate daily notional', () => {
      const config = engine.createConfig(DEFAULT_GLOBAL_GUARDRAIL_CONFIG);
      
      engine.recordSuccess(config.id, new Decimal(10000));
      engine.recordSuccess(config.id, new Decimal(20000));
      
      const updatedConfig = engine.getConfig('global', 'default');
      expect(updatedConfig?.dailyNotionalUsd.toNumber()).toBe(30000);
    });
  });
  
  describe('config creation', () => {
    it('should create venue-specific config', () => {
      const venueConfig = engine.createConfig({
        ...DEFAULT_GLOBAL_GUARDRAIL_CONFIG,
        scopeType: 'venue',
        scopeId: 'drift-devnet',
        maxSingleActionNotionalUsd: new Decimal(50000), // Lower limit for venue
      });
      
      expect(venueConfig.scopeType).toBe('venue');
      expect(venueConfig.scopeId).toBe('drift-devnet');
      expect(venueConfig.maxSingleActionNotionalUsd?.toNumber()).toBe(50000);
    });
  });
});
