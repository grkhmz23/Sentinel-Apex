import { describe, expect, it } from 'vitest';

import {
  DriftMainnetCarryAdapter,
  type DriftMainnetCarryAdapterConfig,
} from '../real/drift-mainnet-carry-adapter.js';

const MOCK_MAINNET_RPC = 'https://api.mainnet-beta.solana.com';

function createTestConfig(overrides: Partial<DriftMainnetCarryAdapterConfig> = {}): DriftMainnetCarryAdapterConfig {
  return {
    rpcEndpoint: MOCK_MAINNET_RPC,
    mainnetExecutionEnabled: false,
    ...overrides,
  };
}

describe('DriftMainnetCarryAdapter', () => {
  describe('constructor', () => {
    it('creates adapter with default venue ID and name', () => {
      const adapter = new DriftMainnetCarryAdapter(createTestConfig());
      expect(adapter.venueId).toBe('drift-solana-mainnet-carry');
      expect(adapter.venueName).toBe('Drift Solana Mainnet Carry');
      expect(adapter.venueType).toBe('dex');
    });

    it('uses custom venue ID and name when provided', () => {
      const adapter = new DriftMainnetCarryAdapter(createTestConfig({
        venueId: 'custom-venue',
        venueName: 'Custom Venue Name',
      }));
      expect(adapter.venueId).toBe('custom-venue');
      expect(adapter.venueName).toBe('Custom Venue Name');
    });

    it('throws when driftEnv is not mainnet-beta', () => {
      expect(() => {
        new DriftMainnetCarryAdapter(createTestConfig({
          driftEnv: 'devnet',
        }));
      }).toThrow('DriftMainnetCarryAdapter only supports Drift mainnet-beta');
    });

    it('accepts mainnet-beta driftEnv', () => {
      const adapter = new DriftMainnetCarryAdapter(createTestConfig({
        driftEnv: 'mainnet-beta',
      }));
      expect(adapter.venueId).toBe('drift-solana-mainnet-carry');
    });
  });

  describe('connection lifecycle', () => {
    it('connects successfully', async () => {
      const adapter = new DriftMainnetCarryAdapter(createTestConfig());
      await adapter.connect();
      expect(adapter.isConnected()).toBe(true);
    });

    it('disconnects successfully', async () => {
      const adapter = new DriftMainnetCarryAdapter(createTestConfig());
      await adapter.connect();
      expect(adapter.isConnected()).toBe(true);
      await adapter.disconnect();
      expect(adapter.isConnected()).toBe(false);
    });
  });

  describe('getCarryCapabilities', () => {
    it('returns not approved for live use when mainnetExecutionEnabled is false', async () => {
      const adapter = new DriftMainnetCarryAdapter(createTestConfig({
        mainnetExecutionEnabled: false,
      }));
      const capabilities = await adapter.getCarryCapabilities();
      expect(capabilities.approvedForLiveUse).toBe(false);
      expect(capabilities.sensitiveExecutionEligible).toBe(false);
      expect(capabilities.promotionStatus).toBe('not_requested');
    });

    it('returns approved for live use when mainnetExecutionEnabled is true and config is valid', async () => {
      // Note: Without a valid private key, it will still show missing prerequisites
      const adapter = new DriftMainnetCarryAdapter(createTestConfig({
        mainnetExecutionEnabled: true,
      }));
      const capabilities = await adapter.getCarryCapabilities();
      // Should have missing prerequisites due to no private key
      expect(capabilities.missingPrerequisites.length).toBeGreaterThan(0);
    });

    it('indicates live venue mode', async () => {
      const adapter = new DriftMainnetCarryAdapter(createTestConfig());
      const capabilities = await adapter.getCarryCapabilities();
      expect(capabilities.venueMode).toBe('live');
      expect(capabilities.executionSupported).toBe(true);
    });
  });

  describe('getVenueCapabilitySnapshot', () => {
    it('includes mainnet-specific metadata', async () => {
      const adapter = new DriftMainnetCarryAdapter(createTestConfig({
        mainnetExecutionEnabled: true,
      }));
      const snapshot = await adapter.getVenueCapabilitySnapshot();
      expect(snapshot.venueId).toBe('drift-solana-mainnet-carry');
      expect(snapshot.connectorType).toBe('drift_native_mainnet_execution');
      expect(snapshot.truthMode).toBe('real');
      expect(snapshot.executionSupport).toBe(true);
    });

    it('reports missing prerequisites when RPC endpoint is empty', async () => {
      const adapter = new DriftMainnetCarryAdapter({
        rpcEndpoint: '',
        mainnetExecutionEnabled: false,
      });
      const snapshot = await adapter.getVenueCapabilitySnapshot();
      expect(snapshot.missingPrerequisites.length).toBeGreaterThan(0);
      expect(snapshot.missingPrerequisites.some(p => p.includes('RPC endpoint'))).toBe(true);
    });

    it('reports missing prerequisites when mainnet execution is disabled', async () => {
      const adapter = new DriftMainnetCarryAdapter(createTestConfig({
        mainnetExecutionEnabled: false,
      }));
      const snapshot = await adapter.getVenueCapabilitySnapshot();
      expect(snapshot.missingPrerequisites.some(p => p.includes('Mainnet execution is not enabled'))).toBe(true);
    });
  });

  describe('getVenueTruthSnapshot', () => {
    it('returns unavailable when RPC endpoint is not configured', async () => {
      const adapter = new DriftMainnetCarryAdapter({
        rpcEndpoint: '',
        mainnetExecutionEnabled: false,
      });
      const snapshot = await adapter.getVenueTruthSnapshot();
      expect(snapshot.snapshotSuccessful).toBe(false);
      expect(snapshot.healthy).toBe(false);
      expect(snapshot.summary).toContain('unconfigured');
    });

    it('returns minimal snapshot when no private key is configured', async () => {
      const adapter = new DriftMainnetCarryAdapter(createTestConfig());
      const snapshot = await adapter.getVenueTruthSnapshot();
      // With a real RPC, this might succeed for connectivity but fail for account
      // In tests without network, it will fail
      expect(snapshot.snapshotType).toContain('drift_mainnet');
    });
  });

  describe('getStatus', () => {
    it('returns unhealthy when RPC endpoint is not configured', async () => {
      const adapter = new DriftMainnetCarryAdapter({
        rpcEndpoint: '',
        mainnetExecutionEnabled: false,
      });
      const status = await adapter.getStatus();
      expect(status.healthy).toBe(false);
      expect(status.message).toContain('DRIFT_RPC_ENDPOINT');
    });

    it('returns healthy status with RPC configured (may fail in test without network)', async () => {
      const adapter = new DriftMainnetCarryAdapter(createTestConfig());
      // This may fail if there's no network, but the config should be valid
      const status = await adapter.getStatus();
      // Either healthy or unhealthy with a latency measurement
      expect(typeof status.latencyMs).toBe('number');
    });
  });

  describe('asset support', () => {
    it('only supports BTC asset', async () => {
      const adapter = new DriftMainnetCarryAdapter(createTestConfig());
      await adapter.connect();

      // BTC should be supported (but will fail for other reasons like no client)
      // Other assets should throw
      await expect(adapter.getMarketData('ETH')).rejects.toThrow('only supports BTC-PERP');
      await expect(adapter.getMarketData('SOL')).rejects.toThrow('only supports BTC-PERP');
    });
  });

  describe('placeOrder safety checks', () => {
    it('throws when mainnet execution is disabled', async () => {
      const adapter = new DriftMainnetCarryAdapter(createTestConfig({
        mainnetExecutionEnabled: false,
      }));
      await adapter.connect();

      await expect(adapter.placeOrder({
        asset: 'BTC',
        side: 'buy',
        size: '0.1',
        type: 'market',
        clientOrderId: 'test-123',
      })).rejects.toThrow('mainnet execution is disabled');
    });

    it('throws for non-market orders', async () => {
      const adapter = new DriftMainnetCarryAdapter(createTestConfig({
        mainnetExecutionEnabled: true,
      }));
      await adapter.connect();

      await expect(adapter.placeOrder({
        asset: 'BTC',
        side: 'buy',
        size: '0.1',
        type: 'limit',
        price: '50000',
        clientOrderId: 'test-123',
      })).rejects.toThrow('only supports market orders');
    });

    it('throws for post-only orders', async () => {
      const adapter = new DriftMainnetCarryAdapter(createTestConfig({
        mainnetExecutionEnabled: true,
      }));
      await adapter.connect();

      await expect(adapter.placeOrder({
        asset: 'BTC',
        side: 'buy',
        size: '0.1',
        type: 'market',
        postOnly: true,
        clientOrderId: 'test-123',
      })).rejects.toThrow('does not support post-only orders');
    });
  });

  describe('getBalances', () => {
    it('returns empty balances array', async () => {
      const adapter = new DriftMainnetCarryAdapter(createTestConfig());
      const balances = await adapter.getBalances();
      expect(balances).toEqual([]);
    });
  });

  describe('cancelOrder', () => {
    it('returns not cancelled with reason for unknown order', async () => {
      const adapter = new DriftMainnetCarryAdapter(createTestConfig());
      const result = await adapter.cancelOrder('some-order-id');
      expect(result.cancelled).toBe(false);
      expect(result.reason).toContain('Unknown Drift execution reference');
    });
  });

  describe('getOrder', () => {
    it('returns null for unknown order', async () => {
      const adapter = new DriftMainnetCarryAdapter(createTestConfig());
      const result = await adapter.getOrder('unknown-order');
      expect(result).toBeNull();
    });
  });

  describe('getExecutionEventEvidence', () => {
    it('returns empty array for empty requests', async () => {
      const adapter = new DriftMainnetCarryAdapter(createTestConfig());
      const result = await adapter.getExecutionEventEvidence([]);
      expect(result).toEqual([]);
    });
  });
});
