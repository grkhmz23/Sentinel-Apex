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
      connectorType: 'drift_native_readonly',
      truthMode: 'real' as const,
      readOnlySupport: true,
      executionSupport: false,
      approvedForLiveUse: false,
      onboardingState: 'read_only' as const,
      missingPrerequisites: [],
      authRequirementsSummary: [
        'DRIFT_RPC_ENDPOINT',
        'DRIFT_READONLY_ENV',
        'DRIFT_READONLY_ACCOUNT_ADDRESS or DRIFT_READONLY_AUTHORITY_ADDRESS',
      ],
      healthy: true,
      healthState: 'healthy' as const,
      degradedReason: null,
      metadata: {
        driftEnv: 'mainnet-beta',
        commitment: 'confirmed',
        endpointConfigured: true,
        accountAddressConfigured: true,
        executionPosture: 'read_only',
      },
    };
  }

  async getVenueTruthSnapshot(): Promise<VenueTruthSnapshot> {
    return {
      venueId: this.venueId,
      venueName: this.venueName,
      snapshotType: 'drift_native_user_account',
      snapshotSuccessful: true,
      healthy: true,
      healthState: 'healthy' as const,
      summary: 'Drift-native read-only snapshot captured for Apex Carry with 2 positions, 2 open orders, and health score 84.',
      errorMessage: null,
      capturedAt: '2026-03-31T12:00:00.000Z',
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
        accountAddress: 'readonly-account',
        accountLabel: 'Apex Carry',
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
          exposureKey: 'perp:0:readonly-account',
          exposureType: 'position',
          assetKey: 'BTC-PERP',
          quantity: '0.75',
          quantityDisplay: '0.75',
          accountAddress: 'readonly-account',
        }],
        methodology: 'drift_position_inventory_exposure',
        provenance: {
          classification: 'derived',
          source: 'drift_sdk_margin_math',
          notes: ['Exposure rows were derived from decoded Drift position inventory.'],
        },
      },
      derivativeAccountState: {
        venue: this.venueId,
        accountAddress: 'readonly-account',
        accountLabel: 'Apex Carry',
        accountExists: true,
        ownerProgram: 'drift-program',
        accountModel: 'program_account',
        venueAccountType: 'drift_user',
        decoded: true,
        authorityAddress: 'drift-authority',
        subaccountId: 0,
        userName: 'Apex Carry',
        delegateAddress: 'drift-delegate',
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
            accountAddress: 'readonly-account',
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
            accountAddress: 'readonly-account',
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
        accountAddress: 'readonly-account',
        authorityAddress: 'drift-authority',
        subaccountId: 0,
        openOrderCount: 2,
        openPositionCount: 2,
        healthScore: 84,
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

  it('persists Drift-native venue truth inventory and real read-only snapshots', async () => {
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
    expect(detail?.venue.truthCoverage.derivativeAccountState.status).toBe('available');
    expect(detail?.venue.sourceMetadata.connectorDepth).toBe('drift_native_readonly');
    expect(detail?.snapshots[0]?.snapshotType).toBe('drift_native_user_account');
    expect(detail?.snapshots[0]?.orderState?.referenceMode).toBe('venue_open_orders');
    expect(detail?.snapshots[0]?.derivativePositionState?.positions.length).toBeGreaterThan(0);
    expect(detail?.snapshots[0]?.derivativeHealthState?.healthScore).toBe(84);

    await runtime.close();
  });

  it('persists canonical internal derivative state from real order and fill flows', async () => {
    const runtime = await createRuntime({
      internalDerivativeTargets: [
        {
          venueId: 'sim-venue-a',
          venueName: 'Simulated Venue A',
          authorityAddress: 'sim-authority-a',
          subaccountId: 0,
          accountLabel: 'Internal Derivative Test Account',
        },
      ],
    });

    await runtime.runCycle('runtime-internal-derivative-state-test');

    const state = await runtime.getVenueInternalState('sim-venue-a');

    expect(state).not.toBeNull();
    expect(state?.venueId).toBe('sim-venue-a');
    expect(state?.coverage.accountState.status).toBe('available');
    expect(state?.coverage.positionState.status).toBe('available');
    expect(state?.coverage.healthState.status).toBe('unsupported');
    expect(state?.coverage.orderState.status).toBe('available');
    expect(state?.accountState?.authorityAddress).toBe('sim-authority-a');
    expect(state?.positionState?.openPositionCount).toBeGreaterThan(0);
    expect(state?.positionState?.positions[0]?.provenance.source).toBe('runtime_fill_ledger');
    expect(state?.orderState?.openOrderCount).toBe(0);
    expect(state?.healthState?.healthStatus).toBe('unknown');
    expect(state?.healthState?.provenance.classification).toBe('estimated');

    await runtime.close();
  });
});
