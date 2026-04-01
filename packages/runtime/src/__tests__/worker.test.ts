import { randomUUID } from 'node:crypto';

import { eq } from 'drizzle-orm';
import { afterEach, describe, expect, it } from 'vitest';

import {
  allocatorRebalanceProposals,
  allocatorRebalanceExecutions,
  carryActions,
  createDatabaseConnection,
  treasuryActionExecutions,
  treasuryActions,
} from '@sentinel-apex/db';
import type {
  VenueCapabilitySnapshot,
  VenueTruthAdapter,
  VenueTruthSnapshot,
} from '@sentinel-apex/venue-adapters';

import { RuntimeControlPlane } from '../control-plane.js';
import { DatabaseAuditWriter, RuntimeStore } from '../store.js';
import { RuntimeWorker } from '../worker.js';

async function createConnectionString(): Promise<string> {
  return `file:///tmp/sentinel-apex-worker-test-${randomUUID()}`;
}

async function waitFor<T>(
  fn: () => Promise<T>,
  predicate: (value: T) => boolean,
  timeoutMs = 30_000,
): Promise<T> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const value = await fn();
    if (predicate(value)) {
      return value;
    }
    await new Promise((resolve) => setTimeout(resolve, 25));
  }

  throw new Error('Timed out waiting for condition');
}

function freshCapturedAt(): string {
  return new Date(Date.now() - 60_000).toISOString();
}

function createStubVenueTruthSnapshot(
  venueId: string,
  venueName: string,
  overrides: Partial<VenueTruthSnapshot> = {},
): VenueTruthSnapshot {
  return {
    venueId,
    venueName,
    snapshotType: 'drift_native_user_account',
    snapshotSuccessful: true,
    healthy: true,
    healthState: 'healthy',
    summary: `Drift-native read-only snapshot captured for ${venueName} with 2 positions, 2 open orders, and health score 84.`,
    errorMessage: null,
    capturedAt: freshCapturedAt(),
    snapshotCompleteness: 'complete',
    truthCoverage: {
      accountState: {
        status: 'available',
        reason: null,
        limitations: [],
      },
      balanceState: {
        status: 'unsupported',
        reason: 'Drift-native read-only decode exposes collateral inventory via derivative positions rather than generic wallet balances.',
        limitations: [],
      },
      capacityState: {
        status: 'unsupported',
        reason: 'Read-only Drift connector does not expose treasury-style venue capacity.',
        limitations: [],
      },
      exposureState: {
        status: 'available',
        reason: null,
        limitations: ['Exposure rows are operator-facing derived views over decoded Drift positions.'],
      },
      derivativeAccountState: {
        status: 'available',
        reason: null,
        limitations: [],
      },
      derivativePositionState: {
        status: 'available',
        reason: null,
        limitations: ['Inventory is venue-native; valuation fields are Drift SDK calculations over current market and oracle state.'],
      },
      derivativeHealthState: {
        status: 'available',
        reason: null,
        limitations: ['Health and margin metrics are Drift SDK calculations over venue-native state.'],
      },
      orderState: {
        status: 'available',
        reason: null,
        limitations: ['placedAt is intentionally null because the read-only path does not backfill per-order timestamps.'],
      },
      executionReferences: {
        status: 'available',
        reason: null,
        limitations: ['Execution references are recent Solana signatures for the tracked Drift user account.'],
      },
    },
    sourceMetadata: {
      sourceKind: 'adapter',
      sourceName: 'drift_native_readonly',
      connectorDepth: 'drift_native_readonly',
      commitment: 'confirmed',
      observedSlot: '123',
      observedScope: [
        'drift_user_account_lookup',
        'drift_user_account_decode',
        'drift_position_inventory',
        'drift_margin_health',
        'drift_open_orders',
        'recent_signatures',
      ],
      provenanceNotes: [
        'This connector is read-only and never signs or submits transactions.',
        'Derivative health and valuation metrics are Drift SDK calculations over decoded user, market, and oracle state.',
      ],
    },
    accountState: {
      accountAddress: `${venueId}-account`,
      accountLabel: venueName,
      accountExists: true,
      ownerProgram: 'drift-program',
      executable: false,
      lamports: '12000000000',
      nativeBalanceDisplay: '12.000000000',
      observedSlot: '123',
      rentEpoch: '0',
      dataLength: 512,
    },
    balanceState: null,
    capacityState: null,
    exposureState: {
      exposures: [{
        exposureKey: `perp:0:${venueId}-account`,
        exposureType: 'position',
        assetKey: 'BTC-PERP',
        quantity: '0.75',
        quantityDisplay: '0.75',
        accountAddress: `${venueId}-account`,
      }],
      methodology: 'drift_position_inventory_exposure',
      provenance: {
        classification: 'derived',
        source: 'drift_sdk_margin_math',
        notes: ['Exposure rows were derived from decoded Drift position inventory.'],
      },
    },
    derivativeAccountState: {
      venue: venueId,
      accountAddress: `${venueId}-account`,
      accountLabel: venueName,
      accountExists: true,
      ownerProgram: 'drift-program',
      accountModel: 'program_account',
      venueAccountType: 'drift_user',
      decoded: true,
      authorityAddress: `${venueId}-authority`,
      subaccountId: 0,
      userName: venueName,
      delegateAddress: `${venueId}-delegate`,
      marginMode: 'default',
      poolId: 0,
      marginTradingEnabled: true,
      openOrderCount: 2,
      openAuctionCount: 0,
      statusFlags: ['protected_maker'],
      observedSlot: '123',
      rpcVersion: '1.18.0',
      dataLength: 512,
      rawDiscriminatorHex: '0102030405060708',
      notes: [
        'The Drift user account was decoded directly with the Drift SDK account coder.',
        'Order inventory in this snapshot comes directly from the user account, while health and liquidation metrics are SDK-derived.',
      ],
      provenance: {
        classification: 'exact',
        source: 'drift_user_account_decode',
        notes: ['Values were decoded directly from the Drift user account.'],
      },
    },
    derivativePositionState: {
      positions: [
        {
          marketIndex: 0,
          marketKey: 'perp:0',
          marketSymbol: 'BTC-PERP',
          positionType: 'perp',
          side: 'long',
          baseAssetAmount: '0.75',
          quoteAssetAmount: '-51250',
          entryPrice: '68333.333333',
          breakEvenPrice: '68400.000000',
          unrealizedPnlUsd: '950.250000',
          liquidationPrice: '52100.000000',
          positionValueUsd: '52125.000000',
          openOrders: 1,
          openBids: '0.10',
          openAsks: '0',
          metadata: {},
          provenance: {
            classification: 'mixed',
            source: 'drift_user_account_with_market_context',
            notes: ['Inventory is exact while valuation uses Drift SDK market context.'],
          },
        },
        {
          marketIndex: 1,
          marketKey: 'spot:1',
          marketSymbol: 'SOL',
          positionType: 'spot',
          side: 'long',
          baseAssetAmount: '12.500000000',
          quoteAssetAmount: null,
          entryPrice: null,
          breakEvenPrice: null,
          unrealizedPnlUsd: null,
          liquidationPrice: '102.100000',
          positionValueUsd: '1875.000000',
          openOrders: 1,
          openBids: null,
          openAsks: null,
          metadata: {},
          provenance: {
            classification: 'mixed',
            source: 'drift_user_account_with_market_context',
            notes: ['Spot balance identity is exact while valuation uses Drift spot-market context.'],
          },
        },
      ],
      openPositionCount: 2,
      methodology: 'drift_user_account_with_market_context',
      notes: [
        'Perp and spot inventory was decoded from the Drift user account.',
        'Valuation and liquidation fields used subscribed Drift market and oracle state where required.',
      ],
      provenance: {
        classification: 'mixed',
        source: 'drift_user_account_with_market_context',
        notes: ['Inventory is exact venue-native state while valuation fields are SDK-derived.'],
      },
    },
    derivativeHealthState: {
      healthStatus: 'healthy',
      healthScore: 84,
      collateralUsd: '153450.250000',
      marginRatio: '0.2841',
      leverage: '2.1100',
      maintenanceMarginRequirementUsd: '18050.000000',
      initialMarginRequirementUsd: '26250.000000',
      freeCollateralUsd: '109150.250000',
      methodology: 'drift_sdk_margin_calculation',
      notes: [
        'Health, collateral, leverage, and margin metrics are derived from decoded Drift user, market, and oracle state.',
      ],
      provenance: {
        classification: 'derived',
        source: 'drift_sdk_margin_math',
        notes: ['All health and margin metrics are SDK-derived from venue-native state.'],
      },
    },
    orderState: {
      openOrderCount: 2,
      openOrders: [
        {
          marketIndex: 0,
          venueOrderId: '901',
          reference: '41',
          marketKey: 'perp:0',
          marketSymbol: 'BTC-PERP',
          marketType: 'perp',
          userOrderId: 41,
          side: 'buy',
          status: 'open',
          orderType: 'limit',
          price: '68000.000000',
          quantity: '0.100000000',
          reduceOnly: false,
          accountAddress: `${venueId}-account`,
          slot: '123',
          placedAt: null,
          metadata: {},
          provenance: {
            classification: 'exact',
            source: 'drift_user_account_decode',
            notes: ['Open-order inventory was decoded directly from the Drift user account.'],
          },
        },
        {
          marketIndex: 1,
          venueOrderId: '902',
          reference: '42',
          marketKey: 'spot:1',
          marketSymbol: 'SOL',
          marketType: 'spot',
          userOrderId: 42,
          side: 'sell',
          status: 'open',
          orderType: 'limit',
          price: '151.250000',
          quantity: '4.500000000',
          reduceOnly: false,
          accountAddress: `${venueId}-account`,
          slot: '123',
          placedAt: null,
          metadata: {},
          provenance: {
            classification: 'exact',
            source: 'drift_user_account_decode',
            notes: ['Open-order inventory was decoded directly from the Drift user account.'],
          },
        },
      ],
      referenceMode: 'venue_open_orders',
      methodology: 'drift_user_account_open_orders',
      notes: [
        'Open-order inventory was decoded directly from the Drift user account.',
        'placedAt remains null because this read-only path does not backfill transaction timestamps for each order.',
      ],
      provenance: {
        classification: 'exact',
        source: 'drift_user_account_decode',
        notes: ['Open-order inventory was decoded directly from the Drift user account.'],
      },
    },
    executionReferenceState: {
      referenceLookbackLimit: 10,
      references: [{
        referenceType: 'solana_signature',
        reference: `${venueId}-sig-1`,
        accountAddress: `${venueId}-account`,
        slot: '123',
        blockTime: '2026-03-31T11:59:00.000Z',
        confirmationStatus: 'confirmed',
        errored: false,
        memo: null,
      }],
      oldestReferenceAt: '2026-03-31T11:59:00.000Z',
    },
    payload: {
      accountAddress: `${venueId}-account`,
      authorityAddress: `${venueId}-authority`,
      subaccountId: 0,
      openOrderCount: 2,
      openPositionCount: 2,
      healthScore: 84,
    },
    metadata: {},
    ...overrides,
  };
}

class StubReadonlyVenueTruthAdapter implements VenueTruthAdapter {
  private connected = false;
  private snapshot: VenueTruthSnapshot;

  constructor(
    readonly venueId: string,
    readonly venueName: string,
    snapshot: Partial<VenueTruthSnapshot>,
    private readonly capabilityOverrides: Partial<VenueCapabilitySnapshot> = {},
  ) {
    this.snapshot = createStubVenueTruthSnapshot(venueId, venueName, snapshot);
  }

  async connect(): Promise<void> {
    this.connected = true;
  }

  async disconnect(): Promise<void> {
    this.connected = false;
  }

  isConnected(): boolean {
    return this.connected;
  }

  async getVenueCapabilitySnapshot(): Promise<VenueCapabilitySnapshot> {
    return {
      venueId: this.venueId,
      venueName: this.venueName,
      sleeveApplicability: ['carry'],
      connectorType: 'drift_native_readonly',
      truthMode: 'real',
      readOnlySupport: true,
      executionSupport: false,
      approvedForLiveUse: false,
      onboardingState: 'read_only',
      missingPrerequisites: [],
      authRequirementsSummary: [
        'DRIFT_RPC_ENDPOINT',
        'DRIFT_READONLY_ENV',
        'DRIFT_READONLY_ACCOUNT_ADDRESS or DRIFT_READONLY_AUTHORITY_ADDRESS',
      ],
      healthy: this.snapshot.healthy,
      healthState: this.snapshot.healthState,
      degradedReason: this.snapshot.errorMessage,
      metadata: {
        executionPosture: 'read_only',
      },
      ...this.capabilityOverrides,
    };
  }

  async getVenueTruthSnapshot(): Promise<VenueTruthSnapshot> {
    return this.snapshot;
  }

  setSnapshot(snapshot: Partial<VenueTruthSnapshot>): void {
    this.snapshot = createStubVenueTruthSnapshot(this.venueId, this.venueName, snapshot);
  }
}

describe('RuntimeWorker', () => {
  const cleanups: Array<() => Promise<void>> = [];

  afterEach(async () => {
    while (cleanups.length > 0) {
      const cleanup = cleanups.pop();
      if (cleanup !== undefined) {
        await cleanup();
      }
    }
  });

  it('boots, schedules cycles, and shuts down with persisted worker metadata', async () => {
    const connectionString = await createConnectionString();
    const controlPlane = await RuntimeControlPlane.connect(connectionString);
    const worker = await RuntimeWorker.createDeterministic(connectionString, {}, {
      cycleIntervalMs: 25,
      pollIntervalMs: 10,
    });

    cleanups.push(async () => {
      await worker.stop();
    });

    await worker.start();

    const runtimeStatus = await waitFor(
      () => controlPlane.getRuntimeStatus(),
      (status) => status.lastRunStatus === 'completed',
    );
    const workerStatus = await controlPlane.getWorkerStatus();
    const treasurySummary = await waitFor(
      () => controlPlane.getTreasurySummary(),
      (summary): summary is Exclude<typeof summary, null> => summary !== null,
    );
    if (treasurySummary === null) {
      throw new Error('Expected treasury summary to be present');
    }

    expect(runtimeStatus.lastRunId).toBeTruthy();
    expect(workerStatus.lifecycleState).toMatch(/ready|degraded/);
    expect(workerStatus.lastHeartbeatAt).toBeTruthy();
    expect(workerStatus.lastSuccessAt).toBeTruthy();
    expect(treasurySummary.sleeveId).toBe('treasury');
    expect(treasurySummary.actionCount).toBeGreaterThanOrEqual(0);
  }, 90_000);

  it('processes commands serially, persists failures as mismatches, and records recovery history', async () => {
    const connectionString = await createConnectionString();
    const controlPlane = await RuntimeControlPlane.connect(connectionString);
    const worker = await RuntimeWorker.createDeterministic(connectionString, {}, {
      cycleIntervalMs: 1000,
      pollIntervalMs: 10,
    });

    cleanups.push(async () => {
      await worker.stop();
    });

    await worker.start();
    await controlPlane.activateKillSwitch('worker-test-pause', 'vitest');

    const blockedCommand = await controlPlane.enqueueCommand('run_cycle', 'vitest', {
      triggerSource: 'vitest-blocked-cycle',
    });
    const failedCommand = await waitFor(
      async () => controlPlane.getCommand(blockedCommand.commandId),
      (command): command is Exclude<typeof command, null> => command !== null && command.status === 'failed',
    );
    if (failedCommand === null) {
      throw new Error('Expected failed command to be present');
    }
    expect(failedCommand.errorMessage).toContain('Runtime is paused');

    const mismatches = await waitFor(
      () => controlPlane.listMismatches(20, { status: 'open' }),
      (items) => items.some((item) => item.category === 'recovery_action_failure'),
    );
    expect(mismatches.some((item) => item.category === 'recovery_action_failure')).toBe(true);

    await controlPlane.resume('worker-test-resume', 'vitest');

    const firstCommand = await controlPlane.enqueueCommand('run_cycle', 'vitest', {
      triggerSource: 'vitest-first-command',
    });
    const secondCommand = await controlPlane.enqueueCommand('run_cycle', 'vitest', {
      triggerSource: 'vitest-second-command',
    });

    const completedFirst = await waitFor(
      async () => controlPlane.getCommand(firstCommand.commandId),
      (command): command is Exclude<typeof command, null> => command !== null && command.status === 'completed',
    );
    const completedSecond = await waitFor(
      async () => controlPlane.getCommand(secondCommand.commandId),
      (command): command is Exclude<typeof command, null> => command !== null && command.status === 'completed',
    );
    if (completedFirst === null || completedSecond === null) {
      throw new Error('Expected completed commands to be present');
    }

    expect(completedFirst.result['runId']).toBeTruthy();
    expect(completedSecond.result['runId']).toBeTruthy();
    expect(completedSecond.startedAt !== null && completedFirst.completedAt !== null).toBe(true);

    const recoveryEvents = await controlPlane.listRecoveryEvents(20);
    expect(recoveryEvents.some((event) => event.eventType === 'runtime_command_failed')).toBe(true);
    expect(recoveryEvents.some((event) => event.eventType === 'runtime_command_completed')).toBe(true);
  });

  it('supports acknowledge, recovering, resolve, verify, and reopen lifecycle transitions', async () => {
    const connectionString = await createConnectionString();
    const controlPlane = await RuntimeControlPlane.connect(connectionString);
    const worker = await RuntimeWorker.createDeterministic(connectionString, {}, {
      cycleIntervalMs: 1000,
      pollIntervalMs: 10,
    });

    cleanups.push(async () => {
      await worker.stop();
    });

    await worker.start();
    await controlPlane.activateKillSwitch('phase-1-7-test-pause', 'vitest');

    const blockedCommand = await controlPlane.enqueueCommand('run_cycle', 'vitest', {
      triggerSource: 'phase-1-7-test-cycle',
    });
    await waitFor(
      async () => controlPlane.getCommand(blockedCommand.commandId),
      (command): command is Exclude<typeof command, null> => command !== null && command.status === 'failed',
    );

    const openMismatch = await waitFor(
      async () => {
        const mismatches = await controlPlane.listMismatches(20);
        return mismatches.find((item) => item.category === 'recovery_action_failure') ?? null;
      },
      (mismatch): mismatch is Exclude<typeof mismatch, null> => mismatch !== null,
    );
    if (openMismatch === null) {
      throw new Error('Expected recovery_action_failure mismatch to exist');
    }

    expect(openMismatch.status).toBe('open');

    const acknowledged = await controlPlane.acknowledgeMismatch(
      openMismatch.id,
      'vitest',
      'operator saw the failure',
    );
    expect(acknowledged?.status).toBe('acknowledged');
    expect(acknowledged?.acknowledgedBy).toBe('vitest');

    const recovering = await controlPlane.startMismatchRecovery({
      mismatchId: openMismatch.id,
      actorId: 'vitest',
      summary: 'linking a recovery command',
      commandId: blockedCommand.commandId,
    });
    expect(recovering?.status).toBe('recovering');
    expect(recovering?.linkedCommandId).toBe(blockedCommand.commandId);

    const resolved = await controlPlane.resolveMismatch({
      mismatchId: openMismatch.id,
      actorId: 'vitest',
      summary: 'investigation complete and fix applied',
      commandId: blockedCommand.commandId,
    });
    expect(resolved?.status).toBe('resolved');
    expect(resolved?.resolvedBy).toBe('vitest');

    const verified = await controlPlane.verifyMismatch({
      mismatchId: openMismatch.id,
      actorId: 'vitest',
      summary: 'fix confirmed by operator review',
    });
    expect(verified?.status).toBe('verified');
    expect(verified?.verificationOutcome).toBe('verified');

    const reopened = await controlPlane.reopenMismatch(
      openMismatch.id,
      'vitest',
      'issue reappeared after verification',
    );
    expect(reopened?.status).toBe('reopened');
    expect(reopened?.reopenedBy).toBe('vitest');

    const failedVerificationReopen = await controlPlane.resolveMismatch({
      mismatchId: openMismatch.id,
      actorId: 'vitest',
      summary: 'second fix applied',
    });
    expect(failedVerificationReopen?.status).toBe('resolved');

    const verificationFailed = await controlPlane.verifyMismatch({
      mismatchId: openMismatch.id,
      actorId: 'vitest',
      summary: 'verification failed; problem still present',
      outcome: 'failed',
    });
    expect(verificationFailed?.status).toBe('reopened');
    expect(verificationFailed?.verificationOutcome).toBe('failed');

    await expect(
      controlPlane.verifyMismatch({
        mismatchId: openMismatch.id,
        actorId: 'vitest',
        summary: 'invalid verification attempt from reopened',
      }),
    ).rejects.toThrow('Cannot verify mismatch');

    const detail = await controlPlane.getMismatchDetail(openMismatch.id);
    expect(detail?.mismatch.status).toBe('reopened');
    expect(detail?.linkedCommand?.commandId).toBe(blockedCommand.commandId);
    expect(detail?.recoveryEvents.some((event) => event.eventType === 'mismatch_recovery_started')).toBe(true);
    expect(detail?.recoveryEvents.some((event) => event.eventType === 'mismatch_verified')).toBe(true);
    expect(detail?.recoveryEvents.some((event) => event.eventType === 'mismatch_verification_failed')).toBe(true);

    const summary = await controlPlane.summarizeMismatches();
    expect(summary.statusCounts.reopened).toBeGreaterThanOrEqual(1);
    expect(summary.activeMismatchCount).toBeGreaterThanOrEqual(1);
  });

  it('creates durable mismatch-scoped remediation attempts and exposes successful outcomes in detail', async () => {
    const connectionString = await createConnectionString();
    const controlPlane = await RuntimeControlPlane.connect(connectionString);
    const worker = await RuntimeWorker.createDeterministic(connectionString, {}, {
      cycleIntervalMs: 1000,
      pollIntervalMs: 25,
    });

    cleanups.push(async () => {
      await worker.stop();
    });

    await worker.start();
    await controlPlane.activateKillSwitch('phase-1-8-open-mismatch', 'vitest');

    const blockedCommand = await controlPlane.enqueueCommand('run_cycle', 'vitest', {
      triggerSource: 'phase-1-8-open-mismatch',
    });
    await waitFor(
      async () => controlPlane.getCommand(blockedCommand.commandId),
      (command): command is Exclude<typeof command, null> => command !== null && command.status === 'failed',
    );

    const mismatch = await waitFor(
      async () => {
        const mismatches = await controlPlane.listMismatches(20);
        return mismatches.find((item) => item.category === 'recovery_action_failure') ?? null;
      },
      (value): value is Exclude<typeof value, null> => value !== null,
    );
    if (mismatch === null) {
      throw new Error('Expected mismatch to exist');
    }

    await controlPlane.acknowledgeMismatch(mismatch.id, 'vitest', 'operator acknowledged mismatch');
    await controlPlane.resume('phase-1-8-remediation-success', 'vitest');

    const remediation = await controlPlane.remediateMismatch({
      mismatchId: mismatch.id,
      actorId: 'vitest',
      remediationType: 'rebuild_projections',
      summary: 'rebuild projections for mismatch context',
    });

    expect(remediation.commandId).toBeTruthy();
    expect(remediation.attemptSequence).toBe(1);
    expect(remediation.status).toBe('requested');

    const completedRemediation = await waitFor(
      async () => controlPlane.getLatestMismatchRemediation(mismatch.id),
      (value): value is Exclude<typeof value, null> => value !== null && value.status === 'completed',
    );
    if (completedRemediation === null) {
      throw new Error('Expected remediation to complete');
    }

    expect(completedRemediation.command?.status).toBe('completed');
    expect(completedRemediation.latestRecoveryEvent?.eventType).toBe('runtime_command_completed');

    const detail = await controlPlane.getMismatchDetail(mismatch.id);
    expect(detail?.mismatch.status).toBe('recovering');
    expect(detail?.latestRemediation?.id).toBe(completedRemediation.id);
    expect(detail?.remediationInFlight).toBe(false);
    expect(detail?.isActionable).toBe(true);
    expect(detail?.remediationHistory).toHaveLength(1);
    expect(detail?.remediationHistory[0]?.command?.commandId).toBe(remediation.commandId);
    expect(detail?.recoveryEvents.some((event) => event.eventType === 'mismatch_remediation_requested')).toBe(true);
  });

  it('processes explicit treasury evaluation commands and persists treasury read models', async () => {
    const connectionString = await createConnectionString();
    const controlPlane = await RuntimeControlPlane.connect(connectionString);
    const worker = await RuntimeWorker.createDeterministic(connectionString, {}, {
      cycleIntervalMs: 1000,
      pollIntervalMs: 10,
    });

    cleanups.push(async () => {
      await worker.stop();
    });

    await worker.start();

    const command = await controlPlane.enqueueTreasuryEvaluation('vitest');
    const completedCommand = await waitFor(
      async () => controlPlane.getCommand(command.commandId),
      (value): value is Exclude<typeof value, null> => value !== null && value.status === 'completed',
    );
    const treasurySummary = await waitFor(
      () => controlPlane.getTreasurySummary(),
      (summary): summary is Exclude<typeof summary, null> => summary !== null,
    );
    if (completedCommand === null || treasurySummary === null) {
      throw new Error('Expected treasury command and summary to be present');
    }
    const allocations = await controlPlane.listTreasuryAllocations(10);
    const actions = await controlPlane.listTreasuryActions(10);

    expect(completedCommand.result['treasuryRunId']).toBe(treasurySummary.treasuryRunId);
    expect(allocations.length).toBeGreaterThan(0);
    expect(actions.length).toBeGreaterThan(0);
    expect(treasurySummary.reserveStatus.requiredReserveUsd).not.toBe('0.00');
  });

  it('approves rebalance proposals and executes them through the runtime command rail', async () => {
    const connectionString = await createConnectionString();
    const controlPlane = await RuntimeControlPlane.connect(connectionString);
    const worker = await RuntimeWorker.createDeterministic(connectionString, {}, {
      cycleIntervalMs: 1000,
      pollIntervalMs: 10,
    });

    cleanups.push(async () => {
      await worker.stop();
    });

    await worker.start();

    const command = await controlPlane.enqueueAllocatorEvaluation('vitest', {
      actorId: 'vitest',
      trigger: 'worker_rebalance_test',
    });
    await waitFor(
      async () => controlPlane.getCommand(command.commandId),
      (value): value is Exclude<typeof value, null> => value !== null && value.status === 'completed',
    );

    const proposals = await waitFor(
      async () => controlPlane.listRebalanceProposals(10),
      (value): value is Exclude<typeof value, null> => value.length > 0,
    );
    const actionable = proposals.find((proposal) => proposal.executable);
    if (actionable === undefined) {
      throw new Error('Expected actionable rebalance proposal.');
    }

    const executionCommand = await controlPlane.approveRebalanceProposal(actionable.id, 'vitest', 'operator');
    expect(executionCommand?.commandType).toBe('execute_rebalance_proposal');

    const completedCommand = await waitFor(
      async () => controlPlane.getCommand(String(executionCommand?.commandId)),
      (value): value is Exclude<typeof value, null> => value !== null && value.status === 'completed',
    );
    const detail = await waitFor(
      async () => controlPlane.getRebalanceProposal(actionable.id),
      (value): value is Exclude<typeof value, null> => value !== null && value.executions.length > 0,
    );
    const downstreamCarryActionIds = Array.isArray(completedCommand?.result['downstreamCarryActionIds'])
      ? completedCommand.result['downstreamCarryActionIds'].filter((value): value is string => typeof value === 'string')
      : [];
    const downstreamTreasuryActionIds = Array.isArray(completedCommand?.result['downstreamTreasuryActionIds'])
      ? completedCommand.result['downstreamTreasuryActionIds'].filter((value): value is string => typeof value === 'string')
      : [];
    const graph = await waitFor(
      async () => controlPlane.getRebalanceExecutionGraph(actionable.id),
      (value): value is Exclude<typeof value, null> => value !== null && value.timeline.length > 0,
    );
    const bundle = await waitFor(
      async () => controlPlane.getRebalanceBundleForProposal(actionable.id),
      (value): value is Exclude<typeof value, null> => value !== null,
    );
    if (bundle === null) {
      throw new Error('Expected rebalance bundle detail.');
    }

    expect(completedCommand?.result['proposalId']).toBe(actionable.id);
    expect(detail?.executions.length).toBeGreaterThan(0);
    expect(detail?.proposal.linkedCommandId).toBe(executionCommand?.commandId ?? null);
    expect(Array.isArray(completedCommand?.result['downstreamCarryActionIds'])).toBe(true);
    expect(Array.isArray(completedCommand?.result['downstreamTreasuryActionIds'])).toBe(true);
    expect(graph?.downstream.carry.rollup.actionCount).toBe(downstreamCarryActionIds.length);
    expect(graph?.downstream.carry.actions.map((action) => action.action.id).sort()).toEqual(
      [...downstreamCarryActionIds].sort(),
    );
    if (downstreamCarryActionIds.length > 0) {
      expect(graph?.downstream.carry.actions.every((action) => action.action.linkedRebalanceProposalId === actionable.id)).toBe(true);
    }
    expect(graph?.downstream.treasury.actions.map((action) => action.action.id).sort()).toEqual(
      [...downstreamTreasuryActionIds].sort(),
    );
    if (downstreamTreasuryActionIds.length > 0) {
      expect(graph?.downstream.treasury.actions.every((action) => action.action.linkedRebalanceProposalId === actionable.id)).toBe(true);
    } else {
      expect(graph?.downstream.treasury.note).toBeTruthy();
    }
    expect(bundle.bundle.proposalId).toBe(actionable.id);
    expect(bundle.graph.detail.proposal.id).toBe(actionable.id);
    expect(bundle.bundle.totalChildCount).toBeGreaterThanOrEqual(bundle.bundle.completedChildCount);
    expect(bundle.bundle.interventionRecommendation).toBeTruthy();
  });

  it('rolls partial downstream application into a requires_intervention bundle recommendation', async () => {
    const connectionString = await createConnectionString();
    const controlPlane = await RuntimeControlPlane.connect(connectionString);
    const connection = await createDatabaseConnection(connectionString);
    const worker = await RuntimeWorker.createDeterministic(connectionString, {}, {
      cycleIntervalMs: 1000,
      pollIntervalMs: 10,
    });

    cleanups.push(async () => {
      await worker.stop();
    });
    cleanups.push(async () => {
      await connection.close();
    });

    await worker.start();

    const command = await controlPlane.enqueueAllocatorEvaluation('vitest', {
      actorId: 'vitest',
      trigger: 'worker_rebalance_bundle_partial_test',
    });
    await waitFor(
      async () => controlPlane.getCommand(command.commandId),
      (value): value is Exclude<typeof value, null> => value !== null && value.status === 'completed',
    );

    const proposal = await waitFor(
      async () => {
        const proposals = await controlPlane.listRebalanceProposals(10);
        return proposals[0] ?? null;
      },
      (value): value is Exclude<typeof value, null> => value !== null,
    );
    const treasurySummary = await waitFor(
      () => controlPlane.getTreasurySummary(),
      (value): value is Exclude<typeof value, null> => value !== null,
    );
    if (proposal === null || treasurySummary === null) {
      throw new Error('Expected rebalance proposal and treasury summary.');
    }

    const [rebalanceExecution] = await connection.db
      .insert(allocatorRebalanceExecutions)
      .values({
        proposalId: proposal.id,
        commandId: 'command-partial-bundle-1',
        status: 'completed',
        executionMode: proposal.executionMode,
        simulated: proposal.simulated,
        requestedBy: 'vitest',
        startedBy: 'worker-test',
        outcomeSummary: 'Manual partial bundle setup for runtime test.',
        outcome: {
          applied: true,
        },
        createdAt: new Date('2026-03-20T12:03:00.000Z'),
        startedAt: new Date('2026-03-20T12:03:01.000Z'),
        completedAt: new Date('2026-03-20T12:03:02.000Z'),
        updatedAt: new Date('2026-03-20T12:03:02.000Z'),
      })
      .returning();

    const [carryAction] = await connection.db
      .insert(carryActions)
      .values({
        strategyRunId: null,
        linkedRebalanceProposalId: proposal.id,
        actionType: 'increase_carry_exposure',
        status: 'recommended',
        sourceKind: 'rebalance',
        sourceReference: proposal.id,
        opportunityId: null,
        asset: null,
        summary: 'Carry child remained blocked for bundle test.',
        notionalUsd: '150000.00',
        details: {},
        readiness: 'blocked',
        executable: false,
        blockedReasons: [{
          code: 'venue_execution_unsupported',
          category: 'venue_capability',
          message: 'Carry venue remains unsupported for execution.',
          operatorAction: 'Inspect venue readiness before retrying.',
          details: {},
        }],
        approvalRequirement: 'operator',
        executionMode: proposal.executionMode,
        simulated: true,
        executionPlan: {},
        actorId: 'vitest',
        createdAt: new Date('2026-03-20T12:03:03.000Z'),
        updatedAt: new Date('2026-03-20T12:03:03.000Z'),
      })
      .returning();

    const [treasuryAction] = await connection.db
      .insert(treasuryActions)
      .values({
        treasuryRunId: treasurySummary.treasuryRunId,
        linkedRebalanceProposalId: proposal.id,
        actionType: 'rebalance_treasury_budget',
        status: 'completed',
        venueId: null,
        venueName: null,
        venueMode: 'reserve',
        amountUsd: '150000.00',
        reasonCode: 'rebalance_budget_application',
        summary: 'Treasury child completed for bundle test.',
        details: {
          rebalanceProposalId: proposal.id,
        },
        readiness: 'actionable',
        executable: true,
        blockedReasons: [],
        approvalRequirement: 'operator',
        executionMode: proposal.executionMode,
        simulated: true,
        approvedBy: 'vitest',
        approvedAt: new Date('2026-03-20T12:03:04.000Z'),
        completedAt: new Date('2026-03-20T12:03:06.000Z'),
        actorId: 'vitest',
        createdAt: new Date('2026-03-20T12:03:04.000Z'),
        updatedAt: new Date('2026-03-20T12:03:06.000Z'),
      })
      .returning();
    if (
      rebalanceExecution === undefined
      || carryAction === undefined
      || treasuryAction === undefined
    ) {
      throw new Error('Expected manual partial bundle rows to persist.');
    }

    const [treasuryExecution] = await connection.db
      .insert(treasuryActionExecutions)
      .values({
        treasuryActionId: treasuryAction.id,
        treasuryRunId: treasurySummary.treasuryRunId,
        commandId: 'command-partial-bundle-1',
        status: 'completed',
        executionMode: proposal.executionMode,
        venueMode: 'reserve',
        simulated: true,
        requestedBy: 'vitest',
        startedBy: 'worker-test',
        blockedReasons: [],
        outcomeSummary: 'Budget-state treasury application completed.',
        outcome: {
          executionKind: 'budget_state_application',
          rebalanceProposalId: proposal.id,
        },
        createdAt: new Date('2026-03-20T12:03:05.000Z'),
        startedAt: new Date('2026-03-20T12:03:05.000Z'),
        completedAt: new Date('2026-03-20T12:03:06.000Z'),
        updatedAt: new Date('2026-03-20T12:03:06.000Z'),
      })
      .returning();
    if (
      rebalanceExecution === undefined
      || carryAction === undefined
      || treasuryAction === undefined
      || treasuryExecution === undefined
    ) {
      throw new Error('Expected manual bundle setup rows to persist.');
    }

    await connection.db
      .update(allocatorRebalanceProposals)
      .set({
        status: 'completed',
        latestExecutionId: rebalanceExecution.id,
        linkedCommandId: 'command-partial-bundle-1',
        updatedAt: new Date('2026-03-20T12:03:06.000Z'),
      })
      .where(eq(allocatorRebalanceProposals.id, proposal.id));

    await connection.db
      .update(treasuryActions)
      .set({
        latestExecutionId: treasuryExecution.id,
        updatedAt: new Date('2026-03-20T12:03:06.000Z'),
      })
      .where(eq(treasuryActions.id, treasuryAction.id));

    await connection.db
      .update(allocatorRebalanceExecutions)
      .set({
        outcome: {
          applied: true,
          downstreamCarryActionIds: [carryAction.id],
          downstreamTreasuryActionIds: [treasuryAction.id],
        },
        updatedAt: new Date('2026-03-20T12:03:06.000Z'),
      })
      .where(eq(allocatorRebalanceExecutions.id, rebalanceExecution.id));

    const proposalDetail = await controlPlane.getRebalanceProposal(proposal.id);
    if (proposalDetail === null) {
      throw new Error('Expected rebalance proposal detail.');
    }

    const bundle = await controlPlane.getRebalanceBundleForProposal(proposal.id);
    if (bundle === null) {
      throw new Error('Expected rebalance bundle detail.');
    }

    expect(bundle.bundle.status).toBe('requires_intervention');
    expect(bundle.bundle.outcomeClassification).toBe('partial_application');
    expect(bundle.bundle.interventionRecommendation).toBe('unresolved_partial_application');
    expect(bundle.bundle.completedChildCount).toBe(1);
    expect(bundle.bundle.blockedChildCount).toBe(1);
    expect(bundle.graph.downstream.carry.actions[0]?.action.id).toBe(carryAction.id);
    expect(bundle.graph.downstream.treasury.actions[0]?.executions[0]?.id).toBe(treasuryExecution.id);
    expect(proposalDetail.executions[0]?.id).toBe(rebalanceExecution.id);
  });

  it('records explicit manual resolution for partially applied non-retryable bundles without erasing prior history', async () => {
    const connectionString = await createConnectionString();
    const controlPlane = await RuntimeControlPlane.connect(connectionString);
    const connection = await createDatabaseConnection(connectionString);
    const worker = await RuntimeWorker.createDeterministic(connectionString, {}, {
      cycleIntervalMs: 1000,
      pollIntervalMs: 10,
    });

    cleanups.push(async () => {
      await worker.stop();
    });
    cleanups.push(async () => {
      await connection.close();
    });

    await worker.start();

    const command = await controlPlane.enqueueAllocatorEvaluation('vitest', {
      actorId: 'vitest',
      trigger: 'worker_bundle_manual_resolution_test',
    });
    await waitFor(
      async () => controlPlane.getCommand(command.commandId),
      (value): value is Exclude<typeof value, null> => value !== null && value.status === 'completed',
    );

    const proposal = await waitFor(
      async () => {
        const proposals = await controlPlane.listRebalanceProposals(10);
        return proposals[0] ?? null;
      },
      (value): value is Exclude<typeof value, null> => value !== null,
    );
    const treasurySummary = await waitFor(
      () => controlPlane.getTreasurySummary(),
      (value): value is Exclude<typeof value, null> => value !== null,
    );
    if (proposal === null || treasurySummary === null) {
      throw new Error('Expected rebalance proposal and treasury summary.');
    }

    const [rebalanceExecution] = await connection.db
      .insert(allocatorRebalanceExecutions)
      .values({
        proposalId: proposal.id,
        commandId: 'command-manual-resolution-setup',
        status: 'completed',
        executionMode: proposal.executionMode,
        simulated: proposal.simulated,
        requestedBy: 'vitest',
        startedBy: 'worker-test',
        outcomeSummary: 'Manual partial bundle setup for resolution test.',
        outcome: {
          applied: true,
        },
        createdAt: new Date('2026-03-22T12:00:00.000Z'),
        startedAt: new Date('2026-03-22T12:00:01.000Z'),
        completedAt: new Date('2026-03-22T12:00:02.000Z'),
        updatedAt: new Date('2026-03-22T12:00:02.000Z'),
      })
      .returning();

    const [carryAction] = await connection.db
      .insert(carryActions)
      .values({
        strategyRunId: null,
        linkedRebalanceProposalId: proposal.id,
        actionType: 'increase_carry_exposure',
        status: 'recommended',
        sourceKind: 'rebalance',
        sourceReference: proposal.id,
        opportunityId: null,
        asset: null,
        summary: 'Carry child remained blocked before any venue-side progress.',
        notionalUsd: '125000.00',
        details: {},
        readiness: 'blocked',
        executable: false,
        blockedReasons: [{
          code: 'venue_execution_unsupported',
          category: 'venue_capability',
          message: 'Carry venue remains unsupported for execution.',
          operatorAction: 'Inspect venue readiness before retrying.',
          details: {},
        }],
        approvalRequirement: 'operator',
        executionMode: proposal.executionMode,
        simulated: true,
        executionPlan: {},
        actorId: 'vitest',
        createdAt: new Date('2026-03-22T12:00:03.000Z'),
        updatedAt: new Date('2026-03-22T12:00:03.000Z'),
      })
      .returning();

    const [treasuryAction] = await connection.db
      .insert(treasuryActions)
      .values({
        treasuryRunId: treasurySummary.treasuryRunId,
        linkedRebalanceProposalId: proposal.id,
        actionType: 'rebalance_treasury_budget',
        status: 'completed',
        venueId: null,
        venueName: null,
        venueMode: 'reserve',
        amountUsd: '125000.00',
        reasonCode: 'rebalance_budget_application',
        summary: 'Treasury child completed budget-state application.',
        details: {
          rebalanceProposalId: proposal.id,
        },
        readiness: 'actionable',
        executable: true,
        blockedReasons: [],
        approvalRequirement: 'operator',
        executionMode: proposal.executionMode,
        simulated: true,
        approvedBy: 'vitest',
        approvedAt: new Date('2026-03-22T12:00:04.000Z'),
        completedAt: new Date('2026-03-22T12:00:06.000Z'),
        actorId: 'vitest',
        createdAt: new Date('2026-03-22T12:00:04.000Z'),
        updatedAt: new Date('2026-03-22T12:00:06.000Z'),
      })
      .returning();

    const [treasuryExecution] = await connection.db
      .insert(treasuryActionExecutions)
      .values({
        treasuryActionId: treasuryAction?.id ?? '',
        treasuryRunId: treasurySummary.treasuryRunId,
        commandId: 'command-manual-resolution-setup',
        status: 'completed',
        executionMode: proposal.executionMode,
        venueMode: 'reserve',
        simulated: true,
        requestedBy: 'vitest',
        startedBy: 'worker-test',
        blockedReasons: [],
        outcomeSummary: 'Budget-state treasury application completed.',
        outcome: {
          executionKind: 'budget_state_application',
          rebalanceProposalId: proposal.id,
        },
        createdAt: new Date('2026-03-22T12:00:05.000Z'),
        startedAt: new Date('2026-03-22T12:00:05.000Z'),
        completedAt: new Date('2026-03-22T12:00:06.000Z'),
        updatedAt: new Date('2026-03-22T12:00:06.000Z'),
      })
      .returning();
    if (
      rebalanceExecution === undefined
      || carryAction === undefined
      || treasuryAction === undefined
      || treasuryExecution === undefined
    ) {
      throw new Error('Expected manual resolution setup rows to persist.');
    }

    await connection.db
      .update(allocatorRebalanceProposals)
      .set({
        status: 'completed',
        latestExecutionId: rebalanceExecution.id,
        linkedCommandId: 'command-manual-resolution-setup',
        updatedAt: new Date('2026-03-22T12:00:06.000Z'),
      })
      .where(eq(allocatorRebalanceProposals.id, proposal.id));

    await connection.db
      .update(treasuryActions)
      .set({
        latestExecutionId: treasuryExecution.id,
        updatedAt: new Date('2026-03-22T12:00:06.000Z'),
      })
      .where(eq(treasuryActions.id, treasuryAction.id));

    await connection.db
      .update(allocatorRebalanceExecutions)
      .set({
        outcome: {
          applied: true,
          downstreamCarryActionIds: [carryAction.id],
          downstreamTreasuryActionIds: [treasuryAction.id],
        },
        updatedAt: new Date('2026-03-22T12:00:06.000Z'),
      })
      .where(eq(allocatorRebalanceExecutions.id, rebalanceExecution.id));

    const bundleBefore = await waitFor(
      async () => controlPlane.getRebalanceBundleForProposal(proposal.id),
      (value): value is Exclude<typeof value, null> => value !== null && value.bundle.status === 'requires_intervention',
    );
    if (bundleBefore === null) {
      throw new Error('Expected requires_intervention bundle.');
    }

    expect(bundleBefore.partialProgress.appliedChildren).toBe(1);
    expect(bundleBefore.partialProgress.nonRetryableChildren).toBe(1);
    expect(bundleBefore.partialProgress.blockedBeforeApplicationChildren).toBe(1);
    const acceptPartial = bundleBefore.resolutionOptions.find((option) =>
      option.resolutionActionType === 'accept_partial_application',
    );
    if (acceptPartial === undefined) {
      throw new Error('Expected accept_partial_application option.');
    }
    expect(acceptPartial.eligibilityState).toBe('eligible');

    const resolutionAction = await controlPlane.requestRebalanceBundleResolutionAction(
      bundleBefore.bundle.id,
      {
        resolutionActionType: 'accept_partial_application',
        note: 'Treasury budget-state application is sufficient; carry child remains intentionally non-retryable.',
      },
      'vitest',
      'operator',
    );
    if (resolutionAction === null) {
      throw new Error('Expected manual resolution action.');
    }

    const bundleAfter = await waitFor(
      async () => controlPlane.getRebalanceBundleForProposal(proposal.id),
      (value): value is Exclude<typeof value, null> => value !== null && value.bundle.resolutionState === 'accepted_partial',
    );
    if (bundleAfter === null) {
      throw new Error('Expected bundle to reflect accepted partial resolution.');
    }

    expect(bundleAfter.bundle.status).toBe('requires_intervention');
    expect(bundleAfter.bundle.interventionRecommendation).toBe('accepted_partial_application');
    expect(bundleAfter.bundle.resolutionSummary).toContain('Treasury budget-state application is sufficient');
    expect(bundleAfter.resolutionActions.some((item) => item.id === resolutionAction.id && item.status === 'completed')).toBe(true);
    expect(bundleAfter.recoveryActions).toHaveLength(0);
  });

  it('tracks escalation ownership, acknowledgement, review, and close workflow separately from bundle execution truth', async () => {
    const connectionString = await createConnectionString();
    const controlPlane = await RuntimeControlPlane.connect(connectionString);
    const connection = await createDatabaseConnection(connectionString);
    const worker = await RuntimeWorker.createDeterministic(connectionString, {}, {
      cycleIntervalMs: 1000,
      pollIntervalMs: 10,
    });

    cleanups.push(async () => {
      await worker.stop();
    });
    cleanups.push(async () => {
      await connection.close();
    });

    await worker.start();

    const command = await controlPlane.enqueueAllocatorEvaluation('vitest', {
      actorId: 'vitest',
      trigger: 'worker_bundle_escalation_workflow_test',
    });
    await waitFor(
      async () => controlPlane.getCommand(command.commandId),
      (value): value is Exclude<typeof value, null> => value !== null && value.status === 'completed',
    );

    const proposal = await waitFor(
      async () => {
        const proposals = await controlPlane.listRebalanceProposals(10);
        return proposals[0] ?? null;
      },
      (value): value is Exclude<typeof value, null> => value !== null,
    );
    const treasurySummary = await waitFor(
      () => controlPlane.getTreasurySummary(),
      (value): value is Exclude<typeof value, null> => value !== null,
    );
    if (proposal === null || treasurySummary === null) {
      throw new Error('Expected rebalance proposal and treasury summary.');
    }

    const [rebalanceExecution] = await connection.db
      .insert(allocatorRebalanceExecutions)
      .values({
        proposalId: proposal.id,
        commandId: 'command-escalation-workflow-setup',
        status: 'completed',
        executionMode: proposal.executionMode,
        simulated: proposal.simulated,
        requestedBy: 'vitest',
        startedBy: 'worker-test',
        outcomeSummary: 'Manual partial bundle setup for escalation workflow test.',
        outcome: {
          applied: true,
        },
        createdAt: new Date('2026-03-23T12:00:00.000Z'),
        startedAt: new Date('2026-03-23T12:00:01.000Z'),
        completedAt: new Date('2026-03-23T12:00:02.000Z'),
        updatedAt: new Date('2026-03-23T12:00:02.000Z'),
      })
      .returning();

    const [carryAction] = await connection.db
      .insert(carryActions)
      .values({
        strategyRunId: null,
        linkedRebalanceProposalId: proposal.id,
        actionType: 'increase_carry_exposure',
        status: 'recommended',
        sourceKind: 'rebalance',
        sourceReference: proposal.id,
        opportunityId: null,
        asset: null,
        summary: 'Carry child remained blocked pending venue-side review.',
        notionalUsd: '125000.00',
        details: {},
        readiness: 'blocked',
        executable: false,
        blockedReasons: [{
          code: 'venue_execution_unsupported',
          category: 'venue_capability',
          message: 'Carry venue remains unsupported for execution.',
          operatorAction: 'Inspect venue readiness before retrying.',
          details: {},
        }],
        approvalRequirement: 'operator',
        executionMode: proposal.executionMode,
        simulated: true,
        executionPlan: {},
        actorId: 'vitest',
        createdAt: new Date('2026-03-23T12:00:03.000Z'),
        updatedAt: new Date('2026-03-23T12:00:03.000Z'),
      })
      .returning();

    const [treasuryAction] = await connection.db
      .insert(treasuryActions)
      .values({
        treasuryRunId: treasurySummary.treasuryRunId,
        linkedRebalanceProposalId: proposal.id,
        actionType: 'rebalance_treasury_budget',
        status: 'completed',
        venueId: null,
        venueName: null,
        venueMode: 'reserve',
        amountUsd: '125000.00',
        reasonCode: 'rebalance_budget_application',
        summary: 'Treasury child completed budget-state application.',
        details: {
          rebalanceProposalId: proposal.id,
        },
        readiness: 'actionable',
        executable: true,
        blockedReasons: [],
        approvalRequirement: 'operator',
        executionMode: proposal.executionMode,
        simulated: true,
        approvedBy: 'vitest',
        approvedAt: new Date('2026-03-23T12:00:04.000Z'),
        completedAt: new Date('2026-03-23T12:00:06.000Z'),
        actorId: 'vitest',
        createdAt: new Date('2026-03-23T12:00:04.000Z'),
        updatedAt: new Date('2026-03-23T12:00:06.000Z'),
      })
      .returning();

    const [treasuryExecution] = await connection.db
      .insert(treasuryActionExecutions)
      .values({
        treasuryActionId: treasuryAction?.id ?? '',
        treasuryRunId: treasurySummary.treasuryRunId,
        commandId: 'command-escalation-workflow-setup',
        status: 'completed',
        executionMode: proposal.executionMode,
        venueMode: 'reserve',
        simulated: true,
        requestedBy: 'vitest',
        startedBy: 'worker-test',
        blockedReasons: [],
        outcomeSummary: 'Budget-state treasury application completed.',
        outcome: {
          executionKind: 'budget_state_application',
          rebalanceProposalId: proposal.id,
        },
        createdAt: new Date('2026-03-23T12:00:05.000Z'),
        startedAt: new Date('2026-03-23T12:00:05.000Z'),
        completedAt: new Date('2026-03-23T12:00:06.000Z'),
        updatedAt: new Date('2026-03-23T12:00:06.000Z'),
      })
      .returning();
    if (
      rebalanceExecution === undefined
      || carryAction === undefined
      || treasuryAction === undefined
      || treasuryExecution === undefined
    ) {
      throw new Error('Expected escalation workflow setup rows to persist.');
    }

    await connection.db
      .update(allocatorRebalanceProposals)
      .set({
        status: 'completed',
        latestExecutionId: rebalanceExecution.id,
        linkedCommandId: 'command-escalation-workflow-setup',
        updatedAt: new Date('2026-03-23T12:00:06.000Z'),
      })
      .where(eq(allocatorRebalanceProposals.id, proposal.id));

    await connection.db
      .update(treasuryActions)
      .set({
        latestExecutionId: treasuryExecution.id,
        updatedAt: new Date('2026-03-23T12:00:06.000Z'),
      })
      .where(eq(treasuryActions.id, treasuryAction.id));

    await connection.db
      .update(allocatorRebalanceExecutions)
      .set({
        outcome: {
          applied: true,
          downstreamCarryActionIds: [carryAction.id],
          downstreamTreasuryActionIds: [treasuryAction.id],
        },
        updatedAt: new Date('2026-03-23T12:00:06.000Z'),
      })
      .where(eq(allocatorRebalanceExecutions.id, rebalanceExecution.id));

    const bundleBefore = await waitFor(
      async () => controlPlane.getRebalanceBundleForProposal(proposal.id),
      (value): value is Exclude<typeof value, null> => value !== null && value.bundle.status === 'requires_intervention',
    );
    if (bundleBefore === null) {
      throw new Error('Expected requires_intervention bundle.');
    }

    const escalationResolution = await controlPlane.requestRebalanceBundleResolutionAction(
      bundleBefore.bundle.id,
      {
        resolutionActionType: 'escalate_bundle_for_review',
        note: 'Venue-side follow-up is required before the bundle can be considered operationally closed.',
      },
      'ops-manager',
      'operator',
    );
    if (escalationResolution === null) {
      throw new Error('Expected escalation resolution action.');
    }

    const escalatedBundle = await waitFor(
      async () => controlPlane.getRebalanceBundleForProposal(proposal.id),
      (value): value is Exclude<typeof value, null> => value !== null && value.bundle.resolutionState === 'escalated' && value.escalation !== null,
    );
    if (escalatedBundle === null || escalatedBundle.escalation === null) {
      throw new Error('Expected escalated bundle with escalation record.');
    }

    expect(escalatedBundle.bundle.status).toBe('requires_intervention');
    expect(escalatedBundle.bundle.escalationStatus).toBe('open');
    expect(escalatedBundle.escalation.ownerId).toBe('ops-manager');
    expect(escalatedBundle.escalationHistory.some((event) => event.eventType === 'created')).toBe(true);

    const openQueue = await controlPlane.listRebalanceEscalations({
      openState: 'open',
      sortBy: 'due_at',
      sortDirection: 'asc',
    });
    const openSummary = await controlPlane.getRebalanceEscalationSummary('ops-manager');
    expect(openQueue.some((item) =>
      item.bundleId === escalatedBundle.bundle.id
      && item.escalationStatus === 'open'
      && item.ownerId === 'ops-manager'
      && item.escalationQueueState === 'on_track',
    )).toBe(true);
    expect(openSummary.open).toBeGreaterThanOrEqual(1);
    expect(openSummary.mine).toBeGreaterThanOrEqual(1);

    await controlPlane.assignRebalanceBundleEscalation(
      escalatedBundle.bundle.id,
      {
        ownerId: 'review-owner',
        note: 'Handing off to the reviewer covering venue-side discrepancies.',
        dueAt: '2026-03-24T12:00:00.000Z',
      },
      'ops-manager',
      'operator',
    );
    await controlPlane.acknowledgeRebalanceBundleEscalation(
      escalatedBundle.bundle.id,
      {
        note: 'Acknowledged by the assigned reviewer.',
      },
      'review-owner',
      'operator',
    );
    await controlPlane.startRebalanceBundleEscalationReview(
      escalatedBundle.bundle.id,
      {
        note: 'Investigating venue-side state and manual settlement evidence.',
      },
      'review-owner',
      'operator',
    );
    await controlPlane.closeRebalanceBundleEscalation(
      escalatedBundle.bundle.id,
      {
        note: 'Resolved after confirming manual settlement and documenting follow-up.',
      },
      'review-owner',
      'operator',
    );

    const bundleAfter = await waitFor(
      async () => controlPlane.getRebalanceBundleForProposal(proposal.id),
      (value): value is Exclude<typeof value, null> => value !== null && value.escalation !== null && value.escalation.status === 'resolved',
    );
    if (bundleAfter === null || bundleAfter.escalation === null) {
      throw new Error('Expected resolved escalation workflow.');
    }

    expect(bundleAfter.bundle.status).toBe('requires_intervention');
    expect(bundleAfter.bundle.resolutionState).toBe('escalated');
    expect(bundleAfter.bundle.escalationStatus).toBe('resolved');
    expect(bundleAfter.bundle.escalationOwnerId).toBe('review-owner');
    expect(bundleAfter.escalation.closedBy).toBe('review-owner');
    expect(bundleAfter.escalation.resolutionNote).toContain('manual settlement');
    expect(bundleAfter.escalationHistory.map((event) => event.eventType)).toEqual(
      expect.arrayContaining(['created', 'assigned', 'acknowledged', 'review_started', 'resolved']),
    );
    expect(escalationResolution.resolutionState).toBe('escalated');

    const resolvedQueue = await controlPlane.listRebalanceEscalations({
      status: 'resolved',
      openState: 'closed',
    });
    const reviewOwnerSummary = await controlPlane.getRebalanceEscalationSummary('review-owner');
    expect(resolvedQueue.some((item) =>
      item.bundleId === bundleAfter.bundle.id
      && item.escalationStatus === 'resolved'
      && item.ownerId === 'review-owner'
      && item.escalationQueueState === 'resolved',
    )).toBe(true);
    expect(reviewOwnerSummary.resolved).toBeGreaterThanOrEqual(1);
  });

  it('queues explicit bundle recovery for safely retryable carry children and links the outcome back to the bundle', async () => {
    const connectionString = await createConnectionString();
    const controlPlane = await RuntimeControlPlane.connect(connectionString);
    const connection = await createDatabaseConnection(connectionString);
    const worker = await RuntimeWorker.createDeterministic(connectionString, {}, {
      cycleIntervalMs: 1000,
      pollIntervalMs: 10,
    });

    cleanups.push(async () => {
      await worker.stop();
    });
    cleanups.push(async () => {
      await connection.close();
    });

    await worker.start();

    const command = await controlPlane.enqueueAllocatorEvaluation('vitest', {
      actorId: 'vitest',
      trigger: 'worker_bundle_recovery_test',
    });
    await waitFor(
      async () => controlPlane.getCommand(command.commandId),
      (value): value is Exclude<typeof value, null> => value !== null && value.status === 'completed',
    );

    const proposal = await waitFor(
      async () => {
        const proposals = await controlPlane.listRebalanceProposals(10);
        return proposals[0] ?? null;
      },
      (value): value is Exclude<typeof value, null> => value !== null,
    );
    if (proposal === null) {
      throw new Error('Expected rebalance proposal.');
    }

    const [rebalanceExecution] = await connection.db
      .insert(allocatorRebalanceExecutions)
      .values({
        proposalId: proposal.id,
        commandId: 'command-bundle-recovery-setup',
        status: 'completed',
        executionMode: proposal.executionMode,
        simulated: proposal.simulated,
        requestedBy: 'vitest',
        startedBy: 'worker-test',
        outcomeSummary: 'Manual failed-child setup for bundle recovery test.',
        outcome: {},
        createdAt: new Date('2026-03-21T12:00:00.000Z'),
        startedAt: new Date('2026-03-21T12:00:01.000Z'),
        completedAt: new Date('2026-03-21T12:00:02.000Z'),
        updatedAt: new Date('2026-03-21T12:00:02.000Z'),
      })
      .returning();

    const [carryAction] = await connection.db
      .insert(carryActions)
      .values({
        strategyRunId: null,
        linkedRebalanceProposalId: proposal.id,
        actionType: 'reduce_carry_exposure',
        status: 'failed',
        sourceKind: 'rebalance',
        sourceReference: proposal.id,
        opportunityId: null,
        asset: null,
        summary: 'Carry child failed before any venue-side progress was recorded.',
        notionalUsd: '10000.00',
        details: {},
        readiness: 'actionable',
        executable: true,
        blockedReasons: [],
        approvalRequirement: 'operator',
        executionMode: proposal.executionMode,
        simulated: true,
        executionPlan: {},
        approvedBy: 'vitest',
        approvedAt: new Date('2026-03-21T12:00:03.000Z'),
        failedAt: new Date('2026-03-21T12:00:04.000Z'),
        linkedCommandId: 'command-old-carry-failure',
        actorId: 'vitest',
        createdAt: new Date('2026-03-21T12:00:03.000Z'),
        updatedAt: new Date('2026-03-21T12:00:04.000Z'),
        lastError: 'Simulated carry failure without side effects.',
      })
      .returning();
    if (rebalanceExecution === undefined || carryAction === undefined) {
      throw new Error('Expected manual bundle recovery rows to persist.');
    }

    await connection.db
      .update(allocatorRebalanceProposals)
      .set({
        status: 'completed',
        latestExecutionId: rebalanceExecution.id,
        linkedCommandId: 'command-bundle-recovery-setup',
        updatedAt: new Date('2026-03-21T12:00:04.000Z'),
      })
      .where(eq(allocatorRebalanceProposals.id, proposal.id));

    await connection.db
      .update(allocatorRebalanceExecutions)
      .set({
        outcome: {
          applied: false,
          downstreamCarryActionIds: [carryAction.id],
          downstreamTreasuryActionIds: [],
        },
        updatedAt: new Date('2026-03-21T12:00:04.000Z'),
      })
      .where(eq(allocatorRebalanceExecutions.id, rebalanceExecution.id));

    const bundleBefore = await waitFor(
      async () => controlPlane.getRebalanceBundleForProposal(proposal.id),
      (value): value is Exclude<typeof value, null> => value !== null && value.bundle.status === 'failed',
    );
    if (bundleBefore === null || rebalanceExecution === undefined || carryAction === undefined) {
      throw new Error('Expected failed bundle and carry action setup.');
    }
    const candidate = bundleBefore.recoveryCandidates.find((item) =>
      item.targetChildType === 'carry_action' && item.targetChildId === carryAction.id,
    );
    if (candidate === undefined) {
      throw new Error('Expected carry recovery candidate.');
    }

    expect(candidate.eligibilityState).toBe('eligible');

    const recoveryAction = await controlPlane.requestRebalanceBundleRecoveryAction(
      bundleBefore.bundle.id,
      {
        recoveryActionType: candidate.recoveryActionType,
        targetChildType: candidate.targetChildType,
        targetChildId: candidate.targetChildId,
        note: 'Retry the failed carry child.',
      },
      'vitest',
      'operator',
    );
    if (recoveryAction === null || recoveryAction.linkedCommandId === null) {
      throw new Error('Expected bundle recovery action to be queued.');
    }

    await waitFor(
      async () => controlPlane.getCommand(recoveryAction.linkedCommandId ?? ''),
      (value): value is Exclude<typeof value, null> => value !== null && value.status === 'completed',
    );

    const completedRecovery = await waitFor(
      async () => controlPlane.getRebalanceBundleRecoveryAction(bundleBefore.bundle.id, recoveryAction.id),
      (value): value is Exclude<typeof value, null> => value !== null && value.status === 'completed',
    );
    const bundleAfter = await waitFor(
      async () => controlPlane.getRebalanceBundleForProposal(proposal.id),
      (value): value is Exclude<typeof value, null> => value !== null && value.bundle.status === 'completed',
    );
    if (completedRecovery === null || bundleAfter === null) {
      throw new Error('Expected completed bundle recovery.');
    }

    expect(completedRecovery.targetChildId).toBe(carryAction.id);
    expect(completedRecovery.linkedCommandId).toBeTruthy();
    expect(bundleAfter.bundle.interventionRecommendation).toBe('no_action_needed');
    expect(bundleAfter.bundle.failedChildCount).toBe(0);
    expect(bundleAfter.recoveryActions.some((item) => item.id === recoveryAction.id)).toBe(true);
  });

  it('evaluates and executes carry actions through the runtime command rail', async () => {
    const connectionString = await createConnectionString();
    const controlPlane = await RuntimeControlPlane.connect(connectionString);
    const worker = await RuntimeWorker.createDeterministic(connectionString, {}, {
      cycleIntervalMs: 1000,
      pollIntervalMs: 10,
    });

    cleanups.push(async () => {
      await worker.stop();
    });

    await worker.start();
    await controlPlane.enqueueCommand('run_cycle', 'vitest', {
      triggerSource: 'carry-worker-test-cycle',
    });

    const evaluationCommand = await controlPlane.enqueueCarryEvaluation('vitest', {
      actorId: 'vitest',
      trigger: 'worker_carry_test',
    });
    await waitFor(
      async () => controlPlane.getCommand(evaluationCommand.commandId),
      (value): value is Exclude<typeof value, null> => value !== null && value.status === 'completed',
    );

    const action = await waitFor(
      async () => {
        const actions = await controlPlane.listCarryActions(20);
        return actions.find((item) => item.executable) ?? null;
      },
      (value): value is Exclude<typeof value, null> => value !== null,
    );
    if (action === null) {
      throw new Error('Expected actionable carry action.');
    }

    const command = await controlPlane.approveCarryAction(action.id, 'vitest', 'operator');
    if (command === null) {
      throw new Error('Expected carry execution command to be queued.');
    }

    const completedCommand = await waitFor(
      async () => controlPlane.getCommand(command.commandId),
      (value): value is Exclude<typeof value, null> => value !== null && value.status === 'completed',
    );
    const detail = await waitFor(
      () => controlPlane.getCarryAction(action.id),
      (value): value is Exclude<typeof value, null> => value !== null && value.action.status === 'completed',
    );
    const executions = await controlPlane.listCarryExecutions(10);
    const executionDetail = await waitFor(
      () => controlPlane.getCarryExecution(String(detail?.executions[0]?.id)),
      (value): value is Exclude<typeof value, null> => value !== null && value.steps.length > 0,
    );
    if (executionDetail === null) {
      throw new Error('Expected carry execution detail.');
    }

    expect(completedCommand?.result['carryExecutionId']).toBeTruthy();
    expect(detail?.executions[0]?.status).toBe('completed');
    expect(detail?.executions[0]?.requestedBy).toBe('vitest');
    expect(executions.some((execution) => execution.carryActionId === action.id)).toBe(true);
    expect(executionDetail.execution.id).toBe(detail?.executions[0]?.id);
    expect(executionDetail.action?.id).toBe(action.id);
    expect(executionDetail.steps[0]?.intentId).toBeTruthy();
    expect(executionDetail.steps[0]?.executionReference).toBeTruthy();
    expect(executionDetail.timeline.some((entry) => entry.linkedExecutionId === executionDetail.execution.id)).toBe(true);
  });

  it('approves and executes treasury actions with durable execution history', async () => {
    const connectionString = await createConnectionString();
    const controlPlane = await RuntimeControlPlane.connect(connectionString);
    const worker = await RuntimeWorker.createDeterministic(connectionString, {}, {
      cycleIntervalMs: 1000,
      pollIntervalMs: 10,
    });

    cleanups.push(async () => {
      await worker.stop();
    });

    await worker.start();

    const evaluationCommand = await controlPlane.enqueueTreasuryEvaluation('vitest');
    await waitFor(
      async () => controlPlane.getCommand(evaluationCommand.commandId),
      (value): value is Exclude<typeof value, null> => value !== null && value.status === 'completed',
    );

    const action = await waitFor(
      async () => {
        const actions = await controlPlane.listTreasuryActions(20);
        return actions.find((item) => item.executable) ?? null;
      },
      (value): value is Exclude<typeof value, null> => value !== null,
    );
    if (action === null) {
      throw new Error('Expected actionable treasury action.');
    }

    const approved = await controlPlane.approveTreasuryAction(action.id, 'vitest', 'operator');
    expect(approved?.status).toBe('approved');

    const command = await controlPlane.enqueueTreasuryActionExecution(action.id, 'vitest', 'operator');
    if (command === null) {
      throw new Error('Expected treasury execution command to be queued.');
    }

    const completedCommand = await waitFor(
      async () => controlPlane.getCommand(command.commandId),
      (value): value is Exclude<typeof value, null> => value !== null && value.status === 'completed',
    );
    const detail = await waitFor(
      () => controlPlane.getTreasuryAction(action.id),
      (value): value is Exclude<typeof value, null> => value !== null && value.action.status === 'completed',
    );
    const executions = await controlPlane.listTreasuryExecutions(10);

    expect(completedCommand?.result['treasuryExecutionId']).toBeTruthy();
    expect(detail?.executions[0]?.status).toBe('completed');
    expect(detail?.executions[0]?.venueExecutionReference).toBeTruthy();
    expect(executions.some((execution) => execution.treasuryActionId === action.id)).toBe(true);
  });

  it('persists blocked treasury execution attempts with durable reasons', async () => {
    const connectionString = await createConnectionString();
    const controlPlane = await RuntimeControlPlane.connect(connectionString);
    const worker = await RuntimeWorker.createDeterministic(connectionString, {}, {
      cycleIntervalMs: 1000,
      pollIntervalMs: 10,
    });
    const connection = await createDatabaseConnection(connectionString);

    cleanups.push(async () => {
      await worker.stop();
    });

    await worker.start();

    const evaluationCommand = await controlPlane.enqueueTreasuryEvaluation('vitest');
    await waitFor(
      async () => controlPlane.getCommand(evaluationCommand.commandId),
      (value): value is Exclude<typeof value, null> => value !== null && value.status === 'completed',
    );

    const action = await waitFor(
      async () => {
        const actions = await controlPlane.listTreasuryActions(20);
        return actions.find((item) => item.executable) ?? null;
      },
      (value): value is Exclude<typeof value, null> => value !== null,
    );
    if (action === null) {
      throw new Error('Expected actionable treasury action.');
    }

    await controlPlane.approveTreasuryAction(action.id, 'vitest', 'operator');
    await connection.db
      .update(treasuryActions)
      .set({
        amountUsd: '999999.99',
        updatedAt: new Date(),
      })
      .where(eq(treasuryActions.id, action.id));

    const command = await controlPlane.enqueueTreasuryActionExecution(action.id, 'vitest', 'operator');
    if (command === null) {
      throw new Error('Expected treasury execution command to be queued.');
    }

    const failedCommand = await waitFor(
      async () => controlPlane.getCommand(command.commandId),
      (value): value is Exclude<typeof value, null> => value !== null && value.status === 'failed',
    );
    const detail = await waitFor(
      () => controlPlane.getTreasuryAction(action.id),
      (value): value is Exclude<typeof value, null> => value !== null && value.action.status === 'failed',
    );

    expect(failedCommand?.errorMessage).toBeTruthy();
    expect(detail?.executions[0]?.status).toBe('failed');
    expect(detail?.executions[0]?.blockedReasons.length).toBeGreaterThan(0);
  });

  it('rejects duplicate in-flight remediation and reopens the mismatch when a remediation command fails', async () => {
    const connectionString = await createConnectionString();
    const controlPlane = await RuntimeControlPlane.connect(connectionString);
    const worker = await RuntimeWorker.createDeterministic(connectionString, {}, {
      cycleIntervalMs: 1000,
      pollIntervalMs: 500,
    });

    cleanups.push(async () => {
      await worker.stop();
    });

    await worker.start();
    await controlPlane.activateKillSwitch('phase-1-8-remediation-failure-setup', 'vitest');

    const blockedCommand = await controlPlane.enqueueCommand('run_cycle', 'vitest', {
      triggerSource: 'phase-1-8-remediation-failure-setup',
    });
    await waitFor(
      async () => controlPlane.getCommand(blockedCommand.commandId),
      (command): command is Exclude<typeof command, null> => command !== null && command.status === 'failed',
    );

    const mismatch = await waitFor(
      async () => {
        const mismatches = await controlPlane.listMismatches(20);
        return mismatches.find((item) => item.category === 'recovery_action_failure') ?? null;
      },
      (value): value is Exclude<typeof value, null> => value !== null,
    );
    if (mismatch === null) {
      throw new Error('Expected mismatch to exist');
    }

    await controlPlane.resume('phase-1-8-remediation-failure-ready', 'vitest');

    const remediation = await controlPlane.remediateMismatch({
      mismatchId: mismatch.id,
      actorId: 'vitest',
      remediationType: 'run_cycle',
      summary: 'attempt one safe remediation cycle',
    });
    expect(remediation.status).toBe('requested');

    await expect(
      controlPlane.remediateMismatch({
        mismatchId: mismatch.id,
        actorId: 'vitest',
        remediationType: 'rebuild_projections',
        summary: 'duplicate in-flight remediation should reject',
      }),
    ).rejects.toThrow('already has remediation');

    await controlPlane.activateKillSwitch('phase-1-8-remediation-failure-trigger', 'vitest');

    const failedRemediation = await waitFor(
      async () => controlPlane.getLatestMismatchRemediation(mismatch.id),
      (value): value is Exclude<typeof value, null> => value !== null && value.status === 'failed',
      7000,
    );
    if (failedRemediation === null) {
      throw new Error('Expected remediation to fail');
    }

    expect(failedRemediation.command?.status).toBe('failed');
    expect(failedRemediation.latestRecoveryEvent?.eventType).toBe('mismatch_remediation_failed');

    const detail = await waitFor(
      async () => controlPlane.getMismatchDetail(mismatch.id),
      (value): value is Exclude<typeof value, null> => value !== null && value.mismatch.status === 'reopened',
      7000,
    );
    if (detail === null) {
      throw new Error('Expected mismatch detail to exist');
    }

    expect(detail.mismatch.linkedCommandId).toBe(remediation.commandId);
    expect(detail.latestRemediation?.status).toBe('failed');
    expect(detail.remediationInFlight).toBe(false);
    expect(detail.isActionable).toBe(true);
    expect(detail.recoveryEvents.some((event) => event.eventType === 'mismatch_remediation_failed')).toBe(true);
  });

  it('persists reconciliation runs and findings, creates reconciliation-driven mismatches, and preserves remediation linkage', async () => {
    const connectionString = await createConnectionString();
    const controlPlane = await RuntimeControlPlane.connect(connectionString);
    const worker = await RuntimeWorker.createDeterministic(connectionString, {}, {
      cycleIntervalMs: 1000,
      pollIntervalMs: 25,
    });

    cleanups.push(async () => {
      await worker.stop();
    });

    await worker.start();

    const cycleCommand = await controlPlane.enqueueCommand('run_cycle', 'vitest', {
      triggerSource: 'phase-1-9-seed-cycle',
    });
    const completedCycle = await waitFor(
      async () => controlPlane.getCommand(cycleCommand.commandId),
      (command): command is Exclude<typeof command, null> => command !== null && command.status === 'completed',
    );
    expect(completedCycle?.result['runId']).toBeTruthy();

    const positions = await controlPlane.listPositions(20);
    expect(positions.length).toBeGreaterThan(0);

    const connection = await createDatabaseConnection(connectionString);
    const positionId = positions[0]?.id;
    if (positionId === undefined) {
      throw new Error('Expected at least one position to exist');
    }

    await connection.execute(`
      UPDATE positions
      SET size = '999', updated_at = NOW()
      WHERE id = '${positionId.replace(/'/g, "''")}';
    `);

    const reconciliationCommand = await controlPlane.enqueueReconciliationRun('vitest', {
      trigger: 'phase-1-9-manual-reconciliation',
      triggerReference: positionId,
      triggeredBy: 'vitest',
    });
    const completedReconciliationCommand = await waitFor(
      async () => controlPlane.getCommand(reconciliationCommand.commandId),
      (command): command is Exclude<typeof command, null> => command !== null && command.status === 'completed',
    );
    const reconciliationRunId = completedReconciliationCommand?.result['reconciliationRunId'];
    expect(typeof reconciliationRunId).toBe('string');

    const reconciliationRun = await waitFor(
      async () => controlPlane.getReconciliationRun(String(reconciliationRunId)),
      (run): run is Exclude<typeof run, null> => run !== null && run.status === 'completed',
    );
    if (reconciliationRun === null) {
      throw new Error('Expected reconciliation run to complete');
    }
    expect(reconciliationRun.findingCount).toBeGreaterThan(0);

    const findings = await controlPlane.listReconciliationFindings({
      findingType: 'position_exposure_mismatch',
      limit: 20,
    });
    const finding = findings.find((item) => item.entityId === positions[0]?.asset);
    expect(finding).toBeTruthy();
    expect(finding?.status).toBe('active');
    expect(finding?.mismatchId).toBeTruthy();

    const mismatchDetail = await controlPlane.getMismatchDetail(String(finding?.mismatchId));
    expect(mismatchDetail?.mismatch.sourceKind).toBe('reconciliation');
    expect(mismatchDetail?.reconciliationFindings.length).toBeGreaterThan(0);
    expect(mismatchDetail?.latestReconciliationFinding?.findingType).toBe('position_exposure_mismatch');
    expect(mismatchDetail?.recommendedRemediationTypes).toContain('rebuild_projections');

    const remediation = await controlPlane.remediateMismatch({
      mismatchId: String(finding?.mismatchId),
      actorId: 'vitest',
      remediationType: 'rebuild_projections',
      summary: 'repair projected positions from durable state',
    });
    expect(remediation.commandId).toBeTruthy();

    await waitFor(
      async () => controlPlane.getLatestMismatchRemediation(String(finding?.mismatchId)),
      (value): value is Exclude<typeof value, null> => value !== null && value.status === 'completed',
    );
    const resolvedMismatch = await waitFor(
      async () => controlPlane.getMismatchDetail(String(finding?.mismatchId)),
      (detail): detail is Exclude<typeof detail, null> => detail !== null && detail.mismatch.status === 'resolved',
    );
    if (resolvedMismatch === null) {
      throw new Error('Expected mismatch to resolve after remediation');
    }

    expect(resolvedMismatch.latestRemediation?.status).toBe('completed');
    expect(resolvedMismatch.reconciliationFindings.some((item) => item.status === 'resolved')).toBe(true);
  });

  it('surfaces missing, stale, and unavailable real venue truth through reconciliation', async () => {
    const connectionString = await createConnectionString();
    const missingAdapter = new StubReadonlyVenueTruthAdapter(
      'drift-solana-missing',
      'Drift Solana Missing',
      {
        venueId: 'drift-solana-missing',
        venueName: 'Drift Solana Missing',
        snapshotType: 'drift_native_error',
        snapshotSuccessful: false,
        healthy: false,
        healthState: 'degraded',
        summary: 'Drift-native snapshot is not available yet.',
        errorMessage: 'Drift user account has not been captured yet.',
        capturedAt: freshCapturedAt(),
        snapshotCompleteness: 'minimal',
        payload: {},
        metadata: {},
      },
      {
        healthy: false,
        healthState: 'degraded',
        degradedReason: 'Account balance has not been captured yet.',
      },
    );
    const staleAdapter = new StubReadonlyVenueTruthAdapter(
      'drift-solana-stale',
      'Drift Solana Stale',
      {
        venueId: 'drift-solana-stale',
        venueName: 'Drift Solana Stale',
        snapshotType: 'drift_native_user_account',
        snapshotSuccessful: true,
        healthy: true,
        healthState: 'healthy',
        summary: 'Drift-native read-only snapshot captured for Drift Solana Stale with 2 positions, 2 open orders, and health score 84.',
        errorMessage: null,
        capturedAt: '2020-01-01T00:00:00.000Z',
        snapshotCompleteness: 'complete',
        payload: { healthScore: 84 },
        metadata: {},
      },
    );
    const unavailableAdapter = new StubReadonlyVenueTruthAdapter(
      'drift-solana-unavailable',
      'Drift Solana Unavailable',
      {
        venueId: 'drift-solana-unavailable',
        venueName: 'Drift Solana Unavailable',
        snapshotType: 'drift_native_error',
        snapshotSuccessful: false,
        healthy: false,
        healthState: 'unavailable',
        summary: 'Drift-native read-only snapshot failed.',
        errorMessage: 'RPC getVersion failed with status 503.',
        capturedAt: freshCapturedAt(),
        snapshotCompleteness: 'minimal',
        payload: {},
        metadata: {},
      },
      {
        healthy: false,
        healthState: 'unavailable',
        degradedReason: 'RPC getVersion failed with status 503.',
      },
    );

    const controlPlane = await RuntimeControlPlane.connect(connectionString);
    const worker = await RuntimeWorker.createDeterministic(connectionString, {
      truthAdapters: [missingAdapter, staleAdapter, unavailableAdapter],
    }, {
      cycleIntervalMs: 60_000,
      pollIntervalMs: 25,
    });

    cleanups.push(async () => {
      await worker.stop();
    });

    await worker.start();

    const firstReconciliationCommand = await controlPlane.enqueueReconciliationRun('vitest', {
      trigger: 'phase-5-2-missing-venue-truth',
      triggeredBy: 'vitest',
    });
    await waitFor(
      async () => controlPlane.getCommand(firstReconciliationCommand.commandId),
      (command): command is Exclude<typeof command, null> => command !== null && command.status === 'completed',
    );

    const missingFindings = await waitFor(
      async () => controlPlane.listReconciliationFindings({
        findingType: 'missing_venue_truth_snapshot',
        limit: 20,
      }),
      (findings) => findings.some(
        (finding) => finding.venueId === 'drift-solana-missing' && finding.status === 'active',
      ),
    );

    expect(missingFindings.some((finding) => finding.venueId === 'drift-solana-missing')).toBe(true);
    missingAdapter.setSnapshot({
      venueId: 'drift-solana-missing',
      venueName: 'Drift Solana Missing',
      snapshotType: 'drift_native_user_account',
      snapshotSuccessful: true,
      healthy: true,
      healthState: 'healthy',
      summary: 'Drift-native read-only snapshot captured for Drift Solana Missing with 2 positions, 2 open orders, and health score 84.',
      errorMessage: null,
      capturedAt: freshCapturedAt(),
      snapshotCompleteness: 'complete',
      payload: { healthScore: 84 },
      metadata: {},
    });

    const cycleCommand = await controlPlane.enqueueCommand('run_cycle', 'vitest', {
      triggerSource: 'phase-5-2-seed-venue-truth',
    });
    await waitFor(
      async () => controlPlane.getCommand(cycleCommand.commandId),
      (command): command is Exclude<typeof command, null> => command !== null && command.status === 'completed',
      20_000,
    );

    const secondReconciliationCommand = await controlPlane.enqueueReconciliationRun('vitest', {
      trigger: 'phase-5-2-venue-truth-after-ingest',
      triggeredBy: 'vitest',
    });
    await waitFor(
      async () => controlPlane.getCommand(secondReconciliationCommand.commandId),
      (command): command is Exclude<typeof command, null> => command !== null && command.status === 'completed',
      20_000,
    );

    const resolvedMissingFindings = await controlPlane.listReconciliationFindings({
      findingType: 'missing_venue_truth_snapshot',
      limit: 50,
    });
    expect(
      resolvedMissingFindings.some((finding) => finding.venueId === 'drift-solana-missing' && finding.status === 'resolved'),
    ).toBe(true);

    const staleFindings = await controlPlane.listReconciliationFindings({
      findingType: 'stale_venue_truth_snapshot',
      limit: 20,
    });
    expect(staleFindings.some((finding) => finding.venueId === 'drift-solana-stale' && finding.status === 'active')).toBe(true);

    const unavailableFindings = await controlPlane.listReconciliationFindings({
      findingType: 'venue_truth_unavailable',
      limit: 20,
    });
    const unavailableFinding = unavailableFindings.find(
      (finding) => finding.venueId === 'drift-solana-unavailable' && finding.status === 'active',
    );
    expect(unavailableFinding).toBeTruthy();
    expect(unavailableFinding?.mismatchId).toBeTruthy();

    const mismatchDetail = await controlPlane.getMismatchDetail(String(unavailableFinding?.mismatchId));
    expect(mismatchDetail?.mismatch.sourceKind).toBe('reconciliation');
    expect(mismatchDetail?.latestReconciliationFinding?.findingType).toBe('venue_truth_unavailable');

    const summary = await controlPlane.getReconciliationSummary();
    expect(summary?.latestTypeCounts['missing_venue_truth_snapshot']).toBeGreaterThan(0);
    expect(summary?.latestTypeCounts['stale_venue_truth_snapshot']).toBeGreaterThan(0);
    expect(summary?.latestTypeCounts['venue_truth_unavailable']).toBeGreaterThan(0);
    expect(summary?.latestTypeCounts['venue_truth_partial_coverage']).toBeGreaterThan(0);
  });

  it('compares internal execution references against recent real venue references when available', async () => {
    const connectionString = await createConnectionString();
    const adapter = new StubReadonlyVenueTruthAdapter(
      'drift-solana-readonly',
      'Drift Solana Read-Only',
      {
        executionReferenceState: {
          referenceLookbackLimit: 10,
          references: [{
            referenceType: 'solana_signature',
            reference: 'sig-observed-1',
            accountAddress: 'drift-solana-readonly-account',
            slot: '123',
            blockTime: '2026-03-31T11:59:00.000Z',
            confirmationStatus: 'confirmed',
            errored: false,
            memo: null,
          }],
          oldestReferenceAt: '2026-03-31T11:59:00.000Z',
        },
      },
    );

    const controlPlane = await RuntimeControlPlane.connect(connectionString);
    const worker = await RuntimeWorker.createDeterministic(connectionString, {
      truthAdapters: [adapter],
    }, {
      cycleIntervalMs: 60_000,
      pollIntervalMs: 25,
    });

    cleanups.push(async () => {
      await worker.stop();
    });

    await worker.start();

    const connection = await createDatabaseConnection(connectionString);
    const store = new RuntimeStore(connection.db, new DatabaseAuditWriter(connection.db));
    const [action] = await store.createCarryActions({
      strategyRunId: null,
      intents: [{
        actionType: 'increase_carry_exposure',
        sourceKind: 'opportunity',
        sourceReference: 'opp-exec-ref-test',
        opportunityId: 'opp-exec-ref-test',
        asset: 'BTC',
        summary: 'Seed execution reference reconciliation.',
        notionalUsd: '1000',
        details: {},
        readiness: 'actionable',
        blockedReasons: [],
        executable: true,
        approvalRequirement: 'operator',
        executionMode: 'dry-run',
        simulated: true,
        plannedOrders: [{
          intentId: 'intent-exec-ref-test',
          venueId: 'drift-solana-readonly',
          asset: 'BTC',
          side: 'buy',
          type: 'market',
          size: '0.01',
          limitPrice: null,
          opportunityId: 'opp-exec-ref-test' as never,
          reduceOnly: false,
          createdAt: new Date('2026-03-31T11:58:00.000Z'),
          metadata: {},
        }],
        effects: {
          currentCarryAllocationUsd: '0',
          projectedCarryAllocationUsd: '1000',
          projectedCarryAllocationPct: 0.01,
          approvedCarryBudgetUsd: '5000',
          projectedRemainingBudgetUsd: '4000',
          openPositionCount: 0,
        },
      }],
      actorId: 'vitest',
      createdAt: new Date('2026-03-31T11:58:00.000Z'),
    });

    if (action === undefined) {
      throw new Error('Expected carry action to be created');
    }

    const execution = await store.createCarryExecution({
      carryActionId: action.id,
      strategyRunId: null,
      commandId: null,
      status: 'completed',
      executionMode: 'dry-run',
      simulated: true,
      requestedBy: 'vitest',
      venueExecutionReference: 'sig-missing-1',
      outcome: {},
    });
    await store.createCarryExecutionStep({
      carryExecutionId: execution.id,
      carryActionId: action.id,
      strategyRunId: null,
      plannedOrderId: null,
      intentId: 'intent-exec-ref-test',
      venueId: 'drift-solana-readonly',
      venueMode: 'live',
      executionSupported: false,
      readOnly: true,
      approvedForLiveUse: false,
      onboardingState: 'read_only',
      asset: 'BTC',
      side: 'buy',
      orderType: 'market',
      requestedSize: '0.01',
      reduceOnly: false,
      executionReference: 'sig-missing-1',
      status: 'completed',
      simulated: true,
      outcome: {},
      metadata: {},
      completedAt: new Date('2026-03-31T11:58:05.000Z'),
    });

    const firstReconciliationCommand = await controlPlane.enqueueReconciliationRun('vitest', {
      trigger: 'phase-5-3-execution-reference-mismatch',
      triggeredBy: 'vitest',
    });
    await waitFor(
      async () => controlPlane.getCommand(firstReconciliationCommand.commandId),
      (command): command is Exclude<typeof command, null> => command !== null && command.status === 'completed',
      20_000,
    );

    const mismatchedFindings = await waitFor(
      async () => controlPlane.listReconciliationFindings({
        findingType: 'venue_execution_reference_mismatch',
        limit: 20,
      }),
      (findings) => findings.some(
        (finding) => finding.venueId === 'drift-solana-readonly' && finding.status === 'active',
      ),
      20_000,
    );
    expect(
      mismatchedFindings.some(
        (finding) => finding.venueId === 'drift-solana-readonly' && finding.status === 'active',
      ),
    ).toBe(true);

    adapter.setSnapshot({
      executionReferenceState: {
        referenceLookbackLimit: 10,
        references: [
          {
            referenceType: 'solana_signature',
            reference: 'sig-observed-1',
            accountAddress: 'drift-solana-readonly-account',
            slot: '123',
            blockTime: '2026-03-31T11:59:00.000Z',
            confirmationStatus: 'confirmed',
            errored: false,
            memo: null,
          },
          {
            referenceType: 'solana_signature',
            reference: 'sig-missing-1',
            accountAddress: 'drift-solana-readonly-account',
            slot: '124',
            blockTime: '2026-03-31T12:00:00.000Z',
            confirmationStatus: 'confirmed',
            errored: false,
            memo: null,
          },
        ],
        oldestReferenceAt: '2026-03-31T11:59:00.000Z',
      },
      payload: {
        balanceSol: '12.000000000',
      },
    });

    const cycleCommand = await controlPlane.enqueueCommand('run_cycle', 'vitest', {
      triggerSource: 'phase-5-3-refresh-execution-reference-truth',
    });
    await waitFor(
      async () => controlPlane.getCommand(cycleCommand.commandId),
      (command): command is Exclude<typeof command, null> => command !== null && command.status === 'completed',
      20_000,
    );

    const secondReconciliationCommand = await controlPlane.enqueueReconciliationRun('vitest', {
      trigger: 'phase-5-3-execution-reference-mismatch-resolved',
      triggeredBy: 'vitest',
    });
    await waitFor(
      async () => controlPlane.getCommand(secondReconciliationCommand.commandId),
      (command): command is Exclude<typeof command, null> => command !== null && command.status === 'completed',
      20_000,
    );

    const resolvedFindings = await controlPlane.listReconciliationFindings({
      findingType: 'venue_execution_reference_mismatch',
      limit: 20,
    });
    expect(
      resolvedFindings.some(
        (finding) => finding.venueId === 'drift-solana-readonly' && finding.status === 'resolved',
      ),
    ).toBe(true);
  });
});
