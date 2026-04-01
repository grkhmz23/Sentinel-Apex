import { randomUUID } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import { applyMigrations, createDatabaseConnection } from '@sentinel-apex/db';
import { createId } from '@sentinel-apex/domain';
import type {
  VenueCapabilitySnapshot,
  VenueTruthAdapter,
  VenueTruthSnapshot,
} from '@sentinel-apex/venue-adapters';

import { RuntimeControlPlane } from '../control-plane.js';
import { SentinelRuntime } from '../runtime.js';
import { DatabaseAuditWriter } from '../store.js';


async function createRuntimeConnectionString(): Promise<string> {
  return `file:///tmp/sentinel-apex-runtime-test-${randomUUID()}`;
}

async function createRuntime(overrides: Parameters<typeof SentinelRuntime.createDeterministic>[1] = {}) {
  const connectionString = await createRuntimeConnectionString();
  return SentinelRuntime.createDeterministic(connectionString, overrides);
}

function asPositionFingerprint(position: {
  venueId: string;
  asset: string;
  side: string;
  size: string;
}): string {
  return `${position.venueId}:${position.asset}:${position.side}:${position.size}`;
}

class StubReadonlyVenueTruthAdapter implements VenueTruthAdapter {
  readonly venueId = 'drift-solana-readonly';
  readonly venueName = 'Drift Solana Read-Only';
  private connected = false;

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
      connectorType: 'solana_rpc_readonly',
      truthMode: 'real' as const,
      readOnlySupport: true,
      executionSupport: false,
      approvedForLiveUse: false,
      onboardingState: 'read_only' as const,
      missingPrerequisites: [],
      authRequirementsSummary: ['DRIFT_RPC_ENDPOINT', 'DRIFT_READONLY_ACCOUNT_ADDRESS'],
      healthy: true,
      healthState: 'healthy' as const,
      degradedReason: null,
      metadata: {
        endpointConfigured: true,
      },
    };
  }

  async getVenueTruthSnapshot(): Promise<VenueTruthSnapshot> {
    return {
      venueId: this.venueId,
      venueName: this.venueName,
      snapshotType: 'solana_rpc_account_state',
      snapshotSuccessful: true,
      healthy: true,
      healthState: 'healthy' as const,
      summary: 'Read-only Solana account snapshot captured with reference-only derivative coverage.',
      errorMessage: null,
      capturedAt: '2026-03-31T12:00:00.000Z',
      snapshotCompleteness: 'partial',
      truthCoverage: {
        accountState: {
          status: 'available',
          reason: null,
          limitations: [],
        },
        balanceState: {
          status: 'available',
          reason: null,
          limitations: [],
        },
        capacityState: {
          status: 'unsupported',
          reason: 'Generic Solana RPC does not expose venue capacity.',
          limitations: [],
        },
        exposureState: {
          status: 'available',
          reason: null,
          limitations: ['Exposure is balance-derived and does not include venue-native derivatives.'],
        },
        derivativeAccountState: {
          status: 'partial',
          reason: 'Program-owned account metadata is visible, but venue-native derivative decoding is not implemented.',
          limitations: ['Authority, subaccount, positions, and health require a venue SDK or IDL-backed decoder.'],
        },
        derivativePositionState: {
          status: 'unsupported',
          reason: 'Generic Solana RPC does not decode venue-native derivative positions.',
          limitations: [],
        },
        derivativeHealthState: {
          status: 'unsupported',
          reason: 'Generic Solana RPC does not decode venue-native margin or health state.',
          limitations: [],
        },
        orderState: {
          status: 'partial',
          reason: 'Order context is reference-only and derived from recent account signatures.',
          limitations: ['Order state is limited to reference-only recent signatures and not venue-native open orders.'],
        },
        executionReferences: {
          status: 'available',
          reason: null,
          limitations: ['Execution references are limited to recent account signatures.'],
        },
      },
      sourceMetadata: {
        sourceKind: 'json_rpc',
        sourceName: 'solana_rpc_readonly',
        observedScope: [
          'account_identity',
          'native_balance',
          'recent_signatures',
          'derivative_account_metadata',
          'order_reference_context',
        ],
      },
      accountState: {
        accountAddress: 'readonly-account',
        accountLabel: 'Runtime test wallet',
        accountExists: true,
        ownerProgram: 'drift-program',
        executable: false,
        lamports: '12000000000',
        nativeBalanceDisplay: '12.000000000',
        observedSlot: '123',
        rentEpoch: '0',
        dataLength: 0,
      },
      balanceState: {
        balances: [{
          assetKey: 'SOL',
          assetSymbol: 'SOL',
          assetType: 'native',
          accountAddress: 'readonly-account',
          amountAtomic: '12000000000',
          amountDisplay: '12.000000000',
          decimals: 9,
          observedSlot: '123',
        }],
        totalTrackedBalances: 1,
        observedSlot: '123',
      },
      capacityState: null,
      exposureState: {
        exposures: [{
          exposureKey: 'SOL:readonly-account',
          exposureType: 'balance_derived_spot',
          assetKey: 'SOL',
          quantity: '12000000000',
          quantityDisplay: '12.000000000',
          accountAddress: 'readonly-account',
        }],
        methodology: 'balance_derived_spot_exposure',
      },
      derivativeAccountState: {
        venue: this.venueId,
        accountAddress: 'readonly-account',
        accountLabel: 'Runtime test wallet',
        accountExists: true,
        ownerProgram: 'drift-program',
        accountModel: 'program_account',
        venueAccountType: null,
        decoded: false,
        authorityAddress: null,
        subaccountId: null,
        observedSlot: '123',
        rpcVersion: '1.18.0',
        dataLength: 512,
        rawDiscriminatorHex: '0102030405060708',
        notes: [
          'Program-owned account metadata was captured from raw RPC.',
          'Venue-native decode is unavailable in the current repo because no Drift or Anchor decoder is present.',
        ],
      },
      derivativePositionState: null,
      derivativeHealthState: null,
      orderState: {
        openOrderCount: null,
        openOrders: [{
          venueOrderId: null,
          reference: 'sig-runtime-test-1',
          marketKey: null,
          marketSymbol: null,
          side: 'unknown',
          status: 'confirmed',
          orderType: null,
          price: null,
          quantity: null,
          reduceOnly: null,
          accountAddress: 'readonly-account',
          slot: '123',
          placedAt: '2026-03-31T11:59:00.000Z',
          metadata: {
            referenceOnly: true,
          },
        }],
        referenceMode: 'recent_account_signatures',
        methodology: 'recent_account_signatures_reference_context',
        notes: [
          'This section is reference-only context derived from recent account signatures.',
          'It is not a venue-native open-orders decode and may include non-order transactions.',
        ],
      },
      executionReferenceState: {
        referenceLookbackLimit: 10,
        references: [{
          referenceType: 'solana_signature',
          reference: 'sig-runtime-test-1',
          accountAddress: 'readonly-account',
          slot: '123',
          blockTime: '2026-03-31T11:59:00.000Z',
          confirmationStatus: 'confirmed',
          errored: false,
          memo: null,
        }],
        oldestReferenceAt: '2026-03-31T11:59:00.000Z',
      },
      payload: {
        balanceSol: '12.000000000',
      },
      metadata: {},
    };
  }
}

describe('SentinelRuntime', () => {
  it('persists approved paper executions into read models', async () => {
    const runtime = await createRuntime();

    const result = await runtime.runCycle('runtime-test');
    const portfolio = await runtime.getPortfolioSummary();
    const orders = await runtime.listOrders();
    const riskSummary = await runtime.getRiskSummary();
    const events = await runtime.listRecentEvents();

    expect(result.intentsExecuted).toBeGreaterThan(0);
    expect(portfolio?.sleeves.length ?? 0).toBeGreaterThan(0);
    expect(orders.length).toBeGreaterThan(0);
    expect(riskSummary?.approvedIntentCount ?? 0).toBeGreaterThan(0);
    expect(events.some((event) => event.eventType === 'runtime.cycle_completed')).toBe(true);

    await runtime.close();
  });

  it('persists rejected-by-risk paths and risk breaches', async () => {
    const runtime = await createRuntime({
      riskLimits: {
        maxGrossExposurePct: 0.01,
      },
    });

    const result = await runtime.runCycle('runtime-risk-test');
    const breaches = await runtime.listRiskBreaches();
    const orders = await runtime.listOrders();

    expect(result.intentsRejected).toBeGreaterThan(0);
    expect(breaches.length).toBeGreaterThan(0);
    expect(orders.length).toBe(0);

    await runtime.close();
  });

  it('deduplicates audit events by eventId', async () => {
    const connectionString = await createRuntimeConnectionString();
    const connection = await createDatabaseConnection(connectionString);
    await applyMigrations(connection);
    const auditWriter = new DatabaseAuditWriter(connection.db);

    const auditEvent = {
      eventId: createId(),
      eventType: 'test.duplicate_event',
      occurredAt: new Date().toISOString(),
      actorType: 'system' as const,
      actorId: 'runtime-test',
      data: { duplicate: true },
    };

    await auditWriter.write(auditEvent);
    await auditWriter.write(auditEvent);

    const runtime = await SentinelRuntime.createDeterministic(connectionString);
    const events = await runtime.listRecentEvents();

    expect(events.filter((event) => event.eventType === 'test.duplicate_event')).toHaveLength(1);

    await runtime.close();
  });

  it('restores runtime state and positions from persisted history on restart', async () => {
    const connectionString = await createRuntimeConnectionString();

    const runtime = await SentinelRuntime.createDeterministic(connectionString);
    const firstCycle = await runtime.runCycle('runtime-restart-test');
    const positionsBeforeClose = await runtime.listPositions();
    await runtime.close();

    const restarted = await SentinelRuntime.createDeterministic(connectionString);
    const restoredStatus = await restarted.getRuntimeStatus();
    const restoredPositions = await restarted.listPositions();

    expect(restoredStatus.lifecycleState).toBe('ready');
    expect(restoredStatus.lastSuccessfulRunId).toBe(firstCycle.runId);
    expect(restoredStatus.lastProjectionSourceRunId).toBe(firstCycle.runId);
    expect(restoredPositions).toHaveLength(positionsBeforeClose.length);
    expect(restoredPositions.map(asPositionFingerprint).sort()).toEqual(
      positionsBeforeClose.map(asPositionFingerprint).sort(),
    );

    await restarted.close();
  });

  it('rebuilds projections idempotently from persisted records', async () => {
    const runtime = await createRuntime();

    const cycle = await runtime.runCycle('runtime-rebuild-test');
    const portfolioBefore = await runtime.getPortfolioSummary();
    const positionsBefore = await runtime.listPositions();

    const firstRebuild = await runtime.rebuildProjections('runtime-test-rebuild');
    const secondRebuild = await runtime.rebuildProjections('runtime-test-rebuild');
    const portfolioAfter = await runtime.getPortfolioSummary();
    const positionsAfter = await runtime.listPositions();

    expect(firstRebuild.projectionStatus).toBe('fresh');
    expect(secondRebuild.projectionStatus).toBe('fresh');
    expect(secondRebuild.lastProjectionSourceRunId).toBe(cycle.runId);
    expect(portfolioAfter).toEqual(portfolioBefore);
    expect(positionsAfter.map(asPositionFingerprint).sort()).toEqual(
      positionsBefore.map(asPositionFingerprint).sort(),
    );

    await runtime.close();
  });

  it('enforces pause and resume semantics through persisted runtime state', async () => {
    const runtime = await createRuntime();

    const paused = await runtime.activateKillSwitch('operator-maintenance', 'runtime-test');
    expect(paused.lifecycleState).toBe('paused');
    await expect(runtime.runCycle('paused-runtime-test')).rejects.toThrow('Runtime is paused');

    const resumed = await runtime.resume('operator-maintenance-complete', 'runtime-test');
    expect(resumed.lifecycleState).toBe('ready');

    const cycle = await runtime.runCycle('post-resume-runtime-test');
    expect(cycle.runId).toBeTruthy();

    await runtime.close();
  });

  it('persists allocator evaluations with target allocations and recommendations', async () => {
    const runtime = await createRuntime();

    await runtime.runCycle('runtime-allocator-test');

    const summary = await runtime.getAllocatorSummary();

    expect(summary?.allocatorRunId).toBeTruthy();
    expect(summary?.carryTargetPct).toBeGreaterThanOrEqual(0);
    expect(summary?.treasuryTargetPct).toBeGreaterThan(0);
    expect(summary?.recommendationCount).toBeGreaterThanOrEqual(1);

    await runtime.close();
  });

  it('persists rebalance proposals derived from allocator targets', async () => {
    const connectionString = await createRuntimeConnectionString();
    const runtime = await SentinelRuntime.createDeterministic(connectionString);
    const controlPlane = await RuntimeControlPlane.connect(connectionString);

    await runtime.runCycle('runtime-rebalance-proposal-test');
    const proposals = await controlPlane.listRebalanceProposals(10);

    expect(proposals.length).toBeGreaterThan(0);
    expect(proposals[0]?.allocatorRunId).toBeTruthy();
    expect(proposals[0]?.actionType).toBe('rebalance_between_sleeves');

    const detail = await controlPlane.getRebalanceProposal(String(proposals[0]?.id));
    expect(detail?.intents.length).toBeGreaterThan(0);
    expect(detail?.proposal.summary).toContain('Rebalance');

    await runtime.close();
  });

  it('persists carry evaluations with actionability state and venue readiness snapshots', async () => {
    const runtime = await createRuntime();

    await runtime.runCycle('runtime-carry-evaluation-test');
    const evaluation = await runtime.runCarryEvaluation({
      actorId: 'vitest',
      trigger: 'runtime_carry_evaluation_test',
    });

    const actions = await runtime.listCarryActions(20);
    const venues = await runtime.listCarryVenues(20);
    const detail = actions[0] === undefined ? null : await runtime.getCarryAction(actions[0].id);
    const executionDetail = detail?.executions[0] === undefined
      ? null
      : await runtime.getCarryExecution(detail.executions[0].id);

    expect(evaluation.actionCount).toBeGreaterThan(0);
    expect(actions.length).toBeGreaterThan(0);
    expect(actions[0]?.executionMode).toBe('dry-run');
    expect(actions[0]?.simulated).toBe(true);
    expect(venues.length).toBeGreaterThan(0);
    expect(venues[0]?.venueMode).toBe('simulated');
    expect(detail?.plannedOrders.length).toBeGreaterThan(0);
    expect(executionDetail).toBeNull();

    await runtime.close();
  });

  it('persists generic venue truth inventory and real read-only snapshots', async () => {
    const runtime = await createRuntime({
      truthAdapters: [new StubReadonlyVenueTruthAdapter()],
    });

    const venues = await runtime.listVenues(20);
    const summary = await runtime.getVenueSummary();
    const detail = await runtime.getVenue('drift-solana-readonly');

    expect(venues.some((venue) => venue.venueId === 'drift-solana-readonly')).toBe(true);
    expect(venues.find((venue) => venue.venueId === 'drift-solana-readonly')?.truthMode).toBe('real');
    expect(venues.find((venue) => venue.venueId === 'drift-solana-readonly')?.readOnlySupport).toBe(true);
    expect(venues.find((venue) => venue.venueId === 'drift-solana-readonly')?.truthProfile).toBe('derivative_aware');
    expect(summary.realReadOnly).toBeGreaterThan(0);
    expect(summary.derivativeAware).toBeGreaterThan(0);
    expect(detail?.venue.truthCoverage.derivativeAccountState.status).toBe('partial');
    expect(detail?.snapshots[0]?.snapshotType).toBe('solana_rpc_account_state');
    expect(detail?.snapshots[0]?.orderState?.referenceMode).toBe('recent_account_signatures');

    await runtime.close();
  });
});
