import { randomUUID } from 'node:crypto';

import Decimal from 'decimal.js';
import { afterEach, describe, expect, it } from 'vitest';

import type { CarryExecutionIntent } from '@sentinel-apex/carry';
import { createDatabaseConnection, executionEvents } from '@sentinel-apex/db';
import type { OrderIntent, RiskAssessment } from '@sentinel-apex/domain';
import {
  createCanonicalMarketIdentity,
  type AccountBalance,
  type CancelOrderResult,
  type MarketData,
  type PlaceOrderParams,
  type PlaceOrderResult,
  type VenueAdapter,
  type VenueCapabilitySnapshot,
  type VenueExecutionEventEvidence,
  type VenueExecutionEventEvidenceRequest,
  type VenueExecutionRawEvent,
  type VenuePosition,
  type VenueTruthSnapshot,
} from '@sentinel-apex/venue-adapters';

import { RuntimeControlPlane } from '../control-plane.js';
import { DatabaseAuditWriter, RuntimeStore } from '../store.js';
import { RuntimeWorker } from '../worker.js';

async function createConnectionString(): Promise<string> {
  return `file:///tmp/sentinel-apex-devnet-execution-test-${randomUUID()}`;
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

class StubDevnetExecutionCarryAdapter implements VenueAdapter {
  readonly venueId = 'drift-solana-devnet-carry';
  readonly venueType = 'dex' as const;

  private connected = false;
  private signatureCounter = 0;
  private positionSize = new Decimal('0.020000000');
  private readonly executionReferences: string[] = [];
  private readonly submittedOrdersByClientOrderId = new Map<string, PlaceOrderResult>();
  private readonly eventEvidencePollCountByReference = new Map<string, number>();
  private readonly pendingPositionReductions = new Map<string, Decimal>();

  constructor(
    private readonly options: {
      appliedFraction?: Decimal.Value;
      includeReferenceInTruth?: boolean;
      eventEvidenceMode?: 'strong' | 'none' | 'probable' | 'conflicting';
      eventEvidenceAvailableAfterPolls?: number;
      positionAppliedAfterPolls?: number;
      eventFillFraction?: Decimal.Value;
      duplicateEventCount?: number;
    } = {},
  ) {}

  async connect(): Promise<void> {
    this.connected = true;
  }

  async disconnect(): Promise<void> {
    this.connected = false;
  }

  isConnected(): boolean {
    return this.connected;
  }

  private applyPendingPositionReductions(): void {
    const requiredPolls = this.options.positionAppliedAfterPolls ?? 0;
    if (requiredPolls <= 0) {
      return;
    }

    for (const [reference, reduction] of this.pendingPositionReductions.entries()) {
      const pollCount = this.eventEvidencePollCountByReference.get(reference) ?? 0;
      if (pollCount < requiredPolls) {
        continue;
      }

      this.positionSize = Decimal.max(this.positionSize.minus(reduction), new Decimal(0));
      this.pendingPositionReductions.delete(reference);
    }
  }

  private rawOrderRecordEvent(
    request: VenueExecutionEventEvidenceRequest,
    fillBaseAssetAmount: string | null,
    fillQuoteAssetAmount: string | null,
  ): VenueExecutionRawEvent {
    return {
      eventId: `drift:${request.executionReference}:OrderRecord:0`,
      venueEventType: 'OrderRecord',
      actionType: 'place',
      txSignature: request.executionReference,
      clientOrderId: request.clientOrderId,
      accountAddress: 'devnet-user-account',
      subaccountId: 0,
      marketIndex: 1,
      orderId: '101',
      userOrderId: 11,
      slot: '1',
      timestamp: new Date().toISOString(),
      fillBaseAssetAmount,
      fillQuoteAssetAmount,
      fillRole: null,
      metadata: {
        providerType: 'websocket',
        reduceOnly: true,
        side: 'sell',
      },
    };
  }

  private rawFillEvent(
    request: VenueExecutionEventEvidenceRequest,
    fillBaseAssetAmount: string,
    fillQuoteAssetAmount: string,
    fillRole: 'maker' | 'taker' | 'unknown',
  ): VenueExecutionRawEvent {
    return {
      eventId: `drift:${request.executionReference}:OrderActionRecord:${fillRole}`,
      venueEventType: 'OrderActionRecord',
      actionType: 'fill',
      txSignature: request.executionReference,
      clientOrderId: request.clientOrderId,
      accountAddress: 'devnet-user-account',
      subaccountId: 0,
      marketIndex: 1,
      orderId: '101',
      userOrderId: null,
      slot: '1',
      timestamp: new Date().toISOString(),
      fillBaseAssetAmount,
      fillQuoteAssetAmount,
      fillRole,
      metadata: {
        providerType: 'websocket',
        fillRecordId: '501',
      },
    };
  }

  private buildStrongEventEvidence(
    request: VenueExecutionEventEvidenceRequest,
  ): VenueExecutionEventEvidence {
    const requestedSize = new Decimal(request.requestedSize);
    const eventFillFraction = new Decimal(this.options.eventFillFraction ?? this.options.appliedFraction ?? 1);
    const fillBase = Decimal.min(
      requestedSize,
      requestedSize.times(eventFillFraction),
    );
    const fillBaseAssetAmount = fillBase.toFixed(9);
    const fillQuoteAssetAmount = fillBase.times('50000').toFixed(6);
    const rawEvents = [
      this.rawOrderRecordEvent(request, fillBaseAssetAmount, fillQuoteAssetAmount),
      this.rawFillEvent(request, fillBaseAssetAmount, fillQuoteAssetAmount, 'taker'),
    ];

    return {
      executionReference: request.executionReference,
      clientOrderId: request.clientOrderId,
      correlationStatus: 'event_matched_strong',
      deduplicationStatus: (this.options.duplicateEventCount ?? 0) > 0 ? 'duplicate_event' : 'unique',
      correlationConfidence: 'strong',
      evidenceOrigin: 'raw_and_derived',
      summary: `Strong Drift fill evidence was attributed to ${request.executionReference}.`,
      blockedReason: null,
      observedAt: rawEvents[1]?.timestamp ?? rawEvents[0]?.timestamp ?? null,
      eventType: 'OrderActionRecord',
      actionType: 'fill',
      txSignature: request.executionReference,
      accountAddress: 'devnet-user-account',
      subaccountId: 0,
      marketIndex: 1,
      orderId: '101',
      userOrderId: 11,
      fillBaseAssetAmount,
      fillQuoteAssetAmount,
      fillRole: 'taker',
      rawEventCount: rawEvents.length,
      duplicateEventCount: this.options.duplicateEventCount ?? 0,
      rawEvents,
    };
  }

  private buildProbableEventEvidence(
    request: VenueExecutionEventEvidenceRequest,
  ): VenueExecutionEventEvidence {
    const rawEvents = [this.rawOrderRecordEvent(request, null, null)];

    return {
      executionReference: request.executionReference,
      clientOrderId: request.clientOrderId,
      correlationStatus: 'event_matched_probable',
      deduplicationStatus: 'unique',
      correlationConfidence: 'probable',
      evidenceOrigin: 'raw_and_derived',
      summary: `Probable Drift lifecycle evidence was attributed to ${request.executionReference}.`,
      blockedReason: 'Only Drift order-lifecycle evidence is currently attributed; a venue-native fill action is still required.',
      observedAt: rawEvents[0]?.timestamp ?? null,
      eventType: 'OrderRecord',
      actionType: null,
      txSignature: request.executionReference,
      accountAddress: 'devnet-user-account',
      subaccountId: 0,
      marketIndex: 1,
      orderId: '101',
      userOrderId: 11,
      fillBaseAssetAmount: null,
      fillQuoteAssetAmount: null,
      fillRole: null,
      rawEventCount: rawEvents.length,
      duplicateEventCount: 0,
      rawEvents,
    };
  }

  private buildConflictingEventEvidence(
    request: VenueExecutionEventEvidenceRequest,
  ): VenueExecutionEventEvidence {
    const rawEvents = [this.rawFillEvent(request, request.requestedSize, '500.000000', 'maker')];

    return {
      executionReference: request.executionReference,
      clientOrderId: request.clientOrderId,
      correlationStatus: 'conflicting_event',
      deduplicationStatus: 'unique',
      correlationConfidence: 'conflicting',
      evidenceOrigin: 'raw_and_derived',
      summary: `Conflicting Drift venue events were attributed to ${request.executionReference}.`,
      blockedReason: 'Drift venue events conflicted with the expected market, side, or reduce-only execution semantics.',
      observedAt: rawEvents[0]?.timestamp ?? null,
      eventType: 'OrderActionRecord',
      actionType: 'fill',
      txSignature: request.executionReference,
      accountAddress: 'devnet-user-account',
      subaccountId: 0,
      marketIndex: 1,
      orderId: '101',
      userOrderId: null,
      fillBaseAssetAmount: request.requestedSize,
      fillQuoteAssetAmount: '500.000000',
      fillRole: 'maker',
      rawEventCount: rawEvents.length,
      duplicateEventCount: 0,
      rawEvents,
    };
  }

  private buildUnmatchedEventEvidence(
    request: VenueExecutionEventEvidenceRequest,
    blockedReason: string,
  ): VenueExecutionEventEvidence {
    return {
      executionReference: request.executionReference,
      clientOrderId: request.clientOrderId,
      correlationStatus: 'event_unmatched',
      deduplicationStatus: 'unique',
      correlationConfidence: 'none',
      evidenceOrigin: 'derived_correlation',
      summary: `No strong Drift fill evidence has been attributed to ${request.executionReference}.`,
      blockedReason,
      observedAt: null,
      eventType: null,
      actionType: null,
      txSignature: request.executionReference,
      accountAddress: 'devnet-user-account',
      subaccountId: 0,
      marketIndex: 1,
      orderId: null,
      userOrderId: null,
      fillBaseAssetAmount: null,
      fillQuoteAssetAmount: null,
      fillRole: null,
      rawEventCount: 0,
      duplicateEventCount: 0,
      rawEvents: [],
    };
  }

  async getCarryCapabilities() {
    return {
      venueId: this.venueId,
      venueMode: 'live' as const,
      executionSupported: true,
      supportsIncreaseExposure: false,
      supportsReduceExposure: true,
      readOnly: false,
      approvedForLiveUse: false,
      sensitiveExecutionEligible: false,
      promotionStatus: 'not_requested' as const,
      promotionBlockedReasons: [],
      healthy: true,
      onboardingState: 'ready_for_review' as const,
      missingPrerequisites: [],
      metadata: {
        endpointConfigured: true,
        privateKeyConfigured: true,
        authorityAddressConfigured: true,
        accountAddressConfigured: true,
        executionPosture: 'devnet_execution_capable',
      },
    };
  }

  async getVenueCapabilitySnapshot(): Promise<VenueCapabilitySnapshot> {
    return {
      venueId: this.venueId,
      venueName: 'Drift Solana Devnet Carry',
      sleeveApplicability: ['carry'],
      connectorType: 'drift_native_devnet_execution',
      truthMode: 'real',
      readOnlySupport: true,
      executionSupport: true,
      approvedForLiveUse: false,
      onboardingState: 'ready_for_review',
      missingPrerequisites: [],
      authRequirementsSummary: [
        'DRIFT_RPC_ENDPOINT',
        'DRIFT_EXECUTION_ENV=devnet',
        'DRIFT_PRIVATE_KEY',
      ],
      healthy: true,
      healthState: 'healthy',
      degradedReason: null,
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
        ],
        unsupportedExecutionScope: [
          'increase exposure',
          'mainnet-beta execution',
        ],
      },
    };
  }

  async getVenueTruthSnapshot(): Promise<VenueTruthSnapshot> {
    this.applyPendingPositionReductions();
    const capturedAt = new Date().toISOString();
    const hasPosition = this.positionSize.gt(0);

    return {
      venueId: this.venueId,
      venueName: 'Drift Solana Devnet Carry',
      snapshotType: 'drift_devnet_execution_account',
      snapshotSuccessful: true,
      healthy: true,
      healthState: 'healthy',
      summary: 'Execution-capable Drift devnet connector snapshot is healthy and ready for promotion review.',
      errorMessage: null,
      capturedAt,
      snapshotCompleteness: 'complete',
      truthCoverage: {
        accountState: { status: 'available', reason: null, limitations: [] },
        balanceState: { status: 'unsupported', reason: 'Generic wallet balances are not exposed by this test connector.', limitations: [] },
        capacityState: { status: 'unsupported', reason: 'Carry connector does not expose treasury-style capacity.', limitations: [] },
        exposureState: { status: 'available', reason: null, limitations: [] },
        derivativeAccountState: { status: 'available', reason: null, limitations: [] },
        derivativePositionState: { status: 'available', reason: null, limitations: [] },
        derivativeHealthState: { status: 'available', reason: null, limitations: [] },
        orderState: { status: 'available', reason: null, limitations: [] },
        executionReferences: { status: 'available', reason: null, limitations: [] },
      },
      sourceMetadata: {
        sourceKind: 'adapter',
        sourceName: 'drift_native_devnet_execution',
        connectorDepth: 'execution_capable',
        commitment: 'confirmed',
        observedScope: ['balances', 'positions', 'status', 'execution_references'],
        provenanceNotes: [
          'Test fixture for the phase 6.0 devnet execution-capable connector path.',
        ],
      },
      accountState: {
        accountAddress: 'devnet-user-account',
        accountLabel: 'Phase 6 Test Account',
        accountExists: true,
        ownerProgram: 'drift-program',
        executable: false,
        lamports: '0',
        nativeBalanceDisplay: '0',
        observedSlot: '1',
        rentEpoch: '0',
        dataLength: 0,
      },
      balanceState: null,
      capacityState: null,
      exposureState: {
        exposures: hasPosition
          ? [{
            exposureKey: 'perp:1:devnet-user-account',
            exposureType: 'position',
            assetKey: 'BTC-PERP',
            quantity: this.positionSize.toFixed(9),
            quantityDisplay: this.positionSize.toFixed(9),
            accountAddress: 'devnet-user-account',
          }]
          : [],
        methodology: 'test_fixture',
      },
      derivativeAccountState: {
        venue: this.venueId,
        accountAddress: 'devnet-user-account',
        accountLabel: 'Phase 6 Test Account',
        accountExists: true,
        ownerProgram: 'drift-program',
        accountModel: 'program_account',
        venueAccountType: 'drift_user',
        decoded: true,
        authorityAddress: 'devnet-authority',
        subaccountId: 0,
        userName: 'Phase 6 Test Account',
        delegateAddress: null,
        marginMode: 'default',
        poolId: 0,
        marginTradingEnabled: true,
        openOrderCount: 0,
        openAuctionCount: 0,
        statusFlags: [],
        observedSlot: '1',
        rpcVersion: '1.18.0',
        dataLength: 0,
        rawDiscriminatorHex: '0102030405060708',
        notes: ['Execution-capable test fixture.'],
      },
      derivativePositionState: {
        positions: hasPosition
          ? [{
            marketIndex: 1,
            marketKey: 'perp:1',
            marketSymbol: 'BTC-PERP',
            positionType: 'perp',
            side: 'long',
            baseAssetAmount: this.positionSize.toFixed(9),
            quoteAssetAmount: '-1000.000000',
            entryPrice: '50000.000000',
            breakEvenPrice: '50000.000000',
            unrealizedPnlUsd: '0.000000',
            liquidationPrice: '25000.000000',
            positionValueUsd: this.positionSize.times('50000').toFixed(6),
            openOrders: 0,
            openBids: '0',
            openAsks: '0',
            metadata: {},
          }]
          : [],
        openPositionCount: hasPosition ? 1 : 0,
        methodology: 'test_fixture',
        notes: ['Execution-capable test fixture position inventory.'],
      },
      derivativeHealthState: {
        healthStatus: 'healthy',
        healthScore: 95,
        collateralUsd: '2000.000000',
        marginRatio: '0.5000',
        leverage: '1.0000',
        maintenanceMarginRequirementUsd: '100.000000',
        initialMarginRequirementUsd: '200.000000',
        freeCollateralUsd: '1800.000000',
        methodology: 'test_fixture',
        notes: ['Execution-capable test fixture health state.'],
      },
      orderState: {
        openOrderCount: 0,
        openOrders: [],
        referenceMode: 'venue_open_orders',
        methodology: 'test_fixture',
        notes: [],
      },
      executionReferenceState: {
        referenceLookbackLimit: 10,
        references: this.executionReferences.map((reference) => ({
          referenceType: 'solana_signature' as const,
          reference,
          accountAddress: 'devnet-user-account',
          slot: '1',
          blockTime: capturedAt,
          confirmationStatus: 'confirmed',
          errored: false,
          memo: null,
        })),
        oldestReferenceAt: this.executionReferences[this.executionReferences.length - 1] === undefined
          ? null
          : capturedAt,
      },
      payload: {
        positionSize: this.positionSize.toFixed(9),
        executionReferenceCount: this.executionReferences.length,
      },
      metadata: {
        driftEnv: 'devnet',
        endpointConfigured: true,
        privateKeyConfigured: true,
        authorityAddressConfigured: true,
        accountAddressConfigured: true,
        executionPosture: 'devnet_execution_capable',
      },
    };
  }

  async getMarketData(asset: string): Promise<MarketData> {
    return {
      venueId: this.venueId,
      asset,
      bid: '49990.000000',
      ask: '50010.000000',
      mid: '50000.000000',
      markPrice: '50000.000000',
      indexPrice: '50000.000000',
      fundingRate: '0.00001000',
      nextFundingTime: new Date(Date.now() + 60_000),
      openInterest: '10.000000000',
      volume24h: '1000000.000000',
      marketIdentity: createCanonicalMarketIdentity({
        venueId: this.venueId,
        asset: 'BTC',
        marketType: 'perp',
        marketIndex: 1,
        marketKey: 'perp:1',
        marketSymbol: 'BTC-PERP',
        provenance: 'venue_native',
        capturedAtStage: 'market_data',
        source: 'test_fixture',
      }),
      updatedAt: new Date(),
    };
  }

  async getFundingRate(): Promise<{ rate: string; nextFundingTime: Date }> {
    return {
      rate: '0.00001000',
      nextFundingTime: new Date(Date.now() + 60_000),
    };
  }

  async getBalances(): Promise<AccountBalance[]> {
    return [{
      venueId: this.venueId,
      asset: 'USDC',
      available: '2000.00',
      locked: '0',
      total: '2000.00',
      updatedAt: new Date(),
    }];
  }

  async getPositions(): Promise<VenuePosition[]> {
    if (this.positionSize.lte(0)) {
      return [];
    }

    return [{
      venueId: this.venueId,
      asset: 'BTC',
      side: 'long',
      size: this.positionSize.toFixed(9),
      entryPrice: '50000.000000',
      markPrice: '50000.000000',
      unrealizedPnl: '0.000000',
      marginUsed: '200.000000',
      liquidationPrice: '25000.000000',
      updatedAt: new Date(),
    }];
  }

  async placeOrder(params: PlaceOrderParams): Promise<PlaceOrderResult> {
    const cached = this.submittedOrdersByClientOrderId.get(params.clientOrderId);
    if (cached !== undefined) {
      return cached;
    }

    this.signatureCounter += 1;
    const signature = `drift-devnet-sig-${this.signatureCounter}`;
    if (this.options.includeReferenceInTruth !== false) {
      this.executionReferences.unshift(signature);
    }
    const appliedFraction = new Decimal(this.options.appliedFraction ?? 1);
    const reduction = new Decimal(params.size).times(appliedFraction);
    if ((this.options.positionAppliedAfterPolls ?? 0) <= 0) {
      this.positionSize = Decimal.max(
        this.positionSize.minus(reduction),
        new Decimal(0),
      );
    } else {
      this.pendingPositionReductions.set(signature, reduction);
    }

    const result: PlaceOrderResult = {
      venueOrderId: signature,
      clientOrderId: params.clientOrderId,
      status: 'submitted',
      filledSize: '0',
      averageFillPrice: null,
      fees: null,
      submittedAt: new Date(),
      executionReference: signature,
      executionMode: 'real',
      marketIdentity: createCanonicalMarketIdentity({
        venueId: this.venueId,
        asset: 'BTC',
        marketType: 'perp',
        marketIndex: 1,
        marketKey: 'perp:1',
        marketSymbol: 'BTC-PERP',
        provenance: 'venue_native',
        capturedAtStage: 'execution_result',
        source: 'test_fixture',
      }),
    };
    this.submittedOrdersByClientOrderId.set(params.clientOrderId, result);
    return result;
  }

  async getExecutionEventEvidence(
    requests: VenueExecutionEventEvidenceRequest[],
  ): Promise<VenueExecutionEventEvidence[]> {
    return requests.map((request) => {
      const nextPollCount = (this.eventEvidencePollCountByReference.get(request.executionReference) ?? 0) + 1;
      this.eventEvidencePollCountByReference.set(request.executionReference, nextPollCount);
      this.applyPendingPositionReductions();

      if (nextPollCount < (this.options.eventEvidenceAvailableAfterPolls ?? 1)) {
        return this.buildUnmatchedEventEvidence(
          request,
          'No venue-native Drift fill evidence has been attributed to this execution yet.',
        );
      }

      switch (this.options.eventEvidenceMode ?? 'strong') {
        case 'none':
          return this.buildUnmatchedEventEvidence(
            request,
            'No venue-native Drift fill evidence has been attributed to this execution yet.',
          );
        case 'probable':
          return this.buildProbableEventEvidence(request);
        case 'conflicting':
          return this.buildConflictingEventEvidence(request);
        case 'strong':
        default:
          return this.buildStrongEventEvidence(request);
      }
    });
  }

  async cancelOrder(venueOrderId: string): Promise<CancelOrderResult> {
    return {
      venueOrderId,
      cancelled: false,
      reason: 'Unsupported by the narrow devnet execution fixture.',
    };
  }

  async getOrder(venueOrderId: string): Promise<PlaceOrderResult | null> {
    return Array.from(this.submittedOrdersByClientOrderId.values()).find(
      (order) => order.venueOrderId === venueOrderId,
    ) ?? null;
  }

  async getStatus(): Promise<{ healthy: boolean; latencyMs: number; message?: string }> {
    return { healthy: true, latencyMs: 5 };
  }
}

async function createRuntimeStore(connectionString: string): Promise<{
  close: () => Promise<void>;
  store: RuntimeStore;
}> {
  const connection = await createDatabaseConnection(connectionString);
  const auditWriter = new DatabaseAuditWriter(connection.db);

  return {
    close: () => connection.close(),
    store: new RuntimeStore(connection.db, auditWriter),
  };
}

async function createLiveReductionAction(
  store: RuntimeStore,
  venueId: string,
): Promise<string> {
  const createdAt = new Date();
  const strategyRunId = `run-${randomUUID()}`;
  await store.createStrategyRun({
    runId: strategyRunId,
    sleeveId: 'carry',
    executionMode: 'live',
    triggerSource: 'vitest-devnet-execution-path',
    metadata: {
      source: 'devnet-execution-path.test.ts',
    },
  });
  const plannedOrder: OrderIntent = {
    intentId: `reduce-${randomUUID()}`,
    venueId: venueId as never,
    asset: 'BTC' as never,
    side: 'sell',
    type: 'market',
    size: '0.010000000',
    limitPrice: null,
    opportunityId: `opp-${randomUUID()}` as never,
    reduceOnly: true,
    createdAt,
    metadata: {
      actionType: 'reduce_carry_exposure',
      sleeveId: 'carry',
      instrumentType: 'perp',
      marketIndex: 1,
      marketKey: 'perp:1',
      marketSymbol: 'BTC-PERP',
      plannedReductionUsd: '500.00',
    },
  };

  await store.persistOpportunity({
    opportunityId: plannedOrder.opportunityId,
    runId: strategyRunId,
    sleeveId: 'carry',
    asset: 'BTC',
    opportunityType: 'reduce_carry_exposure',
    expectedAnnualYieldPct: '5.00',
    netYieldPct: '4.50',
    confidenceScore: '0.90',
    detectedAt: createdAt.toISOString(),
    expiresAt: new Date(createdAt.getTime() + 60_000).toISOString(),
    approved: true,
    payload: {
      source: 'devnet-execution-path.test.ts',
    },
  });

  await store.persistIntent({
    runId: strategyRunId,
    intent: plannedOrder,
    approved: true,
    riskAssessment: {
      opportunityId: plannedOrder.opportunityId,
      orderId: null,
      overallStatus: 'passed',
      timestamp: createdAt,
      results: [],
    } satisfies RiskAssessment,
    executionDisposition: 'queued',
  });

  const intents: CarryExecutionIntent[] = [{
    actionType: 'reduce_carry_exposure',
    sourceKind: 'rebalance',
    sourceReference: 'phase-6-devnet-test',
    opportunityId: null,
    asset: 'BTC',
    summary: 'Reduce BTC-PERP carry exposure through the devnet execution-capable connector.',
    notionalUsd: '500.00',
    details: {
      coveredNotionalUsd: '500.00',
    },
    readiness: 'actionable',
    blockedReasons: [],
    executable: true,
    approvalRequirement: 'admin',
    executionMode: 'live',
    simulated: false,
    plannedOrders: [plannedOrder],
    effects: {
      currentCarryAllocationUsd: '500.00',
      projectedCarryAllocationUsd: '0.00',
      projectedCarryAllocationPct: null,
      approvedCarryBudgetUsd: '0.00',
      projectedRemainingBudgetUsd: '0.00',
      openPositionCount: 1,
    },
  }];

  const [action] = await store.createCarryActions({
    strategyRunId,
    intents,
    actorId: 'vitest',
    createdAt,
  });

  if (action === undefined) {
    throw new Error('Expected carry action to be created.');
  }

  return action.id;
}

describe('phase 6.0 devnet execution path', () => {
  const cleanups: Array<() => Promise<void>> = [];

  afterEach(async () => {
    while (cleanups.length > 0) {
      const cleanup = cleanups.pop();
      if (cleanup !== undefined) {
        try {
          await cleanup();
        } catch (error) {
          if (!(error instanceof Error) || !error.message.includes('closed')) {
            throw error;
          }
        }
      }
    }
  });

  it('blocks live execution before promotion and persists real execution references after approval', async () => {
    const connectionString = await createConnectionString();
    const adapter = new StubDevnetExecutionCarryAdapter();
    const controlPlane = await RuntimeControlPlane.connect(connectionString);
    const worker = await RuntimeWorker.createDeterministic(connectionString, {
      executionMode: 'live',
      liveExecutionEnabled: true,
      venues: [],
      carryAdapters: [adapter],
      carryConfig: {
        approvedVenues: ['sim-venue-a'],
      },
    }, {
      cycleIntervalMs: 60_000,
      pollIntervalMs: 10,
    });
    const runtimeStore = await createRuntimeStore(connectionString);

    cleanups.push(async () => runtimeStore.close());
    cleanups.push(async () => controlPlane.close());
    cleanups.push(async () => worker.stop());

    await worker.start();

    await waitFor(
      () => controlPlane.getConnectorPromotionEligibility(adapter.venueId),
      (value): value is Exclude<typeof value, null> => value !== null,
    );

    const blockedActionId = await createLiveReductionAction(runtimeStore.store, adapter.venueId);
    const blockedCommand = await controlPlane.approveCarryAction(blockedActionId, 'admin-user', 'admin');
    if (blockedCommand === null) {
      throw new Error('Expected blocked carry execution command to be queued.');
    }

    const failedCommand = await waitFor(
      () => controlPlane.getCommand(blockedCommand.commandId),
      (value): value is Exclude<typeof value, null> =>
        value !== null && (value.status === 'completed' || value.status === 'failed'),
    );
    const blockedAction = await waitFor(
      () => controlPlane.getCarryAction(blockedActionId),
      (value): value is Exclude<typeof value, null> =>
        value !== null && value.action.status === 'failed' && value.executions.length > 0,
    );
    if (blockedAction === null) {
      throw new Error('Expected blocked carry action detail.');
    }
    const blockedExecutionDetail = await waitFor(
      () => controlPlane.getCarryExecution(blockedAction.executions[0]?.id ?? ''),
      (value): value is Exclude<typeof value, null> => value !== null,
    );
    if (failedCommand === null || blockedExecutionDetail === null) {
      throw new Error('Expected blocked execution command detail to be present.');
    }

    expect(failedCommand.status).toBe('failed');
    expect(blockedExecutionDetail.execution.status).toBe('failed');
    expect(blockedExecutionDetail.execution.blockedReasons.some((reason) => reason.code === 'venue_live_unapproved')).toBe(true);
    expect(blockedExecutionDetail.steps).toHaveLength(0);

    const requested = await controlPlane.requestConnectorPromotion(
      adapter.venueId,
      'operator-user',
      'operator',
      'Requesting devnet execution review.',
    );
    const approved = await controlPlane.approveConnectorPromotion(
      adapter.venueId,
      'admin-user',
      'admin',
      'Approving devnet execution review.',
    );

    expect(requested?.current.promotionStatus).toBe('pending_review');
    expect(approved?.current.promotionStatus).toBe('approved');
    expect(approved?.current.sensitiveExecutionEligible).toBe(true);

    const allowedActionId = await createLiveReductionAction(runtimeStore.store, adapter.venueId);
    const allowedCommand = await controlPlane.approveCarryAction(allowedActionId, 'admin-user', 'admin');
    if (allowedCommand === null) {
      throw new Error('Expected allowed carry execution command to be queued.');
    }

    const completedCommand = await waitFor(
      () => controlPlane.getCommand(allowedCommand.commandId),
      (value): value is Exclude<typeof value, null> =>
        value !== null && (value.status === 'completed' || value.status === 'failed'),
    );
    if (completedCommand === null) {
      throw new Error('Expected allowed execution command detail.');
    }
    if (completedCommand.status !== 'completed') {
      const failedAction = await controlPlane.getCarryAction(allowedActionId);
      throw new Error(
        `Expected completed carry execution command but received "${completedCommand.status}": ${completedCommand.errorMessage ?? failedAction?.action.lastError ?? 'no error recorded'}`,
      );
    }
    const completedAction = await waitFor(
      () => controlPlane.getCarryAction(allowedActionId),
      (value): value is Exclude<typeof value, null> =>
        value !== null && value.action.status === 'completed' && value.executions.length > 0,
    );
    if (completedAction === null) {
      throw new Error('Expected completed carry action detail.');
    }
    const completedExecutionDetail = await waitFor(
      () => controlPlane.getCarryExecution(completedAction.executions[0]?.id ?? ''),
      (value): value is Exclude<typeof value, null> => value !== null && value.steps.length === 1,
    );
    if (completedExecutionDetail === null) {
      throw new Error('Expected completed execution detail to be present.');
    }

    const orderResults = completedExecutionDetail.execution.outcome['orderResults'];
    const firstOrderResult = Array.isArray(orderResults) ? orderResults[0] as Record<string, unknown> : null;

    expect(completedCommand.result['carryExecutionId']).toBe(completedExecutionDetail.execution.id);
    expect(completedExecutionDetail.execution.status).toBe('completed');
    expect(completedExecutionDetail.execution.simulated).toBe(false);
    expect(completedExecutionDetail.execution.venueExecutionReference).toBe('drift-devnet-sig-1');
    expect(completedExecutionDetail.steps[0]?.executionReference).toBe('drift-devnet-sig-1');
    expect(completedExecutionDetail.steps[0]?.simulated).toBe(false);
    expect(completedExecutionDetail.steps[0]?.status).toBe('filled');
    expect(completedExecutionDetail.steps[0]?.filledSize).toBe('0.010000000');
    expect(completedExecutionDetail.steps[0]?.postTradeConfirmation?.status).toBe('confirmed_full');
    expect(completedExecutionDetail.steps[0]?.postTradeConfirmation?.evidenceBasis).toBe('event_and_position');
    expect(completedExecutionDetail.steps[0]?.postTradeConfirmation?.eventEvidence?.correlationStatus).toBe('event_matched_strong');
    expect(firstOrderResult?.['executionReference']).toBe('drift-devnet-sig-1');
    expect(firstOrderResult?.['executionMode']).toBe('real');

    const eligibilityAfterExecution = await waitFor(
      () => controlPlane.getConnectorPromotionEligibility(adapter.venueId),
      (value): value is Exclude<typeof value, null> =>
        value !== null && value.postTradeConfirmation.status === 'confirmed',
    );
    if (eligibilityAfterExecution === null) {
      throw new Error('Expected connector promotion eligibility after confirmed execution.');
    }

    expect(eligibilityAfterExecution.eligibleForPromotion).toBe(true);
    expect(eligibilityAfterExecution.postTradeConfirmation.confirmedFullCount).toBe(1);
  });

  it('blocks subsequent execution readiness when venue truth only confirms a partial reduce-only delta', async () => {
    const connectionString = await createConnectionString();
    const adapter = new StubDevnetExecutionCarryAdapter({
      appliedFraction: '0.5',
    });
    const controlPlane = await RuntimeControlPlane.connect(connectionString);
    const worker = await RuntimeWorker.createDeterministic(connectionString, {
      executionMode: 'live',
      liveExecutionEnabled: true,
      venues: [],
      carryAdapters: [adapter],
      carryConfig: {
        approvedVenues: ['sim-venue-a'],
      },
    }, {
      cycleIntervalMs: 60_000,
      pollIntervalMs: 10,
    });
    const runtimeStore = await createRuntimeStore(connectionString);

    cleanups.push(async () => runtimeStore.close());
    cleanups.push(async () => controlPlane.close());
    cleanups.push(async () => worker.stop());

    await worker.start();

    await waitFor(
      () => controlPlane.getConnectorPromotionEligibility(adapter.venueId),
      (value): value is Exclude<typeof value, null> => value !== null,
    );

    await controlPlane.requestConnectorPromotion(
      adapter.venueId,
      'operator-user',
      'operator',
      'Requesting partial-fill review path.',
    );
    await controlPlane.approveConnectorPromotion(
      adapter.venueId,
      'admin-user',
      'admin',
      'Approving partial-fill review path.',
    );

    const actionId = await createLiveReductionAction(runtimeStore.store, adapter.venueId);
    const command = await controlPlane.approveCarryAction(actionId, 'admin-user', 'admin');
    if (command === null) {
      throw new Error('Expected carry execution command to be queued.');
    }

    const completedCommand = await waitFor(
      () => controlPlane.getCommand(command.commandId),
      (value): value is Exclude<typeof value, null> =>
        value !== null && (value.status === 'completed' || value.status === 'failed'),
    );
    if (completedCommand?.status !== 'completed') {
      throw new Error(`Expected command to complete, received ${completedCommand?.status ?? 'missing'}.`);
    }

    const completedAction = await waitFor(
      () => controlPlane.getCarryAction(actionId),
      (value): value is Exclude<typeof value, null> =>
        value !== null && value.action.status === 'completed' && value.executions.length > 0,
    );
    if (completedAction === null) {
      throw new Error('Expected completed carry action detail.');
    }
    const executionDetail = await waitFor(
      () => controlPlane.getCarryExecution(completedAction.executions[0]?.id ?? ''),
      (value): value is Exclude<typeof value, null> =>
        value !== null && value.steps[0]?.postTradeConfirmation !== null,
    );
    if (executionDetail === null) {
      throw new Error('Expected execution detail with post-trade confirmation.');
    }

    expect(executionDetail.steps[0]?.status).toBe('partially_filled');
    expect(executionDetail.steps[0]?.filledSize).toBe('0.005');
    expect(executionDetail.steps[0]?.postTradeConfirmation?.status).toBe('confirmed_partial');
    expect(executionDetail.steps[0]?.postTradeConfirmation?.evidenceBasis).toBe('event_and_position');
    expect(executionDetail.steps[0]?.postTradeConfirmation?.eventEvidence?.correlationStatus).toBe('event_matched_strong');

    const degradedEligibility = await waitFor(
      () => controlPlane.getConnectorPromotionEligibility(adapter.venueId),
      (value): value is Exclude<typeof value, null> =>
        value !== null && value.postTradeConfirmation.status === 'blocked',
    );
    if (degradedEligibility === null) {
      throw new Error('Expected degraded connector promotion eligibility after partial confirmation.');
    }

    expect(degradedEligibility.eligibleForPromotion).toBe(false);
    expect(degradedEligibility.postTradeConfirmation.confirmedPartialCount).toBe(1);
    expect(degradedEligibility.blockingReasons.some((reason) => reason.includes('Only 0.005'))).toBe(true);
  });

  it('keeps readiness blocked while signature truth exists but venue-native fill evidence is still missing', async () => {
    const connectionString = await createConnectionString();
    const adapter = new StubDevnetExecutionCarryAdapter({
      eventEvidenceMode: 'none',
      positionAppliedAfterPolls: 999,
    });
    const controlPlane = await RuntimeControlPlane.connect(connectionString);
    const worker = await RuntimeWorker.createDeterministic(connectionString, {
      executionMode: 'live',
      liveExecutionEnabled: true,
      venues: [],
      carryAdapters: [adapter],
      carryConfig: {
        approvedVenues: ['sim-venue-a'],
      },
    }, {
      cycleIntervalMs: 60_000,
      pollIntervalMs: 10,
    });
    const runtimeStore = await createRuntimeStore(connectionString);

    cleanups.push(async () => runtimeStore.close());
    cleanups.push(async () => controlPlane.close());
    cleanups.push(async () => worker.stop());

    await worker.start();

    await controlPlane.requestConnectorPromotion(
      adapter.venueId,
      'operator-user',
      'operator',
      'Requesting pending-event review path.',
    );
    await controlPlane.approveConnectorPromotion(
      adapter.venueId,
      'admin-user',
      'admin',
      'Approving pending-event review path.',
    );

    const actionId = await createLiveReductionAction(runtimeStore.store, adapter.venueId);
    if (await controlPlane.approveCarryAction(actionId, 'admin-user', 'admin') === null) {
      throw new Error('Expected carry execution command to be queued.');
    }

    const completedAction = await waitFor(
      () => controlPlane.getCarryAction(actionId),
      (value): value is Exclude<typeof value, null> =>
        value !== null && value.action.status === 'completed' && value.executions.length > 0,
    );
    if (completedAction === null) {
      throw new Error('Expected completed carry action detail.');
    }

    const executionDetail = await waitFor(
      () => controlPlane.getCarryExecution(completedAction.executions[0]?.id ?? ''),
      (value): value is Exclude<typeof value, null> =>
        value !== null && value.steps[0]?.postTradeConfirmation?.status === 'pending_event',
    );
    if (executionDetail === null) {
      throw new Error('Expected pending-event execution detail.');
    }

    expect(executionDetail.steps[0]?.status).toBe('submitted');
    expect(executionDetail.steps[0]?.postTradeConfirmation?.evidenceBasis).toBe('signature_only');
    expect(executionDetail.steps[0]?.postTradeConfirmation?.eventEvidence?.correlationStatus).toBe('event_unmatched');

    const degradedEligibility = await waitFor(
      () => controlPlane.getConnectorPromotionEligibility(adapter.venueId),
      (value): value is Exclude<typeof value, null> =>
        value !== null && value.postTradeConfirmation.pendingEventCount === 1,
    );
    if (degradedEligibility === null) {
      throw new Error('Expected pending-event promotion evidence.');
    }

    expect(degradedEligibility.postTradeConfirmation.status).toBe('blocked');
    expect(degradedEligibility.eligibleForPromotion).toBe(false);
  });

  it('handles event evidence arriving before position refresh and later promotes to confirmed full', async () => {
    const connectionString = await createConnectionString();
    const adapter = new StubDevnetExecutionCarryAdapter({
      eventEvidenceMode: 'strong',
      positionAppliedAfterPolls: 2,
    });
    const controlPlane = await RuntimeControlPlane.connect(connectionString);
    const worker = await RuntimeWorker.createDeterministic(connectionString, {
      executionMode: 'live',
      liveExecutionEnabled: true,
      venues: [],
      carryAdapters: [adapter],
      carryConfig: {
        approvedVenues: ['sim-venue-a'],
      },
    }, {
      cycleIntervalMs: 60_000,
      pollIntervalMs: 10,
    });
    const runtimeStore = await createRuntimeStore(connectionString);

    cleanups.push(async () => runtimeStore.close());
    cleanups.push(async () => controlPlane.close());
    cleanups.push(async () => worker.stop());

    await worker.start();

    await controlPlane.requestConnectorPromotion(
      adapter.venueId,
      'operator-user',
      'operator',
      'Requesting event-before-position review path.',
    );
    await controlPlane.approveConnectorPromotion(
      adapter.venueId,
      'admin-user',
      'admin',
      'Approving event-before-position review path.',
    );

    const actionId = await createLiveReductionAction(runtimeStore.store, adapter.venueId);
    if (await controlPlane.approveCarryAction(actionId, 'admin-user', 'admin') === null) {
      throw new Error('Expected carry execution command to be queued.');
    }

    const completedAction = await waitFor(
      () => controlPlane.getCarryAction(actionId),
      (value): value is Exclude<typeof value, null> =>
        value !== null && value.action.status === 'completed' && value.executions.length > 0,
    );
    if (completedAction === null) {
      throw new Error('Expected completed carry action detail.');
    }

    const intermediateDetail = await waitFor(
      () => controlPlane.getCarryExecution(completedAction.executions[0]?.id ?? ''),
      (value): value is Exclude<typeof value, null> =>
        value !== null && value.steps[0]?.postTradeConfirmation?.status === 'pending_position_delta',
    );
    if (intermediateDetail === null) {
      throw new Error('Expected pending-position-delta detail.');
    }

    expect(intermediateDetail.steps[0]?.status).toBe('partially_filled');
    expect(intermediateDetail.steps[0]?.filledSize).toBe('0.01');
    expect(intermediateDetail.steps[0]?.postTradeConfirmation?.eventEvidence?.correlationStatus).toBe('event_matched_strong');

    const refreshCommand = await controlPlane.enqueueCommand('run_cycle', 'vitest-refresh');
    const completedRefreshCommand = await waitFor(
      () => controlPlane.getCommand(refreshCommand.commandId),
      (value): value is Exclude<typeof value, null> =>
        value !== null && (value.status === 'completed' || value.status === 'failed'),
    );
    if (completedRefreshCommand?.status !== 'completed') {
      throw new Error(`Expected refresh command to complete, received ${completedRefreshCommand?.status ?? 'missing'}.`);
    }

    const confirmedDetail = await waitFor(
      () => controlPlane.getCarryExecution(completedAction.executions[0]?.id ?? ''),
      (value): value is Exclude<typeof value, null> =>
        value !== null && value.steps[0]?.postTradeConfirmation?.status === 'confirmed_full',
    );
    if (confirmedDetail === null) {
      throw new Error('Expected confirmed-full detail after refresh.');
    }

    expect(confirmedDetail.steps[0]?.status).toBe('filled');
    expect(confirmedDetail.steps[0]?.filledSize).toBe('0.010000000');

    const confirmedEligibility = await waitFor(
      () => controlPlane.getConnectorPromotionEligibility(adapter.venueId),
      (value): value is Exclude<typeof value, null> =>
        value !== null && value.postTradeConfirmation.status === 'confirmed',
    );
    if (confirmedEligibility === null) {
      throw new Error('Expected confirmed promotion evidence after refresh.');
    }

    expect(confirmedEligibility.eligibleForPromotion).toBe(true);
  });

  it('suppresses duplicate raw event persistence across replayed confirmation refreshes', async () => {
    const connectionString = await createConnectionString();
    const adapter = new StubDevnetExecutionCarryAdapter({
      eventEvidenceMode: 'strong',
      duplicateEventCount: 1,
    });
    const controlPlane = await RuntimeControlPlane.connect(connectionString);
    const worker = await RuntimeWorker.createDeterministic(connectionString, {
      executionMode: 'live',
      liveExecutionEnabled: true,
      venues: [],
      carryAdapters: [adapter],
      carryConfig: {
        approvedVenues: ['sim-venue-a'],
      },
    }, {
      cycleIntervalMs: 60_000,
      pollIntervalMs: 10,
    });
    const runtimeStore = await createRuntimeStore(connectionString);

    cleanups.push(async () => runtimeStore.close());
    cleanups.push(async () => controlPlane.close());
    cleanups.push(async () => worker.stop());

    await worker.start();

    await controlPlane.requestConnectorPromotion(
      adapter.venueId,
      'operator-user',
      'operator',
      'Requesting duplicate-event review path.',
    );
    await controlPlane.approveConnectorPromotion(
      adapter.venueId,
      'admin-user',
      'admin',
      'Approving duplicate-event review path.',
    );

    const actionId = await createLiveReductionAction(runtimeStore.store, adapter.venueId);
    if (await controlPlane.approveCarryAction(actionId, 'admin-user', 'admin') === null) {
      throw new Error('Expected carry execution command to be queued.');
    }

    const completedAction = await waitFor(
      () => controlPlane.getCarryAction(actionId),
      (value): value is Exclude<typeof value, null> =>
        value !== null && value.action.status === 'completed' && value.executions.length > 0,
    );
    if (completedAction === null) {
      throw new Error('Expected completed carry action detail.');
    }

    const executionDetail = await waitFor(
      () => controlPlane.getCarryExecution(completedAction.executions[0]?.id ?? ''),
      (value): value is Exclude<typeof value, null> =>
        value !== null && value.steps[0]?.postTradeConfirmation?.status === 'confirmed_full',
    );
    if (executionDetail === null) {
      throw new Error('Expected confirmed execution detail.');
    }

    expect(executionDetail.steps[0]?.postTradeConfirmation?.eventEvidence?.deduplicationStatus).toBe('duplicate_event');
    expect(executionDetail.steps[0]?.postTradeConfirmation?.eventEvidence?.duplicateEventCount).toBe(1);

    const initialExecutionEvents = (await runtimeStore.store.db.select().from(executionEvents))
      .filter((event) => event.eventType.startsWith('venue_execution.'));
    expect(initialExecutionEvents).toHaveLength(2);

    const refreshCommand = await controlPlane.enqueueCommand('run_cycle', 'vitest-refresh');
    const completedRefreshCommand = await waitFor(
      () => controlPlane.getCommand(refreshCommand.commandId),
      (value): value is Exclude<typeof value, null> =>
        value !== null && (value.status === 'completed' || value.status === 'failed'),
    );
    if (completedRefreshCommand?.status !== 'completed') {
      throw new Error(`Expected refresh command to complete, received ${completedRefreshCommand?.status ?? 'missing'}.`);
    }

    const replayedExecutionEvents = (await runtimeStore.store.db.select().from(executionEvents))
      .filter((event) => event.eventType.startsWith('venue_execution.'));
    expect(replayedExecutionEvents).toHaveLength(2);
  });

  it('blocks readiness explicitly when venue-native event evidence conflicts with the observed position delta', async () => {
    const connectionString = await createConnectionString();
    const adapter = new StubDevnetExecutionCarryAdapter({
      eventEvidenceMode: 'conflicting',
    });
    const controlPlane = await RuntimeControlPlane.connect(connectionString);
    const worker = await RuntimeWorker.createDeterministic(connectionString, {
      executionMode: 'live',
      liveExecutionEnabled: true,
      venues: [],
      carryAdapters: [adapter],
      carryConfig: {
        approvedVenues: ['sim-venue-a'],
      },
    }, {
      cycleIntervalMs: 60_000,
      pollIntervalMs: 10,
    });
    const runtimeStore = await createRuntimeStore(connectionString);

    cleanups.push(async () => runtimeStore.close());
    cleanups.push(async () => controlPlane.close());
    cleanups.push(async () => worker.stop());

    await worker.start();

    await controlPlane.requestConnectorPromotion(
      adapter.venueId,
      'operator-user',
      'operator',
      'Requesting conflicting-event review path.',
    );
    await controlPlane.approveConnectorPromotion(
      adapter.venueId,
      'admin-user',
      'admin',
      'Approving conflicting-event review path.',
    );

    const actionId = await createLiveReductionAction(runtimeStore.store, adapter.venueId);
    const command = await controlPlane.approveCarryAction(actionId, 'admin-user', 'admin');
    if (command === null) {
      throw new Error('Expected carry execution command to be queued.');
    }

    const completedAction = await waitFor(
      () => controlPlane.getCarryAction(actionId),
      (value): value is Exclude<typeof value, null> =>
        value !== null && value.action.status === 'completed' && value.executions.length > 0,
    );
    if (completedAction === null) {
      throw new Error('Expected completed carry action detail.');
    }

    const executionDetail = await waitFor(
      () => controlPlane.getCarryExecution(completedAction.executions[0]?.id ?? ''),
      (value): value is Exclude<typeof value, null> =>
        value !== null && value.steps[0]?.postTradeConfirmation?.status === 'conflicting_event_vs_position',
    );
    if (executionDetail === null) {
      throw new Error('Expected conflicting-event execution detail.');
    }

    expect(executionDetail.steps[0]?.postTradeConfirmation?.eventEvidence?.correlationStatus).toBe('conflicting_event');
    expect(executionDetail.steps[0]?.postTradeConfirmation?.evidenceBasis).toBe('conflicting');

    const degradedEligibility = await waitFor(
      () => controlPlane.getConnectorPromotionEligibility(adapter.venueId),
      (value): value is Exclude<typeof value, null> =>
        value !== null && value.postTradeConfirmation.conflictingEventVsPositionCount === 1,
    );
    if (degradedEligibility === null) {
      throw new Error('Expected conflicting-event promotion evidence.');
    }

    expect(degradedEligibility.postTradeConfirmation.status).toBe('blocked');
    expect(degradedEligibility.eligibleForPromotion).toBe(false);
  });
});
