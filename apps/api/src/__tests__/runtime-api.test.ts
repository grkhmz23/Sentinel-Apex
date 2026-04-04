import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  allocatorRebalanceExecutions,
  allocatorRebalanceProposals,
  carryActions,
  createDatabaseConnection,
  type DatabaseConnection,
  treasuryActionExecutions,
  treasuryActions,
} from '@sentinel-apex/db';
import {
  DatabaseAuditWriter,
  RuntimeStore,
} from '@sentinel-apex/runtime';
import type {
  InternalDerivativeSnapshotView,
  RuntimeControlPlane,
  RuntimeWorker,
  VenueSnapshotView,
} from '@sentinel-apex/runtime';
import type {
  VenueCapabilitySnapshot,
  VenueTruthAdapter,
  VenueTruthSnapshot,
} from '@sentinel-apex/venue-adapters';

import { createApp } from '../app.js';
import {
  createApiHarness,
  createOperatorHeaders,
  waitForCommand,
  waitForMismatch,
  waitForMismatchStatus,
  waitForReconciliationRun,
  waitForRemediationStatus,
} from './helpers.js';

import type { FastifyInstance } from 'fastify';

const TEST_API_KEY = 'test-secret-key-for-vitest-suite-32chars!!';
const TEST_SHARED_SECRET = 'ops-auth-shared-secret-for-tests-32chars';

async function waitFor<T>(
  fn: () => Promise<T>,
  predicate: (value: T) => boolean,
  timeoutMs = 5_000,
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

function createInternalDerivativeSnapshot(
  venueId: string,
  venueName: string,
): Omit<InternalDerivativeSnapshotView, 'id' | 'updatedAt'> {
  return {
    venueId,
    venueName,
    sourceComponent: 'sentinel-runtime',
    sourceRunId: 'run-1',
    sourceReference: 'carry-action-1',
    capturedAt: freshCapturedAt(),
    coverage: {
      accountState: {
        status: 'available',
        reason: null,
        limitations: [],
      },
      positionState: {
        status: 'available',
        reason: null,
        limitations: [],
      },
      healthState: {
        status: 'available',
        reason: null,
        limitations: [
          'Internal health posture is derived from internal portfolio and risk projections, not from venue-native Drift margin math.',
          'Only band-level health comparison is currently truthful; exact margin fields remain external-only.',
        ],
      },
      orderState: {
        status: 'partial',
        reason: 'One internal open order does not yet have a venue order id for direct comparison.',
        limitations: ['Orders without a venue order id remain canonical internally but only partially comparable externally.'],
      },
    },
    accountState: {
      venueId,
      venueName,
      configured: true,
      accountLocatorMode: 'authority_subaccount',
      accountAddress: null,
      authorityAddress: `${venueId}-authority`,
      subaccountId: 0,
      accountLabel: venueName,
      methodology: 'runtime_operator_config',
      notes: ['Internal account identity comes from runtime configuration.'],
      provenance: {
        classification: 'canonical',
        source: 'runtime_derivative_tracking_config',
        notes: ['Internal account identity is configured by the operator.'],
      },
    },
    positionState: {
      positions: [
        {
          positionKey: 'perp:0',
          asset: 'BTC',
          marketType: 'perp',
          side: 'long',
          netQuantity: '0.75',
          averageEntryPrice: '68333.333333',
          executedBuyQuantity: '1',
          executedSellQuantity: '0.25',
          fillCount: 2,
          sourceOrderCount: 1,
          firstFilledAt: '2026-03-31T11:58:00.000Z',
          lastFilledAt: '2026-03-31T11:59:00.000Z',
          marketIdentity: {
            asset: 'BTC',
            marketType: 'perp',
            marketIndex: 0,
            marketKey: 'perp:0',
            marketSymbol: 'BTC-PERP',
            normalizedKey: 'perp:0',
            normalizedKeyType: 'market_index',
            confidence: 'exact',
            notes: ['Internal position identity inherited exact market metadata from a source order.'],
            provenance: {
              classification: 'canonical',
              source: 'runtime_fill_ledger',
              notes: ['Internal market identity was sourced from exact order metadata.'],
            },
          },
          metadata: {
            instrumentType: 'perpetual',
            marketIndex: 0,
            marketKey: 'perp:0',
            marketSymbol: 'BTC-PERP',
          },
          provenance: {
            classification: 'derived',
            source: 'runtime_fills_joined_to_orders',
            notes: ['Internal positions are reconstructed from persisted fills joined to internal order metadata.'],
          },
        },
      ],
      openPositionCount: 1,
      methodology: 'runtime_fills_joined_to_orders',
      notes: ['Internal derivative positions are reconstructed from canonical fills.'],
      provenance: {
        classification: 'derived',
        source: 'runtime_fills_joined_to_orders',
        notes: ['Internal derivative positions are reconstructed from canonical fills.'],
      },
    },
    healthState: {
      healthStatus: 'healthy',
      modelType: 'internal_risk_posture',
      comparisonMode: 'status_band_only',
      riskPosture: 'normal',
      collateralLikeUsd: '109150.25',
      liquidityReserveUsd: '109150.25',
      grossExposureUsd: '51000',
      netExposureUsd: '51000',
      venueExposureUsd: '51000',
      exposureToNavRatio: '0.204',
      liquidityReservePct: 43.66,
      leverage: '2.11',
      openPositionCount: 1,
      openOrderCount: 2,
      openCircuitBreakers: [],
      unsupportedReasons: ['Exact Drift collateral, free collateral, margin ratio, and requirement fields remain external-only.'],
      methodology: 'portfolio_current_plus_risk_current',
      notes: [
        'Internal health posture is derived from persisted portfolio and risk read models.',
        'Collateral-like posture maps to internal liquidity reserve rather than exact Drift collateral accounting.',
      ],
      provenance: {
        classification: 'derived',
        source: 'portfolio_current_plus_risk_current',
        notes: ['Internal health posture is derived from internal runtime projections rather than external venue truth.'],
      },
    },
    orderState: {
      openOrderCount: 2,
      comparableOpenOrderCount: 1,
      nonComparableOpenOrderCount: 1,
      openOrders: [
        {
          orderKey: '901',
          clientOrderId: 'client-order-1',
          venueOrderId: '901',
          asset: 'BTC',
          marketType: 'perp',
          side: 'buy',
          status: 'open',
          requestedSize: '0.100000000',
          filledSize: '0',
          remainingSize: '0.100000000',
          requestedPrice: '68000.000000',
          reduceOnly: false,
          executionMode: 'dry-run',
          comparableByVenueOrderId: true,
          submittedAt: '2026-03-31T11:58:30.000Z',
          completedAt: null,
          updatedAt: freshCapturedAt(),
          marketIdentity: {
            asset: 'BTC',
            marketType: 'perp',
            marketIndex: 0,
            marketKey: 'perp:0',
            marketSymbol: 'BTC-PERP',
            normalizedKey: 'perp:0',
            normalizedKeyType: 'market_index',
            confidence: 'exact',
            notes: ['Internal order market identity is sourced from persisted order metadata.'],
            provenance: {
              classification: 'canonical',
              source: 'runtime_orders_table',
              notes: ['Internal market identity was sourced from exact order metadata.'],
            },
          },
          metadata: {
            instrumentType: 'perpetual',
            marketIndex: 0,
            marketKey: 'perp:0',
            marketSymbol: 'BTC-PERP',
          },
          provenance: {
            classification: 'canonical',
            source: 'runtime_orders_table',
            notes: ['Open-order inventory comes from persisted runtime order records.'],
          },
        },
        {
          orderKey: 'client-order-2',
          clientOrderId: 'client-order-2',
          venueOrderId: null,
          asset: 'SOL',
          marketType: 'spot',
          side: 'sell',
          status: 'open',
          requestedSize: '4.500000000',
          filledSize: '0',
          remainingSize: '4.500000000',
          requestedPrice: '151.250000',
          reduceOnly: false,
          executionMode: 'dry-run',
          comparableByVenueOrderId: false,
          submittedAt: '2026-03-31T11:58:35.000Z',
          completedAt: null,
          updatedAt: freshCapturedAt(),
          marketIdentity: {
            asset: 'SOL',
            marketType: 'spot',
            marketIndex: null,
            marketKey: null,
            marketSymbol: 'SOL',
            normalizedKey: 'spot:SOL',
            normalizedKeyType: 'market_symbol',
            confidence: 'derived',
            notes: ['Internal order market identity is derived from order asset plus instrument type.'],
            provenance: {
              classification: 'derived',
              source: 'runtime_orders_table',
              notes: ['Internal market symbol is derived from asset plus market type, not from venue-native order metadata.'],
            },
          },
          metadata: {
            instrumentType: 'spot',
          },
          provenance: {
            classification: 'canonical',
            source: 'runtime_orders_table',
            notes: ['This internal order exists canonically before a venue order id is assigned.'],
          },
        },
      ],
      methodology: 'runtime_orders_table',
      notes: ['Open-order inventory comes directly from persisted internal order state.'],
      provenance: {
        classification: 'canonical',
        source: 'runtime_orders_table',
        notes: ['Open-order inventory is based on persisted runtime orders.'],
      },
    },
    metadata: {
      testFixture: 'phase-5-6-api',
    },
  };
}

async function persistInternalDerivativeSnapshot(
  connectionString: string,
  snapshot: Omit<InternalDerivativeSnapshotView, 'id' | 'updatedAt'>,
): Promise<DatabaseConnection> {
  const connection = await createDatabaseConnection(connectionString);
  const store = new RuntimeStore(connection.db, new DatabaseAuditWriter(connection.db));
  await store.persistInternalDerivativeSnapshots({
    snapshots: [snapshot],
  });
  return connection;
}

function promotionCandidateSnapshot(
  overrides: Partial<VenueSnapshotView> = {},
): VenueSnapshotView {
  const snapshot: VenueSnapshotView = {
    id: 'promotion-candidate-snapshot',
    venueId: 'live-carry-venue',
    venueName: 'Live Carry Venue',
    connectorType: 'carry_adapter',
    sleeveApplicability: ['carry'],
    truthMode: 'real',
    readOnlySupport: false,
    executionSupport: true,
    approvedForLiveUse: false,
    onboardingState: 'ready_for_review',
    missingPrerequisites: [],
    authRequirementsSummary: ['LIVE_CARRY_API_KEY'],
    healthy: true,
    healthState: 'healthy',
    degradedReason: null,
    truthProfile: 'minimal',
    snapshotType: 'execution_capable_connector_state',
    snapshotSuccessful: true,
    snapshotSummary: 'Execution-capable connector snapshot is healthy and fresh.',
    snapshotPayload: {
      connectionState: 'ready',
    },
    errorMessage: null,
    capturedAt: freshCapturedAt(),
    snapshotCompleteness: 'complete',
    truthCoverage: {
      accountState: { status: 'available', reason: null, limitations: [] },
      balanceState: { status: 'available', reason: null, limitations: [] },
      capacityState: { status: 'unsupported', reason: 'Not a treasury connector.', limitations: [] },
      exposureState: { status: 'available', reason: null, limitations: [] },
      derivativeAccountState: { status: 'unsupported', reason: 'Not a derivative-aware connector.', limitations: [] },
      derivativePositionState: { status: 'unsupported', reason: 'Not a derivative-aware connector.', limitations: [] },
      derivativeHealthState: { status: 'unsupported', reason: 'Not a derivative-aware connector.', limitations: [] },
      orderState: { status: 'unsupported', reason: 'Order inventory is not exposed in this test fixture.', limitations: [] },
      executionReferences: { status: 'unsupported', reason: 'Execution references are not exposed in this test fixture.', limitations: [] },
    },
    comparisonCoverage: {
      executionReferences: { status: 'unsupported', reason: 'No execution-reference comparison coverage is modeled in this fixture.' },
      positionInventory: { status: 'unsupported', reason: 'No direct comparison inventory is modeled in this fixture.' },
      healthState: { status: 'unsupported', reason: 'No direct health comparison is modeled in this fixture.' },
      orderInventory: { status: 'unsupported', reason: 'No direct order comparison is modeled in this fixture.' },
      notes: [],
    },
    sourceMetadata: {
      sourceKind: 'adapter',
      sourceName: 'live_execution_adapter',
      connectorDepth: 'execution_capable',
      observedScope: ['balances', 'positions', 'status'],
      provenanceNotes: ['Test fixture for connector promotion workflow.'],
    },
    accountState: {
      accountAddress: 'live-carry-account',
      accountLabel: 'Live Carry Venue',
      accountExists: true,
      ownerProgram: 'live-program',
      executable: false,
      lamports: '0',
      nativeBalanceDisplay: '0',
      observedSlot: '1',
      rentEpoch: '0',
      dataLength: 0,
    },
    balanceState: {
      balances: [],
      totalTrackedBalances: 0,
      observedSlot: '1',
    },
    capacityState: null,
    exposureState: {
      exposures: [],
      methodology: 'test_fixture',
    },
    derivativeAccountState: null,
    derivativePositionState: null,
    derivativeHealthState: null,
    orderState: null,
    executionReferenceState: null,
    executionConfirmationState: null,
    metadata: {
      endpointConfigured: true,
      apiKeyConfigured: true,
      executionPosture: 'execution_capable',
    },
    ...overrides,
  };

  return {
    ...snapshot,
    executionConfirmationState: overrides.executionConfirmationState ?? snapshot.executionConfirmationState,
  };
}

async function persistVenueSnapshot(
  connectionString: string,
  snapshot: VenueSnapshotView,
): Promise<DatabaseConnection> {
  const connection = await createDatabaseConnection(connectionString);
  const store = new RuntimeStore(connection.db, new DatabaseAuditWriter(connection.db));
  await store.persistVenueConnectorSnapshots({
    snapshots: [snapshot],
  });
  return connection;
}

function operatorHeaders(
  role: 'viewer' | 'operator' | 'admin',
  method: string,
  path: string,
  operatorId?: string,
): Record<string, string> {
  return createOperatorHeaders({
    role,
    ...(operatorId === undefined ? {} : { operatorId }),
    method,
    path,
    apiKey: TEST_API_KEY,
    sharedSecret: TEST_SHARED_SECRET,
  });
}

class StubReadonlyVenueTruthAdapter implements VenueTruthAdapter {
  private connected = false;
  private snapshotOverrides: Partial<VenueTruthSnapshot>;

  constructor(
    readonly venueId = 'drift-solana-readonly',
    readonly venueName = 'Drift Solana Read-Only',
    snapshotOverrides: Partial<VenueTruthSnapshot> = {},
    private readonly capabilityOverrides: Partial<VenueCapabilitySnapshot> = {},
  ) {
    this.snapshotOverrides = snapshotOverrides;
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
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
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
        executionPosture: 'read_only',
      },
      ...this.capabilityOverrides,
    } as VenueCapabilitySnapshot;
  }

  async getVenueTruthSnapshot(): Promise<VenueTruthSnapshot> {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return createStubVenueTruthSnapshot(this.venueId, this.venueName, this.snapshotOverrides);
  }

  setSnapshotOverrides(snapshotOverrides: Partial<VenueTruthSnapshot>): void {
    this.snapshotOverrides = snapshotOverrides;
  }
}

describe('runtime-backed API routes', () => {
  let app: FastifyInstance;
  let controlPlane: RuntimeControlPlane;
  let worker: RuntimeWorker;
  let connectionString: string;

  beforeEach(async () => {
    process.env['NODE_ENV'] = 'test';
    process.env['API_SECRET_KEY'] = TEST_API_KEY;
    process.env['OPS_AUTH_SHARED_SECRET'] = TEST_SHARED_SECRET;

    const harness = await createApiHarness();
    connectionString = harness.connectionString;
    controlPlane = harness.controlPlane;
    worker = harness.worker;

    app = await createApp({ controlPlane });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
    await worker.stop();
  });

  it('queues a real runtime cycle through the worker and exposes persisted data through the API', async () => {
    const commandResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/runtime/cycles/run',
      headers: operatorHeaders('operator', 'POST', '/api/v1/runtime/cycles/run'),
    });

    expect(commandResponse.statusCode).toBe(202);
    const commandBody = commandResponse.json<{ data: { commandId: string } }>();
    const command = await waitForCommand(controlPlane, commandBody.data.commandId);
    expect(command.status).toBe('completed');
    expect(command.result['runId']).toBeTruthy();
    expect(command.requestedBy).toBe('operator-user');

    const [portfolioResponse, ordersResponse, eventsResponse, runtimeStatusResponse, workerResponse] = await Promise.all([
      app.inject({
        method: 'GET',
        url: '/api/v1/portfolio',
        headers: { 'x-api-key': TEST_API_KEY },
      }),
      app.inject({
        method: 'GET',
        url: '/api/v1/orders',
        headers: { 'x-api-key': TEST_API_KEY },
      }),
      app.inject({
        method: 'GET',
        url: '/api/v1/events',
        headers: { 'x-api-key': TEST_API_KEY },
      }),
      app.inject({
        method: 'GET',
        url: '/api/v1/runtime/status',
        headers: { 'x-api-key': TEST_API_KEY },
      }),
      app.inject({
        method: 'GET',
        url: '/api/v1/runtime/worker',
        headers: { 'x-api-key': TEST_API_KEY },
      }),
    ]);

    expect(portfolioResponse.statusCode).toBe(200);
    expect(ordersResponse.statusCode).toBe(200);
    expect(eventsResponse.statusCode).toBe(200);
    expect(runtimeStatusResponse.statusCode).toBe(200);
    expect(workerResponse.statusCode).toBe(200);

    const portfolioBody = portfolioResponse.json<{ data: { totalNav: string; sleeves: unknown[] } }>();
    const ordersBody = ordersResponse.json<{ data: Array<{ clientOrderId: string; status: string }> }>();
    const eventsBody = eventsResponse.json<{ data: Array<{ eventType: string }> }>();
    const runtimeStatusBody = runtimeStatusResponse.json<{
      data: {
        runtime: { lastRunStatus: string };
        worker: { lifecycleState: string };
        openMismatchCount: number;
      };
    }>();
    const workerBody = workerResponse.json<{ data: { schedulerState: string } }>();

    expect(portfolioBody.data.totalNav).not.toBe('0');
    expect(portfolioBody.data.sleeves.length).toBeGreaterThan(0);
    expect(ordersBody.data.length).toBeGreaterThan(0);
    expect(eventsBody.data.some((event) => event.eventType === 'runtime.cycle_completed')).toBe(true);
    expect(runtimeStatusBody.data.runtime.lastRunStatus).toBe('completed');
    expect(runtimeStatusBody.data.worker.lifecycleState).toMatch(/ready|degraded/);
    expect(runtimeStatusBody.data.openMismatchCount).toBeGreaterThanOrEqual(0);
    expect(workerBody.data.schedulerState).toMatch(/waiting|running|paused/);
  });

  it('exposes treasury summary, recommendations, execution history, and controlled execution through the API', async () => {
    const evaluateResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/treasury/evaluate',
      headers: operatorHeaders('operator', 'POST', '/api/v1/treasury/evaluate'),
    });

    expect(evaluateResponse.statusCode).toBe(202);
    const evaluateBody = evaluateResponse.json<{ data: { commandId: string } }>();
    const command = await waitForCommand(controlPlane, evaluateBody.data.commandId);
    expect(command.status).toBe('completed');
    expect(command.result['treasuryRunId']).toBeTruthy();

    const [summaryResponse, allocationsResponse, policyResponse, actionsResponse, recommendationsResponse] = await Promise.all([
      app.inject({
        method: 'GET',
        url: '/api/v1/treasury/summary',
        headers: { 'x-api-key': TEST_API_KEY },
      }),
      app.inject({
        method: 'GET',
        url: '/api/v1/treasury/allocations',
        headers: { 'x-api-key': TEST_API_KEY },
      }),
      app.inject({
        method: 'GET',
        url: '/api/v1/treasury/policy',
        headers: { 'x-api-key': TEST_API_KEY },
      }),
      app.inject({
        method: 'GET',
        url: '/api/v1/treasury/actions',
        headers: { 'x-api-key': TEST_API_KEY },
      }),
      app.inject({
        method: 'GET',
        url: '/api/v1/treasury/recommendations',
        headers: { 'x-api-key': TEST_API_KEY },
      }),
    ]);

    expect(summaryResponse.statusCode).toBe(200);
    expect(allocationsResponse.statusCode).toBe(200);
    expect(policyResponse.statusCode).toBe(200);
    expect(actionsResponse.statusCode).toBe(200);
    expect(recommendationsResponse.statusCode).toBe(200);

    const summaryBody = summaryResponse.json<{
      data: null | {
        sleeveId: string;
        reserveStatus: { requiredReserveUsd: string };
        actionCount: number;
      };
    }>();
    const allocationsBody = allocationsResponse.json<{
      data: Array<{ venueId: string; venueMode: string }>;
    }>();
    const policyBody = policyResponse.json<{
      data: null | { policy: { reserveFloorPct: number; eligibleVenues: string[] } };
    }>();
    const actionsBody = actionsResponse.json<{
      data: Array<{ id: string; actionType: string; reasonCode: string; status: string; executable: boolean }>;
    }>();
    const recommendationsBody = recommendationsResponse.json<{
      data: Array<{ id: string; readiness: string }>;
    }>();

    expect(summaryBody.data?.sleeveId).toBe('treasury');
    expect(summaryBody.data?.reserveStatus.requiredReserveUsd).toBeTruthy();
    expect(summaryBody.data?.actionCount).toBeGreaterThanOrEqual(0);
    expect(allocationsBody.data.length).toBeGreaterThan(0);
    expect(allocationsBody.data[0]?.venueMode).toBe('simulated');
    expect(policyBody.data?.policy.reserveFloorPct).toBeGreaterThan(0);
    expect(policyBody.data?.policy.eligibleVenues.length).toBeGreaterThan(0);
    expect(actionsBody.data.length).toBeGreaterThan(0);
    expect(recommendationsBody.data.length).toBeGreaterThan(0);

    const actionable = actionsBody.data.find((action) => action.executable);
    expect(actionable?.status).toBe('recommended');
    expect(actionable?.id).toBeTruthy();

    const approveResponse = await app.inject({
      method: 'POST',
      url: `/api/v1/treasury/actions/${actionable?.id}/approve`,
      headers: operatorHeaders('operator', 'POST', `/api/v1/treasury/actions/${actionable?.id}/approve`),
    });
    expect(approveResponse.statusCode).toBe(200);

    const executeResponse = await app.inject({
      method: 'POST',
      url: `/api/v1/treasury/actions/${actionable?.id}/execute`,
      headers: operatorHeaders('operator', 'POST', `/api/v1/treasury/actions/${actionable?.id}/execute`),
    });
    expect(executeResponse.statusCode).toBe(202);

    const executeBody = executeResponse.json<{ data: { commandId: string } }>();
    const executionCommand = await waitForCommand(controlPlane, executeBody.data.commandId);
    expect(executionCommand.status).toBe('completed');

    const [actionDetailResponse, actionExecutionsResponse, executionsResponse, executionDetailResponse, venuesResponse, venueDetailResponse] = await Promise.all([
      app.inject({
        method: 'GET',
        url: `/api/v1/treasury/actions/${actionable?.id}`,
        headers: { 'x-api-key': TEST_API_KEY },
      }),
      app.inject({
        method: 'GET',
        url: `/api/v1/treasury/actions/${actionable?.id}/executions`,
        headers: { 'x-api-key': TEST_API_KEY },
      }),
      app.inject({
        method: 'GET',
        url: '/api/v1/treasury/executions',
        headers: { 'x-api-key': TEST_API_KEY },
      }),
      app.inject({
        method: 'GET',
        url: '/api/v1/treasury/executions/00000000-0000-0000-0000-000000000000',
        headers: { 'x-api-key': TEST_API_KEY },
      }),
      app.inject({
        method: 'GET',
        url: '/api/v1/treasury/venues',
        headers: { 'x-api-key': TEST_API_KEY },
      }),
      app.inject({
        method: 'GET',
        url: '/api/v1/treasury/venues/atlas-t0-sim',
        headers: { 'x-api-key': TEST_API_KEY },
      }),
    ]);

    expect(actionDetailResponse.statusCode).toBe(200);
    expect(actionExecutionsResponse.statusCode).toBe(200);
    expect(executionsResponse.statusCode).toBe(200);
    expect(executionDetailResponse.statusCode).toBe(404);
    expect(venuesResponse.statusCode).toBe(200);
    expect(venueDetailResponse.statusCode).toBe(200);

    const actionDetailBody = actionDetailResponse.json<{
      data: {
        action: {
          status: string;
          blockedReasons: Array<{ code: string; category: string; operatorAction: string }>;
        };
        timeline: Array<{ eventType: string }>;
        executions: Array<{ status: string; requestedBy: string }>;
        venue: null | { venueId: string; onboardingState: string };
      };
    }>();
    const executionsBody = executionsResponse.json<{
      data: Array<{ id: string; status: string; requestedBy: string }>;
    }>();
    const actionExecutionsBody = actionExecutionsResponse.json<{
      data: Array<{ id: string; treasuryActionId: string; status: string }>;
    }>();
    const venuesBody = venuesResponse.json<{
      data: Array<{
        venueId: string;
        simulationState: string;
        executionSupported: boolean;
        onboardingState: string;
      }>;
    }>();
    const venueDetailBody = venueDetailResponse.json<{
      data: {
        venue: {
          venueId: string;
          simulationState: string;
          missingPrerequisites: string[];
        };
        recentActions: Array<{ id: string }>;
      };
    }>();

    expect(actionDetailBody.data.action.status).toBe('completed');
    expect(actionDetailBody.data.executions[0]?.requestedBy).toBe('operator-user');
    expect(actionDetailBody.data.timeline.length).toBeGreaterThan(0);
    expect(actionDetailBody.data.venue?.onboardingState).toBeTruthy();
    expect(actionExecutionsBody.data[0]?.treasuryActionId).toBe(actionable?.id);
    expect(executionsBody.data.some((execution) => execution.status === 'completed')).toBe(true);
    expect(venuesBody.data.length).toBeGreaterThan(0);
    expect(venuesBody.data[0]?.simulationState).toBe('simulated');
    expect(venuesBody.data[0]?.onboardingState).toBeTruthy();
    expect(venueDetailBody.data.venue.venueId).toBe('atlas-t0-sim');
    expect(venueDetailBody.data.venue.missingPrerequisites.length).toBeGreaterThan(0);
    expect(venueDetailBody.data.recentActions.length).toBeGreaterThan(0);

    const completedExecutionId = executionsBody.data.find((execution) => execution.status === 'completed')?.id;
    expect(completedExecutionId).toBeTruthy();

    const completedExecutionResponse = await app.inject({
      method: 'GET',
      url: `/api/v1/treasury/executions/${completedExecutionId}`,
      headers: { 'x-api-key': TEST_API_KEY },
    });
    expect(completedExecutionResponse.statusCode).toBe(200);

    const completedExecutionBody = completedExecutionResponse.json<{
      data: {
        execution: {
          id: string;
          status: string;
        };
        action: null | { id: string };
        linkedRebalanceProposal: null | { id: string };
        executionKind: string;
        command: null | { commandId: string };
        venue: null | { venueId: string; executionSupported: boolean };
        timeline: Array<{ eventType: string }>;
      };
    }>();

    expect(completedExecutionBody.data.execution.id).toBe(completedExecutionId);
    expect(completedExecutionBody.data.execution.status).toBe('completed');
    expect(completedExecutionBody.data.action?.id).toBe(actionable?.id);
    expect(completedExecutionBody.data.executionKind).toBe('venue_execution');
    expect(completedExecutionBody.data.linkedRebalanceProposal).toBeNull();
    expect(completedExecutionBody.data.command?.commandId).toBeTruthy();
    expect(completedExecutionBody.data.venue?.executionSupported).toBe(true);
    expect(completedExecutionBody.data.timeline.length).toBeGreaterThan(0);
  });

  it('exposes generic venue inventory, readiness, summary, and snapshot detail through the API', async () => {
    await app.close();
    await worker.stop();

    const harness = await createApiHarness({
      truthAdapters: [new StubReadonlyVenueTruthAdapter()],
    });
    connectionString = harness.connectionString;
    controlPlane = harness.controlPlane;
    worker = harness.worker;
    app = await createApp({ controlPlane });
    await app.ready();

    const [
      venuesResponse,
      summaryResponse,
      truthSummaryResponse,
      readinessResponse,
      detailResponse,
      snapshotsResponse,
    ] = await Promise.all([
      app.inject({
        method: 'GET',
        url: '/api/v1/venues',
        headers: { 'x-api-key': TEST_API_KEY },
      }),
      app.inject({
        method: 'GET',
        url: '/api/v1/venues/summary',
        headers: { 'x-api-key': TEST_API_KEY },
      }),
      app.inject({
        method: 'GET',
        url: '/api/v1/venues/truth-summary',
        headers: { 'x-api-key': TEST_API_KEY },
      }),
      app.inject({
        method: 'GET',
        url: '/api/v1/venues/readiness',
        headers: { 'x-api-key': TEST_API_KEY },
      }),
      app.inject({
        method: 'GET',
        url: '/api/v1/venues/drift-solana-readonly',
        headers: { 'x-api-key': TEST_API_KEY },
      }),
      app.inject({
        method: 'GET',
        url: '/api/v1/venues/drift-solana-readonly/snapshots',
        headers: { 'x-api-key': TEST_API_KEY },
      }),
    ]);

    expect(venuesResponse.statusCode).toBe(200);
    expect(summaryResponse.statusCode).toBe(200);
    expect(truthSummaryResponse.statusCode).toBe(200);
    expect(readinessResponse.statusCode).toBe(200);
    expect(detailResponse.statusCode).toBe(200);
    expect(snapshotsResponse.statusCode).toBe(200);

    const venuesBody = venuesResponse.json<{
      data: Array<{
        venueId: string;
        truthMode: string;
        truthProfile: string;
        readOnlySupport: boolean;
        snapshotCompleteness: string;
        truthCoverage: {
          accountState: { status: string };
          derivativeAccountState: { status: string };
          orderState: { status: string };
          balanceState: { status: string };
          executionReferences: { status: string };
        };
      }>;
    }>();
    const summaryBody = summaryResponse.json<{ data: { realReadOnly: number; derivativeAware: number } }>();
    const truthSummaryBody = truthSummaryResponse.json<{
      data: {
        connectorDepth: { drift_native_readonly: number };
        completeSnapshots: number;
        derivativeAwareVenues: number;
        decodedDerivativeAccountVenues: number;
        decodedDerivativePositionVenues: number;
        accountState: { available: number };
        derivativeAccountState: { available: number };
        orderState: { available: number };
        executionReferences: { available: number };
      };
    }>();
    const detailBody = detailResponse.json<{
      data: {
        venue: {
          venueId: string;
          truthProfile: string;
          snapshotCompleteness: string;
          truthCoverage: {
            accountState: { status: string };
            derivativeAccountState: { status: string };
            orderState: { status: string };
            executionReferences: { status: string };
          };
        };
        snapshots: Array<{
          snapshotType: string;
          truthProfile: string;
          accountState: { accountAddress: string | null } | null;
          derivativeAccountState: { accountModel: string; rawDiscriminatorHex: string | null; decoded: boolean } | null;
          derivativePositionState: { positions: Array<{ marketSymbol: string | null }> } | null;
          derivativeHealthState: { healthScore: number | null } | null;
          orderState: { referenceMode: string; openOrders: Array<{ reference: string | null }> } | null;
          executionReferenceState: { references: Array<{ reference: string }> } | null;
        }>;
      };
    }>();
    const snapshotsBody = snapshotsResponse.json<{
      data: Array<{
        snapshotType: string;
        snapshotCompleteness: string;
        truthCoverage: { balanceState: { status: string } };
      }>;
    }>();

    expect(venuesBody.data.some((venue) => venue.venueId === 'drift-solana-readonly')).toBe(true);
    expect(venuesBody.data.find((venue) => venue.venueId === 'drift-solana-readonly')?.truthMode).toBe('real');
    expect(venuesBody.data.find((venue) => venue.venueId === 'drift-solana-readonly')?.truthProfile).toBe('derivative_aware');
    expect(venuesBody.data.find((venue) => venue.venueId === 'drift-solana-readonly')?.readOnlySupport).toBe(true);
    expect(venuesBody.data.find((venue) => venue.venueId === 'drift-solana-readonly')?.snapshotCompleteness).toBe('complete');
    expect(venuesBody.data.find((venue) => venue.venueId === 'drift-solana-readonly')?.truthCoverage.accountState.status).toBe('available');
    expect(venuesBody.data.find((venue) => venue.venueId === 'drift-solana-readonly')?.truthCoverage.derivativeAccountState.status).toBe('available');
    expect(venuesBody.data.find((venue) => venue.venueId === 'drift-solana-readonly')?.truthCoverage.orderState.status).toBe('available');
    expect(summaryBody.data.realReadOnly).toBeGreaterThan(0);
    expect(summaryBody.data.derivativeAware).toBeGreaterThan(0);
    expect(truthSummaryBody.data.connectorDepth.drift_native_readonly).toBeGreaterThan(0);
    expect(truthSummaryBody.data.completeSnapshots).toBeGreaterThan(0);
    expect(truthSummaryBody.data.derivativeAwareVenues).toBeGreaterThan(0);
    expect(truthSummaryBody.data.decodedDerivativeAccountVenues).toBeGreaterThan(0);
    expect(truthSummaryBody.data.decodedDerivativePositionVenues).toBeGreaterThan(0);
    expect(truthSummaryBody.data.accountState.available).toBeGreaterThan(0);
    expect(truthSummaryBody.data.derivativeAccountState.available).toBeGreaterThan(0);
    expect(truthSummaryBody.data.orderState.available).toBeGreaterThan(0);
    expect(truthSummaryBody.data.executionReferences.available).toBeGreaterThan(0);
    expect(detailBody.data.venue.venueId).toBe('drift-solana-readonly');
    expect(detailBody.data.venue.truthProfile).toBe('derivative_aware');
    expect(detailBody.data.venue.snapshotCompleteness).toBe('complete');
    expect(detailBody.data.venue.truthCoverage.derivativeAccountState.status).toBe('available');
    expect(detailBody.data.venue.truthCoverage.orderState.status).toBe('available');
    expect(detailBody.data.venue.truthCoverage.executionReferences.status).toBe('available');
    expect(detailBody.data.snapshots[0]?.snapshotType).toBe('drift_native_user_account');
    expect(detailBody.data.snapshots[0]?.truthProfile).toBe('derivative_aware');
    expect(detailBody.data.snapshots[0]?.accountState?.accountAddress).toContain('drift-solana-readonly-account');
    expect(detailBody.data.snapshots[0]?.derivativeAccountState?.accountModel).toBe('program_account');
    expect(detailBody.data.snapshots[0]?.derivativeAccountState?.decoded).toBe(true);
    expect(detailBody.data.snapshots[0]?.derivativeAccountState?.rawDiscriminatorHex).toBe('0102030405060708');
    expect(detailBody.data.snapshots[0]?.derivativePositionState?.positions.length).toBeGreaterThan(0);
    expect(detailBody.data.snapshots[0]?.derivativeHealthState?.healthScore).toBe(84);
    expect(detailBody.data.snapshots[0]?.orderState?.referenceMode).toBe('venue_open_orders');
    expect(detailBody.data.snapshots[0]?.orderState?.openOrders.length).toBeGreaterThan(0);
    expect(detailBody.data.snapshots[0]?.executionReferenceState?.references.length).toBeGreaterThan(0);
    expect(snapshotsBody.data[0]?.snapshotType).toBe('drift_native_user_account');
    expect(snapshotsBody.data[0]?.snapshotCompleteness).toBe('complete');
    expect(snapshotsBody.data[0]?.truthCoverage.balanceState.status).toBe('unsupported');
  });

  it('exposes internal derivative state and internal-vs-external comparison routes through the API', async () => {
    await app.close();
    await worker.stop();

    const harness = await createApiHarness({
      truthAdapters: [new StubReadonlyVenueTruthAdapter()],
    });
    connectionString = harness.connectionString;
    controlPlane = harness.controlPlane;
    worker = harness.worker;
    app = await createApp({ controlPlane });
    await app.ready();

    await waitFor(
      () => controlPlane.getVenue('drift-solana-readonly'),
      (detail) => detail !== null && detail.snapshots.length > 0,
    );

    const writerConnection = await persistInternalDerivativeSnapshot(
      connectionString,
      createInternalDerivativeSnapshot('drift-solana-readonly', 'Drift Solana Read-Only'),
    );

    try {
      const [
        internalStateResponse,
        comparisonSummaryResponse,
        comparisonDetailResponse,
        venueDetailResponse,
      ] = await Promise.all([
        app.inject({
          method: 'GET',
          url: '/api/v1/venues/drift-solana-readonly/internal-state',
          headers: { 'x-api-key': TEST_API_KEY },
        }),
        app.inject({
          method: 'GET',
          url: '/api/v1/venues/drift-solana-readonly/comparison-summary',
          headers: { 'x-api-key': TEST_API_KEY },
        }),
        app.inject({
          method: 'GET',
          url: '/api/v1/venues/drift-solana-readonly/comparison-detail',
          headers: { 'x-api-key': TEST_API_KEY },
        }),
        app.inject({
          method: 'GET',
          url: '/api/v1/venues/drift-solana-readonly',
          headers: { 'x-api-key': TEST_API_KEY },
        }),
      ]);

      expect(internalStateResponse.statusCode).toBe(200);
      expect(comparisonSummaryResponse.statusCode).toBe(200);
      expect(comparisonDetailResponse.statusCode).toBe(200);
      expect(venueDetailResponse.statusCode).toBe(200);

      const internalStateBody = internalStateResponse.json<{
        data: {
          venueId: string;
          coverage: {
            accountState: { status: string };
            positionState: { status: string };
            healthState: { status: string };
            orderState: { status: string };
          };
          positionState: {
            openPositionCount: number;
            positions: Array<{ positionKey: string; netQuantity: string; marketIdentity?: { normalizedKey: string | null } | null }>;
          } | null;
          orderState: { openOrderCount: number; comparableOpenOrderCount: number; nonComparableOpenOrderCount: number } | null;
          healthState: { healthStatus: string; methodology: string; comparisonMode: string; riskPosture: string | null } | null;
        };
      }>();
      const comparisonSummaryBody = comparisonSummaryResponse.json<{
        data: {
          subaccountIdentity: { status: string };
          positionInventory: { status: string };
          marketIdentity: { status: string };
          healthState: { status: string };
          orderInventory: { status: string };
          healthComparisonMode: string;
          exactPositionIdentityCount: number;
          partialPositionIdentityCount: number;
          positionIdentityGapCount: number;
          matchedPositionCount: number;
          matchedOrderCount: number;
        };
      }>();
      const comparisonDetailBody = comparisonDetailResponse.json<{
        data: {
          accountComparison: { status: string };
          healthComparison: { status: string; comparable: boolean; comparisonMode: string };
          positionComparisons: Array<{
            comparisonKey: string;
            status: string;
            quantityDelta: string | null;
            marketIdentityComparison: { comparisonMode: string };
          }>;
          orderComparisons: Array<{
            comparisonKey: string;
            status: string;
            remainingSizeDelta: string | null;
            marketIdentityComparison: { comparisonMode: string };
          }>;
        };
      }>();
      const venueDetailBody = venueDetailResponse.json<{
        data: {
          internalState: {
            coverage: { orderState: { status: string } };
          } | null;
          comparisonSummary: {
            healthState: { status: string };
            orderInventory: { status: string };
          };
          comparisonDetail: {
            accountComparison: { status: string };
          };
        };
      }>();

      expect(internalStateBody.data.venueId).toBe('drift-solana-readonly');
      expect(internalStateBody.data.coverage.accountState.status).toBe('available');
      expect(internalStateBody.data.coverage.positionState.status).toBe('available');
      expect(internalStateBody.data.coverage.healthState.status).toBe('available');
      expect(internalStateBody.data.coverage.orderState.status).toBe('partial');
      expect(internalStateBody.data.positionState?.openPositionCount).toBe(1);
      expect(internalStateBody.data.positionState?.positions[0]?.positionKey).toBe('perp:0');
      expect(internalStateBody.data.positionState?.positions[0]?.netQuantity).toBe('0.75');
      expect(internalStateBody.data.positionState?.positions[0]?.marketIdentity?.normalizedKey).toBe('perp:0');
      expect(internalStateBody.data.orderState?.openOrderCount).toBe(2);
      expect(internalStateBody.data.orderState?.comparableOpenOrderCount).toBe(1);
      expect(internalStateBody.data.orderState?.nonComparableOpenOrderCount).toBe(1);
      expect(internalStateBody.data.healthState?.healthStatus).toBe('healthy');
      expect(internalStateBody.data.healthState?.methodology).toBe('portfolio_current_plus_risk_current');
      expect(internalStateBody.data.healthState?.comparisonMode).toBe('status_band_only');
      expect(internalStateBody.data.healthState?.riskPosture).toBe('normal');

      expect(comparisonSummaryBody.data.subaccountIdentity.status).toBe('available');
      expect(comparisonSummaryBody.data.positionInventory.status).toBe('available');
      expect(comparisonSummaryBody.data.marketIdentity.status).toBe('available');
      expect(comparisonSummaryBody.data.healthState.status).toBe('partial');
      expect(comparisonSummaryBody.data.orderInventory.status).toBe('partial');
      expect(comparisonSummaryBody.data.healthComparisonMode).toBe('status_band_only');
      expect(comparisonSummaryBody.data.exactPositionIdentityCount).toBe(1);
      expect(comparisonSummaryBody.data.partialPositionIdentityCount).toBe(0);
      expect(comparisonSummaryBody.data.positionIdentityGapCount).toBe(0);
      expect(comparisonSummaryBody.data.matchedPositionCount).toBe(1);
      expect(comparisonSummaryBody.data.matchedOrderCount).toBe(1);

      expect(comparisonDetailBody.data.accountComparison.status).toBe('matched');
      expect(comparisonDetailBody.data.healthComparison.status).toBe('matched');
      expect(comparisonDetailBody.data.healthComparison.comparable).toBe(true);
      expect(comparisonDetailBody.data.healthComparison.comparisonMode).toBe('status_band_only');
      expect(comparisonDetailBody.data.positionComparisons[0]?.comparisonKey).toBe('perp:0');
      expect(comparisonDetailBody.data.positionComparisons[0]?.status).toBe('matched');
      expect(comparisonDetailBody.data.positionComparisons[0]?.quantityDelta).toBe('0');
      expect(comparisonDetailBody.data.positionComparisons[0]?.marketIdentityComparison.comparisonMode).toBe('exact');
      expect(comparisonDetailBody.data.orderComparisons[0]?.comparisonKey).toBe('901');
      expect(comparisonDetailBody.data.orderComparisons[0]?.status).toBe('matched');
      expect(comparisonDetailBody.data.orderComparisons[0]?.remainingSizeDelta).toBe('0');
      expect(comparisonDetailBody.data.orderComparisons[0]?.marketIdentityComparison.comparisonMode).toBe('exact');

      expect(venueDetailBody.data.internalState?.coverage.orderState.status).toBe('partial');
      expect(venueDetailBody.data.comparisonSummary.healthState.status).toBe('partial');
      expect(venueDetailBody.data.comparisonSummary.orderInventory.status).toBe('partial');
      expect(venueDetailBody.data.comparisonDetail.accountComparison.status).toBe('matched');
    } finally {
      await writerConnection.close();
    }
  });

  it('exposes connector promotion workflow routes with auth and transition enforcement', async () => {
    const seededConnection = await persistVenueSnapshot(
      connectionString,
      promotionCandidateSnapshot(),
    );

    try {
      const [
        promotionSummaryResponse,
        promotionDetailResponse,
        eligibilityResponse,
      ] = await Promise.all([
        app.inject({
          method: 'GET',
          url: '/api/v1/venues/promotion-summary',
          headers: { 'x-api-key': TEST_API_KEY },
        }),
        app.inject({
          method: 'GET',
          url: '/api/v1/venues/live-carry-venue/promotion',
          headers: { 'x-api-key': TEST_API_KEY },
        }),
        app.inject({
          method: 'GET',
          url: '/api/v1/venues/live-carry-venue/promotion/eligibility',
          headers: { 'x-api-key': TEST_API_KEY },
        }),
      ]);

      expect(promotionSummaryResponse.statusCode).toBe(200);
      expect(promotionDetailResponse.statusCode).toBe(200);
      expect(eligibilityResponse.statusCode).toBe(200);

      const promotionSummaryBody = promotionSummaryResponse.json<{
        data: {
          totalVenues: number;
          candidates: number;
        };
      }>();
      const promotionDetailBody = promotionDetailResponse.json<{
        data: {
          current: {
            capabilityClass: string;
            promotionStatus: string;
            approvedForLiveUse: boolean;
          };
        };
      }>();
      const eligibilityBody = eligibilityResponse.json<{
        data: {
          capabilityClass: string;
          eligibleForPromotion: boolean;
          blockingReasons: string[];
        };
      }>();

      expect(promotionSummaryBody.data.totalVenues).toBeGreaterThan(0);
      expect(promotionSummaryBody.data.candidates).toBeGreaterThan(0);
      expect(promotionDetailBody.data.current.capabilityClass).toBe('execution_capable');
      expect(promotionDetailBody.data.current.promotionStatus).toBe('not_requested');
      expect(promotionDetailBody.data.current.approvedForLiveUse).toBe(false);
      expect(eligibilityBody.data.eligibleForPromotion).toBe(true);
      expect(eligibilityBody.data.blockingReasons).toHaveLength(0);

      const requestResponse = await app.inject({
        method: 'POST',
        url: '/api/v1/venues/live-carry-venue/promotion/request',
        headers: operatorHeaders('operator', 'POST', '/api/v1/venues/live-carry-venue/promotion/request'),
        payload: {},
      });

      expect(requestResponse.statusCode).toBe(202);

      const approveAsOperatorResponse = await app.inject({
        method: 'POST',
        url: '/api/v1/venues/live-carry-venue/promotion/approve',
        headers: operatorHeaders('operator', 'POST', '/api/v1/venues/live-carry-venue/promotion/approve'),
        payload: {},
      });

      expect(approveAsOperatorResponse.statusCode).toBe(403);

      const approveAsAdminResponse = await app.inject({
        method: 'POST',
        url: '/api/v1/venues/live-carry-venue/promotion/approve',
        headers: operatorHeaders('admin', 'POST', '/api/v1/venues/live-carry-venue/promotion/approve'),
        payload: {
          note: 'Validated truth freshness and execution readiness.',
        },
      });

      expect(approveAsAdminResponse.statusCode).toBe(200);

      const suspendMissingNoteResponse = await app.inject({
        method: 'POST',
        url: '/api/v1/venues/live-carry-venue/promotion/suspend',
        headers: operatorHeaders('admin', 'POST', '/api/v1/venues/live-carry-venue/promotion/suspend'),
        payload: {},
      });

      expect(suspendMissingNoteResponse.statusCode).toBe(400);

      const suspendResponse = await app.inject({
        method: 'POST',
        url: '/api/v1/venues/live-carry-venue/promotion/suspend',
        headers: operatorHeaders('admin', 'POST', '/api/v1/venues/live-carry-venue/promotion/suspend'),
        payload: {
          note: 'Suspending after temporary venue maintenance.',
        },
      });

      expect(suspendResponse.statusCode).toBe(200);

      const historyResponse = await app.inject({
        method: 'GET',
        url: '/api/v1/venues/live-carry-venue/promotion/history',
        headers: { 'x-api-key': TEST_API_KEY },
      });

      expect(historyResponse.statusCode).toBe(200);

      const historyBody = historyResponse.json<{
        data: Array<{ eventType: string; toStatus: string }>;
      }>();

      expect(historyBody.data.map((entry) => entry.eventType)).toEqual([
        'suspended',
        'approved',
        'requested',
      ]);
      expect(historyBody.data[0]?.toStatus).toBe('suspended');
    } finally {
      await seededConnection.close();
    }
  });

  it('exposes devnet execution-capable connector posture and scope through venue routes', async () => {
    const seededConnection = await persistVenueSnapshot(
      connectionString,
      promotionCandidateSnapshot({
        id: 'drift-devnet-carry-snapshot',
        venueId: 'drift-solana-devnet-carry',
        venueName: 'Drift Solana Devnet Carry',
        connectorType: 'drift_native_devnet_execution',
        truthProfile: 'derivative_aware',
        snapshotType: 'drift_devnet_execution_account',
        snapshotSummary: 'Drift devnet execution connector is ready for operator review.',
        authRequirementsSummary: [
          'DRIFT_RPC_ENDPOINT',
          'DRIFT_EXECUTION_ENV=devnet',
          'DRIFT_PRIVATE_KEY',
        ],
        sourceMetadata: {
          sourceKind: 'adapter',
          sourceName: 'drift_native_devnet_execution',
          connectorDepth: 'execution_capable',
          observedScope: ['cluster_version', 'drift_user_account_decode', 'recent_signatures'],
          provenanceNotes: ['Phase 6.0 test fixture for the first real devnet execution-capable connector.'],
        },
        metadata: {
          driftEnv: 'devnet',
          endpointConfigured: true,
          privateKeyConfigured: true,
          authorityAddressConfigured: true,
          accountAddressConfigured: true,
          executionPosture: 'devnet_execution_capable',
          connectorMode: 'execution_capable_devnet',
          supportedExecutionScope: [
            'devnet only',
            'carry sleeve only',
            'reduce-only BTC-PERP market orders',
            'real Solana transaction signatures persisted as execution references',
          ],
          unsupportedExecutionScope: [
            'mainnet-beta execution',
            'carry increase-exposure execution',
            'spot orders',
            'limit or post-only orders',
          ],
          executionReferenceKind: 'solana_signature',
        },
        executionConfirmationState: {
          status: 'confirmed',
          summary: 'All recent real execution references are fully confirmed by venue truth.',
          evaluatedAt: freshCapturedAt(),
          recentExecutionCount: 1,
          confirmedFullCount: 1,
          confirmedPartialCount: 0,
          confirmedPartialEventOnlyCount: 0,
          confirmedPartialPositionOnlyCount: 0,
          pendingCount: 0,
          pendingEventCount: 0,
          pendingPositionDeltaCount: 0,
          conflictingEventCount: 0,
          conflictingEventVsPositionCount: 0,
          missingReferenceCount: 0,
          invalidCount: 0,
          insufficientContextCount: 0,
          latestConfirmedAt: freshCapturedAt(),
          blockingReasons: [],
          entries: [{
            stepId: 'carry-step-1',
            carryExecutionId: 'carry-execution-1',
            carryActionId: 'carry-action-1',
            intentId: 'intent-1',
            clientOrderId: 'intent-1',
            executionReference: 'drift-devnet-sig-1',
            venueId: 'drift-solana-devnet-carry',
            status: 'confirmed_full',
            evidenceBasis: 'event_and_position',
            summary: 'Execution reference drift-devnet-sig-1 has a strong Drift fill match and confirms the full requested 0.010000000 position reduction.',
            evaluatedAt: freshCapturedAt(),
            referenceObserved: true,
            referenceObservedAt: freshCapturedAt(),
            marketKey: 'perp:1',
            marketSymbol: 'BTC-PERP',
            requestedSize: '0.010000000',
            confirmedSize: '0.010000000',
            remainingSize: '0',
            preTradePositionSide: 'long',
            preTradePositionSize: '0.020000000',
            observedPositionSide: 'long',
            observedPositionSize: '0.010000000',
            eventEvidence: {
              executionReference: 'drift-devnet-sig-1',
              clientOrderId: 'intent-1',
              correlationStatus: 'event_matched_strong',
              deduplicationStatus: 'unique',
              correlationConfidence: 'strong',
              evidenceOrigin: 'raw_and_derived',
              summary: 'Strong Drift fill evidence was attributed to drift-devnet-sig-1.',
              blockedReason: null,
              observedAt: freshCapturedAt(),
              eventType: 'OrderActionRecord',
              actionType: 'fill',
              txSignature: 'drift-devnet-sig-1',
              accountAddress: 'devnet-user-account',
              subaccountId: 0,
              marketIndex: 1,
              orderId: '101',
              userOrderId: 11,
              fillBaseAssetAmount: '0.010000000',
              fillQuoteAssetAmount: '500.000000',
              fillRole: 'taker',
              rawEventCount: 2,
              duplicateEventCount: 0,
              rawEvents: [],
            },
            blockedReason: null,
          }],
        },
      }),
    );

    try {
      const [detailResponse, promotionResponse, eligibilityResponse] = await Promise.all([
        app.inject({
          method: 'GET',
          url: '/api/v1/venues/drift-solana-devnet-carry',
          headers: { 'x-api-key': TEST_API_KEY },
        }),
        app.inject({
          method: 'GET',
          url: '/api/v1/venues/drift-solana-devnet-carry/promotion',
          headers: { 'x-api-key': TEST_API_KEY },
        }),
        app.inject({
          method: 'GET',
          url: '/api/v1/venues/drift-solana-devnet-carry/promotion/eligibility',
          headers: { 'x-api-key': TEST_API_KEY },
        }),
      ]);

      expect(detailResponse.statusCode).toBe(200);
      expect(promotionResponse.statusCode).toBe(200);
      expect(eligibilityResponse.statusCode).toBe(200);

      const detailBody = detailResponse.json<{
        data: {
          venue: {
            connectorType: string;
            onboardingState: string;
            metadata: Record<string, unknown>;
          };
          promotion: {
            current: {
              capabilityClass: string;
              promotionStatus: string;
              approvedForLiveUse: boolean;
            };
          };
        };
      }>();
      const promotionBody = promotionResponse.json<{
        data: {
          current: {
            capabilityClass: string;
            effectivePosture: string;
          };
        };
      }>();
      const eligibilityBody = eligibilityResponse.json<{
        data: {
          eligibleForPromotion: boolean;
          blockingReasons: string[];
          postTradeConfirmation: {
            status: string;
            confirmedFullCount: number;
            entries: Array<{
              eventEvidence: {
                correlationStatus: string;
                correlationConfidence: string;
              } | null;
            }>;
          };
        };
      }>();

      expect(detailBody.data.venue.connectorType).toBe('drift_native_devnet_execution');
      expect(detailBody.data.venue.onboardingState).toBe('ready_for_review');
      expect(detailBody.data.venue.metadata['executionPosture']).toBe('devnet_execution_capable');
      expect(detailBody.data.venue.metadata['connectorMode']).toBe('execution_capable_devnet');
      expect(detailBody.data.venue.metadata['executionReferenceKind']).toBe('solana_signature');
      expect(detailBody.data.venue.metadata['supportedExecutionScope']).toContain('reduce-only BTC-PERP market orders');
      expect(detailBody.data.venue.metadata['unsupportedExecutionScope']).toContain('carry increase-exposure execution');
      expect(detailBody.data.promotion.current.capabilityClass).toBe('execution_capable');
      expect(detailBody.data.promotion.current.promotionStatus).toBe('not_requested');
      expect(detailBody.data.promotion.current.approvedForLiveUse).toBe(false);
      expect(promotionBody.data.current.capabilityClass).toBe('execution_capable');
      expect(promotionBody.data.current.effectivePosture).toBe('execution_capable_unapproved');
      expect(eligibilityBody.data.eligibleForPromotion).toBe(true);
      expect(eligibilityBody.data.blockingReasons).toHaveLength(0);
      expect(eligibilityBody.data.postTradeConfirmation.status).toBe('confirmed');
      expect(eligibilityBody.data.postTradeConfirmation.confirmedFullCount).toBe(1);
      expect(eligibilityBody.data.postTradeConfirmation.entries[0]?.eventEvidence?.correlationStatus).toBe('event_matched_strong');
      expect(eligibilityBody.data.postTradeConfirmation.entries[0]?.eventEvidence?.correlationConfidence).toBe('strong');
    } finally {
      await seededConnection.close();
    }
  });

  it('surfaces missing, stale, and unavailable real venue truth through the reconciliation API', async () => {
    await app.close();
    await worker.stop();

    const missingAdapter = new StubReadonlyVenueTruthAdapter(
      'drift-solana-missing',
      'Drift Solana Missing',
      {
        snapshotType: 'drift_native_error',
        snapshotSuccessful: false,
        healthy: false,
        healthState: 'degraded',
        summary: 'Drift-native snapshot is not available yet.',
        errorMessage: 'Drift user account has not been captured yet.',
        capturedAt: freshCapturedAt(),
        payload: {},
      },
      {
        healthy: false,
        healthState: 'degraded',
        degradedReason: 'Account balance has not been captured yet.',
      },
    );

    const harness = await createApiHarness({
      truthAdapters: [
        missingAdapter,
        new StubReadonlyVenueTruthAdapter(
          'drift-solana-stale',
          'Drift Solana Stale',
          {
            capturedAt: '2020-01-01T00:00:00.000Z',
            payload: { healthScore: 84 },
          },
        ),
        new StubReadonlyVenueTruthAdapter(
          'drift-solana-unavailable',
          'Drift Solana Unavailable',
          {
            snapshotType: 'drift_native_error',
            snapshotSuccessful: false,
            healthy: false,
            healthState: 'unavailable',
            summary: 'Drift-native read-only snapshot failed.',
            errorMessage: 'RPC getVersion failed with status 503.',
            capturedAt: freshCapturedAt(),
            payload: {},
          },
          {
            healthy: false,
            healthState: 'unavailable',
            degradedReason: 'RPC getVersion failed with status 503.',
          },
        ),
      ],
    }, {
      cycleIntervalMs: 60_000,
      pollIntervalMs: 25,
    });
    connectionString = harness.connectionString;
    controlPlane = harness.controlPlane;
    worker = harness.worker;
    app = await createApp({ controlPlane });
    await app.ready();

    const firstReconciliationCommandRecord = await controlPlane.enqueueReconciliationRun('operator-user', {
      trigger: 'api-phase-5-2-missing-venue-truth',
      triggeredBy: 'operator-user',
    });
    const firstReconciliationCommand = await waitForCommand(
      controlPlane,
      firstReconciliationCommandRecord.commandId,
    );
    expect(firstReconciliationCommand.status).toBe('completed');
    await waitFor(
      async () => controlPlane.listReconciliationFindings({
        findingType: 'missing_venue_truth_snapshot',
        limit: 20,
      }),
      (findings) => findings.some(
        (finding) => finding.venueId === 'drift-solana-missing' && finding.status === 'active',
      ),
    );

    const missingFindingsResponse = await app.inject({
      method: 'GET',
      url: '/api/v1/runtime/reconciliation/findings?findingType=missing_venue_truth_snapshot',
      headers: { 'x-api-key': TEST_API_KEY },
    });
    expect(missingFindingsResponse.statusCode).toBe(200);
    const missingFindingsBody = missingFindingsResponse.json<{
      data: Array<{ venueId: string | null; status: string }>;
    }>();
    expect(
      missingFindingsBody.data.some(
        (finding) => finding.venueId === 'drift-solana-missing' && finding.status === 'active',
      ),
    ).toBe(true);

    missingAdapter.setSnapshotOverrides({
      snapshotType: 'drift_native_user_account',
      snapshotSuccessful: true,
      healthy: true,
      healthState: 'healthy',
      summary: 'Drift-native read-only snapshot captured for Drift Solana Missing with 2 positions, 2 open orders, and health score 84.',
      errorMessage: null,
      capturedAt: freshCapturedAt(),
      payload: { healthScore: 84 },
    });

    const cycleCommandRecord = await controlPlane.enqueueCommand('run_cycle', 'operator-user', {
      triggerSource: 'api-phase-5-2-seed-venue-truth',
    });
    const cycleCommand = await waitForCommand(controlPlane, cycleCommandRecord.commandId, 20_000);
    expect(cycleCommand.status).toBe('completed');

    const secondReconciliationCommandRecord = await controlPlane.enqueueReconciliationRun('operator-user', {
      trigger: 'api-phase-5-2-venue-truth-after-ingest',
      triggeredBy: 'operator-user',
    });
    const secondReconciliationCommand = await waitForCommand(
      controlPlane,
      secondReconciliationCommandRecord.commandId,
      20_000,
    );
    expect(secondReconciliationCommand.status).toBe('completed');
    await waitFor(
      async () => controlPlane.listReconciliationFindings({
        findingType: 'stale_venue_truth_snapshot',
        limit: 20,
      }),
      (findings) => findings.some(
        (finding) => finding.venueId === 'drift-solana-stale' && finding.status === 'active',
      ),
      20_000,
    );
    await waitFor(
      async () => controlPlane.listReconciliationFindings({
        findingType: 'venue_truth_unavailable',
        limit: 20,
      }),
      (findings) => findings.some(
        (finding) => finding.venueId === 'drift-solana-unavailable' && finding.status === 'active',
      ),
      20_000,
    );

    const staleFindingsResponse = await app.inject({
      method: 'GET',
      url: '/api/v1/runtime/reconciliation/findings?findingType=stale_venue_truth_snapshot',
      headers: { 'x-api-key': TEST_API_KEY },
    });
    expect(staleFindingsResponse.statusCode).toBe(200);
    const staleFindingsBody = staleFindingsResponse.json<{
      data: Array<{ venueId: string | null; status: string }>;
    }>();
    expect(
      staleFindingsBody.data.some(
        (finding) => finding.venueId === 'drift-solana-stale' && finding.status === 'active',
      ),
    ).toBe(true);

    const unavailableFindingsResponse = await app.inject({
      method: 'GET',
      url: '/api/v1/runtime/reconciliation/findings?findingType=venue_truth_unavailable',
      headers: { 'x-api-key': TEST_API_KEY },
    });
    expect(unavailableFindingsResponse.statusCode).toBe(200);
    const unavailableFindingsBody = unavailableFindingsResponse.json<{
      data: Array<{ mismatchId: string | null; venueId: string | null; findingType: string; status: string }>;
    }>();
    const unavailableFinding = unavailableFindingsBody.data.find(
      (finding) => finding.venueId === 'drift-solana-unavailable' && finding.status === 'active',
    );
    expect(unavailableFinding).toBeTruthy();

    const mismatchDetailResponse = await app.inject({
      method: 'GET',
      url: `/api/v1/runtime/mismatches/${unavailableFinding?.mismatchId}`,
      headers: { 'x-api-key': TEST_API_KEY },
    });
    expect(mismatchDetailResponse.statusCode).toBe(200);
    const mismatchDetailBody = mismatchDetailResponse.json<{
      data: {
        latestReconciliationFinding: { findingType: string } | null;
      };
    }>();
    expect(mismatchDetailBody.data.latestReconciliationFinding?.findingType).toBe('venue_truth_unavailable');

    const summaryResponse = await app.inject({
      method: 'GET',
      url: '/api/v1/runtime/reconciliation/summary',
      headers: { 'x-api-key': TEST_API_KEY },
    });
    expect(summaryResponse.statusCode).toBe(200);
    const summaryBody = summaryResponse.json<{
      data: {
        latestTypeCounts: Record<string, number>;
      } | null;
    }>();
    expect(summaryBody.data?.latestTypeCounts['missing_venue_truth_snapshot']).toBeGreaterThan(0);
    expect(summaryBody.data?.latestTypeCounts['stale_venue_truth_snapshot']).toBeGreaterThan(0);
    expect(summaryBody.data?.latestTypeCounts['venue_truth_unavailable']).toBeGreaterThan(0);
  });

  it('exposes carry recommendations, execution history, venue state, and approval-driven execution through the API', async () => {
    const cycleResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/runtime/cycles/run',
      headers: operatorHeaders('operator', 'POST', '/api/v1/runtime/cycles/run'),
    });
    expect(cycleResponse.statusCode).toBe(202);

    const cycleCommand = cycleResponse.json<{ data: { commandId: string } }>();
    await waitForCommand(controlPlane, cycleCommand.data.commandId);

    const evaluateResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/carry/evaluate',
      headers: operatorHeaders('operator', 'POST', '/api/v1/carry/evaluate'),
    });

    expect(evaluateResponse.statusCode).toBe(202);
    const evaluateBody = evaluateResponse.json<{ data: { commandId: string } }>();
    const command = await waitForCommand(controlPlane, evaluateBody.data.commandId);
    expect(command.status).toBe('completed');

    const [strategyProfileResponse, recommendationsResponse, actionsResponse, executionsResponse, venuesResponse] = await Promise.all([
      app.inject({
        method: 'GET',
        url: '/api/v1/carry/strategy-profile',
        headers: { 'x-api-key': TEST_API_KEY },
      }),
      app.inject({
        method: 'GET',
        url: '/api/v1/carry/recommendations',
        headers: { 'x-api-key': TEST_API_KEY },
      }),
      app.inject({
        method: 'GET',
        url: '/api/v1/carry/actions',
        headers: { 'x-api-key': TEST_API_KEY },
      }),
      app.inject({
        method: 'GET',
        url: '/api/v1/carry/executions',
        headers: { 'x-api-key': TEST_API_KEY },
      }),
      app.inject({
        method: 'GET',
        url: '/api/v1/carry/venues',
        headers: { 'x-api-key': TEST_API_KEY },
      }),
    ]);

    expect(strategyProfileResponse.statusCode).toBe(200);
    expect(recommendationsResponse.statusCode).toBe(200);
    expect(actionsResponse.statusCode).toBe(200);
    expect(executionsResponse.statusCode).toBe(200);
    expect(venuesResponse.statusCode).toBe(200);

    const strategyProfileBody = strategyProfileResponse.json<{
      data: {
        vaultBaseAsset: string;
        tenor: { lockPeriodMonths: number; reassessmentCadenceMonths: number; rolling: boolean };
        apy: { targetFloorPct: string; realizedApyPct: string | null };
        eligibility: {
          status: string;
          blockedReasons: string[];
          ruleResults: Array<{ ruleKey: string; status: string }>;
        };
        evidence: { environment: string; latestEvidenceSource: string };
      };
    }>();
    const actionsBody = actionsResponse.json<{
      data: Array<{ id: string; status: string; executable: boolean; simulated: boolean }>;
    }>();
    const venuesBody = venuesResponse.json<{
      data: Array<{ venueId: string; venueMode: string; executionSupported: boolean }>;
    }>();

    expect(strategyProfileBody.data.vaultBaseAsset).toBe('USDC');
    expect(strategyProfileBody.data.tenor.lockPeriodMonths).toBe(3);
    expect(strategyProfileBody.data.tenor.reassessmentCadenceMonths).toBe(3);
    expect(strategyProfileBody.data.tenor.rolling).toBe(true);
    expect(strategyProfileBody.data.apy.targetFloorPct).toBe('10.00');
    expect(strategyProfileBody.data.apy.realizedApyPct).toBeNull();
    expect(strategyProfileBody.data.eligibility.status).toBe('eligible');
    expect(strategyProfileBody.data.eligibility.blockedReasons).toHaveLength(0);
    expect(strategyProfileBody.data.eligibility.ruleResults.some((rule) =>
      rule.ruleKey === 'allowed_yield_source' && rule.status === 'pass',
    )).toBe(true);
    expect(strategyProfileBody.data.evidence.environment).toBe('devnet');

    expect(actionsBody.data.length).toBeGreaterThan(0);
    expect(venuesBody.data.length).toBeGreaterThan(0);
    expect(venuesBody.data[0]?.venueMode).toBe('simulated');

    const actionable = actionsBody.data.find((action) => action.executable);
    expect(actionable?.id).toBeTruthy();

    const approveResponse = await app.inject({
      method: 'POST',
      url: `/api/v1/carry/actions/${actionable?.id}/approve`,
      headers: operatorHeaders('operator', 'POST', `/api/v1/carry/actions/${actionable?.id}/approve`),
    });
    expect(approveResponse.statusCode).toBe(202);

    const approveBody = approveResponse.json<{ data: { commandId: string } }>();
    const executionCommand = await waitForCommand(controlPlane, approveBody.data.commandId);
    expect(executionCommand.status).toBe('completed');

    const actionDetailResponse = await app.inject({
      method: 'GET',
      url: `/api/v1/carry/actions/${actionable?.id}`,
      headers: { 'x-api-key': TEST_API_KEY },
    });
    expect(actionDetailResponse.statusCode).toBe(200);

    const actionDetailBody = actionDetailResponse.json<{
      data: {
        action: {
          status: string;
          linkedCommandId: string | null;
          strategyProfile: {
            vaultBaseAsset: string;
            eligibility: { status: string; ruleResults: Array<{ ruleKey: string; status: string }> };
          };
        };
        plannedOrders: Array<{ marketIdentity: null | { capturedAtStage: string; confidence: string } }>;
        executions: Array<{ id: string; status: string; requestedBy: string }>;
        linkedRebalanceProposal: null | { id: string };
      };
    }>();
    expect(actionDetailBody.data.action.status).toBe('completed');
    expect(actionDetailBody.data.action.strategyProfile.vaultBaseAsset).toBe('USDC');
    expect(actionDetailBody.data.action.strategyProfile.eligibility.status).toBe('eligible');
    expect(actionDetailBody.data.action.strategyProfile.eligibility.ruleResults.some((rule) =>
      rule.ruleKey === 'tenor_three_month_rolling' && rule.status === 'pass',
    )).toBe(true);
    expect(actionDetailBody.data.plannedOrders[0]?.marketIdentity?.capturedAtStage).toBe('strategy_intent');
    expect(actionDetailBody.data.executions[0]?.requestedBy).toBe('operator-user');

    const carryExecutionId = actionDetailBody.data.executions[0]?.id;
    expect(carryExecutionId).toBeTruthy();

    const [carryActionExecutionsResponse, carryExecutionResponse] = await Promise.all([
      app.inject({
        method: 'GET',
        url: `/api/v1/carry/actions/${actionable?.id}/executions`,
        headers: { 'x-api-key': TEST_API_KEY },
      }),
      app.inject({
        method: 'GET',
        url: `/api/v1/carry/executions/${carryExecutionId}`,
        headers: { 'x-api-key': TEST_API_KEY },
      }),
    ]);
    expect(carryActionExecutionsResponse.statusCode).toBe(200);
    expect(carryExecutionResponse.statusCode).toBe(200);

    const carryActionExecutionsBody = carryActionExecutionsResponse.json<{
      data: Array<{ id: string; carryActionId: string }>;
    }>();
    const carryExecutionBody = carryExecutionResponse.json<{
      data: {
        execution: { id: string; status: string; carryActionId: string; simulated: boolean };
        action: null | { id: string; linkedRebalanceProposalId: string | null };
        command: null | { commandId: string };
        linkedRebalanceProposal: null | { id: string };
        venueSnapshots: Array<{ venueId: string; venueMode: string }>;
        steps: Array<{
          intentId: string;
          executionReference: string | null;
          venueId: string;
          simulated: boolean;
          marketIdentity: null | { capturedAtStage: string; confidence: string };
        }>;
        timeline: Array<{ eventType: string; linkedExecutionId: string | null }>;
      };
    }>();

    expect(carryActionExecutionsBody.data[0]?.id).toBe(carryExecutionId);
    expect(carryExecutionBody.data.execution.id).toBe(carryExecutionId);
    expect(carryExecutionBody.data.execution.status).toBe('completed');
    expect(carryExecutionBody.data.execution.carryActionId).toBe(actionable?.id);
    expect(carryExecutionBody.data.execution.simulated).toBe(true);
    expect(carryExecutionBody.data.command?.commandId).toBe(executionCommand.commandId);
    expect(carryExecutionBody.data.steps.length).toBeGreaterThan(0);
    expect(carryExecutionBody.data.steps[0]?.intentId).toBeTruthy();
    expect(carryExecutionBody.data.steps[0]?.venueId).toBeTruthy();
    expect(carryExecutionBody.data.steps[0]?.simulated).toBe(true);
    expect(carryExecutionBody.data.steps[0]?.marketIdentity?.capturedAtStage).toBeTruthy();
    expect(carryExecutionBody.data.timeline.some((entry) => entry.linkedExecutionId === carryExecutionId)).toBe(true);
  });

  it('surfaces the full mismatch recovery lifecycle through the API', async () => {
    const pauseResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/control/kill-switch',
      headers: operatorHeaders('admin', 'POST', '/api/v1/control/kill-switch'),
      payload: { reason: 'maintenance-window' },
    });

    expect(pauseResponse.statusCode).toBe(200);

    const blockedCycleResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/runtime/cycles/run',
      headers: operatorHeaders('operator', 'POST', '/api/v1/runtime/cycles/run'),
    });
    const blockedCommandBody = blockedCycleResponse.json<{ data: { commandId: string } }>();
    const blockedCommand = await waitForCommand(controlPlane, blockedCommandBody.data.commandId);
    expect(blockedCommand.status).toBe('failed');

    const awaitedMismatches = await waitForMismatch(controlPlane, 'recovery_action_failure');
    expect(awaitedMismatches.some((mismatch) => mismatch.status === 'open')).toBe(true);

    const mismatchesResponse = await app.inject({
      method: 'GET',
      url: '/api/v1/runtime/mismatches',
      headers: { 'x-api-key': TEST_API_KEY },
    });
    expect(mismatchesResponse.statusCode).toBe(200);
    const mismatchesBody = mismatchesResponse.json<{ data: Array<{ id: string; category: string; status: string }> }>();
    expect(awaitedMismatches.some((mismatch) => mismatch.category === 'recovery_action_failure')).toBe(true);
    expect(mismatchesBody.data.some((mismatch) => mismatch.category === 'recovery_action_failure')).toBe(true);

    const mismatchId = mismatchesBody.data.find((mismatch) => mismatch.category === 'recovery_action_failure')?.id;
    expect(mismatchId).toBeTruthy();

    const acknowledgeResponse = await app.inject({
      method: 'POST',
      url: `/api/v1/runtime/mismatches/${mismatchId}/acknowledge`,
      headers: operatorHeaders('operator', 'POST', `/api/v1/runtime/mismatches/${mismatchId}/acknowledge`),
      payload: { summary: 'reviewed by test' },
    });
    expect(acknowledgeResponse.statusCode).toBe(200);
    await waitForMismatchStatus(controlPlane, mismatchId as string, 'acknowledged');

    const recoverResponse = await app.inject({
      method: 'POST',
      url: `/api/v1/runtime/mismatches/${mismatchId}/recover`,
      headers: operatorHeaders('operator', 'POST', `/api/v1/runtime/mismatches/${mismatchId}/recover`),
      payload: {
        summary: 'linking failed command to recovery workflow',
        commandId: blockedCommand.commandId,
      },
    });
    expect(recoverResponse.statusCode).toBe(200);
    await waitForMismatchStatus(controlPlane, mismatchId as string, 'recovering');

    const resolveResponse = await app.inject({
      method: 'POST',
      url: `/api/v1/runtime/mismatches/${mismatchId}/resolve`,
      headers: operatorHeaders('operator', 'POST', `/api/v1/runtime/mismatches/${mismatchId}/resolve`),
      payload: {
        summary: 'operator applied a remediation path',
        commandId: blockedCommand.commandId,
      },
    });
    expect(resolveResponse.statusCode).toBe(200);
    await waitForMismatchStatus(controlPlane, mismatchId as string, 'resolved');

    const verifyResponse = await app.inject({
      method: 'POST',
      url: `/api/v1/runtime/mismatches/${mismatchId}/verify`,
      headers: operatorHeaders('operator', 'POST', `/api/v1/runtime/mismatches/${mismatchId}/verify`),
      payload: {
        summary: 'operator verified the incident closure',
      },
    });
    expect(verifyResponse.statusCode).toBe(200);
    await waitForMismatchStatus(controlPlane, mismatchId as string, 'verified');

    const reopenResponse = await app.inject({
      method: 'POST',
      url: `/api/v1/runtime/mismatches/${mismatchId}/reopen`,
      headers: operatorHeaders('operator', 'POST', `/api/v1/runtime/mismatches/${mismatchId}/reopen`),
      payload: {
        summary: 'manual reopen after additional review',
      },
    });
    expect(reopenResponse.statusCode).toBe(200);
    await waitForMismatchStatus(controlPlane, mismatchId as string, 'reopened');

    const mismatchDetailResponse = await app.inject({
      method: 'GET',
      url: `/api/v1/runtime/mismatches/${mismatchId}`,
      headers: { 'x-api-key': TEST_API_KEY },
    });
    expect(mismatchDetailResponse.statusCode).toBe(200);
    const mismatchDetailBody = mismatchDetailResponse.json<{
      data: {
        mismatch: { status: string; linkedCommandId: string | null; reopenedBy: string | null };
        linkedCommand: { commandId: string } | null;
        recoveryEvents: Array<{ eventType: string }>;
      };
    }>();
    expect(mismatchDetailBody.data.mismatch.status).toBe('reopened');
    expect(mismatchDetailBody.data.mismatch.linkedCommandId).toBe(blockedCommand.commandId);
    expect(mismatchDetailBody.data.mismatch.reopenedBy).toBe('operator-user');
    expect(mismatchDetailBody.data.linkedCommand?.commandId).toBe(blockedCommand.commandId);
    expect(mismatchDetailBody.data.recoveryEvents.some((event) => event.eventType === 'mismatch_verified')).toBe(true);

    const summaryResponse = await app.inject({
      method: 'GET',
      url: '/api/v1/runtime/mismatches/summary',
      headers: { 'x-api-key': TEST_API_KEY },
    });
    expect(summaryResponse.statusCode).toBe(200);
    const summaryBody = summaryResponse.json<{
      data: {
        activeMismatchCount: number;
        statusCounts: Record<string, number>;
      };
    }>();
    expect(summaryBody.data.activeMismatchCount).toBeGreaterThanOrEqual(1);
    expect(summaryBody.data.statusCounts['reopened']).toBeGreaterThanOrEqual(1);

    const invalidVerifyResponse = await app.inject({
      method: 'POST',
      url: `/api/v1/runtime/mismatches/${mismatchId}/verify`,
      headers: operatorHeaders('operator', 'POST', `/api/v1/runtime/mismatches/${mismatchId}/verify`),
      payload: {
        summary: 'invalid verification from reopened state',
      },
    });
    expect(invalidVerifyResponse.statusCode).toBe(409);

    const resumeResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/control/resume',
      headers: operatorHeaders('admin', 'POST', '/api/v1/control/resume'),
      payload: { reason: 'maintenance-complete' },
    });
    expect(resumeResponse.statusCode).toBe(200);

    const rebuildResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/runtime/projections/rebuild',
      headers: operatorHeaders('operator', 'POST', '/api/v1/runtime/projections/rebuild'),
    });
    expect(rebuildResponse.statusCode).toBe(202);
    const rebuildBody = rebuildResponse.json<{ data: { commandId: string } }>();
    const rebuildCommand = await waitForCommand(controlPlane, rebuildBody.data.commandId);
    expect(rebuildCommand.status).toBe('completed');

    const commandStatusResponse = await app.inject({
      method: 'GET',
      url: `/api/v1/runtime/commands/${rebuildBody.data.commandId}`,
      headers: { 'x-api-key': TEST_API_KEY },
    });
    expect(commandStatusResponse.statusCode).toBe(200);

    const recoveryEventsResponse = await app.inject({
      method: 'GET',
      url: '/api/v1/runtime/recovery-events',
      headers: { 'x-api-key': TEST_API_KEY },
    });
    expect(recoveryEventsResponse.statusCode).toBe(200);
    const recoveryEventsBody = recoveryEventsResponse.json<{ data: Array<{ eventType: string; status: string }> }>();
    expect(recoveryEventsBody.data.some((event) => event.eventType === 'runtime_command_completed')).toBe(true);

    const recoveryOutcomesResponse = await app.inject({
      method: 'GET',
      url: '/api/v1/runtime/recovery-outcomes',
      headers: { 'x-api-key': TEST_API_KEY },
    });
    expect(recoveryOutcomesResponse.statusCode).toBe(200);
    const recoveryOutcomesBody = recoveryOutcomesResponse.json<{ data: Array<{ eventType: string; status: string }> }>();
    expect(recoveryOutcomesBody.data.some((event) => event.eventType === 'mismatch_resolved')).toBe(true);
    expect(recoveryOutcomesBody.data.some((event) => event.eventType === 'mismatch_reopened')).toBe(true);
  });

  it('triggers and exposes mismatch-scoped remediation actions through the API', async () => {
    const pauseResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/control/kill-switch',
      headers: operatorHeaders('admin', 'POST', '/api/v1/control/kill-switch'),
      payload: { reason: 'phase-1-8-remediation-setup' },
    });
    expect(pauseResponse.statusCode).toBe(200);

    const blockedCycleResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/runtime/cycles/run',
      headers: operatorHeaders('operator', 'POST', '/api/v1/runtime/cycles/run'),
    });
    const blockedCommandBody = blockedCycleResponse.json<{ data: { commandId: string } }>();
    const blockedCommand = await waitForCommand(controlPlane, blockedCommandBody.data.commandId);
    expect(blockedCommand.status).toBe('failed');

    const awaitedMismatches = await waitForMismatch(controlPlane, 'recovery_action_failure');
    const mismatchId = awaitedMismatches.find((mismatch) => mismatch.category === 'recovery_action_failure')?.id;
    expect(mismatchId).toBeTruthy();

    const resumeResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/control/resume',
      headers: operatorHeaders('admin', 'POST', '/api/v1/control/resume'),
      payload: { reason: 'phase-1-8-remediation-ready' },
    });
    expect(resumeResponse.statusCode).toBe(200);

    const remediateResponse = await app.inject({
      method: 'POST',
      url: `/api/v1/runtime/mismatches/${mismatchId}/remediate`,
      headers: operatorHeaders('operator', 'POST', `/api/v1/runtime/mismatches/${mismatchId}/remediate`),
      payload: {
        actionType: 'rebuild_projections',
        summary: 'rebuild projections for the mismatched read model',
      },
    });
    expect(remediateResponse.statusCode).toBe(202);
    const remediationBody = remediateResponse.json<{
      data: { id: string; commandId: string; status: string; attemptSequence: number };
    }>();
    expect(remediationBody.data.status).toBe('requested');
    expect(remediationBody.data.attemptSequence).toBe(1);

    const completedRemediation = await waitForRemediationStatus(
      controlPlane,
      mismatchId as string,
      'completed',
    );
    expect(completedRemediation.command?.status).toBe('completed');

    const remediationLatestResponse = await app.inject({
      method: 'GET',
      url: `/api/v1/runtime/mismatches/${mismatchId}/remediation-latest`,
      headers: { 'x-api-key': TEST_API_KEY },
    });
    expect(remediationLatestResponse.statusCode).toBe(200);
    const remediationLatestBody = remediationLatestResponse.json<{
      data: { id: string; status: string; command: { commandId: string; status: string } | null };
    }>();
    expect(remediationLatestBody.data.id).toBe(completedRemediation.id);
    expect(remediationLatestBody.data.command?.status).toBe('completed');
    expect(completedRemediation.requestedBy).toBe('operator-user');

    const remediationHistoryResponse = await app.inject({
      method: 'GET',
      url: `/api/v1/runtime/mismatches/${mismatchId}/remediation-history`,
      headers: { 'x-api-key': TEST_API_KEY },
    });
    expect(remediationHistoryResponse.statusCode).toBe(200);
    const remediationHistoryBody = remediationHistoryResponse.json<{
      data: Array<{ id: string; status: string; commandId: string }>;
    }>();
    expect(remediationHistoryBody.data).toHaveLength(1);
    expect(remediationHistoryBody.data[0]?.status).toBe('completed');

    const mismatchDetailResponse = await app.inject({
      method: 'GET',
      url: `/api/v1/runtime/mismatches/${mismatchId}`,
      headers: { 'x-api-key': TEST_API_KEY },
    });
    expect(mismatchDetailResponse.statusCode).toBe(200);
    const mismatchDetailBody = mismatchDetailResponse.json<{
      data: {
        mismatch: { status: string };
        latestRemediation: { id: string; status: string } | null;
        remediationHistory: Array<{ id: string; status: string }>;
        remediationInFlight: boolean;
        isActionable: boolean;
      };
    }>();
    expect(mismatchDetailBody.data.mismatch.status).toBe('recovering');
    expect(mismatchDetailBody.data.latestRemediation?.status).toBe('completed');
    expect(mismatchDetailBody.data.remediationHistory).toHaveLength(1);
    expect(mismatchDetailBody.data.remediationInFlight).toBe(false);
    expect(mismatchDetailBody.data.isActionable).toBe(true);

    const resolveResponse = await app.inject({
      method: 'POST',
      url: `/api/v1/runtime/mismatches/${mismatchId}/resolve`,
      headers: operatorHeaders('operator', 'POST', `/api/v1/runtime/mismatches/${mismatchId}/resolve`),
      payload: {
        summary: 'remediation completed and operator is closing the incident',
        commandId: completedRemediation.commandId,
      },
    });
    expect(resolveResponse.statusCode).toBe(200);
    await waitForMismatchStatus(controlPlane, mismatchId as string, 'resolved');

    const verifyResponse = await app.inject({
      method: 'POST',
      url: `/api/v1/runtime/mismatches/${mismatchId}/verify`,
      headers: operatorHeaders('operator', 'POST', `/api/v1/runtime/mismatches/${mismatchId}/verify`),
      payload: {
        summary: 'operator verified the remediation outcome',
      },
    });
    expect(verifyResponse.statusCode).toBe(200);
    await waitForMismatchStatus(controlPlane, mismatchId as string, 'verified');

    const invalidRemediateResponse = await app.inject({
      method: 'POST',
      url: `/api/v1/runtime/mismatches/${mismatchId}/remediate`,
      headers: operatorHeaders('operator', 'POST', `/api/v1/runtime/mismatches/${mismatchId}/remediate`),
      payload: {
        actionType: 'rebuild_projections',
        summary: 'verified incidents should not accept remediation',
      },
    });
    expect(invalidRemediateResponse.statusCode).toBe(409);
  });

  it('persists reconciliation runs and findings through the API and links reconciliation-driven mismatches to remediation', async () => {
    const runCycleResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/runtime/cycles/run',
      headers: operatorHeaders('operator', 'POST', '/api/v1/runtime/cycles/run'),
    });
    expect(runCycleResponse.statusCode).toBe(202);
    const seededCycle = runCycleResponse.json<{ data: { commandId: string } }>();
    await waitForCommand(controlPlane, seededCycle.data.commandId);

    const positionsResponse = await app.inject({
      method: 'GET',
      url: '/api/v1/positions',
      headers: { 'x-api-key': TEST_API_KEY },
    });
    expect(positionsResponse.statusCode).toBe(200);
    const positionsBody = positionsResponse.json<{ data: Array<{ id: string; asset: string }> }>();
    const position = positionsBody.data[0];
    expect(position?.id).toBeTruthy();

    await controlPlane.activateKillSwitch('api-reconciliation-test-pause', 'vitest');

    const connection = await createDatabaseConnection(connectionString);
    await connection.execute(`
      UPDATE positions
      SET size = '777', updated_at = NOW()
      WHERE id = '${String(position?.id).replace(/'/g, "''")}';
    `);

    const reconciliationResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/runtime/reconciliation/run',
      headers: operatorHeaders('operator', 'POST', '/api/v1/runtime/reconciliation/run'),
      payload: {
        trigger: 'api-reconciliation-test',
        triggerReference: position?.id,
      },
    });
    expect(reconciliationResponse.statusCode).toBe(202);
    const reconciliationBody = reconciliationResponse.json<{ data: { commandId: string } }>();
    const completedReconciliationCommand = await waitForCommand(
      controlPlane,
      reconciliationBody.data.commandId,
    );
    const reconciliationRun = await waitForReconciliationRun(
      controlPlane,
      String(completedReconciliationCommand.result['reconciliationRunId']),
    );
    expect(reconciliationRun.status).toBe('completed');
    expect(reconciliationRun.findingCount).toBeGreaterThan(0);

    const runsResponse = await app.inject({
      method: 'GET',
      url: '/api/v1/runtime/reconciliation/runs',
      headers: { 'x-api-key': TEST_API_KEY },
    });
    expect(runsResponse.statusCode).toBe(200);
    const runsBody = runsResponse.json<{ data: Array<{ id: string }> }>();
    expect(runsBody.data.some((run) => run.id === reconciliationRun.id)).toBe(true);

    const findingsResponse = await app.inject({
      method: 'GET',
      url: '/api/v1/runtime/reconciliation/findings?findingType=position_exposure_mismatch',
      headers: { 'x-api-key': TEST_API_KEY },
    });
    expect(findingsResponse.statusCode).toBe(200);
    const findingsBody = findingsResponse.json<{
      data: Array<{ id: string; mismatchId: string | null; status: string; findingType: string }>;
    }>();
    const finding = findingsBody.data.find((item) => item.findingType === 'position_exposure_mismatch');
    expect(finding).toBeTruthy();
    expect(finding?.status).toBe('active');
    expect(finding?.mismatchId).toBeTruthy();

    const findingDetailResponse = await app.inject({
      method: 'GET',
      url: `/api/v1/runtime/reconciliation/findings/${finding?.id}`,
      headers: { 'x-api-key': TEST_API_KEY },
    });
    expect(findingDetailResponse.statusCode).toBe(200);

    const mismatchFindingsResponse = await app.inject({
      method: 'GET',
      url: `/api/v1/runtime/mismatches/${finding?.mismatchId}/findings`,
      headers: { 'x-api-key': TEST_API_KEY },
    });
    expect(mismatchFindingsResponse.statusCode).toBe(200);
    const mismatchFindingsBody = mismatchFindingsResponse.json<{ data: Array<{ id: string }> }>();
    expect(mismatchFindingsBody.data.some((item) => item.id === finding?.id)).toBe(true);

    const mismatchDetailResponse = await app.inject({
      method: 'GET',
      url: `/api/v1/runtime/mismatches/${finding?.mismatchId}`,
      headers: { 'x-api-key': TEST_API_KEY },
    });
    expect(mismatchDetailResponse.statusCode).toBe(200);
    const mismatchDetailBody = mismatchDetailResponse.json<{
      data: {
        mismatch: { sourceKind: string };
        reconciliationFindings: Array<{ id: string; status: string }>;
        latestReconciliationFinding: { id: string; findingType: string } | null;
        recommendedRemediationTypes: string[];
      };
    }>();
    expect(mismatchDetailBody.data.mismatch.sourceKind).toBe('reconciliation');
    expect(mismatchDetailBody.data.reconciliationFindings.some((item) => item.id === finding?.id)).toBe(true);
    expect(mismatchDetailBody.data.latestReconciliationFinding?.findingType).toBe('position_exposure_mismatch');
    expect(mismatchDetailBody.data.recommendedRemediationTypes).toContain('rebuild_projections');

    const summaryResponse = await app.inject({
      method: 'GET',
      url: '/api/v1/runtime/reconciliation/summary',
      headers: { 'x-api-key': TEST_API_KEY },
    });
    expect(summaryResponse.statusCode).toBe(200);
    const summaryBody = summaryResponse.json<{
      data: {
        latestRun: { id: string } | null;
        latestSeverityCounts: Record<string, number>;
        latestTypeCounts: Record<string, number>;
      } | null;
    }>();
    expect(summaryBody.data?.latestRun?.id).toBe(reconciliationRun.id);
    expect((summaryBody.data?.latestSeverityCounts['high'] ?? 0) + (summaryBody.data?.latestSeverityCounts['critical'] ?? 0)).toBeGreaterThan(0);
    expect(summaryBody.data?.latestTypeCounts['position_exposure_mismatch']).toBeGreaterThan(0);

    const remediateResponse = await app.inject({
      method: 'POST',
      url: `/api/v1/runtime/mismatches/${finding?.mismatchId}/remediate`,
      headers: operatorHeaders('operator', 'POST', `/api/v1/runtime/mismatches/${finding?.mismatchId}/remediate`),
      payload: {
        actionType: 'rebuild_projections',
        summary: 'repair projected positions from persisted truth',
      },
    });
    expect(remediateResponse.statusCode).toBe(202);
    await waitForRemediationStatus(controlPlane, String(finding?.mismatchId), 'completed');
    await waitForMismatchStatus(controlPlane, String(finding?.mismatchId), 'resolved');

    const resolvedMismatchFindingsResponse = await app.inject({
      method: 'GET',
      url: `/api/v1/runtime/mismatches/${finding?.mismatchId}/findings`,
      headers: { 'x-api-key': TEST_API_KEY },
    });
    expect(resolvedMismatchFindingsResponse.statusCode).toBe(200);
    const resolvedMismatchFindingsBody = resolvedMismatchFindingsResponse.json<{
      data: Array<{ status: string }>;
    }>();
    expect(resolvedMismatchFindingsBody.data.some((item) => item.status === 'resolved')).toBe(true);
  });

  it('rejects viewer mutation attempts and allows admin control actions', async () => {
    const viewerCycleResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/runtime/cycles/run',
      headers: operatorHeaders('viewer', 'POST', '/api/v1/runtime/cycles/run'),
    });
    expect(viewerCycleResponse.statusCode).toBe(403);

    const viewerTreasuryResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/treasury/evaluate',
      headers: operatorHeaders('viewer', 'POST', '/api/v1/treasury/evaluate'),
    });
    expect(viewerTreasuryResponse.statusCode).toBe(403);

    const viewerApproveTreasuryResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/treasury/actions/not-found/approve',
      headers: operatorHeaders('viewer', 'POST', '/api/v1/treasury/actions/not-found/approve'),
    });
    expect(viewerApproveTreasuryResponse.statusCode).toBe(403);

    const missingOperatorResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/runtime/cycles/run',
      headers: { 'x-api-key': TEST_API_KEY },
    });
    expect(missingOperatorResponse.statusCode).toBe(403);

    const adminKillSwitchResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/control/kill-switch',
      headers: operatorHeaders('admin', 'POST', '/api/v1/control/kill-switch'),
      payload: { reason: 'authz-test' },
    });
    expect(adminKillSwitchResponse.statusCode).toBe(200);
  });

  it('exposes allocator summary, targets, history, and manual evaluation through the API', async () => {
    const evaluateResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/allocator/evaluate',
      headers: operatorHeaders('operator', 'POST', '/api/v1/allocator/evaluate'),
    });

    expect(evaluateResponse.statusCode).toBe(202);

    const evaluateBody = evaluateResponse.json<{ data: { commandId: string } }>();
    const command = await waitForCommand(controlPlane, evaluateBody.data.commandId);
    expect(command.status).toBe('completed');
    expect(command.result['allocatorRunId']).toBeTruthy();

    const [summaryResponse, targetsResponse, decisionsResponse, detailResponse, runsResponse, proposalsResponse] = await Promise.all([
      app.inject({
        method: 'GET',
        url: '/api/v1/allocator/summary',
        headers: { 'x-api-key': TEST_API_KEY },
      }),
      app.inject({
        method: 'GET',
        url: '/api/v1/allocator/targets',
        headers: { 'x-api-key': TEST_API_KEY },
      }),
      app.inject({
        method: 'GET',
        url: '/api/v1/allocator/decisions',
        headers: { 'x-api-key': TEST_API_KEY },
      }),
      app.inject({
        method: 'GET',
        url: `/api/v1/allocator/decisions/${String(command.result['allocatorRunId'])}`,
        headers: { 'x-api-key': TEST_API_KEY },
      }),
      app.inject({
        method: 'GET',
        url: '/api/v1/allocator/runs',
        headers: { 'x-api-key': TEST_API_KEY },
      }),
      app.inject({
        method: 'GET',
        url: '/api/v1/allocator/rebalance-proposals',
        headers: { 'x-api-key': TEST_API_KEY },
      }),
    ]);

    expect(summaryResponse.statusCode).toBe(200);
    expect(targetsResponse.statusCode).toBe(200);
    expect(decisionsResponse.statusCode).toBe(200);
    expect(detailResponse.statusCode).toBe(200);
    expect(runsResponse.statusCode).toBe(200);
    expect(proposalsResponse.statusCode).toBe(200);

    const summaryBody = summaryResponse.json<{
      data: null | {
        allocatorRunId: string;
        regimeState: string;
        carryTargetPct: number;
      };
    }>();
    const targetsBody = targetsResponse.json<{
      data: Array<{ sleeveId: string; targetAllocationPct: number }>;
    }>();
    const decisionsBody = decisionsResponse.json<{
      data: Array<{ allocatorRunId: string; recommendationCount: number }>;
    }>();
    const detailBody = detailResponse.json<{
      data: {
        run: { allocatorRunId: string };
        targets: Array<{ sleeveId: string }>;
      };
    }>();
    const proposalsBody = proposalsResponse.json<{
      data: Array<{ id: string; allocatorRunId: string; status: string }>;
    }>();

    expect(summaryBody.data?.allocatorRunId).toBe(String(command.result['allocatorRunId']));
    expect(summaryBody.data?.regimeState).toBeTruthy();
    expect(summaryBody.data?.carryTargetPct).toBeGreaterThanOrEqual(0);
    expect(targetsBody.data.length).toBeGreaterThanOrEqual(2);
    expect(targetsBody.data.some((target) => target.sleeveId === 'carry')).toBe(true);
    expect(targetsBody.data.some((target) => target.sleeveId === 'treasury')).toBe(true);
    expect(decisionsBody.data[0]?.allocatorRunId).toBe(String(command.result['allocatorRunId']));
    expect(detailBody.data.run.allocatorRunId).toBe(String(command.result['allocatorRunId']));
    expect(detailBody.data.targets.length).toBeGreaterThanOrEqual(2);
    expect(Array.isArray(proposalsBody.data)).toBe(true);
  });

  it('approves allocator rebalance proposals through the API and exposes linked outcome state', async () => {
    const cycleResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/runtime/cycles/run',
      headers: operatorHeaders('operator', 'POST', '/api/v1/runtime/cycles/run'),
    });
    const cycleBody = cycleResponse.json<{ data: { commandId: string } }>();
    await waitForCommand(controlPlane, cycleBody.data.commandId);

    const evaluateResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/allocator/evaluate',
      headers: operatorHeaders('operator', 'POST', '/api/v1/allocator/evaluate'),
    });
    expect(evaluateResponse.statusCode).toBe(202);

    const evaluateBody = evaluateResponse.json<{ data: { commandId: string } }>();
    await waitForCommand(controlPlane, evaluateBody.data.commandId);

    const proposalsResponse = await app.inject({
      method: 'GET',
      url: '/api/v1/allocator/rebalance-proposals',
      headers: { 'x-api-key': TEST_API_KEY },
    });
    const proposalsBody = proposalsResponse.json<{
      data: Array<{ id: string; executable: boolean; allocatorRunId: string }>;
    }>();
    const actionable = proposalsBody.data.find((proposal) => proposal.executable);
    expect(actionable?.id).toBeTruthy();

    const approveResponse = await app.inject({
      method: 'POST',
      url: `/api/v1/allocator/rebalance-proposals/${actionable?.id}/approve`,
      headers: operatorHeaders('operator', 'POST', `/api/v1/allocator/rebalance-proposals/${actionable?.id}/approve`),
    });
    expect(approveResponse.statusCode).toBe(202);

    const approveBody = approveResponse.json<{ data: { commandId: string } }>();
    const command = await waitForCommand(controlPlane, approveBody.data.commandId);
    expect(command.status).toBe('completed');
    const downstreamCarryActionIds = Array.isArray(command.result['downstreamCarryActionIds'])
      ? command.result['downstreamCarryActionIds'].filter((value): value is string => typeof value === 'string')
      : [];
    const downstreamTreasuryActionIds = Array.isArray(command.result['downstreamTreasuryActionIds'])
      ? command.result['downstreamTreasuryActionIds'].filter((value): value is string => typeof value === 'string')
      : [];

    const [detailResponse, graphResponse, bundleResponse, bundlesResponse, timelineResponse, byDecisionResponse] = await Promise.all([
      app.inject({
        method: 'GET',
        url: `/api/v1/allocator/rebalance-proposals/${actionable?.id}`,
        headers: { 'x-api-key': TEST_API_KEY },
      }),
      app.inject({
        method: 'GET',
        url: `/api/v1/allocator/rebalance-proposals/${actionable?.id}/execution-graph`,
        headers: { 'x-api-key': TEST_API_KEY },
      }),
      app.inject({
        method: 'GET',
        url: `/api/v1/allocator/rebalance-proposals/${actionable?.id}/bundle`,
        headers: { 'x-api-key': TEST_API_KEY },
      }),
      app.inject({
        method: 'GET',
        url: '/api/v1/allocator/rebalance-bundles',
        headers: { 'x-api-key': TEST_API_KEY },
      }),
      app.inject({
        method: 'GET',
        url: `/api/v1/allocator/rebalance-proposals/${actionable?.id}/timeline`,
        headers: { 'x-api-key': TEST_API_KEY },
      }),
      app.inject({
        method: 'GET',
        url: `/api/v1/allocator/decisions/${actionable?.allocatorRunId}/rebalance-proposals`,
        headers: { 'x-api-key': TEST_API_KEY },
      }),
    ]);

    expect(detailResponse.statusCode).toBe(200);
    expect(graphResponse.statusCode).toBe(200);
    expect(bundleResponse.statusCode).toBe(200);
    expect(bundlesResponse.statusCode).toBe(200);
    expect(timelineResponse.statusCode).toBe(200);
    expect(byDecisionResponse.statusCode).toBe(200);

    const detailBody = detailResponse.json<{
      data: {
        proposal: { status: string; linkedCommandId: string | null };
        executions: Array<{ status: string }>;
      };
    }>();
    const graphBody = graphResponse.json<{
      data: {
        detail: {
          proposal: { id: string; linkedCommandId: string | null };
        };
        commands: Array<{ commandId: string }>;
        downstream: {
          carry: {
            actions: Array<{
              action: { id: string; linkedRebalanceProposalId: string | null };
              executions: Array<{ id: string; status: string; venueExecutionReference: string | null }>;
            }>;
            rollup: { actionCount: number; executionCount: number; status: string };
          };
          treasury: {
            actions: Array<{
              action: { id: string; linkedRebalanceProposalId: string | null };
              executions: Array<{ id: string; status: string }>;
            }>;
            note: string | null;
          };
        };
        timeline: Array<{ sleeveId: string; scope: string; status: string | null }>;
      };
    }>();
    const timelineBody = timelineResponse.json<{
      data: Array<{ sleeveId: string; scope: string; summary: string }>;
    }>();
    const bundleBody = bundleResponse.json<{
      data: {
        bundle: {
          proposalId: string;
          status: string;
          interventionRecommendation: string;
          totalChildCount: number;
          completedChildCount: number;
        };
        graph: {
          detail: {
            proposal: { id: string };
          };
        };
      };
    }>();
    const bundlesBody = bundlesResponse.json<{
      data: Array<{ proposalId: string; status: string }>;
    }>();

    expect(detailBody.data.proposal.status).toBe('completed');
    expect(detailBody.data.proposal.linkedCommandId).toBe(approveBody.data.commandId);
    expect(detailBody.data.executions[0]?.status).toBe('completed');
    expect(graphBody.data.detail.proposal.id).toBe(actionable?.id);
    expect(graphBody.data.commands[0]?.commandId).toBe(approveBody.data.commandId);
    expect(graphBody.data.downstream.carry.actions.map((item) => item.action.id).sort()).toEqual(
      [...downstreamCarryActionIds].sort(),
    );
    if (downstreamCarryActionIds.length > 0) {
      expect(graphBody.data.downstream.carry.actions[0]?.action.linkedRebalanceProposalId).toBe(actionable?.id);
    }
    expect(graphBody.data.downstream.treasury.actions.map((item) => item.action.id).sort()).toEqual(
      [...downstreamTreasuryActionIds].sort(),
    );
    if (downstreamTreasuryActionIds.length > 0) {
      expect(graphBody.data.downstream.treasury.actions[0]?.action.linkedRebalanceProposalId).toBe(actionable?.id);
      expect(graphBody.data.downstream.treasury.actions[0]?.executions.length).toBeGreaterThan(0);
      expect(graphBody.data.downstream.treasury.note).toBeNull();
    } else {
      expect(graphBody.data.downstream.treasury.note).toBeTruthy();
    }
    expect(graphBody.data.timeline.some((entry) => entry.sleeveId === 'carry')).toBe(true);
    expect(timelineBody.data.some((entry) => entry.scope === 'downstream_execution')).toBe(true);
    expect(bundleBody.data.bundle.proposalId).toBe(actionable?.id);
    expect(bundleBody.data.graph.detail.proposal.id).toBe(actionable?.id);
    expect(bundleBody.data.bundle.totalChildCount).toBeGreaterThanOrEqual(bundleBody.data.bundle.completedChildCount);
    expect(bundlesBody.data.some((bundle) => bundle.proposalId === actionable?.id)).toBe(true);
    expect(Array.isArray(command.result['downstreamCarryActionIds'])).toBe(true);
    expect(Array.isArray(command.result['downstreamTreasuryActionIds'])).toBe(true);
  });

  it('exposes bundle recovery candidates and records explicit recovery requests through the allocator API', async () => {
    const connection = await createDatabaseConnection(connectionString);

    const evaluateResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/allocator/evaluate',
      headers: operatorHeaders('operator', 'POST', '/api/v1/allocator/evaluate'),
    });
    const evaluateBody = evaluateResponse.json<{ data: { commandId: string } }>();
    await waitForCommand(controlPlane, evaluateBody.data.commandId);

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
        commandId: 'api-bundle-recovery-setup',
        status: 'completed',
        executionMode: proposal.executionMode,
        simulated: proposal.simulated,
        requestedBy: 'operator-user',
        startedBy: 'worker-test',
        outcomeSummary: 'Manual failed-child setup for API recovery test.',
        outcome: {},
        createdAt: new Date('2026-03-21T13:00:00.000Z'),
        startedAt: new Date('2026-03-21T13:00:01.000Z'),
        completedAt: new Date('2026-03-21T13:00:02.000Z'),
        updatedAt: new Date('2026-03-21T13:00:02.000Z'),
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
        notionalUsd: '5000.00',
        details: {},
        readiness: 'actionable',
        executable: true,
        blockedReasons: [],
        approvalRequirement: 'operator',
        executionMode: proposal.executionMode,
        simulated: true,
        executionPlan: {},
        approvedBy: 'operator-user',
        approvedAt: new Date('2026-03-21T13:00:03.000Z'),
        failedAt: new Date('2026-03-21T13:00:04.000Z'),
        linkedCommandId: 'command-carry-old-failure',
        actorId: 'operator-user',
        createdAt: new Date('2026-03-21T13:00:03.000Z'),
        updatedAt: new Date('2026-03-21T13:00:04.000Z'),
        lastError: 'Simulated failure without external side effects.',
      })
      .returning();

    await connection.db
      .update(allocatorRebalanceProposals)
      .set({
        status: 'completed',
        latestExecutionId: rebalanceExecution.id,
        linkedCommandId: 'api-bundle-recovery-setup',
        updatedAt: new Date('2026-03-21T13:00:04.000Z'),
      });

    await connection.db
      .update(allocatorRebalanceExecutions)
      .set({
        outcome: {
          applied: false,
          downstreamCarryActionIds: [carryAction.id],
          downstreamTreasuryActionIds: [],
        },
        updatedAt: new Date('2026-03-21T13:00:04.000Z'),
      });

    const bundle = await waitFor(
      () => controlPlane.getRebalanceBundleForProposal(proposal.id),
      (value): value is Exclude<typeof value, null> => value !== null && value.bundle.status === 'failed',
    );
    if (bundle === null) {
      throw new Error('Expected rebalance bundle.');
    }

    const candidatesResponse = await app.inject({
      method: 'GET',
      url: `/api/v1/allocator/rebalance-bundles/${bundle.bundle.id}/recovery-candidates`,
      headers: { 'x-api-key': TEST_API_KEY },
    });
    expect(candidatesResponse.statusCode).toBe(200);
    const candidatesBody = candidatesResponse.json<{
      data: Array<{
        targetChildType: string;
        targetChildId: string;
        eligibilityState: string;
      }>;
    }>();
    const carryCandidate = candidatesBody.data.find((item) =>
      item.targetChildType === 'carry_action' && item.targetChildId === carryAction.id,
    );
    expect(carryCandidate?.eligibilityState).toBe('eligible');

    const requestResponse = await app.inject({
      method: 'POST',
      url: `/api/v1/allocator/rebalance-bundles/${bundle.bundle.id}/recovery-actions`,
      headers: operatorHeaders('operator', 'POST', `/api/v1/allocator/rebalance-bundles/${bundle.bundle.id}/recovery-actions`),
      payload: {
        recoveryActionType: 'requeue_child_execution',
        targetChildType: 'carry_action',
        targetChildId: carryAction.id,
        note: 'Retry the failed carry child safely.',
      },
    });
    expect(requestResponse.statusCode).toBe(202);
    const requestBody = requestResponse.json<{ data: { id: string; linkedCommandId: string | null; status: string } }>();
    expect(requestBody.data.status).toBe('queued');
    expect(requestBody.data.linkedCommandId).toBeTruthy();

    const recoveryCommand = await waitForCommand(controlPlane, String(requestBody.data.linkedCommandId));
    expect(recoveryCommand.status).toBe('completed');

    const [historyResponse, actionDetailResponse, bundleResponse] = await Promise.all([
      app.inject({
        method: 'GET',
        url: `/api/v1/allocator/rebalance-bundles/${bundle.bundle.id}/recovery-actions`,
        headers: { 'x-api-key': TEST_API_KEY },
      }),
      app.inject({
        method: 'GET',
        url: `/api/v1/allocator/rebalance-bundles/${bundle.bundle.id}/recovery-actions/${requestBody.data.id}`,
        headers: { 'x-api-key': TEST_API_KEY },
      }),
      app.inject({
        method: 'GET',
        url: `/api/v1/allocator/rebalance-proposals/${proposal.id}/bundle`,
        headers: { 'x-api-key': TEST_API_KEY },
      }),
    ]);

    expect(historyResponse.statusCode).toBe(200);
    expect(actionDetailResponse.statusCode).toBe(200);
    expect(bundleResponse.statusCode).toBe(200);

    const historyBody = historyResponse.json<{ data: Array<{ id: string; status: string; linkedCommandId: string | null }> }>();
    const actionDetailBody = actionDetailResponse.json<{ data: { id: string; status: string; targetChildId: string } }>();
    const bundleBody = bundleResponse.json<{
      data: {
        bundle: { status: string; failedChildCount: number };
        recoveryActions: Array<{ id: string; status: string }>;
      };
    }>();

    expect(historyBody.data.some((item) => item.id === requestBody.data.id)).toBe(true);
    expect(actionDetailBody.data.status).toBe('completed');
    expect(actionDetailBody.data.targetChildId).toBe(carryAction.id);
    expect(bundleBody.data.bundle.status).toBe('completed');
    expect(bundleBody.data.bundle.failedChildCount).toBe(0);
    expect(bundleBody.data.recoveryActions.some((item) => item.id === requestBody.data.id && item.status === 'completed')).toBe(true);

    await connection.close();
  });

  it('exposes bundle manual resolution options and records explicit partial-application closure through the allocator API', async () => {
    const connection = await createDatabaseConnection(connectionString);

    const evaluateResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/allocator/evaluate',
      headers: operatorHeaders('operator', 'POST', '/api/v1/allocator/evaluate'),
    });
    const evaluateBody = evaluateResponse.json<{ data: { commandId: string } }>();
    await waitForCommand(controlPlane, evaluateBody.data.commandId);

    const proposal = await waitFor(
      async () => {
        const proposals = await controlPlane.listRebalanceProposals(10);
        return proposals[0] ?? null;
      },
      (value): value is Exclude<typeof value, null> => value !== null,
    );
    const treasurySummaryResponse = await app.inject({
      method: 'GET',
      url: '/api/v1/treasury/summary',
      headers: { 'x-api-key': TEST_API_KEY },
    });
    const treasurySummaryBody = treasurySummaryResponse.json<{ data: { treasuryRunId: string } | null }>();
    if (treasurySummaryBody.data === null) {
      throw new Error('Expected treasury summary.');
    }

    const [rebalanceExecution] = await connection.db
      .insert(allocatorRebalanceExecutions)
      .values({
        proposalId: proposal.id,
        commandId: 'api-manual-resolution-setup',
        status: 'completed',
        executionMode: proposal.executionMode,
        simulated: proposal.simulated,
        requestedBy: 'operator-user',
        startedBy: 'worker-test',
        outcomeSummary: 'Manual partial bundle setup for API resolution test.',
        outcome: {
          applied: true,
        },
        createdAt: new Date('2026-03-22T13:00:00.000Z'),
        startedAt: new Date('2026-03-22T13:00:01.000Z'),
        completedAt: new Date('2026-03-22T13:00:02.000Z'),
        updatedAt: new Date('2026-03-22T13:00:02.000Z'),
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
        summary: 'Carry child remained blocked before application.',
        notionalUsd: '5000.00',
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
        actorId: 'operator-user',
        createdAt: new Date('2026-03-22T13:00:03.000Z'),
        updatedAt: new Date('2026-03-22T13:00:03.000Z'),
      })
      .returning();

    const [treasuryAction] = await connection.db
      .insert(treasuryActions)
      .values({
        treasuryRunId: treasurySummaryBody.data.treasuryRunId,
        linkedRebalanceProposalId: proposal.id,
        actionType: 'rebalance_treasury_budget',
        status: 'completed',
        venueId: null,
        venueName: null,
        venueMode: 'reserve',
        amountUsd: '5000.00',
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
        approvedBy: 'operator-user',
        approvedAt: new Date('2026-03-22T13:00:04.000Z'),
        completedAt: new Date('2026-03-22T13:00:06.000Z'),
        actorId: 'operator-user',
        createdAt: new Date('2026-03-22T13:00:04.000Z'),
        updatedAt: new Date('2026-03-22T13:00:06.000Z'),
      })
      .returning();

    const [treasuryExecution] = await connection.db
      .insert(treasuryActionExecutions)
      .values({
        treasuryActionId: treasuryAction?.id ?? '',
        treasuryRunId: treasurySummaryBody.data.treasuryRunId,
        commandId: 'api-manual-resolution-setup',
        status: 'completed',
        executionMode: proposal.executionMode,
        venueMode: 'reserve',
        simulated: true,
        requestedBy: 'operator-user',
        startedBy: 'worker-test',
        blockedReasons: [],
        outcomeSummary: 'Budget-state treasury application completed.',
        outcome: {
          executionKind: 'budget_state_application',
          rebalanceProposalId: proposal.id,
        },
        createdAt: new Date('2026-03-22T13:00:05.000Z'),
        startedAt: new Date('2026-03-22T13:00:05.000Z'),
        completedAt: new Date('2026-03-22T13:00:06.000Z'),
        updatedAt: new Date('2026-03-22T13:00:06.000Z'),
      })
      .returning();

    await connection.db
      .update(allocatorRebalanceProposals)
      .set({
        status: 'completed',
        latestExecutionId: rebalanceExecution?.id ?? null,
        linkedCommandId: 'api-manual-resolution-setup',
        updatedAt: new Date('2026-03-22T13:00:06.000Z'),
      });

    await connection.db
      .update(treasuryActions)
      .set({
        latestExecutionId: treasuryExecution?.id ?? null,
        updatedAt: new Date('2026-03-22T13:00:06.000Z'),
      });

    await connection.db
      .update(allocatorRebalanceExecutions)
      .set({
        outcome: {
          applied: true,
          downstreamCarryActionIds: [carryAction?.id],
          downstreamTreasuryActionIds: [treasuryAction?.id],
        },
        updatedAt: new Date('2026-03-22T13:00:06.000Z'),
      });

    const bundle = await waitFor(
      () => controlPlane.getRebalanceBundleForProposal(proposal.id),
      (value): value is Exclude<typeof value, null> => value !== null && value.bundle.status === 'requires_intervention',
    );
    if (bundle === null || carryAction === undefined) {
      throw new Error('Expected requires_intervention bundle.');
    }

    const optionsResponse = await app.inject({
      method: 'GET',
      url: `/api/v1/allocator/rebalance-bundles/${bundle.bundle.id}/resolution-options`,
      headers: { 'x-api-key': TEST_API_KEY },
    });
    expect(optionsResponse.statusCode).toBe(200);
    const optionsBody = optionsResponse.json<{ data: Array<{ resolutionActionType: string; eligibilityState: string }> }>();
    const acceptPartial = optionsBody.data.find((item) => item.resolutionActionType === 'accept_partial_application');
    expect(acceptPartial?.eligibilityState).toBe('eligible');

    const requestResponse = await app.inject({
      method: 'POST',
      url: `/api/v1/allocator/rebalance-bundles/${bundle.bundle.id}/resolution-actions`,
      headers: operatorHeaders('operator', 'POST', `/api/v1/allocator/rebalance-bundles/${bundle.bundle.id}/resolution-actions`),
      payload: {
        resolutionActionType: 'accept_partial_application',
        note: 'Treasury budget-state application is acceptable; carry remains intentionally non-retryable.',
      },
    });
    expect(requestResponse.statusCode).toBe(200);
    const requestBody = requestResponse.json<{ data: { id: string; status: string; resolutionState: string } }>();
    expect(requestBody.data.status).toBe('completed');
    expect(requestBody.data.resolutionState).toBe('accepted_partial');

    const [historyResponse, detailResponse, bundleResponse] = await Promise.all([
      app.inject({
        method: 'GET',
        url: `/api/v1/allocator/rebalance-bundles/${bundle.bundle.id}/resolution-actions`,
        headers: { 'x-api-key': TEST_API_KEY },
      }),
      app.inject({
        method: 'GET',
        url: `/api/v1/allocator/rebalance-bundles/${bundle.bundle.id}/resolution-actions/${requestBody.data.id}`,
        headers: { 'x-api-key': TEST_API_KEY },
      }),
      app.inject({
        method: 'GET',
        url: `/api/v1/allocator/rebalance-proposals/${proposal.id}/bundle`,
        headers: { 'x-api-key': TEST_API_KEY },
      }),
    ]);

    expect(historyResponse.statusCode).toBe(200);
    expect(detailResponse.statusCode).toBe(200);
    expect(bundleResponse.statusCode).toBe(200);

    const historyBody = historyResponse.json<{ data: Array<{ id: string; status: string }> }>();
    const detailBody = detailResponse.json<{ data: { id: string; status: string; resolutionState: string; note: string } }>();
    const bundleBody = bundleResponse.json<{
      data: {
        bundle: { status: string; resolutionState: string; interventionRecommendation: string };
        partialProgress: { appliedChildren: number; nonRetryableChildren: number };
        resolutionActions: Array<{ id: string; status: string }>;
      };
    }>();

    expect(historyBody.data.some((item) => item.id === requestBody.data.id)).toBe(true);
    expect(detailBody.data.status).toBe('completed');
    expect(detailBody.data.resolutionState).toBe('accepted_partial');
    expect(detailBody.data.note).toContain('Treasury budget-state application');
    expect(bundleBody.data.bundle.status).toBe('requires_intervention');
    expect(bundleBody.data.bundle.resolutionState).toBe('accepted_partial');
    expect(bundleBody.data.bundle.interventionRecommendation).toBe('accepted_partial_application');
    expect(bundleBody.data.partialProgress.appliedChildren).toBe(1);
    expect(bundleBody.data.partialProgress.nonRetryableChildren).toBe(1);
    expect(bundleBody.data.resolutionActions.some((item) => item.id === requestBody.data.id && item.status === 'completed')).toBe(true);

    await connection.close();
  });

  it('exposes escalation detail and enforces assign, acknowledge, review, and close transitions through the allocator API', async () => {
    const connection = await createDatabaseConnection(connectionString);

    const evaluateResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/allocator/evaluate',
      headers: operatorHeaders('operator', 'POST', '/api/v1/allocator/evaluate'),
    });
    const evaluateBody = evaluateResponse.json<{ data: { commandId: string } }>();
    await waitForCommand(controlPlane, evaluateBody.data.commandId);

    const proposal = await waitFor(
      async () => {
        const proposals = await controlPlane.listRebalanceProposals(10);
        return proposals[0] ?? null;
      },
      (value): value is Exclude<typeof value, null> => value !== null,
    );
    const treasurySummaryResponse = await app.inject({
      method: 'GET',
      url: '/api/v1/treasury/summary',
      headers: { 'x-api-key': TEST_API_KEY },
    });
    const treasurySummaryBody = treasurySummaryResponse.json<{ data: { treasuryRunId: string } | null }>();
    if (treasurySummaryBody.data === null) {
      throw new Error('Expected treasury summary.');
    }

    const [rebalanceExecution] = await connection.db
      .insert(allocatorRebalanceExecutions)
      .values({
        proposalId: proposal.id,
        commandId: 'api-escalation-workflow-setup',
        status: 'completed',
        executionMode: proposal.executionMode,
        simulated: proposal.simulated,
        requestedBy: 'operator-user',
        startedBy: 'worker-test',
        outcomeSummary: 'Manual partial bundle setup for API escalation test.',
        outcome: { applied: true },
        createdAt: new Date('2026-03-23T13:00:00.000Z'),
        startedAt: new Date('2026-03-23T13:00:01.000Z'),
        completedAt: new Date('2026-03-23T13:00:02.000Z'),
        updatedAt: new Date('2026-03-23T13:00:02.000Z'),
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
        summary: 'Carry child remained blocked pending venue-side follow-up.',
        notionalUsd: '5000.00',
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
        actorId: 'operator-user',
        createdAt: new Date('2026-03-23T13:00:03.000Z'),
        updatedAt: new Date('2026-03-23T13:00:03.000Z'),
      })
      .returning();

    const [treasuryAction] = await connection.db
      .insert(treasuryActions)
      .values({
        treasuryRunId: treasurySummaryBody.data.treasuryRunId,
        linkedRebalanceProposalId: proposal.id,
        actionType: 'rebalance_treasury_budget',
        status: 'completed',
        venueId: null,
        venueName: null,
        venueMode: 'reserve',
        amountUsd: '5000.00',
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
        approvedBy: 'operator-user',
        approvedAt: new Date('2026-03-23T13:00:04.000Z'),
        completedAt: new Date('2026-03-23T13:00:06.000Z'),
        actorId: 'operator-user',
        createdAt: new Date('2026-03-23T13:00:04.000Z'),
        updatedAt: new Date('2026-03-23T13:00:06.000Z'),
      })
      .returning();

    const [treasuryExecution] = await connection.db
      .insert(treasuryActionExecutions)
      .values({
        treasuryActionId: treasuryAction?.id ?? '',
        treasuryRunId: treasurySummaryBody.data.treasuryRunId,
        commandId: 'api-escalation-workflow-setup',
        status: 'completed',
        executionMode: proposal.executionMode,
        venueMode: 'reserve',
        simulated: true,
        requestedBy: 'operator-user',
        startedBy: 'worker-test',
        blockedReasons: [],
        outcomeSummary: 'Budget-state treasury application completed.',
        outcome: {
          executionKind: 'budget_state_application',
          rebalanceProposalId: proposal.id,
        },
        createdAt: new Date('2026-03-23T13:00:05.000Z'),
        startedAt: new Date('2026-03-23T13:00:05.000Z'),
        completedAt: new Date('2026-03-23T13:00:06.000Z'),
        updatedAt: new Date('2026-03-23T13:00:06.000Z'),
      })
      .returning();

    await connection.db
      .update(allocatorRebalanceProposals)
      .set({
        status: 'completed',
        latestExecutionId: rebalanceExecution?.id ?? null,
        linkedCommandId: 'api-escalation-workflow-setup',
        updatedAt: new Date('2026-03-23T13:00:06.000Z'),
      });

    await connection.db
      .update(treasuryActions)
      .set({
        latestExecutionId: treasuryExecution?.id ?? null,
        updatedAt: new Date('2026-03-23T13:00:06.000Z'),
      });

    await connection.db
      .update(allocatorRebalanceExecutions)
      .set({
        outcome: {
          applied: true,
          downstreamCarryActionIds: [carryAction?.id],
          downstreamTreasuryActionIds: [treasuryAction?.id],
        },
        updatedAt: new Date('2026-03-23T13:00:06.000Z'),
      });

    const bundle = await waitFor(
      () => controlPlane.getRebalanceBundleForProposal(proposal.id),
      (value): value is Exclude<typeof value, null> => value !== null && value.bundle.status === 'requires_intervention',
    );
    if (bundle === null) {
      throw new Error('Expected requires_intervention bundle.');
    }

    const escalateResponse = await app.inject({
      method: 'POST',
      url: `/api/v1/allocator/rebalance-bundles/${bundle.bundle.id}/resolution-actions`,
      headers: operatorHeaders('operator', 'POST', `/api/v1/allocator/rebalance-bundles/${bundle.bundle.id}/resolution-actions`),
      payload: {
        resolutionActionType: 'escalate_bundle_for_review',
        note: 'Escalating bundle for explicit operator handoff and venue-side follow-up.',
      },
    });
    expect(escalateResponse.statusCode).toBe(200);

    const [
      escalationResponse,
      openQueueResponse,
      summaryResponse,
      mineResponse,
      assignResponse,
    ] = await Promise.all([
      app.inject({
        method: 'GET',
        url: `/api/v1/allocator/rebalance-bundles/${bundle.bundle.id}/escalation`,
        headers: { 'x-api-key': TEST_API_KEY },
      }),
      app.inject({
        method: 'GET',
        url: '/api/v1/allocator/escalations?openState=open&sortBy=due_at&sortDirection=asc',
        headers: { 'x-api-key': TEST_API_KEY },
      }),
      app.inject({
        method: 'GET',
        url: '/api/v1/allocator/escalations/summary',
        headers: operatorHeaders('operator', 'GET', '/api/v1/allocator/escalations/summary', 'operator-user'),
      }),
      app.inject({
        method: 'GET',
        url: '/api/v1/allocator/escalations/mine',
        headers: operatorHeaders('operator', 'GET', '/api/v1/allocator/escalations/mine', 'operator-user'),
      }),
      app.inject({
        method: 'POST',
        url: `/api/v1/allocator/rebalance-bundles/${bundle.bundle.id}/escalation/assign`,
        headers: operatorHeaders('operator', 'POST', `/api/v1/allocator/rebalance-bundles/${bundle.bundle.id}/escalation/assign`),
        payload: {
          ownerId: 'review-owner',
          note: 'Assigning to the reviewer responsible for venue-side follow-up.',
          dueAt: '2026-03-24T13:00:00.000Z',
        },
      }),
    ]);
    expect(escalationResponse.statusCode).toBe(200);
    expect(openQueueResponse.statusCode).toBe(200);
    expect(summaryResponse.statusCode).toBe(200);
    expect(mineResponse.statusCode).toBe(200);
    expect(assignResponse.statusCode).toBe(200);

    const acknowledgeResponse = await app.inject({
      method: 'POST',
      url: `/api/v1/allocator/rebalance-bundles/${bundle.bundle.id}/escalation/acknowledge`,
      headers: operatorHeaders('operator', 'POST', `/api/v1/allocator/rebalance-bundles/${bundle.bundle.id}/escalation/acknowledge`, 'review-owner'),
      payload: {
        note: 'Acknowledged by the assigned reviewer.',
      },
    });
    expect(acknowledgeResponse.statusCode).toBe(200);

    const reviewResponse = await app.inject({
      method: 'POST',
      url: `/api/v1/allocator/rebalance-bundles/${bundle.bundle.id}/escalation/start-review`,
      headers: operatorHeaders('operator', 'POST', `/api/v1/allocator/rebalance-bundles/${bundle.bundle.id}/escalation/start-review`, 'review-owner'),
      payload: {
        note: 'Active review started for venue-side discrepancy investigation.',
      },
    });
    expect(reviewResponse.statusCode).toBe(200);

    const closeResponse = await app.inject({
      method: 'POST',
      url: `/api/v1/allocator/rebalance-bundles/${bundle.bundle.id}/escalation/close`,
      headers: operatorHeaders('operator', 'POST', `/api/v1/allocator/rebalance-bundles/${bundle.bundle.id}/escalation/close`, 'review-owner'),
      payload: {
        note: 'Resolved after operator handoff and venue-side follow-up were completed.',
      },
    });
    expect(closeResponse.statusCode).toBe(200);

    const [historyResponse, bundleResponse, invalidReviewResponse, resolvedQueueResponse] = await Promise.all([
      app.inject({
        method: 'GET',
        url: `/api/v1/allocator/rebalance-bundles/${bundle.bundle.id}/escalation/history`,
        headers: { 'x-api-key': TEST_API_KEY },
      }),
      app.inject({
        method: 'GET',
        url: `/api/v1/allocator/rebalance-proposals/${proposal.id}/bundle`,
        headers: { 'x-api-key': TEST_API_KEY },
      }),
      app.inject({
        method: 'POST',
        url: `/api/v1/allocator/rebalance-bundles/${bundle.bundle.id}/escalation/start-review`,
        headers: operatorHeaders('operator', 'POST', `/api/v1/allocator/rebalance-bundles/${bundle.bundle.id}/escalation/start-review`, 'review-owner'),
        payload: {
          note: 'This should fail because the escalation is already resolved.',
        },
      }),
      app.inject({
        method: 'GET',
        url: '/api/v1/allocator/escalations?status=resolved&openState=closed',
        headers: { 'x-api-key': TEST_API_KEY },
      }),
    ]);

    expect(historyResponse.statusCode).toBe(200);
    expect(bundleResponse.statusCode).toBe(200);
    expect(invalidReviewResponse.statusCode).toBe(409);
    expect(resolvedQueueResponse.statusCode).toBe(200);

    const escalationBody = escalationResponse.json<{
      data: {
        escalation: { status: string; ownerId: string | null } | null;
        transitions: Array<{ transitionType: string }>;
      };
    }>();
    const openQueueBody = openQueueResponse.json<{
      data: Array<{ bundleId: string; escalationStatus: string; escalationQueueState: string; ownerId: string | null }>;
    }>();
    const summaryBody = summaryResponse.json<{
      data: { open: number; overdue: number; mine: number };
    }>();
    const mineBody = mineResponse.json<{
      data: Array<{ bundleId: string; ownerId: string | null }>;
    }>();
    const historyBody = historyResponse.json<{ data: Array<{ eventType: string; ownerId: string | null }> }>();
    const resolvedQueueBody = resolvedQueueResponse.json<{
      data: Array<{ bundleId: string; escalationStatus: string; ownerId: string | null }>;
    }>();
    const bundleBody = bundleResponse.json<{
      data: {
        bundle: {
          resolutionState: string;
          escalationStatus: string | null;
          escalationOwnerId: string | null;
        };
        escalation: { status: string; ownerId: string | null; closedBy: string | null } | null;
        escalationHistory: Array<{ eventType: string }>;
      };
    }>();

    expect(escalationBody.data.escalation?.status).toBe('open');
    expect(escalationBody.data.transitions.some((item) => item.transitionType === 'assign')).toBe(true);
    expect(openQueueBody.data.some((item) =>
      item.bundleId === bundle.bundle.id
      && item.escalationStatus === 'open'
      && item.escalationQueueState === 'on_track',
    )).toBe(true);
    expect(summaryBody.data.open).toBeGreaterThanOrEqual(1);
    expect(mineBody.data.some((item) => item.bundleId === bundle.bundle.id && item.ownerId === 'operator-user')).toBe(true);
    expect(historyBody.data.map((item) => item.eventType)).toEqual(
      expect.arrayContaining(['created', 'assigned', 'acknowledged', 'review_started', 'resolved']),
    );
    expect(resolvedQueueBody.data.some((item) =>
      item.bundleId === bundle.bundle.id
      && item.escalationStatus === 'resolved'
      && item.ownerId === 'review-owner',
    )).toBe(true);
    expect(bundleBody.data.bundle.resolutionState).toBe('escalated');
    expect(bundleBody.data.bundle.escalationStatus).toBe('resolved');
    expect(bundleBody.data.bundle.escalationOwnerId).toBe('review-owner');
    expect(bundleBody.data.escalation?.closedBy).toBe('review-owner');
    expect(bundleBody.data.escalationHistory.some((item) => item.eventType === 'resolved')).toBe(true);

    await connection.close();
  });

  it('requires operator authorization for allocator evaluation', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/allocator/evaluate',
      headers: operatorHeaders('viewer', 'POST', '/api/v1/allocator/evaluate'),
    });

    expect(response.statusCode).toBe(403);
  });

  it('requires operator authorization for rebalance approval', async () => {
    const cycleResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/runtime/cycles/run',
      headers: operatorHeaders('operator', 'POST', '/api/v1/runtime/cycles/run'),
    });
    const cycleBody = cycleResponse.json<{ data: { commandId: string } }>();
    await waitForCommand(controlPlane, cycleBody.data.commandId);

    const evaluateResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/allocator/evaluate',
      headers: operatorHeaders('operator', 'POST', '/api/v1/allocator/evaluate'),
    });
    const evaluateBody = evaluateResponse.json<{ data: { commandId: string } }>();
    await waitForCommand(controlPlane, evaluateBody.data.commandId);

    const proposals = await controlPlane.listRebalanceProposals(10);
    const proposal = proposals[0];
    expect(proposal?.id).toBeTruthy();

    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/allocator/rebalance-proposals/${proposal?.id}/approve`,
      headers: operatorHeaders('viewer', 'POST', `/api/v1/allocator/rebalance-proposals/${proposal?.id}/approve`),
    });

    expect(response.statusCode).toBe(403);
  });
});
