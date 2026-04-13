import { Connection, Keypair, PublicKey } from '@solana/web3.js';
import { Decimal } from 'decimal.js';
import { beforeEach, describe, expect, it } from 'vitest';

import {
  RangerVaultClient,
  VaultConfigSchema,
  type VaultClientConfig,
} from '../index.js';

describe('RangerVaultClient', () => {
  let client: RangerVaultClient;
  let mockConnection: Connection;
  let adminSigner: Keypair;
  let managerSigner: Keypair;

  beforeEach(() => {
    mockConnection = new Connection('http://localhost:8899');
    adminSigner = Keypair.generate();
    managerSigner = Keypair.generate();

    const config: VaultClientConfig = {
      connection: mockConnection,
      adminSigner,
      managerSigner,
      mode: 'simulated',
    };

    client = new RangerVaultClient(config);
  });

  function buildVaultConfig() {
    return VaultConfigSchema.parse({
      assetMint: Keypair.generate().publicKey.toBase58(),
      name: 'Sentinel Carry',
      description: 'USDC delta-neutral carry',
      maxCap: '1000000000000',
      startAtTs: 0,
      lockedProfitDegradationDurationSeconds: 86400,
      withdrawalWaitingPeriodSeconds: 0,
      managerPerformanceFeeBps: 1000,
      adminPerformanceFeeBps: 500,
      managerManagementFeeBps: 50,
      adminManagementFeeBps: 25,
      redemptionFeeBps: 10,
      issuanceFeeBps: 10,
      strategyId: 'delta-neutral-carry',
    });
  }

  describe('getIntegrationStatus', () => {
    it('reports simulated mode as available', () => {
      const status = client.getIntegrationStatus();

      expect(status.mode).toBe('simulated');
      expect(status.sdkAvailable).toBe(true);
      expect(status.hasAdminSigner).toBe(true);
      expect(status.hasManagerSigner).toBe(true);
      expect(status.blockerDescription).toBeNull();
    });

    it('reports unavailable when sdk dependencies are missing in full mode', () => {
      const fullClient = new RangerVaultClient({
        connection: mockConnection,
        adminSigner,
        mode: 'full',
      });

      const status = fullClient.getIntegrationStatus();
      expect(['full', 'unavailable']).toContain(status.mode);
      if (status.mode === 'unavailable') {
        expect(status.blockerDescription).toContain('@voltr/vault-sdk');
      }
    });
  });

  describe('createVault', () => {
    it('creates a simulated vault with separate admin and manager roles', async () => {
      const result = await client.createVault({
        config: buildVaultConfig(),
      });

      expect(result.ok).toBe(true);
      if (!result.ok) {
        return;
      }

      expect(result.value.vaultAddress).toBeInstanceOf(PublicKey);
      expect(result.value.shareTokenMint).toBeInstanceOf(PublicKey);
      expect(result.value.admin.toBase58()).toBe(adminSigner.publicKey.toBase58());
      expect(result.value.manager.toBase58()).toBe(managerSigner.publicKey.toBase58());
    });
  });

  describe('metadata + state', () => {
    it('persists simulated lp metadata into vault state', async () => {
      const created = await client.createVault({ config: buildVaultConfig() });
      expect(created.ok).toBe(true);
      if (!created.ok) {
        return;
      }

      const metadataResult = await client.createLpMetadata({
        vaultId: created.value.vaultId,
        name: 'Sentinel LP',
        symbol: 'sLP',
        uri: 'https://example.com/lp.json',
      });

      expect(metadataResult.ok).toBe(true);

      const state = await client.getVaultState(created.value.vaultId);
      expect(state.ok).toBe(true);
      if (!state.ok) {
        return;
      }

      expect(state.value.config.lpTokenName).toBe('Sentinel LP');
      expect(state.value.config.lpTokenSymbol).toBe('sLP');
      expect(state.value.config.strategyMetadataUri).toBe('https://example.com/lp.json');
    });
  });

  describe('config updates', () => {
    it('updates the manager in simulated mode', async () => {
      const created = await client.createVault({ config: buildVaultConfig() });
      expect(created.ok).toBe(true);
      if (!created.ok) {
        return;
      }

      const newManager = Keypair.generate().publicKey;
      const update = await client.updateVaultConfig({
        vaultId: created.value.vaultId,
        field: 'manager',
        value: newManager,
      });

      expect(update.ok).toBe(true);

      const state = await client.getVaultState(created.value.vaultId);
      expect(state.ok).toBe(true);
      if (!state.ok) {
        return;
      }

      expect(state.value.manager.toBase58()).toBe(newManager.toBase58());
    });
  });

  describe('manager/admin operations', () => {
    it('simulates adaptor addition and strategy lifecycle operations', async () => {
      const created = await client.createVault({ config: buildVaultConfig() });
      expect(created.ok).toBe(true);
      if (!created.ok) {
        return;
      }

      const adaptorProgramId = Keypair.generate().publicKey;
      const strategy = Keypair.generate().publicKey;

      const addAdaptor = await client.addAdaptor({
        vaultId: created.value.vaultId,
        adaptorProgramId,
      });
      expect(addAdaptor.ok).toBe(true);

      const initStrategy = await client.initializeStrategy({
        vaultId: created.value.vaultId,
        strategy,
        adaptorProgramId,
        remainingAccounts: [],
      });
      expect(initStrategy.ok).toBe(true);

      const strategyDeposit = await client.depositToStrategy({
        vaultId: created.value.vaultId,
        strategy,
        amount: '1000000',
        adaptorProgramId,
        remainingAccounts: [],
      });
      expect(strategyDeposit.ok).toBe(true);

      const strategyWithdraw = await client.withdrawFromStrategy({
        vaultId: created.value.vaultId,
        strategy,
        amount: '500000',
        adaptorProgramId,
        remainingAccounts: [],
      });
      expect(strategyWithdraw.ok).toBe(true);

      const state = await client.getVaultState(created.value.vaultId);
      expect(state.ok).toBe(true);
      if (!state.ok) {
        return;
      }

      expect(
        state.value.adaptorPrograms.some((program) => program.equals(adaptorProgramId)),
      ).toBe(true);
    });

    it('simulates fee harvest and high-water-mark calibration', async () => {
      const created = await client.createVault({ config: buildVaultConfig() });
      expect(created.ok).toBe(true);
      if (!created.ok) {
        return;
      }

      const harvest = await client.harvestFees({
        vaultId: created.value.vaultId,
        protocolAdmin: Keypair.generate().publicKey,
      });
      expect(harvest.ok).toBe(true);

      const calibrate = await client.calibrateHighWaterMark({
        vaultId: created.value.vaultId,
      });
      expect(calibrate.ok).toBe(true);
    });
  });

  describe('deposit + withdrawal simulation', () => {
    it('tracks nav through simulated deposits and withdrawals', async () => {
      const created = await client.createVault({ config: buildVaultConfig() });
      expect(created.ok).toBe(true);
      if (!created.ok) {
        return;
      }

      const deposit = await client.deposit(created.value.vaultId, {
        depositId: `deposit_${Date.now()}`,
        depositor: Keypair.generate().publicKey,
        amount: new Decimal(50000),
        minSharesOut: new Decimal(49000),
        requestedAt: new Date(),
      });
      expect(deposit.ok).toBe(true);

      const withdrawal = await client.requestWithdrawal(created.value.vaultId, {
        withdrawalId: `withdrawal_${Date.now()}`,
        shareholder: Keypair.generate().publicKey,
        sharesToBurn: new Decimal(10000),
        minAmountOut: new Decimal(10000),
        requestedAt: new Date(),
      });
      expect(withdrawal.ok).toBe(true);

      const nav = await client.calculateNav(created.value.vaultId);
      expect(nav.ok).toBe(true);
      if (!nav.ok) {
        return;
      }

      expect(nav.value.nav.toNumber()).toBe(40000);
      expect(nav.value.sharePrice.toNumber()).toBe(1);
    });
  });
});
