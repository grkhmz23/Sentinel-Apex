import { describe, expect, it } from 'vitest';

import { createCanonicalMarketIdentity } from '@sentinel-apex/venue-adapters';

import {
  buildInternalDerivativeSnapshot,
  buildVenueDerivativeComparisonDetail,
  type InternalDerivativeFillRecord,
  type InternalDerivativeTrackedVenueConfig,
} from '../internal-derivative-state.js';

import type {
  OrderView,
  PortfolioSummaryView,
  RiskSummaryView,
  RuntimeReconciliationFindingView,
  VenueSnapshotView,
} from '../types.js';

function createOrder(overrides: Partial<OrderView> = {}): OrderView {
  return {
    clientOrderId: 'client-order-1',
    runId: 'run-1',
    sleeveId: 'carry',
    opportunityId: 'opp-1',
    venueId: 'drift-solana-readonly',
    venueOrderId: '901',
    asset: 'BTC',
    side: 'buy',
    orderType: 'limit',
    executionMode: 'dry-run',
    requestedSize: '1',
    requestedPrice: '68000',
    filledSize: '0',
    averageFillPrice: null,
    status: 'open',
    attemptCount: 1,
    lastError: null,
    reduceOnly: false,
    marketIdentity: createCanonicalMarketIdentity({
      venueId: 'drift-solana-readonly',
      asset: 'BTC',
      marketType: 'perpetual',
      marketIndex: 0,
      marketKey: 'perp:0',
      marketSymbol: 'BTC-PERP',
      provenance: 'venue_native',
      capturedAtStage: 'strategy_intent',
      source: 'internal-derivative-state-test',
      notes: ['Test order carries exact market identity.'],
    }),
    metadata: {
      instrumentType: 'perpetual',
      marketIndex: 0,
      marketKey: 'perp:0',
      marketSymbol: 'BTC-PERP',
    },
    submittedAt: '2026-03-20T12:00:00.000Z',
    completedAt: null,
    createdAt: '2026-03-20T12:00:00.000Z',
    updatedAt: '2026-03-20T12:00:00.000Z',
    ...overrides,
  };
}

function createTrackedVenue(overrides: Partial<InternalDerivativeTrackedVenueConfig> = {}): InternalDerivativeTrackedVenueConfig {
  return {
    venueId: 'drift-solana-readonly',
    venueName: 'Drift Solana Read-Only',
    authorityAddress: 'drift-authority',
    subaccountId: 0,
    accountLabel: 'Apex Carry',
    ...overrides,
  };
}

function createPortfolioSummary(): PortfolioSummaryView {
  return {
    totalNav: '250000',
    grossExposure: '51000',
    netExposure: '51000',
    liquidityReserve: '109150.25',
    openPositionCount: 1,
    dailyPnl: '1250',
    cumulativePnl: '8900',
    sleeves: [
      {
        sleeveId: 'carry',
        nav: '250000',
        allocationPct: 100,
      },
    ],
    venueExposures: {
      'drift-solana-readonly': '51000',
    },
    assetExposures: {
      BTC: '51000',
    },
    updatedAt: '2026-03-20T12:01:00.000Z',
  };
}

function createRiskSummary(): RiskSummaryView {
  return {
    summary: {
      grossExposurePct: 20.4,
      netExposurePct: 20.4,
      leverage: 2.11,
      liquidityReservePct: 43.66,
      dailyDrawdownPct: 0.8,
      weeklyDrawdownPct: 1.2,
      portfolioDrawdownPct: 2.4,
      openCircuitBreakers: [],
      riskLevel: 'normal',
    },
    approvedIntentCount: 2,
    rejectedIntentCount: 0,
    capturedAt: '2026-03-20T12:01:00.000Z',
  };
}

function createInternalSnapshot() {
  const orders: OrderView[] = [
    createOrder(),
    createOrder({
      clientOrderId: 'client-order-2',
      venueOrderId: null,
      asset: 'SOL',
      side: 'sell',
      requestedSize: '4.5',
      requestedPrice: '151.25',
      metadata: {
        instrumentType: 'spot',
      },
    }),
  ];

  const fills: InternalDerivativeFillRecord[] = [
    {
      venueId: 'drift-solana-readonly',
      venueOrderId: '901',
      clientOrderId: 'client-order-1',
      asset: 'BTC',
      side: 'buy',
      size: '1',
      price: '68000',
      fee: '2',
      feeAsset: 'USDC',
      reduceOnly: false,
      filledAt: new Date('2026-03-20T11:59:00.000Z'),
      marketIdentity: createCanonicalMarketIdentity({
        venueId: 'drift-solana-readonly',
        asset: 'BTC',
        marketType: 'perpetual',
        marketIndex: 0,
        marketKey: 'perp:0',
        marketSymbol: 'BTC-PERP',
        provenance: 'venue_native',
        capturedAtStage: 'fill',
        source: 'internal-derivative-state-test',
        notes: ['Test fill carries exact market identity.'],
      }),
      metadata: {},
    },
    {
      venueId: 'drift-solana-readonly',
      venueOrderId: '901',
      clientOrderId: 'client-order-1',
      asset: 'BTC',
      side: 'sell',
      size: '0.25',
      price: '69000',
      fee: '1',
      feeAsset: 'USDC',
      reduceOnly: true,
      filledAt: new Date('2026-03-20T12:00:30.000Z'),
      marketIdentity: createCanonicalMarketIdentity({
        venueId: 'drift-solana-readonly',
        asset: 'BTC',
        marketType: 'perpetual',
        marketIndex: 0,
        marketKey: 'perp:0',
        marketSymbol: 'BTC-PERP',
        provenance: 'venue_native',
        capturedAtStage: 'fill',
        source: 'internal-derivative-state-test',
        notes: ['Test fill carries exact market identity.'],
      }),
      metadata: {},
    },
  ];

  return buildInternalDerivativeSnapshot({
    venue: createTrackedVenue(),
    orders,
    fills,
    portfolioSummary: createPortfolioSummary(),
    riskSummary: createRiskSummary(),
    capturedAt: '2026-03-20T12:01:00.000Z',
    sourceComponent: 'sentinel-runtime',
    sourceRunId: 'run-1',
    sourceReference: 'carry-action-1',
  });
}

function createExternalSnapshot(): VenueSnapshotView {
  return {
    id: 'venue-snapshot-1',
    venueId: 'drift-solana-readonly',
    venueName: 'Drift Solana Read-Only',
    connectorType: 'drift_native_readonly',
    sleeveApplicability: ['carry'],
    truthMode: 'real',
    readOnlySupport: true,
    executionSupport: false,
    approvedForLiveUse: false,
    onboardingState: 'read_only',
    missingPrerequisites: [],
    authRequirementsSummary: ['DRIFT_RPC_ENDPOINT', 'DRIFT_READONLY_AUTHORITY_ADDRESS'],
    healthy: true,
    healthState: 'healthy',
    degradedReason: null,
    truthProfile: 'derivative_aware',
    snapshotType: 'drift_native_user_account',
    snapshotSuccessful: true,
    snapshotSummary: 'Drift-native read-only snapshot captured for Apex Carry.',
    snapshotPayload: {},
    errorMessage: null,
    capturedAt: '2026-03-20T12:01:05.000Z',
    snapshotCompleteness: 'complete',
    truthCoverage: {
      accountState: { status: 'available', reason: null, limitations: [] },
      balanceState: { status: 'unsupported', reason: 'Not exposed.', limitations: [] },
      capacityState: { status: 'unsupported', reason: 'Not exposed.', limitations: [] },
      exposureState: { status: 'available', reason: null, limitations: [] },
      derivativeAccountState: { status: 'available', reason: null, limitations: [] },
      derivativePositionState: { status: 'available', reason: null, limitations: [] },
      derivativeHealthState: { status: 'available', reason: null, limitations: [] },
      orderState: { status: 'available', reason: null, limitations: [] },
      executionReferences: { status: 'unsupported', reason: 'Not used in this test.', limitations: [] },
    },
    comparisonCoverage: {
      executionReferences: { status: 'unsupported', reason: 'Not used in this test.' },
      positionInventory: { status: 'available', reason: null },
      healthState: { status: 'unsupported', reason: 'No internal health model.' },
      orderInventory: { status: 'partial', reason: 'One internal order lacks a venue order id.' },
      notes: [],
    },
    sourceMetadata: {
      sourceKind: 'adapter',
      sourceName: 'drift_native_readonly',
      connectorDepth: 'drift_native_readonly',
      commitment: 'confirmed',
      observedSlot: '123',
      observedScope: ['drift_user_account_decode'],
      provenanceNotes: ['Read-only snapshot.'],
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
      exposures: [],
      methodology: 'derived',
      provenance: {
        classification: 'derived',
        source: 'test',
        notes: [],
      },
    },
    derivativeAccountState: {
      venue: 'drift-solana-readonly',
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
      delegateAddress: null,
      marginMode: 'default',
      poolId: 0,
      marginTradingEnabled: true,
      openOrderCount: 1,
      openAuctionCount: 0,
      statusFlags: [],
      observedSlot: '123',
      rpcVersion: '1.18.0',
      dataLength: 512,
      rawDiscriminatorHex: '0102030405060708',
      notes: [],
      provenance: {
        classification: 'exact',
        source: 'drift_user_account_decode',
        notes: [],
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
          quoteAssetAmount: '-51000',
          entryPrice: '68000',
          breakEvenPrice: '68010',
          unrealizedPnlUsd: '50',
          liquidationPrice: '52000',
          positionValueUsd: '51000',
          openOrders: 1,
          openBids: '0.1',
          openAsks: '0',
          metadata: {},
          provenance: {
            classification: 'mixed',
            source: 'drift_user_account_with_market_context',
            notes: [],
          },
        },
      ],
      openPositionCount: 1,
      methodology: 'drift_user_account_with_market_context',
      notes: [],
      provenance: {
        classification: 'mixed',
        source: 'drift_user_account_with_market_context',
        notes: [],
      },
    },
    derivativeHealthState: {
      healthStatus: 'healthy',
      healthScore: 84,
      collateralUsd: '153450.25',
      marginRatio: '0.2841',
      leverage: '2.11',
      maintenanceMarginRequirementUsd: '18050',
      initialMarginRequirementUsd: '26250',
      freeCollateralUsd: '109150.25',
      methodology: 'drift_sdk_margin_calculation',
      notes: [],
      provenance: {
        classification: 'derived',
        source: 'drift_sdk_margin_math',
        notes: [],
      },
    },
    orderState: {
      openOrderCount: 1,
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
          price: '68000',
          quantity: '1',
          reduceOnly: false,
          accountAddress: 'readonly-account',
          slot: '123',
          placedAt: null,
          metadata: {},
          provenance: {
            classification: 'exact',
            source: 'drift_user_account_decode',
            notes: [],
          },
        },
      ],
      referenceMode: 'venue_open_orders',
      methodology: 'drift_user_account_open_orders',
      notes: [],
      provenance: {
        classification: 'exact',
        source: 'drift_user_account_decode',
        notes: [],
      },
    },
    executionReferenceState: null,
    executionConfirmationState: null,
    metadata: {},
  };
}

function createPartialInternalSnapshot() {
  return buildInternalDerivativeSnapshot({
    venue: createTrackedVenue(),
    orders: [
      createOrder({
        marketIdentity: createCanonicalMarketIdentity({
          venueId: 'drift-solana-readonly',
          asset: 'BTC',
          marketType: 'perpetual',
          marketSymbol: 'BTC-PERP',
          provenance: 'derived',
          capturedAtStage: 'runtime_order',
          source: 'internal-derivative-state-test',
          notes: ['Partial snapshot order only carries derived market identity.'],
        }),
        metadata: {
          instrumentType: 'perpetual',
        },
      }),
    ],
    fills: [
      {
        venueId: 'drift-solana-readonly',
        venueOrderId: '901',
        clientOrderId: 'client-order-1',
        asset: 'BTC',
        side: 'buy',
        size: '0.75',
        price: '68000',
        fee: '1.5',
        feeAsset: 'USDC',
        reduceOnly: false,
        filledAt: new Date('2026-03-20T12:00:30.000Z'),
        marketIdentity: createCanonicalMarketIdentity({
          venueId: 'drift-solana-readonly',
          asset: 'BTC',
          marketType: 'perpetual',
          marketSymbol: 'BTC-PERP',
          provenance: 'derived',
          capturedAtStage: 'fill',
          source: 'internal-derivative-state-test',
          notes: ['Test fill only carries derived market identity.'],
        }),
        metadata: {},
      },
    ],
    portfolioSummary: createPortfolioSummary(),
    riskSummary: createRiskSummary(),
    capturedAt: '2026-03-20T12:01:00.000Z',
    sourceComponent: 'sentinel-runtime',
  });
}

function createAmbiguousExternalSnapshot(): VenueSnapshotView {
  const snapshot = createExternalSnapshot();

  return {
    ...snapshot,
    derivativePositionState: {
      positions: [
        {
          marketIndex: 0,
          marketKey: 'perp:0',
          marketSymbol: 'BTC-PERP',
          positionType: 'perp',
          side: 'long',
          baseAssetAmount: '0.75',
          quoteAssetAmount: '-51000',
          entryPrice: '68000',
          breakEvenPrice: '68010',
          unrealizedPnlUsd: '50',
          liquidationPrice: '52000',
          positionValueUsd: '51000',
          openOrders: 1,
          openBids: '0.1',
          openAsks: '0',
          metadata: {},
          provenance: {
            classification: 'mixed',
            source: 'drift_user_account_with_market_context',
            notes: [],
          },
        },
        {
          marketIndex: 99,
          marketKey: 'perp:99',
          marketSymbol: 'BTC-PERP',
          positionType: 'perp',
          side: 'long',
          baseAssetAmount: '0.75',
          quoteAssetAmount: '-51000',
          entryPrice: '68000',
          breakEvenPrice: '68010',
          unrealizedPnlUsd: '50',
          liquidationPrice: '52000',
          positionValueUsd: '51000',
          openOrders: 0,
          openBids: '0',
          openAsks: '0',
          metadata: {},
          provenance: {
            classification: 'mixed',
            source: 'drift_user_account_with_market_context',
            notes: [],
          },
        },
      ],
      openPositionCount: 2,
      methodology: 'drift_user_account_with_market_context',
      notes: [],
      provenance: {
        classification: 'mixed',
        source: 'drift_user_account_with_market_context',
        notes: [],
      },
    },
  };
}

function createFinding(): RuntimeReconciliationFindingView {
  return {
    id: 'finding-1',
    reconciliationRunId: 'recon-1',
    dedupeKey: 'drift_truth_comparison_gap:drift-solana-readonly',
    findingType: 'drift_truth_comparison_gap',
    severity: 'low',
    status: 'active',
    sourceComponent: 'sentinel-runtime',
    subsystem: 'derivative_truth_comparison',
    venueId: 'drift-solana-readonly',
    entityType: 'venue_connector',
    entityId: 'drift-solana-readonly',
    mismatchId: null,
    summary: 'Health comparison remains partial internally.',
    expectedState: {
      healthState: 'available_or_external_unsupported',
    },
    actualState: {
      healthState: 'partial',
    },
    delta: {},
    details: {},
    detectedAt: '2026-03-20T12:01:10.000Z',
    createdAt: '2026-03-20T12:01:10.000Z',
  };
}

describe('internal derivative state', () => {
  it('builds canonical internal account and order state with derived internal health posture', () => {
    const snapshot = createInternalSnapshot();

    expect(snapshot.coverage.accountState.status).toBe('available');
    expect(snapshot.coverage.positionState.status).toBe('available');
    expect(snapshot.coverage.healthState.status).toBe('available');
    expect(snapshot.coverage.orderState.status).toBe('partial');
    expect(snapshot.accountState?.accountLocatorMode).toBe('authority_subaccount');
    expect(snapshot.positionState?.openPositionCount).toBe(1);
    expect(snapshot.positionState?.positions[0]?.positionKey).toBe('perp:0');
    expect(snapshot.positionState?.positions[0]?.netQuantity).toBe('0.75');
    expect(snapshot.positionState?.positions[0]?.averageEntryPrice).toBe('68000');
    expect(snapshot.positionState?.positions[0]?.marketIdentity?.normalizedKey).toBe('perp:0');
    expect(snapshot.orderState?.openOrderCount).toBe(2);
    expect(snapshot.orderState?.comparableOpenOrderCount).toBe(1);
    expect(snapshot.orderState?.nonComparableOpenOrderCount).toBe(1);
    expect(snapshot.healthState?.healthStatus).toBe('healthy');
    expect(snapshot.healthState?.comparisonMode).toBe('status_band_only');
    expect(snapshot.healthState?.riskPosture).toBe('normal');
    expect(snapshot.healthState?.venueExposureUsd).toBe('51000');
    expect(snapshot.healthState?.provenance.classification).toBe('derived');
  });

  it('marks health as unsupported when internal portfolio and risk projections are missing', () => {
    const snapshot = buildInternalDerivativeSnapshot({
      venue: createTrackedVenue(),
      orders: [createOrder()],
      fills: [],
      portfolioSummary: null,
      riskSummary: null,
      capturedAt: '2026-03-20T12:01:00.000Z',
      sourceComponent: 'sentinel-runtime',
    });

    expect(snapshot.coverage.healthState.status).toBe('unsupported');
    expect(snapshot.healthState?.healthStatus).toBe('unknown');
    expect(snapshot.healthState?.comparisonMode).toBe('unsupported');
    expect(snapshot.healthState?.provenance.classification).toBe('unsupported');
    expect(snapshot.healthState?.unsupportedReasons.length).toBeGreaterThan(0);
  });

  it('marks exact market identity and partial health comparison honestly', () => {
    const internalSnapshot = createInternalSnapshot();
    const detail = buildVenueDerivativeComparisonDetail({
      venueId: 'drift-solana-readonly',
      venueName: 'Drift Solana Read-Only',
      internalState: {
        ...internalSnapshot,
        id: 'internal-snapshot-1',
        updatedAt: internalSnapshot.capturedAt,
      },
      externalSnapshot: createExternalSnapshot(),
      activeFindings: [createFinding()],
    });

    expect(detail.summary.subaccountIdentity.status).toBe('available');
    expect(detail.summary.positionInventory.status).toBe('available');
    expect(detail.summary.marketIdentity.status).toBe('available');
    expect(detail.summary.healthState.status).toBe('partial');
    expect(detail.summary.orderInventory.status).toBe('partial');
    expect(detail.summary.healthComparisonMode).toBe('status_band_only');
    expect(detail.summary.exactPositionIdentityCount).toBe(1);
    expect(detail.summary.partialPositionIdentityCount).toBe(0);
    expect(detail.summary.positionIdentityGapCount).toBe(0);
    expect(detail.summary.matchedPositionCount).toBe(1);
    expect(detail.summary.mismatchedPositionCount).toBe(0);
    expect(detail.summary.matchedOrderCount).toBe(1);
    expect(detail.summary.mismatchedOrderCount).toBe(0);
    expect(detail.summary.activeFindingCount).toBe(1);
    expect(detail.accountComparison.status).toBe('matched');
    expect(detail.positionComparisons[0]?.status).toBe('matched');
    expect(detail.positionComparisons[0]?.marketIdentityComparison.comparisonMode).toBe('exact');
    expect(detail.orderComparisons[0]?.status).toBe('matched');
    expect(detail.orderComparisons[0]?.marketIdentityComparison.comparisonMode).toBe('exact');
    expect(detail.healthComparison.status).toBe('matched');
    expect(detail.healthComparison.comparable).toBe(true);
    expect(detail.healthComparison.comparisonMode).toBe('status_band_only');
  });

  it('reports partial market identity honestly when the external side cannot be paired uniquely', () => {
    const internalSnapshot = createPartialInternalSnapshot();
    const detail = buildVenueDerivativeComparisonDetail({
      venueId: 'drift-solana-readonly',
      venueName: 'Drift Solana Read-Only',
      internalState: {
        ...internalSnapshot,
        id: 'internal-snapshot-2',
        updatedAt: internalSnapshot.capturedAt,
      },
      externalSnapshot: createAmbiguousExternalSnapshot(),
      activeFindings: [],
    });

    expect(detail.summary.positionInventory.status).toBe('partial');
    expect(detail.summary.marketIdentity.status).toBe('partial');
    expect(detail.summary.exactPositionIdentityCount).toBe(0);
    expect(detail.summary.partialPositionIdentityCount).toBe(0);
    expect(detail.summary.positionIdentityGapCount).toBe(1);
    const identityGapComparison = detail.positionComparisons.find(
      (comparison) => comparison.status === 'not_comparable' && comparison.internalPosition !== null,
    );
    expect(identityGapComparison?.status).toBe('not_comparable');
    expect(identityGapComparison?.marketIdentityComparison.comparisonMode).toBe('unsupported');
    expect(identityGapComparison?.marketIdentityComparison.notes[0]).toContain('Multiple external positions');
    expect(detail.healthComparison.comparisonMode).toBe('status_band_only');
  });

  it('promotes exact internal position identity when exact fill metadata is captured earlier', () => {
    const snapshot = createInternalSnapshot();

    expect(snapshot.positionState?.positions[0]?.positionKey).toBe('perp:0');
    expect(snapshot.positionState?.positions[0]?.marketIdentity?.confidence).toBe('exact');
    expect(snapshot.positionState?.positions[0]?.marketIdentity?.normalizedKeyType).toBe('market_index');
  });
});
