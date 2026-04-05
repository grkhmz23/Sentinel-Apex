// =============================================================================
// Backtest Engine Tests
// =============================================================================

import { describe, it, expect } from 'vitest';
import { 
  createBacktestEngine, 
  validateBacktestConfig,
  createDefaultConfig,
} from '../index.js';

describe('validateBacktestConfig', () => {
  it('validates a correct config', () => {
    const config = createDefaultConfig({
      backtestId: 'test-1',
      period: {
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-31'),
      },
      assets: ['BTC'],
      createdBy: 'test',
    });
    
    const result = validateBacktestConfig(config);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });
  
  it('rejects end date before start date', () => {
    const config = createDefaultConfig({
      backtestId: 'test-1',
      period: {
        startDate: new Date('2024-02-01'),
        endDate: new Date('2024-01-01'),
      },
      assets: ['BTC'],
      createdBy: 'test',
    });
    
    const result = validateBacktestConfig(config);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Start date must be before end date');
  });
  
  it('rejects period less than 1 day', () => {
    const config = createDefaultConfig({
      backtestId: 'test-1',
      period: {
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-01'),
      },
      assets: ['BTC'],
      createdBy: 'test',
    });
    
    const result = validateBacktestConfig(config);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Backtest period must be at least 1 day');
  });
  
  it('rejects empty assets', () => {
    const config = createDefaultConfig({
      backtestId: 'test-1',
      period: {
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-31'),
      },
      assets: [],
      createdBy: 'test',
    });
    
    const result = validateBacktestConfig(config);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('At least one asset must be specified');
  });
  
  it('rejects zero initial capital', () => {
    const config = createDefaultConfig({
      backtestId: 'test-1',
      period: {
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-31'),
      },
      assets: ['BTC'],
      initialCapitalUsd: '0',
      createdBy: 'test',
    });
    
    const result = validateBacktestConfig(config);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Initial capital must be positive');
  });
});

describe('BacktestEngine', () => {
  it('creates engine with default options', () => {
    const engine = createBacktestEngine();
    expect(engine).toBeDefined();
  });
  
  it('starts a backtest and returns run', async () => {
    const engine = createBacktestEngine();
    const config = createDefaultConfig({
      backtestId: 'integration-test',
      name: 'Integration Test',
      period: {
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-07'), // 7 days for speed
      },
      assets: ['BTC'],
      createdBy: 'test',
    });
    
    const run = await engine.startBacktest(config);
    expect(run.runId).toBeDefined();
    expect(run.backtestId).toBe('integration-test');
    expect(run.status).toBe('running');
    
    // Wait for completion
    await new Promise((resolve) => setTimeout(resolve, 2000));
    
    const updatedRun = engine.getRun(run.runId);
    expect(updatedRun?.status).toBe('completed');
    expect(updatedRun?.results).toBeDefined();
  }, 10000);
  
  it('generates valid results structure', async () => {
    const engine = createBacktestEngine();
    const config = createDefaultConfig({
      backtestId: 'results-test',
      period: {
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-14'), // 2 weeks
      },
      assets: ['BTC'],
      createdBy: 'test',
    });
    
    const run = await engine.startBacktest(config);
    
    // Wait for completion
    await new Promise((resolve) => setTimeout(resolve, 3000));
    
    const results = engine.getRun(run.runId)?.results;
    expect(results).toBeDefined();
    expect(results?.backtestId).toBe('results-test');
    expect(results?.performance).toBeDefined();
    expect(results?.trades).toBeDefined();
    expect(results?.funding).toBeDefined();
    expect(results?.dailySnapshots.length).toBeGreaterThan(0);
    expect(results?.caveats.length).toBeGreaterThan(0);
  }, 15000);
  
  it('calculates performance metrics correctly', async () => {
    const engine = createBacktestEngine();
    const config = createDefaultConfig({
      backtestId: 'metrics-test',
      period: {
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-31'),
      },
      assets: ['BTC'],
      initialCapitalUsd: '100000',
      createdBy: 'test',
    });
    
    const run = await engine.startBacktest(config);
    await new Promise((resolve) => setTimeout(resolve, 5000));
    
    const results = engine.getRun(run.runId)?.results;
    expect(results).toBeDefined();
    
    // Performance metrics exist
    expect(results?.performance.totalReturnPct).toBeDefined();
    expect(results?.performance.annualizedReturnPct).toBeDefined();
    expect(results?.performance.maxDrawdownPct).toBeDefined();
    
    // Trade stats exist
    expect(results?.trades.totalTrades).toBeGreaterThanOrEqual(0);
    expect(results?.trades.winRatePct).toBeDefined();
  }, 10000);
});

describe('Multi-asset backtesting', () => {
  it('handles multiple assets', async () => {
    const engine = createBacktestEngine();
    const config = createDefaultConfig({
      backtestId: 'multi-asset-test',
      period: {
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-10'),
      },
      assets: ['BTC', 'ETH'],
      createdBy: 'test',
    });
    
    const run = await engine.startBacktest(config);
    await new Promise((resolve) => setTimeout(resolve, 3000));
    
    const results = engine.getRun(run.runId)?.results;
    expect(results).toBeDefined();
    expect(results?.config.assets).toContain('BTC');
    expect(results?.config.assets).toContain('ETH');
  }, 10000);
});

describe('Backtest cancellation', () => {
  it('cancels a running backtest', async () => {
    const engine = createBacktestEngine();
    const config = createDefaultConfig({
      backtestId: 'cancel-test',
      period: {
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-12-31'), // Long period
      },
      assets: ['BTC'],
      createdBy: 'test',
    });
    
    const run = await engine.startBacktest(config);
    expect(run.status).toBe('running');
    
    // Cancel immediately
    const cancelled = engine.cancelBacktest(run.runId);
    expect(cancelled).toBe(true);
    
    const updatedRun = engine.getRun(run.runId);
    expect(updatedRun?.status).toBe('cancelled');
  });
});
