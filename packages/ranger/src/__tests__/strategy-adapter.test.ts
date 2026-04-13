import { Connection, PublicKey } from '@solana/web3.js';
import { Decimal } from 'decimal.js';
import { describe, it, expect, beforeEach } from 'vitest';

import {
  RangerCarryStrategyAdapter,
  RangerStrategyAdapterFactory,
  type StrategyAdapterConfig,
} from '../index.js';

describe('RangerCarryStrategyAdapter', () => {
  let adapter: RangerCarryStrategyAdapter;
  let mockConnection: Connection;
  
  beforeEach(() => {
    mockConnection = new Connection('http://localhost:8899');
    
    const config: StrategyAdapterConfig = {
      connection: mockConnection,
      strategyProgramId: PublicKey.default,
      mode: 'simulated',
    };
    
    adapter = new RangerCarryStrategyAdapter(config, {
      baseAsset: 'USDC',
      maxGrossExposure: new Decimal(1000000),
      minFundingRateThreshold: new Decimal(0.0001),
      rebalanceThresholdPct: 5,
      approvedVenues: ['jupiter-perps'],
      approvedMarkets: ['BTC-PERP'],
    });
  });
  
  describe('strategy identity', () => {
    it('should have correct strategy ID', () => {
      expect(adapter.strategyId).toBe('sentinel-apex-delta-neutral-carry-v1');
    });
  });
  
  describe('checkCompliance', () => {
    it('should pass compliance for valid allocations', async () => {
      const context = {
        vaultId: 'test-vault',
        strategyProgram: PublicKey.default,
        authority: PublicKey.default,
        currentAum: new Decimal(100000),
        targetAllocations: new Map([
          ['jupiter-perps:BTC-PERP:long', new Decimal(50000)],
        ]),
      };
      
      const result = await adapter.checkCompliance(context);
      
      expect(result.compliant).toBe(true);
      expect(result.violations).toHaveLength(0);
    });
    
    it('should fail compliance for excessive exposure', async () => {
      const context = {
        vaultId: 'test-vault',
        strategyProgram: PublicKey.default,
        authority: PublicKey.default,
        currentAum: new Decimal(100000),
        targetAllocations: new Map([
          ['jupiter-perps:BTC-PERP:long', new Decimal(1500000)], // Exceeds max
        ]),
      };
      
      const result = await adapter.checkCompliance(context);
      
      expect(result.compliant).toBe(false);
      expect(result.violations.length).toBeGreaterThan(0);
      expect(result.violations[0]).toContain('exposure');
    });
    
    it('should fail compliance for unapproved venue', async () => {
      const context = {
        vaultId: 'test-vault',
        strategyProgram: PublicKey.default,
        authority: PublicKey.default,
        currentAum: new Decimal(100000),
        targetAllocations: new Map([
          ['unapproved:BTC-PERP:long', new Decimal(50000)],
        ]),
      };
      
      const result = await adapter.checkCompliance(context);
      
      expect(result.compliant).toBe(false);
      expect(result.violations.some(v => v.includes('Venue'))).toBe(true);
    });
  });
  
  describe('calculateNav', () => {
    it('should return current AUM in simulated mode', async () => {
      const context = {
        vaultId: 'test-vault',
        strategyProgram: PublicKey.default,
        authority: PublicKey.default,
        currentAum: new Decimal(123456.78),
        targetAllocations: new Map(),
      };
      
      const nav = await adapter.calculateNav(context);
      
      expect(nav.toNumber()).toBe(123456.78);
    });
  });
  
  describe('generateRebalanceInstructions', () => {
    it('should generate instructions for target allocations', async () => {
      const context = {
        vaultId: 'test-vault',
        strategyProgram: PublicKey.default,
        authority: PublicKey.default,
        currentAum: new Decimal(100000),
        targetAllocations: new Map([
          ['jupiter-perps:BTC-PERP:long', new Decimal(50000)],
          ['jupiter-perps:BTC-PERP:short', new Decimal(-50000)],
        ]),
      };
      
      const instructions = await adapter.generateRebalanceInstructions(context);
      
      expect(instructions.length).toBe(2);
      expect(instructions[0]?.description).toContain('BTC-PERP');
    });
    
    it('should return empty array for empty allocations', async () => {
      const context = {
        vaultId: 'test-vault',
        strategyProgram: PublicKey.default,
        authority: PublicKey.default,
        currentAum: new Decimal(100000),
        targetAllocations: new Map(),
      };
      
      const instructions = await adapter.generateRebalanceInstructions(context);
      
      expect(instructions).toHaveLength(0);
    });
  });
});

describe('RangerStrategyAdapterFactory', () => {
  let factory: RangerStrategyAdapterFactory;
  
  beforeEach(() => {
    const config: StrategyAdapterConfig = {
      connection: new Connection('http://localhost:8899'),
      strategyProgramId: PublicKey.default,
      mode: 'simulated',
    };
    
    factory = new RangerStrategyAdapterFactory(config);
  });
  
  describe('createAdapter', () => {
    it('should create carry strategy adapter', async () => {
      const result = await factory.createAdapter('sentinel-apex-delta-neutral-carry-v1');
      
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.strategyId).toBe('sentinel-apex-delta-neutral-carry-v1');
      }
    });
    
    it('should create adapter by short name', async () => {
      const result = await factory.createAdapter('delta-neutral-carry');
      
      expect(result.ok).toBe(true);
    });
    
    it('should fail for unknown strategy', async () => {
      const result = await factory.createAdapter('unknown-strategy');
      
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toContain('Unknown strategy');
      }
    });
    
    it('should cache adapters', async () => {
      const result1 = await factory.createAdapter('delta-neutral-carry');
      const result2 = await factory.createAdapter('delta-neutral-carry');
      
      expect(result1.ok).toBe(true);
      expect(result2.ok).toBe(true);
      
      if (result1.ok && result2.ok) {
        expect(result1.value).toBe(result2.value); // Same instance
      }
    });
  });
});
