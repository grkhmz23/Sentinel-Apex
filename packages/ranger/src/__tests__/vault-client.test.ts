import { Keypair, Connection, PublicKey } from '@solana/web3.js';
import { Decimal } from 'decimal.js';
import { describe, it, expect, beforeEach } from 'vitest';

import {
  RangerVaultClient,
  VaultConfigSchema,
  type VaultClientConfig,
} from '../index.js';

describe('RangerVaultClient', () => {
  let client: RangerVaultClient;
  let mockConnection: Connection;
  
  beforeEach(() => {
    mockConnection = new Connection('http://localhost:8899');
    
    const config: VaultClientConfig = {
      connection: mockConnection,
      mode: 'simulated',
    };
    
    client = new RangerVaultClient(config);
  });
  
  describe('getIntegrationStatus', () => {
    it('should report simulated mode correctly', () => {
      const status = client.getIntegrationStatus();
      
      expect(status.mode).toBe('simulated');
      expect(status.sdkAvailable).toBe(false);
      expect(status.blockerDescription).toContain('simulated mode');
    });
    
    it('should report unavailable when SDK not present', () => {
      const fullClient = new RangerVaultClient({
        connection: mockConnection,
        mode: 'full',
      });
      
      const status = fullClient.getIntegrationStatus();
      
      expect(status.mode).toBe('unavailable');
      expect(status.sdkAvailable).toBe(false);
      expect(status.blockerDescription).toContain('SDK');
    });
  });
  
  describe('createVault', () => {
    it('should create vault in simulated mode', async () => {
      const config = VaultConfigSchema.parse({
        baseAsset: 'USDC',
        minDeposit: '100',
        maxCapacity: '1000000',
        lockPeriodSeconds: 7884000, // 3 months
        performanceFeeBps: 1000,
        managementFeeBps: 100,
        strategyId: 'delta-neutral-carry',
      });
      
      const authority = Keypair.generate().publicKey;
      
      const result = await client.createVault(config, authority);
      
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.vaultId).toContain('vault_sim_');
        expect(result.value.vaultAddress).toBeInstanceOf(PublicKey);
        expect(result.value.signature).toContain('simulated');
      }
    });
    
    it('should fail in unavailable mode', async () => {
      const unavailableClient = new RangerVaultClient({
        connection: mockConnection,
        mode: 'full',
      });
      
      const config = VaultConfigSchema.parse({
        baseAsset: 'USDC',
        minDeposit: '100',
        maxCapacity: '1000000',
        lockPeriodSeconds: 7884000,
        performanceFeeBps: 1000,
        managementFeeBps: 100,
        strategyId: 'delta-neutral-carry',
      });
      
      const authority = Keypair.generate().publicKey;
      
      const result = await unavailableClient.createVault(config, authority);
      
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toContain('SDK');
      }
    });
  });
  
  describe('deposit', () => {
    it('should process deposit in simulated mode', async () => {
      // First create a vault
      const vaultConfig = VaultConfigSchema.parse({
        baseAsset: 'USDC',
        minDeposit: '100',
        maxCapacity: '1000000',
        lockPeriodSeconds: 7884000,
        performanceFeeBps: 1000,
        managementFeeBps: 100,
        strategyId: 'delta-neutral-carry',
      });
      
      const authority = Keypair.generate().publicKey;
      const createResult = await client.createVault(vaultConfig, authority);
      
      expect(createResult.ok).toBe(true);
      if (!createResult.ok) return;
      
      const { vaultId } = createResult.value;
      
      // Make a deposit
      const depositResult = await client.deposit(vaultId, {
        depositId: `deposit_${Date.now()}`,
        depositor: Keypair.generate().publicKey,
        amount: new Decimal(10000),
        minSharesOut: new Decimal(9000),
        requestedAt: new Date(),
      });
      
      expect(depositResult.ok).toBe(true);
      if (depositResult.ok) {
        expect(depositResult.value.sharesMinted.toNumber()).toBeGreaterThan(0);
        expect(depositResult.value.status).toBe('confirmed');
        expect(depositResult.value.signature).toContain('simulated');
      }
    });
    
    it('should fail deposit for non-existent vault', async () => {
      const result = await client.deposit('non-existent-vault', {
        depositId: `deposit_${Date.now()}`,
        depositor: Keypair.generate().publicKey,
        amount: new Decimal(10000),
        minSharesOut: new Decimal(9000),
        requestedAt: new Date(),
      });
      
      expect(result.ok).toBe(false);
    });
  });
  
  describe('withdrawal', () => {
    it('should process withdrawal in simulated mode', async () => {
      // Create vault
      const vaultConfig = VaultConfigSchema.parse({
        baseAsset: 'USDC',
        minDeposit: '100',
        maxCapacity: '1000000',
        lockPeriodSeconds: 7884000,
        performanceFeeBps: 1000,
        managementFeeBps: 100,
        strategyId: 'delta-neutral-carry',
      });
      
      const authority = Keypair.generate().publicKey;
      const createResult = await client.createVault(vaultConfig, authority);
      
      expect(createResult.ok).toBe(true);
      if (!createResult.ok) return;
      
      const { vaultId } = createResult.value;
      
      // Request withdrawal
      const withdrawalResult = await client.requestWithdrawal(vaultId, {
        withdrawalId: `withdrawal_${Date.now()}`,
        shareholder: Keypair.generate().publicKey,
        sharesToBurn: new Decimal(5000),
        minAmountOut: new Decimal(4500),
        requestedAt: new Date(),
      });
      
      expect(withdrawalResult.ok).toBe(true);
      if (withdrawalResult.ok) {
        expect(withdrawalResult.value.amountReturned.toNumber()).toBeGreaterThan(0);
        expect(withdrawalResult.value.status).toBe('completed');
        expect(withdrawalResult.value.sharesBurned.toNumber()).toBe(5000);
      }
    });
  });
  
  describe('calculateNav', () => {
    it('should return vault AUM as NAV in simulated mode', async () => {
      // Create vault
      const vaultConfig = VaultConfigSchema.parse({
        baseAsset: 'USDC',
        minDeposit: '100',
        maxCapacity: '1000000',
        lockPeriodSeconds: 7884000,
        performanceFeeBps: 1000,
        managementFeeBps: 100,
        strategyId: 'delta-neutral-carry',
      });
      
      const authority = Keypair.generate().publicKey;
      const createResult = await client.createVault(vaultConfig, authority);
      
      expect(createResult.ok).toBe(true);
      if (!createResult.ok) return;
      
      const { vaultId } = createResult.value;
      
      // Make a deposit first
      await client.deposit(vaultId, {
        depositId: `deposit_${Date.now()}`,
        depositor: Keypair.generate().publicKey,
        amount: new Decimal(50000),
        minSharesOut: new Decimal(45000),
        requestedAt: new Date(),
      });
      
      // Calculate NAV
      const navResult = await client.calculateNav(vaultId);
      
      expect(navResult.ok).toBe(true);
      if (navResult.ok) {
        expect(navResult.value.nav.toNumber()).toBe(50000);
        expect(navResult.value.sharePrice.toNumber()).toBe(1);
      }
    });
  });
});
