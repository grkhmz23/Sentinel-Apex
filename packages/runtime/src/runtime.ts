import Decimal from 'decimal.js';

import {
  DEFAULT_ALLOCATOR_POLICY,
  DEFAULT_REBALANCE_POLICY,
  SentinelAllocatorPolicyEngine,
  SentinelRebalancePlanner,
  SentinelSleeveRegistry,
  type AllocatorPolicyInput,
  type AllocatorSleeveSnapshot,
} from '@sentinel-apex/allocator';
import {
  CarryControlledExecutionPlanner,
  DEFAULT_BUILD_A_BEAR_STRATEGY_POLICY,
  DEFAULT_CARRY_CONFIG,
  DEFAULT_CARRY_OPERATIONAL_POLICY,
  buildCarryReductionIntents,
  type CarryOperationalBlockedReason,
  type CarryExecutionRecommendation,
  type CarryOpportunityCandidate,
  type CarryPositionSnapshot,
  type LegStatus,
} from '@sentinel-apex/carry';
import {
  applyMigrations,
  createDatabaseConnection,
  type DatabaseConnection,
} from '@sentinel-apex/db';
import { createId, type OrderFill, type OrderIntent } from '@sentinel-apex/domain';
import { OrderExecutor, type OrderRecord } from '@sentinel-apex/execution';
import { createLogger, registry, type Logger } from '@sentinel-apex/observability';
import {
  CircuitBreakerRegistry,
  DEFAULT_RISK_LIMITS,
  RiskEngine,
  type RiskLimits,
} from '@sentinel-apex/risk-engine';
import {
  PortfolioStateTracker,
  StrategyPipeline,
  type PipelineConfig,
} from '@sentinel-apex/strategy-engine';
import {
  DEFAULT_TREASURY_POLICY,
  TreasuryExecutionPlanner,
  TreasuryPolicyEngine,
  type TreasuryPolicy,
  type TreasuryRecommendation,
  type TreasuryVenueSnapshot,
} from '@sentinel-apex/treasury';
import {
  DriftDevnetCarryAdapter,
  DriftMainnetCarryAdapter,
  DriftMultiAssetCarryAdapter,
  DriftReadonlyTruthAdapter,
  DriftSpotAdapter,
  VENUE_EXECUTION_MODE_METADATA_KEY,
  VENUE_EXECUTION_REFERENCE_METADATA_KEY,
  readCanonicalMarketIdentityFromMetadata,
  SimulatedVenueAdapter,
  SimulatedTreasuryVenueAdapter,
  type SimulatedVenueConfig,
  type SimulatedTreasuryVenueConfig,
  type TreasuryVenueAdapter,
  type TreasuryVenueCapabilities,
  type VenueAdapter,
  type VenueCapabilitySnapshot,
  type VenueExecutionEventEvidence,
  type VenueExecutionEventEvidenceRequest,
  type VenuePosition,
  type VenueTruthAdapter,
  type VenueTruthSnapshot,
} from '@sentinel-apex/venue-adapters';

import { RuntimeHealthMonitor } from './health-monitor.js';
import {
  buildInternalDerivativeSnapshot,
  type InternalDerivativeTrackedVenueConfig,
} from './internal-derivative-state.js';
import { RuntimeReconciliationEngine } from './reconciliation-engine.js';
import { DatabaseAuditWriter, RuntimeOrderStore, RuntimeStore } from './store.js';

import type {
  AllocatorSummaryView,
  AuditEventView,
  CarryActionDetailView,
  CarryStrategyProfileView,
  CarryActionView,
  CarryExecutionPostTradeConfirmationView,
  CarryExecutionDetailView,
  CarryExecutionView,
  CarryVenueView,
  ConnectorPostTradeConfirmationEvidenceView,
  OpportunityView,
  OrderView,
  PnlSummaryView,
  PortfolioSnapshotView,
  PortfolioSummaryView,
  InternalDerivativeSnapshotView,
  PositionView,
  RiskBreachView,
  RebalanceExecutionGraphView,
  RebalanceExecutionTimelineEntry,
  RuntimeLifecycleState,
  RuntimeReconciliationRunView,
  RiskSummaryView,
  RuntimeCycleOutcome,
  RuntimeStatusView,
  TreasurySummaryView,
  VenueDetailView,
  VenueDerivativeComparisonDetailView,
  VenueDerivativeComparisonSummaryView,
  VenueInventoryItemView,
  VenueInventorySummaryView,
  VenueSnapshotView,
  VenueTruthComparisonCoverageView,
  VenueTruthProfile,
  VenueTruthSummaryView,
} from './types.js';

function severityForRiskStatus(status: string): string {
  switch (status) {
    case 'failed':
      return 'high';
    case 'warning':
      return 'medium';
    default:
      return 'low';
  }
}

function buildOpportunityId(opportunity: CarryOpportunityCandidate): string {
  return `${opportunity.asset}-${opportunity.type}-${opportunity.detectedAt.getTime()}`;
}

function buildPositionViews(
  sleeveId: string,
  venuePositions: VenuePosition[],
): PositionView[] {
  return venuePositions.map((position) => ({
    id: createId(),
    sleeveId,
    venueId: position.venueId,
    asset: position.asset,
    side: position.side,
    size: position.size,
    entryPrice: position.entryPrice,
    markPrice: position.markPrice,
    unrealizedPnl: position.unrealizedPnl,
    realizedPnl: '0',
    fundingAccrued: '0',
    hedgeState: 'hedged',
    status: 'open',
    openedAt: position.updatedAt.toISOString(),
    closedAt: null,
    updatedAt: position.updatedAt.toISOString(),
  }));
}

function toCarryPositionSnapshot(position: PositionView): CarryPositionSnapshot | null {
  if (position.side !== 'long' && position.side !== 'short') {
    return null;
  }

  const updatedAt = new Date(position.updatedAt);
  if (Number.isNaN(updatedAt.getTime())) {
    return null;
  }

  return {
    positionId: position.id,
    venueId: position.venueId,
    asset: position.asset,
    side: position.side,
    size: position.size,
    markPrice: position.markPrice,
    updatedAt: updatedAt.toISOString(),
  };
}

function normaliseCarryOpportunityScore(opportunities: OpportunityView[]): number {
  if (opportunities.length === 0) {
    return 0;
  }

  const scored = opportunities.map((opportunity) => {
    const confidence = Number(opportunity.confidenceScore);
    const netYield = Number(opportunity.netYieldPct);
    const yieldScore = Number.isFinite(netYield)
      ? Math.max(0, Math.min(netYield / 10, 1))
      : 0;
    const confidenceScore = Number.isFinite(confidence)
      ? Math.max(0, Math.min(confidence, 1))
      : 0;

    return yieldScore * 0.6 + confidenceScore * 0.4;
  });

  return Number((scored.reduce((sum, value) => sum + value, 0) / scored.length).toFixed(4));
}

function readVenueExecutionReference(metadata: Record<string, unknown>): string | null {
  const value = metadata[VENUE_EXECUTION_REFERENCE_METADATA_KEY];
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function readVenueExecutionMode(
  metadata: Record<string, unknown>,
): 'real' | 'simulated' | null {
  const value = metadata[VENUE_EXECUTION_MODE_METADATA_KEY];
  return value === 'real' || value === 'simulated' ? value : null;
}

const PRE_TRADE_POSITION_CONTEXT_METADATA_KEY = 'preTradePositionContext';
const POST_TRADE_CONFIRMATION_OUTCOME_KEY = 'postTradeConfirmation';
const POST_TRADE_CONFIRMATION_CANDIDATE_LIMIT = 10;
const POST_TRADE_POSITION_TOLERANCE = new Decimal('0.000000001');

type CarryExecutionConfirmationCandidate =
  Awaited<ReturnType<RuntimeStore['listRecentCarryExecutionConfirmationCandidates']>>[number];

interface PreTradePositionContext {
  captureStatus: 'captured' | 'unavailable';
  observedAt: string;
  asset: string;
  marketKey: string | null;
  marketSymbol: string | null;
  side: 'long' | 'short' | 'flat' | null;
  size: string | null;
  reason: string | null;
}

interface PositionBoundaryContext {
  side: 'long' | 'short' | 'flat';
  size: string;
  marketKey: string | null;
  marketSymbol: string | null;
}

interface CarryExecutionPostTradeConfirmationEvaluation {
  candidate: CarryExecutionConfirmationCandidate;
  confirmation: CarryExecutionPostTradeConfirmationView;
  statusPatch?: string;
  filledSizePatch?: string | null;
}

type CarryExecutionEventEvidenceMap = Map<string, VenueExecutionEventEvidence>;

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function normaliseDecimalString(value: string): string {
  if (!value.includes('.')) {
    return value;
  }

  return value.replace(/\.?0+$/, '');
}

function decimalMax(left: Decimal, right: Decimal): Decimal {
  return left.greaterThan(right) ? left : right;
}

function marketValue(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function readPreTradePositionContext(metadata: Record<string, unknown>): PreTradePositionContext | null {
  const value = asRecord(metadata[PRE_TRADE_POSITION_CONTEXT_METADATA_KEY]);
  if (typeof value['captureStatus'] !== 'string' || typeof value['observedAt'] !== 'string') {
    return null;
  }

  return {
    captureStatus: value['captureStatus'] === 'captured' ? 'captured' : 'unavailable',
    observedAt: value['observedAt'],
    asset: typeof value['asset'] === 'string' ? value['asset'] : '',
    marketKey: marketValue(value['marketKey']),
    marketSymbol: marketValue(value['marketSymbol']),
    side: value['side'] === 'long' || value['side'] === 'short' || value['side'] === 'flat'
      ? value['side']
      : null,
    size: marketValue(value['size']),
    reason: marketValue(value['reason']),
  };
}

function positionSideFromOrderSide(side: 'buy' | 'sell'): 'long' | 'short' {
  return side === 'buy' ? 'long' : 'short';
}

function expectedPositionSideForOrder(
  side: 'buy' | 'sell',
  reduceOnly: boolean,
): 'long' | 'short' {
  if (reduceOnly) {
    return side === 'buy' ? 'short' : 'long';
  }

  return positionSideFromOrderSide(side);
}

function describeRequestedPositionChange(candidate: CarryExecutionConfirmationCandidate): string {
  if (candidate.reduceOnly) {
    return 'position reduction';
  }

  return `${positionSideFromOrderSide(candidate.side)} exposure increase`;
}

function describeExpectedExecutionSemantics(candidate: CarryExecutionConfirmationCandidate): string {
  if (candidate.reduceOnly) {
    return 'reduce-only BTC-PERP execution semantics';
  }

  return `${positionSideFromOrderSide(candidate.side)}-side BTC-PERP execution semantics`;
}

function positionExposureForSide(
  side: 'long' | 'short' | 'flat' | null,
  size: Decimal,
  targetSide: 'long' | 'short',
): Decimal {
  if (side !== targetSide) {
    return new Decimal(0);
  }

  return size;
}

function capturePreTradePositionContext(input: {
  asset: string;
  side: 'buy' | 'sell';
  reduceOnly: boolean;
  marketKey: string | null;
  marketSymbol: string | null;
  capturedAt: Date;
  positions: VenuePosition[];
}): PreTradePositionContext {
  const expectedPositionSide = expectedPositionSideForOrder(input.side, input.reduceOnly);
  const matchingPositions = input.positions.filter((position) => (
    position.asset.trim().toUpperCase() === input.asset.trim().toUpperCase()
  ));
  const matchingPosition = matchingPositions.find((position) => position.side === expectedPositionSide)
    ?? matchingPositions[0];

  if (matchingPosition === undefined) {
    return {
      captureStatus: 'captured',
      observedAt: input.capturedAt.toISOString(),
      asset: input.asset,
      marketKey: input.marketKey,
      marketSymbol: input.marketSymbol,
      side: 'flat',
      size: '0',
      reason: null,
    };
  }

  return {
    captureStatus: 'captured',
    observedAt: input.capturedAt.toISOString(),
    asset: input.asset,
    marketKey: input.marketKey,
    marketSymbol: input.marketSymbol,
    side: matchingPosition.side,
    size: matchingPosition.size,
    reason: null,
  };
}

function defaultPositionBoundary(context: PreTradePositionContext): PositionBoundaryContext {
  return {
    side: 'flat',
    size: '0',
    marketKey: context.marketKey,
    marketSymbol: context.marketSymbol,
  };
}

function candidateGroupKey(candidate: CarryExecutionConfirmationCandidate): string {
  const context = readPreTradePositionContext(candidate.metadata);
  return [
    candidate.venueId,
    context?.asset ?? candidate.asset,
    context?.marketKey ?? context?.marketSymbol ?? candidate.asset,
    context?.side === 'long' || context?.side === 'short'
      ? context.side
      : expectedPositionSideForOrder(candidate.side, candidate.reduceOnly),
  ].join(':');
}

function findSnapshotPositionBoundary(
  snapshot: VenueSnapshotView,
  context: PreTradePositionContext,
): PositionBoundaryContext {
  const positions = snapshot.derivativePositionState?.positions ?? [];
  const matchingPosition = positions.find((position) => (
    (context.marketKey !== null && position.marketKey === context.marketKey)
      || (context.marketSymbol !== null && position.marketSymbol === context.marketSymbol)
      || (position.marketSymbol !== null && position.marketSymbol.startsWith(`${context.asset.trim().toUpperCase()}-`))
  ));

  if (
    matchingPosition === undefined
    || matchingPosition.side === 'unknown'
    || matchingPosition.baseAssetAmount === null
  ) {
    return defaultPositionBoundary(context);
  }

  return {
    side: matchingPosition.side === 'long' || matchingPosition.side === 'short'
      ? matchingPosition.side
      : 'flat',
    size: matchingPosition.baseAssetAmount === null
      ? '0'
      : normaliseDecimalString(new Decimal(matchingPosition.baseAssetAmount).abs().toFixed(9)),
    marketKey: matchingPosition.marketKey,
    marketSymbol: matchingPosition.marketSymbol,
  };
}

function buildPostTradeConfirmationSummary(
  candidate: CarryExecutionConfirmationCandidate,
  status: CarryExecutionPostTradeConfirmationView['status'],
  requestedSize: string,
  confirmedSize: string | null,
  executionReference: string,
  eventEvidence: VenueExecutionEventEvidence | null,
): string {
  const requestedChange = describeRequestedPositionChange(candidate);

  switch (status) {
    case 'confirmed_full':
      return `Execution reference ${executionReference} has a strong Drift fill match and confirms the full requested ${requestedSize} ${requestedChange}.`;
    case 'confirmed_partial':
      return `Execution reference ${executionReference} has attributed Drift fill evidence and venue truth, but only ${confirmedSize ?? '0'} of the requested ${requestedSize} ${requestedChange} is jointly confirmed.`;
    case 'confirmed_partial_event_only':
      return eventEvidence?.fillBaseAssetAmount == null
        ? `Execution reference ${executionReference} has a strong Drift fill match, but venue position truth has not fully reflected the requested ${requestedChange} yet.`
        : `Execution reference ${executionReference} has a strong Drift fill match for ${eventEvidence.fillBaseAssetAmount}, but venue position truth has not fully reflected that ${requestedChange} yet.`;
    case 'confirmed_partial_position_only':
      return `Execution reference ${executionReference} confirms ${confirmedSize ?? '0'} of the requested ${requestedSize} ${requestedChange} in venue truth, but venue-native Drift fill evidence is still missing or only probable.`;
    case 'pending_event':
      return `Execution reference ${executionReference} is present in venue truth, but a strong venue-native Drift fill match has not been attributed yet.`;
    case 'pending_position_delta':
      return `Execution reference ${executionReference} has a strong Drift fill match, but the expected position delta is not yet visible in venue truth.`;
    case 'conflicting_event':
      return `Execution reference ${executionReference} has Drift venue events that conflict with the expected ${describeExpectedExecutionSemantics(candidate)}.`;
    case 'conflicting_event_vs_position':
      return `Execution reference ${executionReference} has Drift event evidence that conflicts with the observed position delta.`;
    case 'missing_reference':
      return `Execution reference ${executionReference} is not present in the latest venue truth snapshot.`;
    case 'invalid_position_delta':
      return `Execution reference ${executionReference} was observed, but the latest venue position state does not reflect a safe ${requestedChange}.`;
    case 'insufficient_context':
      return `Execution reference ${executionReference} cannot be confirmed because the required pre-trade position context was not persisted.`;
    default:
      return `Execution reference ${executionReference} has an unknown confirmation state.`;
  }
}

function formatOptionalDecimal(value: Decimal | null): string | null {
  return value === null ? null : normaliseDecimalString(value.toFixed(9));
}

function parseOptionalDecimal(value: string | null | undefined): Decimal | null {
  if (value === null || value === undefined) {
    return null;
  }

  try {
    const decimal = new Decimal(value);
    return decimal.isFinite() ? decimal : null;
  } catch {
    return null;
  }
}

function buildCarryExecutionPostTradeConfirmation(input: {
  candidate: CarryExecutionConfirmationCandidate;
  status: CarryExecutionPostTradeConfirmationView['status'];
  evidenceBasis: CarryExecutionPostTradeConfirmationView['evidenceBasis'];
  evaluatedAt: string;
  referenceObserved: boolean;
  referenceObservedAt: string | null;
  context: PreTradePositionContext | null;
  boundary: PositionBoundaryContext | null;
  confirmedSize: Decimal | null;
  remainingSize: Decimal | null;
  blockedReason: string | null;
  eventEvidence: VenueExecutionEventEvidence | null;
}): CarryExecutionPostTradeConfirmationView {
  const confirmedSize = formatOptionalDecimal(input.confirmedSize);
  const remainingSize = formatOptionalDecimal(input.remainingSize);

  return {
    status: input.status,
    evidenceBasis: input.evidenceBasis,
    summary: buildPostTradeConfirmationSummary(
      input.candidate,
      input.status,
      input.candidate.requestedSize,
      confirmedSize,
      input.candidate.executionReference,
      input.eventEvidence,
    ),
    evaluatedAt: input.evaluatedAt,
    referenceObserved: input.referenceObserved,
    referenceObservedAt: input.referenceObservedAt,
    marketKey: input.boundary?.marketKey ?? input.context?.marketKey ?? null,
    marketSymbol: input.boundary?.marketSymbol ?? input.context?.marketSymbol ?? null,
    requestedSize: input.candidate.requestedSize,
    confirmedSize,
    remainingSize,
    preTradePositionSide: input.context?.side ?? null,
    preTradePositionSize: input.context?.size ?? null,
    observedPositionSide: input.boundary?.side ?? null,
    observedPositionSize: input.boundary === null
      ? null
      : normaliseDecimalString(new Decimal(input.boundary.size).toFixed(9)),
    eventEvidence: input.eventEvidence,
    blockedReason: input.blockedReason,
  };
}

function dedupeCarryExecutionConfirmationCandidates(
  candidates: CarryExecutionConfirmationCandidate[],
): CarryExecutionConfirmationCandidate[] {
  return Array.from(
    candidates.reduce((map, candidate) => {
      const key = candidate.clientOrderId ?? candidate.executionReference;
      const existing = map.get(key);
      if (existing === undefined || existing.updatedAt < candidate.updatedAt) {
        map.set(key, candidate);
      }
      return map;
    }, new Map<string, CarryExecutionConfirmationCandidate>()).values(),
  ).sort((left, right) => left.createdAt.localeCompare(right.createdAt));
}

function countConfirmationEntries(
  entries: ConnectorPostTradeConfirmationEvidenceView['entries'],
  statuses: CarryExecutionPostTradeConfirmationView['status'][],
): number {
  return entries.filter((entry) => statuses.includes(entry.status)).length;
}

function buildUnavailableExecutionEventEvidence(
  request: VenueExecutionEventEvidenceRequest,
  message: string,
): VenueExecutionEventEvidence {
  return {
    executionReference: request.executionReference,
    clientOrderId: request.clientOrderId,
    correlationStatus: 'event_unmatched',
    deduplicationStatus: 'unique',
    correlationConfidence: 'none',
    evidenceOrigin: 'derived_correlation',
    summary: `Venue-native execution event evidence is unavailable for ${request.executionReference}.`,
    blockedReason: message,
    observedAt: null,
    eventType: null,
    actionType: null,
    txSignature: request.executionReference,
    accountAddress: null,
    subaccountId: null,
    marketIndex: null,
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

function deriveConfirmationPatch(
  candidate: CarryExecutionConfirmationCandidate,
  confirmation: CarryExecutionPostTradeConfirmationView,
): Pick<CarryExecutionPostTradeConfirmationEvaluation, 'statusPatch' | 'filledSizePatch'> {
  const requestedSize = new Decimal(candidate.requestedSize);
  const observedFilledSize = [
    parseOptionalDecimal(confirmation.confirmedSize),
    parseOptionalDecimal(confirmation.eventEvidence?.fillBaseAssetAmount),
  ].reduce<Decimal | null>((current, value) => {
    if (value === null) {
      return current;
    }

    const bounded = decimalMax(Decimal.min(value, requestedSize), new Decimal(0));
    if (current === null || bounded.greaterThan(current)) {
      return bounded;
    }
    return current;
  }, null);
  const filledSizePatch = formatOptionalDecimal(observedFilledSize);

  switch (confirmation.status) {
    case 'confirmed_full':
      return {
        statusPatch: 'filled',
        filledSizePatch: candidate.requestedSize,
      };
    case 'confirmed_partial':
    case 'confirmed_partial_event_only':
    case 'confirmed_partial_position_only':
    case 'pending_position_delta':
      return filledSizePatch === null
        ? {}
        : {
          statusPatch: 'partially_filled',
          filledSizePatch,
        };
    default:
      return {};
  }
}

function evaluatePostTradeConfirmationGroup(
  snapshot: VenueSnapshotView,
  candidates: CarryExecutionConfirmationCandidate[],
  eventEvidenceByStepId: CarryExecutionEventEvidenceMap,
): CarryExecutionPostTradeConfirmationEvaluation[] {
  const observedReferences = new Map(
    (snapshot.executionReferenceState?.references ?? []).map((reference) => [reference.reference, reference] as const),
  );
  const evaluations: CarryExecutionPostTradeConfirmationEvaluation[] = [];

  for (let index = 0; index < candidates.length; index += 1) {
    const candidate = candidates[index];
    if (candidate === undefined) {
      continue;
    }

    const eventEvidence = eventEvidenceByStepId.get(candidate.stepId) ?? null;
    const context = readPreTradePositionContext(candidate.metadata);
    const observedReference = observedReferences.get(candidate.executionReference);
    const targetSide = expectedPositionSideForOrder(candidate.side, candidate.reduceOnly);

    if (
      context === null
      || context.captureStatus !== 'captured'
      || context.size === null
      || (
        candidate.reduceOnly
          ? (context.side !== 'long' && context.side !== 'short')
          : (context.side !== 'long' && context.side !== 'short' && context.side !== 'flat')
      )
    ) {
      evaluations.push({
        candidate,
        confirmation: buildCarryExecutionPostTradeConfirmation({
          candidate,
          status: 'insufficient_context',
          evidenceBasis: 'insufficient',
          evaluatedAt: snapshot.capturedAt,
          referenceObserved: observedReference !== undefined,
          referenceObservedAt: observedReference?.blockTime ?? null,
          context,
          boundary: null,
          confirmedSize: null,
          remainingSize: new Decimal(candidate.requestedSize),
          blockedReason: context?.reason ?? 'Pre-trade position context was unavailable.',
          eventEvidence,
        }),
      });
      continue;
    }

    if (observedReference === undefined) {
      evaluations.push({
        candidate,
        confirmation: buildCarryExecutionPostTradeConfirmation({
          candidate,
          status: 'missing_reference',
          evidenceBasis: eventEvidence === null ? 'signature_only' : 'insufficient',
          evaluatedAt: snapshot.capturedAt,
          referenceObserved: false,
          referenceObservedAt: null,
          context,
          boundary: null,
          confirmedSize: null,
          remainingSize: new Decimal(candidate.requestedSize),
          blockedReason: 'The latest venue truth snapshot does not include the submitted execution reference.',
          eventEvidence,
        }),
      });
      continue;
    }

    const nextCandidate = candidates[index + 1];
    const nextContext = nextCandidate === undefined ? null : readPreTradePositionContext(nextCandidate.metadata);
    const boundary = nextCandidate === undefined
      ? findSnapshotPositionBoundary(snapshot, context)
      : nextContext !== null
        && nextContext.captureStatus === 'captured'
        && nextContext.size !== null
        && (nextContext.side === 'long' || nextContext.side === 'short' || nextContext.side === 'flat')
        ? {
          side: nextContext.side,
          size: nextContext.size,
          marketKey: nextContext.marketKey,
          marketSymbol: nextContext.marketSymbol,
        }
        : null;

    if (boundary === null) {
      evaluations.push({
        candidate,
        confirmation: buildCarryExecutionPostTradeConfirmation({
          candidate,
          status: 'insufficient_context',
          evidenceBasis: 'insufficient',
          evaluatedAt: snapshot.capturedAt,
          referenceObserved: true,
          referenceObservedAt: observedReference.blockTime,
          context,
          boundary: null,
          confirmedSize: null,
          remainingSize: new Decimal(candidate.requestedSize),
          blockedReason: 'A later carry execution did not persist its own pre-trade position boundary, so this delta cannot be attributed safely.',
          eventEvidence,
        }),
      });
      continue;
    }

    const preSize = new Decimal(context.size);
    const boundarySize = new Decimal(boundary.size);
    const requestedSize = new Decimal(candidate.requestedSize);
    const contextSide = context.side;
    const boundarySide = boundary.side;
    const invalidDirection = candidate.reduceOnly
      ? boundarySide !== 'flat' && boundarySide !== contextSide
      : boundarySide !== 'flat' && boundarySide !== targetSide;
    const unsupportedStartingExposure = !candidate.reduceOnly
      && contextSide !== 'flat'
      && contextSide !== targetSide;
    const increasedExposure = candidate.reduceOnly
      ? boundarySize.minus(preSize).greaterThan(POST_TRADE_POSITION_TOLERANCE)
      : false;
    const targetPreExposure = positionExposureForSide(contextSide, preSize, targetSide);
    const targetBoundaryExposure = positionExposureForSide(boundarySide, boundarySize, targetSide);
    const reducedTargetExposure = !candidate.reduceOnly
      && targetPreExposure.minus(targetBoundaryExposure).greaterThan(POST_TRADE_POSITION_TOLERANCE);
    const rawPositionChange = candidate.reduceOnly
      ? decimalMax(preSize.minus(boundarySize), new Decimal(0))
      : decimalMax(targetBoundaryExposure.minus(targetPreExposure), new Decimal(0));
    const positionConfirmedSize = decimalMax(Decimal.min(rawPositionChange, requestedSize), new Decimal(0));
    const remainingSize = decimalMax(requestedSize.minus(positionConfirmedSize), new Decimal(0));
    const eventFilledSize = parseOptionalDecimal(eventEvidence?.fillBaseAssetAmount);
    const boundedEventFilledSize = eventFilledSize === null
      ? null
      : decimalMax(Decimal.min(eventFilledSize, requestedSize), new Decimal(0));
    const expectedEventSize = boundedEventFilledSize ?? requestedSize;
    const hasStrongEventMatch = eventEvidence?.correlationStatus === 'event_matched_strong';
    const hasProbableEventMatch = eventEvidence?.correlationStatus === 'event_matched_probable';
    const hasConflictingEvent = eventEvidence?.correlationStatus === 'conflicting_event';

    let confirmation = buildCarryExecutionPostTradeConfirmation({
      candidate,
      status: 'pending_event',
      evidenceBasis: 'signature_only',
      evaluatedAt: snapshot.capturedAt,
      referenceObserved: true,
      referenceObservedAt: observedReference.blockTime,
      context,
      boundary,
      confirmedSize: null,
      remainingSize,
      blockedReason: 'Execution reference is visible, but venue-native Drift fill evidence has not been attributed yet.',
      eventEvidence,
    });

    if (hasConflictingEvent) {
      confirmation = buildCarryExecutionPostTradeConfirmation({
        candidate,
        status: positionConfirmedSize.gt(POST_TRADE_POSITION_TOLERANCE)
          || invalidDirection
          || increasedExposure
          || unsupportedStartingExposure
          || reducedTargetExposure
          ? 'conflicting_event_vs_position'
          : 'conflicting_event',
        evidenceBasis: 'conflicting',
        evaluatedAt: snapshot.capturedAt,
        referenceObserved: true,
        referenceObservedAt: observedReference.blockTime,
        context,
        boundary,
        confirmedSize: positionConfirmedSize.gt(POST_TRADE_POSITION_TOLERANCE) ? positionConfirmedSize : null,
        remainingSize,
        blockedReason: eventEvidence?.blockedReason
          ?? `Drift venue events conflicted with the expected market, side, or ${describeExpectedExecutionSemantics(candidate)}.`,
        eventEvidence,
      });
    } else if (
      invalidDirection
      || increasedExposure
      || unsupportedStartingExposure
      || reducedTargetExposure
    ) {
      confirmation = buildCarryExecutionPostTradeConfirmation({
        candidate,
        status: hasStrongEventMatch || hasProbableEventMatch
          ? 'conflicting_event_vs_position'
          : 'invalid_position_delta',
        evidenceBasis: hasStrongEventMatch || hasProbableEventMatch ? 'conflicting' : 'signature_only',
        evaluatedAt: snapshot.capturedAt,
        referenceObserved: true,
        referenceObservedAt: observedReference.blockTime,
        context,
        boundary,
        confirmedSize: null,
        remainingSize: requestedSize,
        blockedReason: unsupportedStartingExposure
          ? `Pre-trade venue truth showed a ${contextSide} BTC-PERP position, but non-reduce-only confirmation currently only supports flat or ${targetSide} starting exposure.`
          : invalidDirection
            ? candidate.reduceOnly
              ? 'Latest venue truth shows a position-side flip after a reduce-only submission.'
              : `Latest venue truth shows a ${boundarySide} position after a ${targetSide} increase submission.`
            : increasedExposure
              ? 'Latest venue truth shows a larger position than was present before submission.'
              : `Latest venue truth shows less ${targetSide} exposure than was present before submission.`,
        eventEvidence,
      });
    } else if (hasStrongEventMatch) {
      if (positionConfirmedSize.lte(POST_TRADE_POSITION_TOLERANCE)) {
        confirmation = buildCarryExecutionPostTradeConfirmation({
          candidate,
          status: 'pending_position_delta',
          evidenceBasis: 'event_only',
          evaluatedAt: snapshot.capturedAt,
          referenceObserved: true,
          referenceObservedAt: observedReference.blockTime,
          context,
          boundary,
          confirmedSize: null,
          remainingSize: requestedSize,
          blockedReason: `Strong Drift fill evidence was attributed, but the expected ${describeRequestedPositionChange(candidate)} is not yet reflected in venue truth.`,
          eventEvidence,
        });
      } else if (expectedEventSize.minus(positionConfirmedSize).greaterThan(POST_TRADE_POSITION_TOLERANCE)) {
        confirmation = buildCarryExecutionPostTradeConfirmation({
          candidate,
          status: 'confirmed_partial_event_only',
          evidenceBasis: 'event_only',
          evaluatedAt: snapshot.capturedAt,
          referenceObserved: true,
          referenceObservedAt: observedReference.blockTime,
          context,
          boundary,
          confirmedSize: positionConfirmedSize,
          remainingSize,
          blockedReason: `Drift fill evidence reports ${formatOptionalDecimal(expectedEventSize) ?? '0'} filled, but venue truth currently confirms only ${formatOptionalDecimal(positionConfirmedSize) ?? '0'}.`,
          eventEvidence,
        });
      } else if (remainingSize.lte(POST_TRADE_POSITION_TOLERANCE)) {
        confirmation = buildCarryExecutionPostTradeConfirmation({
          candidate,
          status: 'confirmed_full',
          evidenceBasis: 'event_and_position',
          evaluatedAt: snapshot.capturedAt,
          referenceObserved: true,
          referenceObservedAt: observedReference.blockTime,
          context,
          boundary,
          confirmedSize: requestedSize,
          remainingSize: new Decimal(0),
          blockedReason: null,
          eventEvidence,
        });
      } else {
        confirmation = buildCarryExecutionPostTradeConfirmation({
          candidate,
          status: 'confirmed_partial',
          evidenceBasis: 'event_and_position',
          evaluatedAt: snapshot.capturedAt,
          referenceObserved: true,
          referenceObservedAt: observedReference.blockTime,
          context,
          boundary,
          confirmedSize: positionConfirmedSize,
          remainingSize,
          blockedReason: `Only ${formatOptionalDecimal(positionConfirmedSize) ?? '0'} of ${candidate.requestedSize} is jointly confirmed by Drift fill evidence and venue truth for this ${describeRequestedPositionChange(candidate)}.`,
          eventEvidence,
        });
      }
    } else if (positionConfirmedSize.gt(POST_TRADE_POSITION_TOLERANCE)) {
      confirmation = buildCarryExecutionPostTradeConfirmation({
        candidate,
        status: 'confirmed_partial_position_only',
        evidenceBasis: 'position_only',
        evaluatedAt: snapshot.capturedAt,
        referenceObserved: true,
        referenceObservedAt: observedReference.blockTime,
        context,
        boundary,
        confirmedSize: positionConfirmedSize,
        remainingSize,
        blockedReason: hasProbableEventMatch
          ? `Venue truth confirms ${formatOptionalDecimal(positionConfirmedSize) ?? '0'} of ${candidate.requestedSize}, but only probable Drift lifecycle evidence is currently attributed.`
          : `Venue truth confirms ${formatOptionalDecimal(positionConfirmedSize) ?? '0'} of ${candidate.requestedSize}, but venue-native Drift fill evidence is still missing.`,
        eventEvidence,
      });
    } else {
      confirmation = buildCarryExecutionPostTradeConfirmation({
        candidate,
        status: 'pending_event',
        evidenceBasis: 'signature_only',
        evaluatedAt: snapshot.capturedAt,
        referenceObserved: true,
        referenceObservedAt: observedReference.blockTime,
        context,
        boundary,
        confirmedSize: null,
        remainingSize: requestedSize,
        blockedReason: hasProbableEventMatch
          ? 'Execution reference is visible and a probable Drift lifecycle event was observed, but a strong fill match is still required.'
          : 'Execution reference is visible, but venue-native Drift fill evidence has not been attributed yet.',
        eventEvidence,
      });
    }

    evaluations.push({
      candidate,
      confirmation,
      ...deriveConfirmationPatch(candidate, confirmation),
    });
  }

  return evaluations;
}

function evaluatePostTradeConfirmation(
  snapshot: VenueSnapshotView,
  candidates: CarryExecutionConfirmationCandidate[],
  eventEvidenceByStepId: CarryExecutionEventEvidenceMap,
): {
  evidence: ConnectorPostTradeConfirmationEvidenceView;
  evaluations: CarryExecutionPostTradeConfirmationEvaluation[];
} {
  if (candidates.length === 0) {
    return {
      evidence: {
        status: 'not_required',
        summary: 'No recent real execution references currently require post-trade confirmation.',
        evaluatedAt: snapshot.capturedAt,
        recentExecutionCount: 0,
        confirmedFullCount: 0,
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
        latestConfirmedAt: null,
        blockingReasons: [],
        entries: [],
      },
      evaluations: [],
    };
  }

  const groupedCandidates = new Map<string, CarryExecutionConfirmationCandidate[]>();
  for (const candidate of candidates) {
    const groupKey = candidateGroupKey(candidate);
    const group = groupedCandidates.get(groupKey) ?? [];
    group.push(candidate);
    groupedCandidates.set(groupKey, group);
  }

  const evaluations = Array.from(groupedCandidates.values())
    .flatMap((group) => evaluatePostTradeConfirmationGroup(snapshot, group, eventEvidenceByStepId))
    .sort((left, right) => left.candidate.createdAt.localeCompare(right.candidate.createdAt));

  const entries = evaluations.map(({ candidate, confirmation }) => ({
    ...confirmation,
    stepId: candidate.stepId,
    carryExecutionId: candidate.carryExecutionId,
    carryActionId: candidate.carryActionId,
    intentId: candidate.intentId,
    clientOrderId: candidate.clientOrderId,
    executionReference: candidate.executionReference,
    venueId: candidate.venueId,
  }));
  const confirmedEntries = entries.filter((entry) => entry.status === 'confirmed_full');
  const blockingEntries = entries.filter((entry) => entry.status !== 'confirmed_full');
  const blockingReasons = blockingEntries.map((entry) => entry.blockedReason ?? entry.summary);

  return {
    evidence: {
      status: blockingEntries.length === 0 ? 'confirmed' : 'blocked',
      summary: blockingEntries.length === 0
        ? `All ${entries.length} recent real execution reference(s) are fully confirmed by Drift event evidence and venue truth.`
        : `${blockingEntries.length} of ${entries.length} recent real execution reference(s) still require operator review before the connector is considered execution-ready.`,
      evaluatedAt: snapshot.capturedAt,
      recentExecutionCount: entries.length,
      confirmedFullCount: countConfirmationEntries(entries, ['confirmed_full']),
      confirmedPartialCount: countConfirmationEntries(entries, [
        'confirmed_partial',
        'confirmed_partial_event_only',
        'confirmed_partial_position_only',
      ]),
      confirmedPartialEventOnlyCount: countConfirmationEntries(entries, ['confirmed_partial_event_only']),
      confirmedPartialPositionOnlyCount: countConfirmationEntries(entries, ['confirmed_partial_position_only']),
      pendingCount: countConfirmationEntries(entries, ['pending_event', 'pending_position_delta']),
      pendingEventCount: countConfirmationEntries(entries, ['pending_event']),
      pendingPositionDeltaCount: countConfirmationEntries(entries, ['pending_position_delta']),
      conflictingEventCount: countConfirmationEntries(entries, ['conflicting_event']),
      conflictingEventVsPositionCount: countConfirmationEntries(entries, ['conflicting_event_vs_position']),
      missingReferenceCount: countConfirmationEntries(entries, ['missing_reference']),
      invalidCount: countConfirmationEntries(entries, ['invalid_position_delta']),
      insufficientContextCount: countConfirmationEntries(entries, ['insufficient_context']),
      latestConfirmedAt: confirmedEntries.at(-1)?.referenceObservedAt ?? null,
      blockingReasons,
      entries,
    },
    evaluations,
  };
}

function deriveVenueTruthProfile(snapshot: VenueTruthSnapshot): VenueTruthProfile {
  if (
    snapshot.truthCoverage.derivativeAccountState.status !== 'unsupported'
    || snapshot.truthCoverage.derivativePositionState.status !== 'unsupported'
    || snapshot.truthCoverage.derivativeHealthState.status !== 'unsupported'
    || snapshot.truthCoverage.orderState.status !== 'unsupported'
  ) {
    return 'derivative_aware';
  }

  if (snapshot.truthCoverage.capacityState.status === 'available') {
    return 'capacity_only';
  }

  if (
    snapshot.truthCoverage.accountState.status === 'available'
    || snapshot.truthCoverage.balanceState.status === 'available'
    || snapshot.truthCoverage.exposureState.status === 'available'
    || snapshot.truthCoverage.executionReferences.status === 'available'
  ) {
    return 'generic_wallet';
  }

  return 'minimal';
}

function deriveVenueTruthComparisonCoverage(
  capability: VenueCapabilitySnapshot,
  snapshot: VenueTruthSnapshot,
): VenueTruthComparisonCoverageView {
  const connectorDepth = snapshot.sourceMetadata.connectorDepth
    ?? (capability.truthMode === 'simulated'
      ? 'simulation'
      : capability.executionSupport
        ? 'execution_capable'
        : capability.connectorType === 'drift_native_readonly'
          ? 'drift_native_readonly'
          : 'generic_rpc_readonly');
  const isDriftNativeReadonly = connectorDepth === 'drift_native_readonly';

  return {
    executionReferences: {
      status: snapshot.truthCoverage.executionReferences.status,
      reason: snapshot.truthCoverage.executionReferences.reason,
    },
    positionInventory: {
      status: 'unsupported',
      reason: isDriftNativeReadonly && snapshot.truthCoverage.derivativePositionState.status === 'available'
        ? 'Decoded Drift position inventory is visible, but the runtime does not yet persist venue-native Drift position projections for direct comparison.'
        : 'The runtime does not yet maintain a truthful internal position model that can be compared directly against this venue snapshot.',
    },
    healthState: {
      status: 'unsupported',
      reason: isDriftNativeReadonly && snapshot.truthCoverage.derivativeHealthState.status === 'available'
        ? 'Drift health and margin metrics are visible, but the runtime does not yet persist an internal canonical health model for direct comparison.'
        : 'No internal health-state model is available for direct reconciliation against this venue snapshot.',
    },
    orderInventory: {
      status: 'unsupported',
      reason: isDriftNativeReadonly && snapshot.truthCoverage.orderState.status === 'available'
        ? 'Decoded Drift open-order inventory is visible, but the runtime does not yet persist a venue-native open-order model for direct comparison.'
        : 'No venue-native internal open-order inventory is available for direct reconciliation against this venue snapshot.',
    },
    notes: isDriftNativeReadonly
      ? [
        'Decoded Drift account, position, health, and order sections are operator-visible venue truth.',
        'Current reconciliation directly compares internal execution references when they are available.',
      ]
      : connectorDepth === 'generic_rpc_readonly'
        ? [
          'This connector exposes generic read-only truth rather than venue-native Drift decode.',
          'Execution-reference comparison is the only direct real-venue reconciliation path currently available.',
        ]
        : connectorDepth === 'simulation'
          ? [
            'Simulated venue truth is generated internally and is not treated as external reconciliation coverage.',
          ]
          : [
            'This connector depth does not currently expose additional direct reconciliation coverage beyond the recorded truth sections.',
          ],
  };
}

export interface DeterministicRuntimeScenario {
  sleeveId?: string;
  executionMode?: 'dry-run' | 'live';
  liveExecutionEnabled?: boolean;
  carryConfig?: Partial<typeof DEFAULT_CARRY_CONFIG>;
  treasuryPolicy?: Partial<TreasuryPolicy>;
  riskLimits?: Partial<RiskLimits>;
  pipelineConfig?: Partial<PipelineConfig>;
  venues?: SimulatedVenueConfig[];
  carryAdapters?: VenueAdapter[];
  treasuryVenues?: SimulatedTreasuryVenueConfig[];
  truthAdapters?: VenueTruthAdapter[];
  internalDerivativeTargets?: InternalDerivativeTrackedVenueConfig[];
}

export interface SentinelRuntimeOptions {
  connection: DatabaseConnection;
  store: RuntimeStore;
  pipeline: StrategyPipeline;
  portfolioTracker: PortfolioStateTracker;
  riskEngine: RiskEngine;
  riskLimits: RiskLimits;
  adapters: Map<string, VenueAdapter>;
  treasuryAdapters: Map<string, TreasuryVenueAdapter>;
  truthAdapters: Map<string, VenueTruthAdapter>;
  treasuryPolicyEngine: TreasuryPolicyEngine;
  treasuryExecutionPlanner: TreasuryExecutionPlanner;
  treasuryPolicy: TreasuryPolicy;
  executionMode: 'dry-run' | 'live';
  liveExecutionEnabled: boolean;
  sleeveId: string;
  internalDerivativeTargets: Map<string, InternalDerivativeTrackedVenueConfig>;
  logger: Logger;
}

export class SentinelRuntime {
  private started = false;
  private closed = false;
  private readonly healthMonitor: RuntimeHealthMonitor;
  private readonly reconciliationEngine: RuntimeReconciliationEngine;
  private readonly allocatorRegistry = new SentinelSleeveRegistry();
  private readonly allocatorPolicyEngine = new SentinelAllocatorPolicyEngine();
  private readonly rebalancePlanner = new SentinelRebalancePlanner();
  private readonly carryExecutionPlanner = new CarryControlledExecutionPlanner();

  constructor(private readonly options: SentinelRuntimeOptions) {
    this.healthMonitor = new RuntimeHealthMonitor(this.options.store);
    this.reconciliationEngine = new RuntimeReconciliationEngine(
      this.options.store,
      this.options.adapters,
      this.options.truthAdapters,
      this.options.logger,
    );
  }

  static async createDeterministic(
    connectionString: string,
    overrides: DeterministicRuntimeScenario = {},
  ): Promise<SentinelRuntime> {
    const sleeveId = overrides.sleeveId ?? 'carry';
    const executionMode = overrides.executionMode ?? 'dry-run';
    const liveExecutionEnabled = overrides.liveExecutionEnabled ?? false;
    const logger = createLogger('runtime');

    const defaultVenues: SimulatedVenueConfig[] = overrides.venues ?? [
      {
        venueId: 'sim-venue-a',
        venueType: 'cex',
        makerFeePct: '0.0002',
        takerFeePct: '0.0005',
        slippagePct: '0.0001',
        initialBalances: { USDC: '100000' },
        deterministicPrices: { BTC: '100000', ETH: '3000' },
        deterministicFundingRates: { BTC: '0.00006', ETH: '0.00003' },
      },
      {
        venueId: 'sim-venue-b',
        venueType: 'cex',
        makerFeePct: '0.0002',
        takerFeePct: '0.0005',
        slippagePct: '0.0001',
        initialBalances: { USDC: '100000' },
        deterministicPrices: { BTC: '100180', ETH: '3008' },
        deterministicFundingRates: { BTC: '-0.00002', ETH: '0.00001' },
      },
    ];
    const defaultTreasuryVenues: SimulatedTreasuryVenueConfig[] = overrides.treasuryVenues ?? [
      {
        venueId: 'atlas-t0-sim',
        venueName: 'Atlas Treasury T0',
        liquidityTier: 'instant',
        aprBps: 385,
        availableCapacityUsd: '500000',
        currentAllocationUsd: '15000',
        withdrawalAvailableUsd: '15000',
      },
      {
        venueId: 'atlas-t1-sim',
        venueName: 'Atlas Treasury T1',
        liquidityTier: 'same_day',
        aprBps: 465,
        availableCapacityUsd: '750000',
        currentAllocationUsd: '5000',
        withdrawalAvailableUsd: '5000',
      },
    ];

    const adapters = new Map<string, VenueAdapter>();
    for (const venue of defaultVenues) {
      const adapter = new SimulatedVenueAdapter(venue);
      adapters.set(venue.venueId, adapter);
    }
    for (const adapter of overrides.carryAdapters ?? []) {
      adapters.set(adapter.venueId, adapter);
    }
    const treasuryAdapters = new Map<string, TreasuryVenueAdapter>();
    for (const venue of defaultTreasuryVenues) {
      const adapter = new SimulatedTreasuryVenueAdapter(venue);
      treasuryAdapters.set(venue.venueId, adapter);
    }
    const truthAdapters = new Map<string, VenueTruthAdapter>();
    for (const adapter of overrides.truthAdapters ?? []) {
      truthAdapters.set(adapter.venueId, adapter);
    }
    const internalDerivativeTargets = new Map<string, InternalDerivativeTrackedVenueConfig>(
      (overrides.internalDerivativeTargets ?? []).map((target) => [target.venueId, target] as const),
    );
    const driftRpcEndpoint = process.env['DRIFT_RPC_ENDPOINT'];
    // Initialize multi-asset devnet adapter
    if (
      !adapters.has('drift-solana-devnet-carry')
      && process.env['DRIFT_EXECUTION_ENV'] === 'devnet'
    ) {
      const adapter = new DriftMultiAssetCarryAdapter({
        venueId: 'drift-solana-devnet-carry',
        venueName: 'Drift Solana Devnet Carry (Multi-Asset)',
        rpcEndpoint: driftRpcEndpoint ?? '',
        driftEnv: 'devnet',
        supportedAssets: ['BTC', 'ETH', 'SOL'],
        executionEnabled: true,
        ...(process.env['DRIFT_PRIVATE_KEY'] === undefined
          ? {}
          : { privateKey: process.env['DRIFT_PRIVATE_KEY'] }),
        ...(process.env['DRIFT_EXECUTION_SUBACCOUNT_ID'] === undefined
          ? {}
          : { subaccountId: Number.parseInt(process.env['DRIFT_EXECUTION_SUBACCOUNT_ID'], 10) }),
        ...(process.env['DRIFT_EXECUTION_ACCOUNT_LABEL'] === undefined
          ? {}
          : { accountLabel: process.env['DRIFT_EXECUTION_ACCOUNT_LABEL'] }),
      });
      adapters.set(adapter.venueId, adapter);

      if (!internalDerivativeTargets.has(adapter.venueId)) {
        internalDerivativeTargets.set(adapter.venueId, {
          venueId: adapter.venueId,
          venueName: 'Drift Solana Devnet Carry (Multi-Asset)',
          ...(process.env['DRIFT_EXECUTION_SUBACCOUNT_ID'] === undefined
            ? {}
            : { subaccountId: Number.parseInt(process.env['DRIFT_EXECUTION_SUBACCOUNT_ID'], 10) }),
          ...(process.env['DRIFT_EXECUTION_ACCOUNT_LABEL'] === undefined
            ? {}
            : { accountLabel: process.env['DRIFT_EXECUTION_ACCOUNT_LABEL'] }),
        });
      }
    }
    // Initialize multi-asset mainnet adapter
    if (
      !adapters.has('drift-solana-mainnet-carry')
      && process.env['DRIFT_EXECUTION_ENV'] === 'mainnet-beta'
    ) {
      const executionEnabled = process.env['DRIFT_MAINNET_EXECUTION_ENABLED'] === 'true';
      const adapter = new DriftMultiAssetCarryAdapter({
        venueId: 'drift-solana-mainnet-carry',
        venueName: 'Drift Solana Mainnet Carry (Multi-Asset)',
        rpcEndpoint: driftRpcEndpoint ?? '',
        driftEnv: 'mainnet-beta',
        supportedAssets: ['BTC', 'ETH', 'SOL'],
        executionEnabled,
        ...(process.env['DRIFT_PRIVATE_KEY'] === undefined
          ? {}
          : { privateKey: process.env['DRIFT_PRIVATE_KEY'] }),
        ...(process.env['DRIFT_EXECUTION_SUBACCOUNT_ID'] === undefined
          ? {}
          : { subaccountId: Number.parseInt(process.env['DRIFT_EXECUTION_SUBACCOUNT_ID'], 10) }),
        ...(process.env['DRIFT_EXECUTION_ACCOUNT_LABEL'] === undefined
          ? {}
          : { accountLabel: process.env['DRIFT_EXECUTION_ACCOUNT_LABEL'] }),
      });
      adapters.set(adapter.venueId, adapter);

      if (!internalDerivativeTargets.has(adapter.venueId)) {
        internalDerivativeTargets.set(adapter.venueId, {
          venueId: adapter.venueId,
          venueName: 'Drift Solana Mainnet Carry',
          ...(process.env['DRIFT_EXECUTION_SUBACCOUNT_ID'] === undefined
            ? {}
            : { subaccountId: Number.parseInt(process.env['DRIFT_EXECUTION_SUBACCOUNT_ID'], 10) }),
          ...(process.env['DRIFT_EXECUTION_ACCOUNT_LABEL'] === undefined
            ? {}
            : { accountLabel: process.env['DRIFT_EXECUTION_ACCOUNT_LABEL'] }),
        });
      }
    }
    // Initialize Drift spot adapter if enabled
    if (
      !adapters.has('drift-solana-spot')
      && driftRpcEndpoint !== undefined
      && driftRpcEndpoint !== ''
      && process.env['DRIFT_SPOT_EXECUTION_ENABLED'] === 'true'
    ) {
      const spotAdapter = new DriftSpotAdapter({
        venueId: 'drift-solana-spot',
        venueName: 'Drift Solana Spot',
        rpcEndpoint: driftRpcEndpoint,
        driftEnv: process.env['DRIFT_EXECUTION_ENV'] === 'devnet' ? 'devnet' : 'mainnet-beta',
        executionEnabled: true,
        ...(process.env['DRIFT_PRIVATE_KEY'] === undefined
          ? {}
          : { privateKey: process.env['DRIFT_PRIVATE_KEY'] }),
        ...(process.env['DRIFT_EXECUTION_SUBACCOUNT_ID'] === undefined
          ? {}
          : { subaccountId: Number.parseInt(process.env['DRIFT_EXECUTION_SUBACCOUNT_ID'], 10) }),
        ...(process.env['DRIFT_EXECUTION_ACCOUNT_LABEL'] === undefined
          ? {}
          : { accountLabel: process.env['DRIFT_EXECUTION_ACCOUNT_LABEL'] }),
      });
      adapters.set(spotAdapter.venueId, spotAdapter);
    }
    if (
      !truthAdapters.has('drift-solana-readonly')
      && driftRpcEndpoint !== undefined
      && driftRpcEndpoint !== ''
    ) {
      const adapter = new DriftReadonlyTruthAdapter({
        venueId: 'drift-solana-readonly',
        venueName: 'Drift Solana Read-Only',
        rpcEndpoint: driftRpcEndpoint,
        ...(process.env['DRIFT_READONLY_ENV'] === undefined
          ? {}
          : { driftEnv: process.env['DRIFT_READONLY_ENV'] as 'devnet' | 'mainnet-beta' }),
        ...(process.env['DRIFT_READONLY_ACCOUNT_ADDRESS'] === undefined
          ? {}
          : { accountAddress: process.env['DRIFT_READONLY_ACCOUNT_ADDRESS'] }),
        ...(process.env['DRIFT_READONLY_AUTHORITY_ADDRESS'] === undefined
          ? {}
          : { authorityAddress: process.env['DRIFT_READONLY_AUTHORITY_ADDRESS'] }),
        ...(process.env['DRIFT_READONLY_SUBACCOUNT_ID'] === undefined
          ? {}
          : { subaccountId: Number.parseInt(process.env['DRIFT_READONLY_SUBACCOUNT_ID'], 10) }),
        ...(process.env['DRIFT_READONLY_ACCOUNT_LABEL'] === undefined
          ? {}
          : { accountLabel: process.env['DRIFT_READONLY_ACCOUNT_LABEL'] }),
      });
      truthAdapters.set(adapter.venueId, adapter);
    }
    if (
      !internalDerivativeTargets.has('drift-solana-readonly')
      && (
        (process.env['DRIFT_READONLY_ACCOUNT_ADDRESS'] !== undefined
          && process.env['DRIFT_READONLY_ACCOUNT_ADDRESS'] !== '')
        || (process.env['DRIFT_READONLY_AUTHORITY_ADDRESS'] !== undefined
          && process.env['DRIFT_READONLY_AUTHORITY_ADDRESS'] !== '')
      )
    ) {
      internalDerivativeTargets.set('drift-solana-readonly', {
        venueId: 'drift-solana-readonly',
        venueName: 'Drift Solana Read-Only',
        ...(process.env['DRIFT_READONLY_ACCOUNT_ADDRESS'] === undefined
          ? {}
          : { accountAddress: process.env['DRIFT_READONLY_ACCOUNT_ADDRESS'] }),
        ...(process.env['DRIFT_READONLY_AUTHORITY_ADDRESS'] === undefined
          ? {}
          : { authorityAddress: process.env['DRIFT_READONLY_AUTHORITY_ADDRESS'] }),
        ...(process.env['DRIFT_READONLY_SUBACCOUNT_ID'] === undefined
          ? {}
          : { subaccountId: Number.parseInt(process.env['DRIFT_READONLY_SUBACCOUNT_ID'], 10) }),
        ...(process.env['DRIFT_READONLY_ACCOUNT_LABEL'] === undefined
          ? {}
          : { accountLabel: process.env['DRIFT_READONLY_ACCOUNT_LABEL'] }),
      });
    }

    const connection = await createDatabaseConnection(connectionString);
    await applyMigrations(connection);
    const auditWriter = new DatabaseAuditWriter(connection.db);
    const store = new RuntimeStore(connection.db, auditWriter);

    const effectiveRiskLimits = {
      ...DEFAULT_RISK_LIMITS,
      maxSingleVenuePct: 100,
      maxSingleAssetPct: 100,
      ...(overrides.riskLimits ?? {}),
    };

    const riskEngine = new RiskEngine(
      effectiveRiskLimits,
      new CircuitBreakerRegistry(effectiveRiskLimits),
    );

    const carryConfig = {
      ...DEFAULT_CARRY_CONFIG,
      sleeveId,
      approvedVenues: overrides.carryConfig?.approvedVenues ?? defaultVenues.map((venue) => venue.venueId),
      approvedAssets: ['BTC'],
      minAnnualYieldPct: DEFAULT_BUILD_A_BEAR_STRATEGY_POLICY.minimumTargetApyPct,
      minFundingRateAnnualized: '4.0',
      minCrossVenueSpreadPct: '0.15',
      ...(overrides.carryConfig ?? {}),
    };

    const pipeline = new StrategyPipeline(
      {
        mode: executionMode,
        allowLiveExecution: liveExecutionEnabled,
        sleeveId,
        scanIntervalMs: 0,
        maxIterations: 1,
        ...(overrides.pipelineConfig ?? {}),
      },
      adapters,
      riskEngine,
      carryConfig,
      logger,
      auditWriter,
      registry,
    );

    const portfolioTracker = new PortfolioStateTracker(adapters, logger, sleeveId);
    const treasuryPolicy = {
      ...DEFAULT_TREASURY_POLICY,
      ...(overrides.treasuryPolicy ?? {}),
      eligibleVenues: overrides.treasuryPolicy?.eligibleVenues ?? Array.from(treasuryAdapters.keys()),
    } satisfies TreasuryPolicy;

    await store.ensureRuntimeState(
      executionMode,
      liveExecutionEnabled,
      effectiveRiskLimits as unknown as Record<string, unknown>,
    );

    const runtime = new SentinelRuntime({
      connection,
      store,
      pipeline,
      portfolioTracker,
      riskEngine,
      riskLimits: effectiveRiskLimits,
      adapters,
      treasuryAdapters,
      truthAdapters,
      treasuryPolicyEngine: new TreasuryPolicyEngine(),
      treasuryExecutionPlanner: new TreasuryExecutionPlanner(),
      treasuryPolicy,
      executionMode,
      liveExecutionEnabled,
      sleeveId,
      internalDerivativeTargets,
      logger,
    });

    await runtime.start('runtime-bootstrap');
    return runtime;
  }

  get riskLimits(): RiskLimits {
    return this.options.riskLimits;
  }

  async start(actorId = 'runtime-bootstrap'): Promise<RuntimeStatusView> {
    if (this.closed) {
      throw new Error('SentinelRuntime.start: runtime has already been closed');
    }

    if (this.started) {
      return this.getRuntimeStatus();
    }

    const now = new Date();
    await this.options.store.updateRuntimeStatus({
      lifecycleState: 'starting',
      startedAt: now,
      stoppedAt: null,
      lastError: null,
      lastUpdatedBy: actorId,
    });

    for (const adapter of this.options.adapters.values()) {
      if (!adapter.isConnected()) {
        await adapter.connect();
      }
    }
    for (const adapter of this.options.treasuryAdapters.values()) {
      if (!adapter.isConnected()) {
        await adapter.connect();
      }
    }
    for (const adapter of this.options.truthAdapters.values()) {
      if (!adapter.isConnected()) {
        await adapter.connect();
      }
    }

    await this.rebuildProjections(actorId, false);

    const currentStatus = await this.options.store.getRuntimeStatus();
    const lifecycleState: RuntimeLifecycleState = currentStatus.halted ? 'paused' : 'ready';
    await this.options.store.updateRuntimeStatus({
      lifecycleState,
      readyAt: new Date(),
      lastUpdatedBy: actorId,
    });

    await this.options.store.auditWriter.write({
      eventId: createId(),
      eventType: 'runtime.started',
      occurredAt: new Date().toISOString(),
      actorType: 'system',
      actorId,
      sleeveId: this.options.sleeveId,
      data: { lifecycleState },
    });

    this.started = true;
    return this.getRuntimeStatus();
  }

  async runCycle(triggerSource = 'api-dev-trigger'): Promise<RuntimeCycleOutcome> {
    if (!this.started) {
      await this.start('runtime-autostart');
    }

    const runtimeStatus = await this.options.store.getRuntimeStatus();
    if (runtimeStatus.halted || runtimeStatus.lifecycleState === 'paused') {
      throw new Error(`Runtime is paused: ${runtimeStatus.reason ?? 'no reason provided'}`);
    }
    if (runtimeStatus.lifecycleState === 'stopped') {
      throw new Error('Runtime is stopped and cannot process cycles');
    }

    const runId = createId();
    const cycleStartedAt = new Date();
    await this.options.store.createStrategyRun({
      runId,
      sleeveId: this.options.sleeveId,
      executionMode: this.options.executionMode,
      triggerSource,
      metadata: {
        liveExecutionEnabled: this.options.liveExecutionEnabled,
      },
    });

    await this.options.store.auditWriter.write({
      eventId: createId(),
      eventType: 'runtime.cycle_started',
      occurredAt: new Date().toISOString(),
      actorType: 'system',
      actorId: 'sentinel-runtime',
      sleeveId: this.options.sleeveId,
      data: { runId, triggerSource },
    });

    await this.options.store.updateRuntimeStatus({
      lifecycleState: 'ready',
      projectionStatus: 'stale',
      lastRunId: runId,
      lastRunStatus: 'running',
      lastCycleStartedAt: cycleStartedAt,
      lastUpdatedBy: 'sentinel-runtime',
    });

    try {
      const portfolioState = await this.options.portfolioTracker.refresh();
      const planned = await this.options.pipeline.planCycle(portfolioState);
      const approvedOpportunityIds = new Set(
        planned.opportunitiesApproved.map((opportunity) => buildOpportunityId(opportunity)),
      );

      for (const opportunity of planned.opportunitiesDetected) {
        const opportunityId = buildOpportunityId(opportunity);
        await this.options.store.persistOpportunity({
          opportunityId,
          runId,
          sleeveId: this.options.sleeveId,
          asset: opportunity.asset,
          opportunityType: opportunity.type,
          expectedAnnualYieldPct: opportunity.expectedAnnualYieldPct,
          netYieldPct: opportunity.netYieldPct,
          confidenceScore: String(opportunity.confidenceScore),
          detectedAt: opportunity.detectedAt.toISOString(),
          expiresAt: opportunity.expiresAt.toISOString(),
          approved: approvedOpportunityIds.has(opportunityId),
          payload: opportunity as unknown as Record<string, unknown>,
        });
      }

      for (const riskResult of planned.riskResults) {
        const intent = {
          ...riskResult.intent,
          metadata: {
            ...riskResult.intent.metadata,
            runId,
            executionMode: this.options.executionMode,
            sleeveId: this.options.sleeveId,
          },
        };

        await this.options.store.persistIntent({
          runId,
          intent,
          approved: riskResult.approved,
          riskAssessment: riskResult.assessment,
          executionDisposition: riskResult.approved ? 'paper-executed' : 'risk-rejected',
        });

        if (!riskResult.approved) {
          for (const check of riskResult.assessment.results.filter((result) => result.status !== 'passed')) {
            await this.options.store.persistRiskBreach({
              id: createId(),
              breachType: check.checkName,
              severity: severityForRiskStatus(check.status),
              description: check.message,
              triggeredAt: riskResult.assessment.timestamp.toISOString(),
              resolvedAt: null,
              details: {
                intentId: intent.intentId,
                opportunityId: intent.opportunityId,
                limit: check.limit,
                actual: check.actual,
              },
            });
          }
        }
      }

      const riskSummary = this.options.riskEngine.getRiskSummary(portfolioState);
      await this.options.store.persistRiskSnapshot({
        runId,
        sleeveId: this.options.sleeveId,
        summary: riskSummary,
        approvedIntentCount: planned.approvedIntents.length,
        rejectedIntentCount: planned.rejectedIntents.length,
        capturedAt: new Date(),
      });

      let intentsExecuted = 0;

      for (const approvedIntent of planned.approvedIntents) {
        const intent = {
          ...approvedIntent,
          metadata: {
            ...approvedIntent.metadata,
            runId,
            executionMode: this.options.executionMode,
            sleeveId: this.options.sleeveId,
          },
        };
        const adapter = this.options.adapters.get(intent.venueId);
        if (adapter === undefined) {
          continue;
        }

        const orderStore = new RuntimeOrderStore(this.options.store.db);
        const executor = new OrderExecutor(
          adapter,
          orderStore,
          {
            maxRetries: 0,
            retryDelayMs: 0,
            orderTimeoutMs: 1000,
          },
          this.options.logger,
          this.options.store.auditWriter,
        );

        const orderRecord = await executor.submitIntent(intent);
        await this.persistExecutionRecord(runId, orderRecord);
        intentsExecuted += 1;
      }

      const refreshedPortfolio = await this.options.portfolioTracker.refresh();
      const treasurySummary = await this.runTreasuryEvaluation({
        actorId: 'sentinel-runtime',
        sourceRunId: runId,
        portfolioState: refreshedPortfolio,
      });
      await this.runAllocatorEvaluation({
        trigger: 'post_cycle',
        actorId: 'sentinel-runtime',
        sourceRunId: runId,
        carryOpportunities: planned.opportunitiesApproved.map((opportunity) => ({
          opportunityId: buildOpportunityId(opportunity),
          runId,
          sleeveId: this.options.sleeveId,
          asset: opportunity.asset,
          opportunityType: opportunity.type,
          expectedAnnualYieldPct: opportunity.expectedAnnualYieldPct,
          netYieldPct: opportunity.netYieldPct,
          confidenceScore: String(opportunity.confidenceScore),
          detectedAt: opportunity.detectedAt.toISOString(),
          expiresAt: opportunity.expiresAt.toISOString(),
          approved: true,
          payload: opportunity as unknown as Record<string, unknown>,
        })),
        treasurySummary,
        portfolioSummaryOverride: {
          totalNav: refreshedPortfolio.totalNav,
          grossExposure: refreshedPortfolio.grossExposure,
          netExposure: refreshedPortfolio.netExposure,
          liquidityReserve: refreshedPortfolio.liquidityReserve,
          openPositionCount: refreshedPortfolio.openPositionCount,
          dailyPnl: '0',
          cumulativePnl: '0',
          sleeves: [],
          venueExposures: Object.fromEntries(refreshedPortfolio.venueExposures.entries()),
          assetExposures: Object.fromEntries(refreshedPortfolio.assetExposures.entries()),
          updatedAt: new Date().toISOString(),
        },
      });
      const finalRiskSummary = this.options.riskEngine.getRiskSummary(refreshedPortfolio);
      const cumulativePnl = await this.computeCumulativePnl();
      const dailyPnl = cumulativePnl;

      await this.options.store.persistPortfolioSnapshot({
        sourceRunId: runId,
        snapshotAt: new Date(),
        portfolioState: refreshedPortfolio,
        riskSummary: finalRiskSummary,
        dailyPnl,
        cumulativePnl,
      });

      const latestPositions = await this.collectPositions();
      await this.options.store.syncPositions(latestPositions);
      await this.refreshInternalDerivativeState({
        sourceComponent: 'sentinel-runtime',
        sourceRunId: runId,
        sourceReference: runId,
      });
      await this.refreshVenueTruthInventory();

      await this.options.store.completeStrategyRun({
        runId,
        status: 'completed',
        opportunitiesDetected: planned.opportunitiesDetected.length,
        opportunitiesApproved: planned.opportunitiesApproved.length,
        intentsGenerated: planned.intentsGenerated.length,
        intentsApproved: planned.approvedIntents.length,
        intentsRejected: planned.rejectedIntents.length,
        intentsExecuted,
      });

      await this.options.store.updateRuntimeStatus({
        lastRunId: runId,
        lastRunStatus: 'completed',
        lastSuccessfulRunId: runId,
        lastCycleCompletedAt: new Date(),
        lastProjectionSourceRunId: runId,
        projectionStatus: 'fresh',
        lastError: null,
        reason: null,
        lastUpdatedBy: 'sentinel-runtime',
      });

      await this.options.store.auditWriter.write({
        eventId: createId(),
        eventType: 'runtime.cycle_completed',
        occurredAt: new Date().toISOString(),
        actorType: 'system',
        actorId: 'sentinel-runtime',
        sleeveId: this.options.sleeveId,
        data: {
          runId,
          opportunitiesDetected: planned.opportunitiesDetected.length,
          opportunitiesApproved: planned.opportunitiesApproved.length,
          intentsGenerated: planned.intentsGenerated.length,
          intentsApproved: planned.approvedIntents.length,
          intentsRejected: planned.rejectedIntents.length,
          intentsExecuted,
        },
      });

      await this.healthMonitor.resolveRuntimeFailure('sentinel-runtime', runId);
      await this.runReconciliation({
        trigger: 'post_cycle',
        sourceComponent: 'sentinel-runtime',
        triggerReference: runId,
      });

      return {
        runId,
        opportunitiesDetected: planned.opportunitiesDetected.length,
        opportunitiesApproved: planned.opportunitiesApproved.length,
        intentsGenerated: planned.intentsGenerated.length,
        intentsApproved: planned.approvedIntents.length,
        intentsRejected: planned.rejectedIntents.length,
        intentsExecuted,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      await this.options.store.completeStrategyRun({
        runId,
        status: 'failed',
        opportunitiesDetected: 0,
        opportunitiesApproved: 0,
        intentsGenerated: 0,
        intentsApproved: 0,
        intentsRejected: 0,
        intentsExecuted: 0,
        errorMessage: message,
      });

      await this.options.store.updateRuntimeStatus({
        lastRunId: runId,
        lastRunStatus: 'failed',
        lastCycleCompletedAt: new Date(),
        lifecycleState: 'degraded',
        projectionStatus: 'stale',
        lastError: message,
        reason: message,
        lastUpdatedBy: 'sentinel-runtime',
      });

      await this.options.store.auditWriter.write({
        eventId: createId(),
        eventType: 'runtime.cycle_failed',
        occurredAt: new Date().toISOString(),
        actorType: 'system',
        actorId: 'sentinel-runtime',
        sleeveId: this.options.sleeveId,
        data: { runId, error: message },
      });

      await this.healthMonitor.recordRuntimeFailure('sentinel-runtime', runId, message);

      throw error;
    }
  }

  async getPortfolioSummary(): Promise<PortfolioSummaryView | null> {
    return this.options.store.getPortfolioSummary();
  }

  async listPortfolioSnapshots(limit = 20): Promise<PortfolioSnapshotView[]> {
    return this.options.store.listPortfolioSnapshots(limit);
  }

  async getPnlSummary(): Promise<PnlSummaryView> {
    return this.options.store.getPnlSummary();
  }

  async getRiskSummary(): Promise<RiskSummaryView | null> {
    return this.options.store.getRiskSummary();
  }

  async listRiskBreaches(limit = 50): Promise<RiskBreachView[]> {
    return this.options.store.listRiskBreaches(limit);
  }

  async listOrders(limit = 100): Promise<OrderView[]> {
    return this.options.store.listOrders(limit);
  }

  async getOrder(clientOrderId: string): Promise<OrderView | null> {
    return this.options.store.getOrder(clientOrderId);
  }

  async listPositions(limit = 100): Promise<PositionView[]> {
    return this.options.store.listPositions(limit);
  }

  async getPosition(id: string): Promise<PositionView | null> {
    return this.options.store.getPosition(id);
  }

  async listOpportunities(limit = 100): Promise<OpportunityView[]> {
    return this.options.store.listOpportunities(limit);
  }

  async listRecentEvents(limit = 100): Promise<AuditEventView[]> {
    return this.options.store.listRecentEvents(limit);
  }

  async getRuntimeStatus(): Promise<RuntimeStatusView> {
    return this.options.store.getRuntimeStatus();
  }

  async getAllocatorSummary(): Promise<AllocatorSummaryView | null> {
    return this.options.store.getAllocatorSummary();
  }

  async getTreasurySummary(): Promise<TreasurySummaryView | null> {
    return this.options.store.getTreasurySummary();
  }

  async listCarryRecommendations(limit = 50): Promise<CarryActionView[]> {
    return this.options.store.listCarryRecommendations(limit);
  }

  async listCarryActions(limit = 50): Promise<CarryActionView[]> {
    return this.options.store.listCarryActions(limit);
  }

  async getCarryStrategyProfile(): Promise<CarryStrategyProfileView> {
    return this.options.store.getCarryStrategyProfile();
  }

  async getCarryAction(actionId: string): Promise<CarryActionDetailView | null> {
    return this.options.store.getCarryAction(actionId);
  }

  async listCarryExecutions(limit = 50): Promise<CarryExecutionView[]> {
    return this.options.store.listCarryExecutions(limit);
  }

  async listCarryExecutionsForAction(actionId: string): Promise<CarryExecutionView[]> {
    return this.options.store.listCarryExecutionsForAction(actionId);
  }

  async getCarryExecution(executionId: string): Promise<CarryExecutionDetailView | null> {
    return this.options.store.getCarryExecution(executionId);
  }

  async getRebalanceExecutionGraph(proposalId: string): Promise<RebalanceExecutionGraphView | null> {
    return this.options.store.getRebalanceExecutionGraph(proposalId);
  }

  async getRebalanceTimeline(proposalId: string): Promise<RebalanceExecutionTimelineEntry[]> {
    return this.options.store.getRebalanceTimeline(proposalId);
  }

  async listCarryVenues(limit = 50): Promise<CarryVenueView[]> {
    return this.options.store.listCarryVenues(limit);
  }

  async listVenues(limit = 100): Promise<VenueInventoryItemView[]> {
    return this.options.store.listVenues(limit);
  }

  async getVenue(venueId: string): Promise<VenueDetailView | null> {
    return this.options.store.getVenue(venueId);
  }

  async listVenueSnapshots(venueId: string, limit = 20): Promise<VenueSnapshotView[]> {
    return this.options.store.listVenueSnapshots(venueId, limit);
  }

  async getVenueInternalState(venueId: string): Promise<InternalDerivativeSnapshotView | null> {
    return this.options.store.getVenueInternalState(venueId);
  }

  async getVenueComparisonSummary(
    venueId: string,
  ): Promise<VenueDerivativeComparisonSummaryView | null> {
    return this.options.store.getVenueComparisonSummary(venueId);
  }

  async getVenueComparisonDetail(venueId: string): Promise<VenueDerivativeComparisonDetailView | null> {
    return this.options.store.getVenueComparisonDetail(venueId);
  }

  async getVenueSummary(): Promise<VenueInventorySummaryView> {
    return this.options.store.getVenueSummary();
  }

  async getVenueTruthSummary(): Promise<VenueTruthSummaryView> {
    return this.options.store.getVenueTruthSummary();
  }

  async listVenueReadiness(limit = 100): Promise<VenueInventoryItemView[]> {
    return this.options.store.listVenueReadiness(limit);
  }

  private async collectCarryVenueViews(
    strategyRunId: string | null,
  ): Promise<Array<{
    strategyRunId: string | null;
    venueId: string;
    venueMode: 'simulated' | 'live';
    executionSupported: boolean;
    supportsIncreaseExposure: boolean;
    supportsReduceExposure: boolean;
    readOnly: boolean;
    approvedForLiveUse: boolean;
    sensitiveExecutionEligible: boolean;
    promotionStatus: 'not_requested' | 'pending_review' | 'approved' | 'rejected' | 'suspended';
    promotionBlockedReasons: string[];
    healthy: boolean;
    onboardingState: 'simulated' | 'read_only' | 'ready_for_review' | 'approved_for_live';
    missingPrerequisites: string[];
    metadata: Record<string, unknown>;
    updatedAt: string;
    createdAt: string;
  }>> {
    const now = new Date().toISOString();
    const promotionByVenueId = new Map(
      (await this.options.store.listVenues(500)).map((venue) => [venue.venueId, venue.promotion] as const),
    );
    const views = [];

    for (const adapter of this.options.adapters.values()) {
      const capabilities = typeof adapter.getCarryCapabilities === 'function'
        ? await adapter.getCarryCapabilities()
        : {
          venueId: adapter.venueId,
          venueMode: 'simulated' as const,
          executionSupported: false,
          supportsIncreaseExposure: false,
          supportsReduceExposure: false,
          readOnly: true,
          approvedForLiveUse: false,
          healthy: true,
          onboardingState: 'read_only' as const,
          missingPrerequisites: ['carry_controlled_execution_not_implemented'],
          metadata: {
            venueType: adapter.venueType,
          },
        };
      const promotion = promotionByVenueId.get(capabilities.venueId);

      views.push({
        strategyRunId,
        venueId: capabilities.venueId,
        venueMode: capabilities.venueMode,
        executionSupported: capabilities.executionSupported,
        supportsIncreaseExposure: capabilities.supportsIncreaseExposure,
        supportsReduceExposure: capabilities.supportsReduceExposure,
        readOnly: capabilities.readOnly,
        approvedForLiveUse: promotion?.approvedForLiveUse ?? false,
        sensitiveExecutionEligible: promotion?.sensitiveExecutionEligible ?? false,
        promotionStatus: promotion?.promotionStatus ?? 'not_requested',
        promotionBlockedReasons: promotion?.blockers ?? capabilities.missingPrerequisites,
        healthy: capabilities.healthy,
        onboardingState: capabilities.onboardingState,
        missingPrerequisites: capabilities.missingPrerequisites,
        metadata: {
          ...capabilities.metadata,
          reportedApprovedForLiveUse: capabilities.approvedForLiveUse,
          connectorPromotionStatus: promotion?.promotionStatus ?? 'not_requested',
        },
        updatedAt: now,
        createdAt: now,
      });
    }

    return views;
  }

  private async refreshVenueTruthInventory(venueIds?: readonly string[]): Promise<void> {
    const snapshots = await this.collectVenueTruthSnapshots(venueIds);
    await this.options.store.persistVenueConnectorSnapshots({ snapshots });
  }

  private trackedInternalDerivativeVenues(): InternalDerivativeTrackedVenueConfig[] {
    const tracked = new Map<string, InternalDerivativeTrackedVenueConfig>(
      Array.from(this.options.internalDerivativeTargets.entries()),
    );

    for (const adapter of this.options.truthAdapters.values()) {
      if (!tracked.has(adapter.venueId)) {
        tracked.set(adapter.venueId, {
          venueId: adapter.venueId,
          venueName: adapter.venueName,
        });
      }
    }

    return Array.from(tracked.values());
  }

  private async refreshInternalDerivativeState(input: {
    sourceComponent: string;
    sourceRunId?: string | null;
    sourceReference?: string | null;
  }): Promise<void> {
    const trackedVenues = this.trackedInternalDerivativeVenues();
    if (trackedVenues.length === 0) {
      return;
    }

    const capturedAt = new Date().toISOString();
    const [fillHistory, portfolioSummary, riskSummary] = await Promise.all([
      this.options.store.listFillHistory(),
      this.options.store.getPortfolioSummary(),
      this.options.store.getRiskSummary(),
    ]);
    const snapshots = await Promise.all(
      trackedVenues.map(async (venue) => {
        const orders = await this.options.store.listOrdersByVenue(venue.venueId);
        return buildInternalDerivativeSnapshot({
          venue,
          orders,
          fills: fillHistory.filter((fill) => fill.venueId === venue.venueId),
          portfolioSummary,
          riskSummary,
          capturedAt,
          sourceComponent: input.sourceComponent,
          sourceRunId: input.sourceRunId ?? null,
          sourceReference: input.sourceReference ?? null,
        });
      }),
    );

    await this.options.store.persistInternalDerivativeSnapshots({ snapshots });
  }

  private async collectVenueTruthSnapshots(venueIds?: readonly string[]): Promise<VenueSnapshotView[]> {
    const scopedVenueIds = venueIds === undefined ? null : new Set(venueIds);
    const snapshots: VenueSnapshotView[] = [];

    for (const adapter of this.options.adapters.values()) {
      if (scopedVenueIds !== null && !scopedVenueIds.has(adapter.venueId)) {
        continue;
      }
      const capability = await this.collectVenueCapabilityForCarryAdapter(adapter);
      const snapshot = await this.collectVenueTruthForCarryAdapter(adapter);
      snapshots.push(await this.enrichVenueSnapshotWithExecutionConfirmation(
        this.composeVenueSnapshot(capability, snapshot),
      ));
    }

    for (const adapter of this.options.treasuryAdapters.values()) {
      if (scopedVenueIds !== null && !scopedVenueIds.has(adapter.venueId)) {
        continue;
      }
      const capability = await this.collectVenueCapabilityForTreasuryAdapter(adapter);
      const snapshot = await this.collectVenueTruthForTreasuryAdapter(adapter);
      snapshots.push(this.composeVenueSnapshot(capability, snapshot));
    }

    for (const adapter of this.options.truthAdapters.values()) {
      if (scopedVenueIds !== null && !scopedVenueIds.has(adapter.venueId)) {
        continue;
      }
      const [capability, snapshot] = await Promise.all([
        adapter.getVenueCapabilitySnapshot(),
        adapter.getVenueTruthSnapshot(),
      ]);
      snapshots.push(this.composeVenueSnapshot(capability, snapshot));
    }

    return snapshots;
  }

  private composeVenueSnapshot(
    capability: VenueCapabilitySnapshot,
    snapshot: VenueTruthSnapshot,
  ): VenueSnapshotView {
    return {
      id: createId(),
      venueId: capability.venueId,
      venueName: capability.venueName,
      connectorType: capability.connectorType,
      sleeveApplicability: capability.sleeveApplicability,
      truthMode: capability.truthMode,
      readOnlySupport: capability.readOnlySupport,
      executionSupport: capability.executionSupport,
      approvedForLiveUse: capability.approvedForLiveUse,
      onboardingState: capability.onboardingState,
      missingPrerequisites: capability.missingPrerequisites,
      authRequirementsSummary: capability.authRequirementsSummary,
      healthy: snapshot.healthy && capability.healthy,
      healthState: snapshot.healthState,
      degradedReason: snapshot.errorMessage ?? capability.degradedReason,
      truthProfile: deriveVenueTruthProfile(snapshot),
      snapshotType: snapshot.snapshotType,
      snapshotSuccessful: snapshot.snapshotSuccessful,
      snapshotSummary: snapshot.summary,
      snapshotPayload: snapshot.payload,
      errorMessage: snapshot.errorMessage,
      capturedAt: snapshot.capturedAt,
      snapshotCompleteness: snapshot.snapshotCompleteness,
      truthCoverage: snapshot.truthCoverage,
      comparisonCoverage: deriveVenueTruthComparisonCoverage(capability, snapshot),
      sourceMetadata: snapshot.sourceMetadata,
      accountState: snapshot.accountState,
      balanceState: snapshot.balanceState,
      capacityState: snapshot.capacityState,
      exposureState: snapshot.exposureState,
      derivativeAccountState: snapshot.derivativeAccountState,
      derivativePositionState: snapshot.derivativePositionState,
      derivativeHealthState: snapshot.derivativeHealthState,
      orderState: snapshot.orderState,
      executionReferenceState: snapshot.executionReferenceState,
      executionConfirmationState: null,
      metadata: {
        ...capability.metadata,
        ...snapshot.metadata,
      },
    };
  }

  private buildExecutionEventEvidenceRequests(
    candidates: CarryExecutionConfirmationCandidate[],
  ): VenueExecutionEventEvidenceRequest[] {
    return candidates.map((candidate) => ({
      executionReference: candidate.executionReference,
      clientOrderId: candidate.clientOrderId,
      asset: candidate.asset,
      side: candidate.side,
      requestedSize: candidate.requestedSize,
      reduceOnly: candidate.reduceOnly,
      createdAt: candidate.createdAt,
      updatedAt: candidate.updatedAt,
      metadata: candidate.metadata,
    }));
  }

  private async loadExecutionEventEvidence(
    snapshot: VenueSnapshotView,
    candidates: CarryExecutionConfirmationCandidate[],
  ): Promise<CarryExecutionEventEvidenceMap> {
    if (candidates.length === 0) {
      return new Map();
    }

    const requests = this.buildExecutionEventEvidenceRequests(candidates);
    const adapter = this.options.adapters.get(snapshot.venueId);
    if (adapter === undefined || typeof adapter.getExecutionEventEvidence !== 'function') {
      return new Map(
        candidates.map((candidate, index) => [
          candidate.stepId,
          buildUnavailableExecutionEventEvidence(
            requests[index] ?? {
              executionReference: candidate.executionReference,
              clientOrderId: candidate.clientOrderId,
              asset: candidate.asset,
              side: candidate.side,
              requestedSize: candidate.requestedSize,
              reduceOnly: candidate.reduceOnly,
              createdAt: candidate.createdAt,
              updatedAt: candidate.updatedAt,
              metadata: candidate.metadata,
            },
            'Connector does not expose venue-native execution event evidence.',
          ),
        ] as const),
      );
    }

    try {
      const evidence = await adapter.getExecutionEventEvidence(requests);
      return new Map(
        candidates.map((candidate, index) => [
          candidate.stepId,
          evidence[index] ?? buildUnavailableExecutionEventEvidence(
            requests[index] ?? {
              executionReference: candidate.executionReference,
              clientOrderId: candidate.clientOrderId,
              asset: candidate.asset,
              side: candidate.side,
              requestedSize: candidate.requestedSize,
              reduceOnly: candidate.reduceOnly,
              createdAt: candidate.createdAt,
              updatedAt: candidate.updatedAt,
              metadata: candidate.metadata,
            },
            'Adapter returned no event evidence for this execution attempt.',
          ),
        ] as const),
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.options.logger.warn('Failed to load execution event evidence', {
        venueId: snapshot.venueId,
        error: message,
      });
      return new Map(
        candidates.map((candidate, index) => [
          candidate.stepId,
          buildUnavailableExecutionEventEvidence(
            requests[index] ?? {
              executionReference: candidate.executionReference,
              clientOrderId: candidate.clientOrderId,
              asset: candidate.asset,
              side: candidate.side,
              requestedSize: candidate.requestedSize,
              reduceOnly: candidate.reduceOnly,
              createdAt: candidate.createdAt,
              updatedAt: candidate.updatedAt,
              metadata: candidate.metadata,
            },
            message,
          ),
        ] as const),
      );
    }
  }

  private async persistExecutionEventEvidence(
    candidate: CarryExecutionConfirmationCandidate,
    confirmation: CarryExecutionPostTradeConfirmationView,
    occurredAtFallback: string,
  ): Promise<void> {
    const strategyRunId = candidate.strategyRunId;
    const eventEvidence = confirmation.eventEvidence;

    if (strategyRunId === null || eventEvidence === null || eventEvidence.rawEvents.length === 0) {
      return;
    }

    for (const rawEvent of eventEvidence.rawEvents) {
      const occurredAt = rawEvent.timestamp === null ? new Date(occurredAtFallback) : new Date(rawEvent.timestamp);
      await this.options.store.persistExecutionEvent({
        eventId: `carry-step:${candidate.stepId}:${rawEvent.eventId}`,
        runId: strategyRunId,
        intentId: candidate.intentId,
        clientOrderId: candidate.clientOrderId,
        venueOrderId: candidate.executionReference,
        eventType: `venue_execution.${rawEvent.venueEventType}`,
        status: eventEvidence.correlationStatus,
        payload: {
          source: 'venue_native_execution_event_ingestion',
          venueId: candidate.venueId,
          carryExecutionId: candidate.carryExecutionId,
          carryActionId: candidate.carryActionId,
          stepId: candidate.stepId,
          executionReference: candidate.executionReference,
          correlationStatus: eventEvidence.correlationStatus,
          correlationConfidence: eventEvidence.correlationConfidence,
          deduplicationStatus: eventEvidence.deduplicationStatus,
          evidenceOrigin: eventEvidence.evidenceOrigin,
          rawEvent,
        },
        occurredAt: Number.isNaN(occurredAt.getTime()) ? new Date(occurredAtFallback) : occurredAt,
      });
    }
  }

  private async enrichVenueSnapshotWithExecutionConfirmation(
    snapshot: VenueSnapshotView,
  ): Promise<VenueSnapshotView> {
    if (
      snapshot.truthMode !== 'real'
      || !snapshot.executionSupport
      || !snapshot.sleeveApplicability.includes('carry')
    ) {
      return snapshot;
    }

    const candidates = dedupeCarryExecutionConfirmationCandidates(
      await this.options.store.listRecentCarryExecutionConfirmationCandidates(
        snapshot.venueId,
        POST_TRADE_CONFIRMATION_CANDIDATE_LIMIT,
      ),
    );
    const eventEvidenceByStepId = await this.loadExecutionEventEvidence(snapshot, candidates);
    const { evidence, evaluations } = evaluatePostTradeConfirmation(
      snapshot,
      candidates,
      eventEvidenceByStepId,
    );

    for (const evaluation of evaluations) {
      await this.persistExecutionEventEvidence(
        evaluation.candidate,
        evaluation.confirmation,
        snapshot.capturedAt,
      );
    }

    for (const evaluation of evaluations) {
      const nextOutcome = {
        ...evaluation.candidate.outcome,
        [POST_TRADE_CONFIRMATION_OUTCOME_KEY]: evaluation.confirmation,
      };
      const statusPatch = evaluation.statusPatch;
      const filledSizePatch = evaluation.filledSizePatch;
      const confirmationChanged = JSON.stringify(
        evaluation.candidate.outcome[POST_TRADE_CONFIRMATION_OUTCOME_KEY] ?? null,
      ) !== JSON.stringify(evaluation.confirmation);
      const statusChanged = statusPatch !== undefined && evaluation.candidate.status !== statusPatch;
      const filledSizeChanged = filledSizePatch !== undefined
        && evaluation.candidate.outcome['filledSize'] !== filledSizePatch;
      const summaryChanged = evaluation.candidate.outcome['postTradeConfirmationSummary'] !== evaluation.confirmation.summary;

      if (!confirmationChanged && !statusChanged && !filledSizeChanged && !summaryChanged) {
        continue;
      }

      await this.options.store.updateCarryExecutionStep(evaluation.candidate.stepId, {
        ...(statusPatch === undefined ? {} : { status: statusPatch }),
        ...(filledSizePatch === undefined ? {} : { filledSize: filledSizePatch }),
        outcomeSummary: evaluation.confirmation.summary,
        outcome: {
          ...nextOutcome,
          postTradeConfirmationSummary: evaluation.confirmation.summary,
        },
      });
    }

    return {
      ...snapshot,
      executionConfirmationState: evidence,
    };
  }

  private async buildCarryExecutionStepMetadata(
    adapter: VenueAdapter,
    plannedOrder: CarryActionDetailView['plannedOrders'][number],
  ): Promise<Record<string, unknown>> {
    const capturedAt = new Date();
    const existingMetadata = plannedOrder.metadata;
    const marketIdentity = readCanonicalMarketIdentityFromMetadata(existingMetadata, {
      venueId: plannedOrder.venueId,
      asset: plannedOrder.asset,
      marketType: existingMetadata['instrumentType'],
      provenance: 'derived',
      capturedAtStage: 'carry_execution_step',
      source: 'carry_execution_pretrade_capture',
      notes: ['Pre-trade position context captures the best market identity available immediately before submission.'],
    });

    try {
      const positions = await adapter.getPositions();
      return {
        ...existingMetadata,
        [PRE_TRADE_POSITION_CONTEXT_METADATA_KEY]: capturePreTradePositionContext({
          asset: plannedOrder.asset,
          side: plannedOrder.side,
          reduceOnly: plannedOrder.reduceOnly,
          marketKey: marketIdentity?.marketKey ?? marketValue(existingMetadata['marketKey']),
          marketSymbol: marketIdentity?.marketSymbol ?? marketValue(existingMetadata['marketSymbol']),
          capturedAt,
          positions,
        }),
      };
    } catch (error) {
      return {
        ...existingMetadata,
        [PRE_TRADE_POSITION_CONTEXT_METADATA_KEY]: {
          captureStatus: 'unavailable',
          observedAt: capturedAt.toISOString(),
          asset: plannedOrder.asset,
          marketKey: marketIdentity?.marketKey ?? marketValue(existingMetadata['marketKey']),
          marketSymbol: marketIdentity?.marketSymbol ?? marketValue(existingMetadata['marketSymbol']),
          side: null,
          size: null,
          reason: error instanceof Error ? error.message : String(error),
        },
      };
    }
  }

  private async collectVenueCapabilityForCarryAdapter(adapter: VenueAdapter): Promise<VenueCapabilitySnapshot> {
    if (typeof adapter.getVenueCapabilitySnapshot === 'function') {
      return adapter.getVenueCapabilitySnapshot();
    }

    const capabilities = typeof adapter.getCarryCapabilities === 'function'
      ? await adapter.getCarryCapabilities()
      : {
        venueId: adapter.venueId,
        venueMode: 'simulated' as const,
        executionSupported: false,
        supportsIncreaseExposure: false,
        supportsReduceExposure: false,
        readOnly: true,
        approvedForLiveUse: false,
        healthy: true,
        onboardingState: 'read_only' as const,
        missingPrerequisites: ['carry_controlled_execution_not_implemented'],
        metadata: {
          venueType: adapter.venueType,
        },
      };

    return {
      venueId: capabilities.venueId,
      venueName: capabilities.venueId,
      sleeveApplicability: ['carry'],
      connectorType: 'carry_adapter',
      truthMode: capabilities.venueMode === 'simulated' ? 'simulated' : 'real',
      readOnlySupport: capabilities.readOnly,
      executionSupport: capabilities.executionSupported,
      approvedForLiveUse: capabilities.approvedForLiveUse,
      onboardingState: capabilities.onboardingState,
      missingPrerequisites: capabilities.missingPrerequisites,
      authRequirementsSummary: [],
      healthy: capabilities.healthy,
      healthState: capabilities.healthy ? 'healthy' : 'degraded',
      degradedReason: capabilities.healthy ? null : 'carry_adapter_reported_unhealthy',
      metadata: capabilities.metadata,
    };
  }

  private async collectVenueTruthForCarryAdapter(adapter: VenueAdapter): Promise<VenueTruthSnapshot> {
    if (typeof adapter.getVenueTruthSnapshot === 'function') {
      return adapter.getVenueTruthSnapshot();
    }

    const [balances, positions, status] = await Promise.all([
      adapter.getBalances(),
      adapter.getPositions(),
      adapter.getStatus(),
    ]);
    return {
      venueId: adapter.venueId,
      venueName: adapter.venueId,
      snapshotType: 'carry_adapter_account_state',
      snapshotSuccessful: true,
      healthy: status.healthy,
      healthState: status.healthy ? 'healthy' : 'degraded',
      summary: `${balances.length} balances and ${positions.length} positions observed.`,
      errorMessage: null,
      capturedAt: new Date().toISOString(),
      snapshotCompleteness: 'complete',
      truthCoverage: {
        accountState: {
          status: 'unsupported',
          reason: 'Carry adapter truth does not expose a stable venue account identity.',
          limitations: [],
        },
        balanceState: {
          status: 'available',
          reason: null,
          limitations: [],
        },
        capacityState: {
          status: 'unsupported',
          reason: 'Carry adapters do not expose treasury-style venue capacity.',
          limitations: [],
        },
        exposureState: {
          status: 'available',
          reason: null,
          limitations: [],
        },
        derivativeAccountState: {
          status: 'unsupported',
          reason: 'Carry adapter truth does not decode venue-native derivative account metadata.',
          limitations: [],
        },
        derivativePositionState: {
          status: 'unsupported',
          reason: 'Carry adapter truth exposes generic venue positions, not venue-native derivative state.',
          limitations: [],
        },
        derivativeHealthState: {
          status: 'unsupported',
          reason: 'Carry adapter truth does not expose venue-native margin or health semantics.',
          limitations: [],
        },
        orderState: {
          status: 'unsupported',
          reason: 'Carry adapter truth does not expose venue-native open-order state.',
          limitations: [],
        },
        executionReferences: {
          status: 'unsupported',
          reason: 'Carry adapter truth does not expose external execution references.',
          limitations: [],
        },
      },
      sourceMetadata: {
        sourceKind: 'adapter',
        sourceName: 'carry_adapter',
        observedScope: ['balances', 'positions', 'status'],
      },
      accountState: null,
      balanceState: {
        balances: balances.map((balance) => ({
          assetKey: balance.asset,
          assetSymbol: balance.asset,
          assetType: 'unknown',
          accountAddress: null,
          amountAtomic: balance.total,
          amountDisplay: balance.total,
          decimals: null,
          observedSlot: null,
        })),
        totalTrackedBalances: balances.length,
        observedSlot: null,
      },
      capacityState: null,
      exposureState: {
        exposures: positions.map((position) => ({
          exposureKey: `${position.asset}:${position.side}`,
          exposureType: 'position',
          assetKey: position.asset,
          quantity: position.size,
          quantityDisplay: position.size,
          accountAddress: null,
        })),
        methodology: 'venue_positions',
      },
      derivativeAccountState: null,
      derivativePositionState: null,
      derivativeHealthState: null,
      orderState: null,
      executionReferenceState: null,
      payload: {
        balances: balances.map((balance) => ({
          asset: balance.asset,
          total: balance.total,
          available: balance.available,
          locked: balance.locked,
          updatedAt: balance.updatedAt.toISOString(),
        })),
        positions: positions.map((position) => ({
          asset: position.asset,
          side: position.side,
          size: position.size,
          updatedAt: position.updatedAt.toISOString(),
        })),
        status,
      },
      metadata: {
        venueType: adapter.venueType,
      },
    };
  }

  private async collectVenueCapabilityForTreasuryAdapter(
    adapter: TreasuryVenueAdapter,
  ): Promise<VenueCapabilitySnapshot> {
    if (typeof adapter.getVenueCapabilitySnapshot === 'function') {
      return adapter.getVenueCapabilitySnapshot();
    }

    const capabilities = await adapter.getCapabilities();
    return {
      venueId: capabilities.venueId,
      venueName: capabilities.venueId,
      sleeveApplicability: ['treasury'],
      connectorType: 'treasury_adapter',
      truthMode: capabilities.venueMode === 'simulated' ? 'simulated' : 'real',
      readOnlySupport: capabilities.readOnly,
      executionSupport: capabilities.executionSupported,
      approvedForLiveUse: capabilities.approvedForLiveUse,
      onboardingState: capabilities.onboardingState,
      missingPrerequisites: capabilities.missingPrerequisites,
      authRequirementsSummary: [],
      healthy: capabilities.healthy,
      healthState: capabilities.healthy ? 'healthy' : 'degraded',
      degradedReason: capabilities.healthy ? null : 'treasury_adapter_reported_unhealthy',
      metadata: capabilities.metadata,
    };
  }

  private async collectVenueTruthForTreasuryAdapter(
    adapter: TreasuryVenueAdapter,
  ): Promise<VenueTruthSnapshot> {
    if (typeof adapter.getVenueTruthSnapshot === 'function') {
      return adapter.getVenueTruthSnapshot();
    }

    const [state, position] = await Promise.all([
      adapter.getVenueState(),
      adapter.getPosition(),
    ]);
    return {
      venueId: state.venueId,
      venueName: state.venueName,
      snapshotType: 'treasury_adapter_state',
      snapshotSuccessful: true,
      healthy: state.healthy,
      healthState: state.healthy ? 'healthy' : 'degraded',
      summary: `Allocation ${position.currentAllocationUsd} USD and available capacity ${state.availableCapacityUsd} USD.`,
      errorMessage: null,
      capturedAt: position.updatedAt,
      snapshotCompleteness: 'complete',
      truthCoverage: {
        accountState: {
          status: 'unsupported',
          reason: 'Treasury adapter truth does not expose a stable venue account identity.',
          limitations: [],
        },
        balanceState: {
          status: 'unsupported',
          reason: 'Treasury adapter truth is modeled as capacity and allocation, not account balances.',
          limitations: [],
        },
        capacityState: {
          status: 'available',
          reason: null,
          limitations: [],
        },
        exposureState: {
          status: 'available',
          reason: null,
          limitations: [],
        },
        derivativeAccountState: {
          status: 'unsupported',
          reason: 'Treasury adapter truth does not expose venue-native derivative account metadata.',
          limitations: [],
        },
        derivativePositionState: {
          status: 'unsupported',
          reason: 'Treasury adapter truth does not expose venue-native derivative positions.',
          limitations: [],
        },
        derivativeHealthState: {
          status: 'unsupported',
          reason: 'Treasury adapter truth does not expose venue-native margin or health semantics.',
          limitations: [],
        },
        orderState: {
          status: 'unsupported',
          reason: 'Treasury adapter truth does not expose venue-native open-order state.',
          limitations: [],
        },
        executionReferences: {
          status: 'unsupported',
          reason: 'Treasury adapter truth does not expose external execution references.',
          limitations: [],
        },
      },
      sourceMetadata: {
        sourceKind: 'adapter',
        sourceName: 'treasury_adapter',
        observedScope: ['capacity', 'allocation'],
      },
      accountState: null,
      balanceState: null,
      capacityState: {
        availableCapacityUsd: state.availableCapacityUsd,
        currentAllocationUsd: position.currentAllocationUsd,
        withdrawalAvailableUsd: position.withdrawalAvailableUsd,
        liquidityTier: state.liquidityTier,
        aprBps: state.aprBps,
      },
      exposureState: {
        exposures: [{
          exposureKey: `${state.venueId}:allocation`,
          exposureType: 'allocation',
          assetKey: 'USD',
          quantity: position.currentAllocationUsd,
          quantityDisplay: position.currentAllocationUsd,
          accountAddress: null,
        }],
        methodology: 'treasury_allocation_state',
      },
      derivativeAccountState: null,
      derivativePositionState: null,
      derivativeHealthState: null,
      orderState: null,
      executionReferenceState: null,
      payload: {
        liquidityTier: state.liquidityTier,
        aprBps: state.aprBps,
        availableCapacityUsd: state.availableCapacityUsd,
        currentAllocationUsd: position.currentAllocationUsd,
        withdrawalAvailableUsd: position.withdrawalAvailableUsd,
      },
      metadata: state.metadata,
    };
  }

  async runCarryEvaluation(input: {
    actorId: string;
    trigger: string;
    sourceRunId?: string | null;
    linkedRebalanceProposalId?: string | null;
    targetCarryNotionalUsd?: string | null;
  }): Promise<{ sourceRunId: string | null; actionCount: number }> {
    const sourceRunId = input.sourceRunId ?? await this.options.store.getLatestStrategyRunId();
    if (sourceRunId === null) {
      return { sourceRunId: null, actionCount: 0 };
    }

    const [opportunities, approvedIntents, runtimeStatus, carryVenues, portfolioSummary] = await Promise.all([
      this.options.store.listApprovedOpportunitiesForRun(sourceRunId),
      this.options.store.listApprovedStrategyIntentsForRun(sourceRunId),
      this.options.store.getRuntimeStatus(),
      this.collectCarryVenueViews(sourceRunId),
      this.options.store.getPortfolioSummary(),
    ]);

    await this.options.store.persistCarryVenueSnapshots({
      strategyRunId: sourceRunId,
      venues: carryVenues,
    });
    await this.refreshVenueTruthInventory();

    const carryCurrentAllocationUsd = portfolioSummary?.sleeves.find((sleeve) => sleeve.sleeveId === 'carry')?.nav ?? '0';
    const approvedCarryBudgetUsd = (await this.options.store.getRebalanceCurrent())?.carryTargetAllocationUsd
      ?? (await this.options.store.getAllocatorSummary())?.totalCapitalUsd
      ?? null;
    const approvedBudgetCapUsd = (await this.options.store.getRebalanceCurrent())?.carryTargetAllocationUsd ?? approvedCarryBudgetUsd;
    const openPositions = (await this.collectPositions())
      .filter((position) => position.sleeveId === this.options.sleeveId && position.status === 'open')
      .flatMap((position) => {
        const snapshot = toCarryPositionSnapshot(position);
        return snapshot === null ? [] : [snapshot];
      });

    const recommendations: CarryExecutionRecommendation[] = [];
    const approvedByOpportunityId = new Map<string, OrderIntent[]>();

    for (const intent of approvedIntents) {
      const existing = approvedByOpportunityId.get(String(intent.opportunityId)) ?? [];
      existing.push(intent);
      approvedByOpportunityId.set(String(intent.opportunityId), existing);
    }

    let remainingTarget = input.targetCarryNotionalUsd === null || input.targetCarryNotionalUsd === undefined
      ? null
      : new Decimal(input.targetCarryNotionalUsd);

    for (const opportunity of opportunities) {
      const plannedOrders = approvedByOpportunityId.get(opportunity.opportunityId) ?? [];
      const notionalUsd = String(plannedOrders[0]?.metadata['positionSizeUsd'] ?? '0');
      const amount = new Decimal(notionalUsd);
      if (remainingTarget !== null && remainingTarget.lte(0)) {
        break;
      }
      if (remainingTarget !== null && amount.gt(remainingTarget)) {
        continue;
      }

      recommendations.push({
        actionType: input.linkedRebalanceProposalId === null || input.linkedRebalanceProposalId === undefined
          ? 'increase_carry_exposure'
          : 'restore_carry_budget',
        sourceKind: input.linkedRebalanceProposalId === null || input.linkedRebalanceProposalId === undefined
          ? 'opportunity'
          : 'rebalance',
        sourceReference: input.linkedRebalanceProposalId ?? opportunity.opportunityId,
        opportunityId: opportunity.opportunityId,
        asset: opportunity.asset,
        summary: `Deploy carry exposure for ${opportunity.asset} opportunity ${opportunity.opportunityId}.`,
        notionalUsd,
        details: {
          confidenceScore: Number(opportunity.confidenceScore),
          expectedAnnualYieldPct: opportunity.expectedAnnualYieldPct,
          netYieldPct: opportunity.netYieldPct,
          expiresAt: opportunity.expiresAt,
        },
        plannedOrders,
      });

      if (remainingTarget !== null) {
        remainingTarget = remainingTarget.minus(amount);
      }
    }

    const intents = this.carryExecutionPlanner.createExecutionIntents({
      recommendations,
      policy: DEFAULT_CARRY_OPERATIONAL_POLICY,
      currentCarryAllocationUsd: carryCurrentAllocationUsd,
      approvedCarryBudgetUsd: approvedBudgetCapUsd,
      totalCapitalUsd: portfolioSummary?.totalNav ?? null,
      runtimeLifecycleState: runtimeStatus.lifecycleState,
      runtimeHalted: runtimeStatus.halted,
      criticalMismatchCount: await this.options.store.countOpenMismatches(),
      carryThrottleState: runtimeStatus.halted ? 'blocked' : 'normal',
      executionMode: this.options.executionMode,
      liveExecutionEnabled: this.options.liveExecutionEnabled,
      venueCapabilities: carryVenues,
      openPositions,
      now: new Date(),
    });

    const actions = await this.options.store.createCarryActions({
      strategyRunId: sourceRunId,
      linkedRebalanceProposalId: input.linkedRebalanceProposalId ?? null,
      intents,
      actorId: input.actorId,
      createdAt: new Date(),
    });

    await this.options.store.auditWriter.write({
      eventId: createId(),
      eventType: 'carry.evaluated',
      occurredAt: new Date().toISOString(),
      actorType: 'operator',
      actorId: input.actorId,
      sleeveId: 'carry',
      data: {
        sourceRunId,
        trigger: input.trigger,
        actionCount: actions.length,
      },
    });

    return {
      sourceRunId,
      actionCount: actions.length,
    };
  }

  async runAllocatorEvaluation(input: {
    trigger: string;
    actorId: string;
    sourceRunId?: string | null;
    carryOpportunities?: OpportunityView[];
    treasurySummary?: TreasurySummaryView | null;
    portfolioSummaryOverride?: Pick<PortfolioSummaryView, 'totalNav' | 'sleeves'>
      | {
        totalNav: string;
        grossExposure: string;
        netExposure: string;
        liquidityReserve: string;
        openPositionCount: number;
        dailyPnl: string;
        cumulativePnl: string;
        sleeves: Array<{ sleeveId: string; nav: string; allocationPct: number }>;
        venueExposures: Record<string, string>;
        assetExposures: Record<string, string>;
        updatedAt: string;
      }
      | null;
  }): Promise<AllocatorSummaryView> {
    const [
      runtimeStatus,
      mismatchSummary,
      criticalMismatches,
      reconciliationSummary,
      persistedPortfolioSummary,
      persistedTreasurySummary,
      persistedOpportunities,
    ] = await Promise.all([
      this.options.store.getRuntimeStatus(),
      this.options.store.summarizeMismatches(),
      this.options.store.listMismatches(20, { severity: 'critical' }),
      this.options.store.summarizeLatestReconciliation(),
      this.options.store.getPortfolioSummary(),
      this.options.store.getTreasurySummary(),
      input.carryOpportunities === undefined
        ? this.options.store.listOpportunities(20)
        : Promise.resolve(input.carryOpportunities),
    ]);

    const treasurySummary = input.treasurySummary ?? persistedTreasurySummary;
    const portfolioSummary = input.portfolioSummaryOverride ?? persistedPortfolioSummary;
    const opportunities = persistedOpportunities.filter((opportunity) => opportunity.approved);

    const totalCapitalUsd = treasurySummary?.reserveStatus.totalCapitalUsd
      ?? portfolioSummary?.totalNav
      ?? '0';
    const totalCapital = new Decimal(totalCapitalUsd);
    const carryCurrentUsd = portfolioSummary?.sleeves.find((sleeve) => sleeve.sleeveId === this.options.sleeveId)?.nav
      ?? '0';
    const treasuryCurrentUsd = Decimal.max(totalCapital.minus(new Decimal(carryCurrentUsd)), 0).toFixed(2);
    const carryCurrentPct = totalCapital.equals(0)
      ? 0
      : Number(new Decimal(carryCurrentUsd).div(totalCapital).times(100).toFixed(4));
    const treasuryCurrentPct = totalCapital.equals(0)
      ? 0
      : Number(new Decimal(treasuryCurrentUsd).div(totalCapital).times(100).toFixed(4));
    const carryOpportunityScore = normaliseCarryOpportunityScore(opportunities);
    const reserveConstrainedCapitalUsd = treasurySummary?.reserveStatus.requiredReserveUsd ?? '0';
    const allocatableCapitalUsd = Decimal.max(
      totalCapital.minus(new Decimal(reserveConstrainedCapitalUsd)),
      0,
    ).toFixed(2);
    const criticalMismatchCount = criticalMismatches.filter(
      (mismatch) => mismatch.status !== 'verified',
    ).length;
    const carryThrottleState: AllocatorSleeveSnapshot['throttleState'] = runtimeStatus.halted
      ? 'blocked'
      : runtimeStatus.lifecycleState === 'degraded' || criticalMismatchCount > 0
        ? 'de_risk'
        : carryOpportunityScore < DEFAULT_ALLOCATOR_POLICY.carryOpportunityScoreFloor
          ? 'throttled'
          : 'normal';
    const carryStatus: AllocatorSleeveSnapshot['status'] = carryThrottleState === 'blocked'
      ? 'blocked'
      : carryThrottleState === 'de_risk'
        ? 'degraded'
        : carryThrottleState === 'throttled'
          ? 'throttled'
          : 'active';
    const treasuryStatus: AllocatorSleeveSnapshot['status'] = treasurySummary === null
      ? 'degraded'
      : new Decimal(treasurySummary.reserveStatus.reserveShortfallUsd).greaterThan(0)
        ? 'degraded'
        : 'active';

    const sleeves: AllocatorSleeveSnapshot[] = [
      {
        sleeveId: 'carry',
        kind: 'carry',
        name: this.allocatorRegistry.get('carry').name,
        currentAllocationUsd: new Decimal(carryCurrentUsd).toFixed(2),
        currentAllocationPct: carryCurrentPct,
        minAllocationPct: 0,
        maxAllocationPct: DEFAULT_ALLOCATOR_POLICY.maximumCarryPct,
        capacityUsd: totalCapital.toFixed(2),
        status: carryStatus,
        throttleState: carryThrottleState,
        healthy: carryStatus === 'active',
        actionability: runtimeStatus.halted ? 'blocked' : 'actionable',
        opportunityScore: carryOpportunityScore,
        metadata: {
          approvedOpportunityCount: opportunities.length,
          runtimeLifecycleState: runtimeStatus.lifecycleState,
        },
      },
      {
        sleeveId: 'treasury',
        kind: 'treasury',
        name: this.allocatorRegistry.get('treasury').name,
        currentAllocationUsd: treasuryCurrentUsd,
        currentAllocationPct: treasuryCurrentPct,
        minAllocationPct: DEFAULT_ALLOCATOR_POLICY.minimumTreasuryPct,
        maxAllocationPct: 100,
        capacityUsd: totalCapital.toFixed(2),
        status: treasuryStatus,
        throttleState: 'normal',
        healthy: treasurySummary !== null,
        actionability: treasurySummary === null ? 'observe_only' : 'actionable',
        opportunityScore: null,
        metadata: {
          reserveCoveragePct: treasurySummary?.reserveStatus.reserveCoveragePct ?? null,
          reserveShortfallUsd: treasurySummary?.reserveStatus.reserveShortfallUsd ?? null,
        },
      },
    ];

    const policyInput: AllocatorPolicyInput = {
      policy: DEFAULT_ALLOCATOR_POLICY,
      sleeves,
      system: {
        totalCapitalUsd: totalCapital.toFixed(2),
        reserveConstrainedCapitalUsd,
        allocatableCapitalUsd,
        runtimeLifecycleState: runtimeStatus.lifecycleState,
        runtimeHalted: runtimeStatus.halted,
        openMismatchCount: mismatchSummary.activeMismatchCount,
        criticalMismatchCount,
        degradedReasonCount: runtimeStatus.reason === null ? 0 : 1,
        treasuryReserveCoveragePct: Number(treasurySummary?.reserveStatus.reserveCoveragePct ?? 0),
        treasuryReserveShortfallUsd: treasurySummary?.reserveStatus.reserveShortfallUsd ?? '0',
        carryOpportunityCount: opportunities.length,
        carryApprovedOpportunityCount: opportunities.length,
        carryOpportunityScore,
        recentReconciliationIssues: reconciliationSummary?.latestStatusCounts.active ?? 0,
      },
      evaluatedAt: new Date().toISOString(),
      sourceReference: input.sourceRunId ?? null,
    };

    const decision = this.allocatorPolicyEngine.evaluate(policyInput);
    const allocatorRunId = createId();
    const evaluatedAt = new Date();

    await this.options.store.persistAllocatorEvaluation({
      allocatorRunId,
      sourceRunId: input.sourceRunId ?? null,
      trigger: input.trigger,
      triggeredBy: input.actorId,
      policy: DEFAULT_ALLOCATOR_POLICY,
      evaluationInput: policyInput as unknown as Record<string, unknown>,
      decision,
      evaluatedAt,
    });

    const rebalanceProposal = this.rebalancePlanner.createProposal({
      allocatorRunId,
      decision,
      system: {
        runtimeLifecycleState: runtimeStatus.lifecycleState,
        runtimeHalted: runtimeStatus.halted,
        criticalMismatchCount,
        executionMode: this.options.executionMode,
        liveExecutionEnabled: this.options.liveExecutionEnabled,
      },
      treasury: {
        idleCapitalUsd: treasurySummary?.reserveStatus.idleCapitalUsd ?? '0',
        reserveShortfallUsd: treasurySummary?.reserveStatus.reserveShortfallUsd ?? '0',
      },
      policy: DEFAULT_REBALANCE_POLICY,
    });

    if (rebalanceProposal !== null) {
      const proposal = await this.options.store.createRebalanceProposal({
        proposal: rebalanceProposal,
        createdAt: evaluatedAt,
      });
      await this.options.store.auditWriter.write({
        eventId: createId(),
        eventType: 'allocator.rebalance_proposed',
        occurredAt: evaluatedAt.toISOString(),
        actorType: 'operator',
        actorId: input.actorId,
        sleeveId: 'allocator',
        data: {
          proposalId: proposal.id,
          allocatorRunId,
          executable: proposal.executable,
          blockedReasonCount: proposal.blockedReasons.length,
          executionMode: proposal.executionMode,
        },
      });
    }

    await this.options.store.auditWriter.write({
      eventId: createId(),
      eventType: 'allocator.evaluated',
      occurredAt: evaluatedAt.toISOString(),
      actorType: 'operator',
      actorId: input.actorId,
      sleeveId: 'allocator',
      data: {
        allocatorRunId,
        sourceRunId: input.sourceRunId ?? null,
        trigger: input.trigger,
        regimeState: decision.regimeState,
        pressureLevel: decision.pressureLevel,
        recommendationCount: decision.recommendations.length,
      },
    });

    const summary = await this.options.store.getAllocatorSummary();
    if (summary === null) {
      throw new Error(`SentinelRuntime.runAllocatorEvaluation: allocator run "${allocatorRunId}" was not persisted`);
    }

    return summary;
  }

  async rebuildProjections(
    actorId = 'runtime-rebuild',
    emitAuditEvent = true,
  ): Promise<RuntimeStatusView> {
    const now = new Date();
    await this.options.store.updateRuntimeStatus({
      projectionStatus: 'rebuilding',
      lifecycleState: this.started ? 'starting' : 'starting',
      lastUpdatedBy: actorId,
    });

    await this.restoreAdaptersFromPersistence();

    const latestPortfolioSnapshot = await this.options.store.getLatestPortfolioSnapshotRow();
    if (latestPortfolioSnapshot !== null) {
      await this.options.store.replacePortfolioCurrentFromSnapshot(latestPortfolioSnapshot);
    }

    const latestRiskSnapshot = await this.options.store.getLatestRiskSnapshotRow();
    if (latestRiskSnapshot !== null) {
      await this.options.store.replaceRiskCurrentFromSnapshot(latestRiskSnapshot);
    }

    const latestPositions = await this.collectPositions();
    await this.options.store.syncPositions(latestPositions);
    const lastSuccessfulRunId = await this.options.store.getLatestSuccessfulRunId();
    await this.refreshInternalDerivativeState({
      sourceComponent: actorId,
      sourceRunId: lastSuccessfulRunId,
      sourceReference: emitAuditEvent ? actorId : lastSuccessfulRunId,
    });
    await this.refreshVenueTruthInventory();

    const currentStatus = await this.options.store.getRuntimeStatus();
    const lifecycleState: RuntimeLifecycleState = currentStatus.halted ? 'paused' : 'ready';
    await this.options.store.updateRuntimeStatus({
      lifecycleState,
      projectionStatus: 'fresh',
      lastProjectionRebuildAt: now,
      lastProjectionSourceRunId: lastSuccessfulRunId,
      lastUpdatedBy: actorId,
    });

    if (emitAuditEvent) {
      await this.options.store.auditWriter.write({
        eventId: createId(),
        eventType: 'runtime.projections_rebuilt',
        occurredAt: now.toISOString(),
        actorType: 'operator',
        actorId,
        sleeveId: this.options.sleeveId,
        data: {
          lastProjectionSourceRunId: lastSuccessfulRunId,
          positionCount: latestPositions.length,
        },
      });
    }

    await this.runReconciliation({
      trigger: emitAuditEvent ? 'projection_rebuild' : 'runtime_startup',
      sourceComponent: 'sentinel-runtime',
      triggerReference: lastSuccessfulRunId,
    });

    return this.getRuntimeStatus();
  }

  async runReconciliation(input: {
    trigger: string;
    sourceComponent: string;
    triggerReference?: string | null;
    triggeredBy?: string | null;
  }): Promise<RuntimeReconciliationRunView> {
    const result = await this.reconciliationEngine.run({
      trigger: input.trigger,
      sourceComponent: input.sourceComponent,
      triggerReference: input.triggerReference ?? null,
      triggeredBy: input.triggeredBy ?? null,
    });
    return result.run;
  }

  async runTreasuryEvaluation(input: {
    actorId: string;
    sourceRunId?: string | null;
    portfolioState?: Awaited<ReturnType<PortfolioStateTracker['refresh']>>;
    idleCapitalUsdOverride?: string | null;
  }): Promise<TreasurySummaryView> {
    const portfolioState = input.portfolioState ?? await this.options.portfolioTracker.refresh();
    const venueSnapshots = await this.collectTreasuryVenueSnapshots();
    const venueCapabilities = await this.collectTreasuryVenueCapabilities();
    const persistedCashBalanceUsd = await this.options.store.getTreasuryCashBalanceUsd();
    const evaluation = this.options.treasuryPolicyEngine.evaluate({
      totalNavUsd: portfolioState.totalNav,
      idleCapitalUsd: input.idleCapitalUsdOverride
        ?? persistedCashBalanceUsd
        ?? portfolioState.liquidityReserve,
      venueSnapshots,
      policy: this.options.treasuryPolicy,
    });
    const executionIntents = this.options.treasuryExecutionPlanner.createExecutionIntents({
      evaluation,
      policy: this.options.treasuryPolicy,
      executionMode: this.options.executionMode,
      liveExecutionEnabled: this.options.liveExecutionEnabled,
      venueCapabilities,
    });
    const treasuryRunId = createId();

    await this.options.store.persistTreasuryEvaluation({
      treasuryRunId,
      sourceRunId: input.sourceRunId ?? null,
      sleeveId: 'treasury',
      policy: this.options.treasuryPolicy,
      evaluation,
      executionIntents,
      venueCapabilities,
      actorId: input.actorId,
    });
    await this.refreshVenueTruthInventory();

    await this.options.store.auditWriter.write({
      eventId: createId(),
      eventType: 'treasury.evaluated',
      occurredAt: new Date().toISOString(),
      actorType: 'operator',
      actorId: input.actorId,
      sleeveId: 'treasury',
      data: {
        treasuryRunId,
        sourceRunId: input.sourceRunId ?? null,
        actionCount: evaluation.recommendations.length,
        reserveShortfallUsd: evaluation.reserveStatus.reserveShortfallUsd,
        surplusCapitalUsd: evaluation.reserveStatus.surplusCapitalUsd,
      },
    });

    const summary = await this.options.store.getTreasurySummary();
    if (summary === null) {
      throw new Error(`SentinelRuntime.runTreasuryEvaluation: treasury run "${treasuryRunId}" was not persisted`);
    }

    return summary;
  }

  async executeRebalanceProposal(input: {
    proposalId: string;
    actorId: string;
    commandId: string | null;
    startedBy: string;
  }): Promise<{
    proposalId: string;
    executionId: string;
    applied: boolean;
    allocatorRunId: string;
    downstreamCarryActionIds: string[];
    downstreamTreasuryActionIds: string[];
  }> {
    const detail = await this.options.store.getRebalanceProposal(input.proposalId);
    if (detail === null) {
      throw new Error(`Rebalance proposal "${input.proposalId}" was not found.`);
    }

    if (detail.proposal.status !== 'queued' && detail.proposal.status !== 'approved') {
      throw new Error(
        `Rebalance proposal "${input.proposalId}" is not executable from status "${detail.proposal.status}".`,
      );
    }

    const syncBundle = async (): Promise<void> => {
      await this.options.store.syncRebalanceBundleForProposal(detail.proposal.id);
    };

    const execution = await this.options.store.createRebalanceExecution({
      proposalId: detail.proposal.id,
      commandId: input.commandId,
      status: detail.proposal.executable ? 'executing' : 'failed',
      executionMode: detail.proposal.executionMode,
      simulated: detail.proposal.simulated,
      requestedBy: input.actorId,
      startedBy: input.startedBy,
      outcome: {
        blockedReasons: detail.proposal.blockedReasons,
      },
      lastError: detail.proposal.executable
        ? null
        : detail.proposal.blockedReasons.map((reason) => reason.message).join('; '),
    });

    if (!detail.proposal.executable) {
      const errorMessage = detail.proposal.blockedReasons.map((reason) => reason.message).join('; ');
      await this.options.store.failRebalanceProposal({
        proposalId: detail.proposal.id,
        latestExecutionId: execution.id,
        errorMessage,
      });
      await syncBundle();
      throw new Error(errorMessage);
    }

    await this.options.store.markRebalanceProposalExecuting(detail.proposal.id);

    const carryIntent = detail.intents.find((intent) => intent.sleeveId === 'carry');
    const treasuryIntent = detail.intents.find((intent) => intent.sleeveId === 'treasury');
    if (carryIntent === undefined || treasuryIntent === undefined) {
      await this.options.store.updateRebalanceExecution(execution.id, {
        status: 'failed',
        lastError: 'Rebalance proposal is missing carry or treasury intent.',
        completedAt: new Date(),
      });
      await this.options.store.failRebalanceProposal({
        proposalId: detail.proposal.id,
        latestExecutionId: execution.id,
        errorMessage: 'Rebalance proposal is missing carry or treasury intent.',
      });
      await syncBundle();
      throw new Error('Rebalance proposal is missing carry or treasury intent.');
    }

    const appliedAt = new Date();
    const applied = detail.proposal.executionMode === 'live';
    const downstreamCarryActionIds: string[] = [];
    const downstreamTreasuryActionIds: string[] = [];
    const runtimeStatus = await this.options.store.getRuntimeStatus();
    const allocatorDecision = await this.options.store.getAllocatorDecision(detail.proposal.allocatorRunId);
    const carrySourceRunId = allocatorDecision?.run.sourceRunId ?? null;

    const carryDeltaUsd = new Decimal(carryIntent.deltaUsd);
    if (!carryDeltaUsd.isZero()) {
      if (carryDeltaUsd.greaterThan(0)) {
        const carryEvaluation = await this.runCarryEvaluation({
          actorId: input.actorId,
          trigger: 'rebalance_proposal_execution',
          sourceRunId: carrySourceRunId,
          linkedRebalanceProposalId: detail.proposal.id,
          targetCarryNotionalUsd: carryDeltaUsd.toFixed(2),
        });
        const carryActions = await this.options.store.listCarryActions(20);
        downstreamCarryActionIds.push(
          ...carryActions
            .filter((action) => action.linkedRebalanceProposalId === detail.proposal.id)
            .map((action) => action.id),
        );
        void carryEvaluation;
      } else {
        const openPositions = (await this.collectPositions())
          .filter((position) => position.sleeveId === this.options.sleeveId && position.status === 'open')
          .flatMap((position) => {
            const snapshot = toCarryPositionSnapshot(position);
            return snapshot === null ? [] : [snapshot];
          });
        const plannedOrders = buildCarryReductionIntents(
          openPositions,
          carryDeltaUsd.abs().toFixed(2),
          detail.proposal.id,
        );
        const carryVenues = await this.collectCarryVenueViews(carrySourceRunId);
        const coveredNotionalUsd = plannedOrders
          .reduce((sum, order) => {
            const plannedReductionUsd = order.metadata['plannedReductionUsd'];
            return typeof plannedReductionUsd === 'string'
              ? sum.plus(plannedReductionUsd)
              : sum;
          }, new Decimal(0))
          .toFixed(2);
        const carryActions = await this.options.store.createCarryActions({
          strategyRunId: null,
          linkedRebalanceProposalId: detail.proposal.id,
          intents: this.carryExecutionPlanner.createExecutionIntents({
            recommendations: [{
              actionType: 'reduce_carry_exposure',
              sourceKind: 'rebalance',
              sourceReference: detail.proposal.id,
              opportunityId: null,
              asset: null,
              summary: `Reduce carry exposure by ${carryDeltaUsd.abs().toFixed(2)} USD for rebalance proposal ${detail.proposal.id}.`,
              notionalUsd: carryDeltaUsd.abs().toFixed(2),
              details: {
                coveredNotionalUsd,
              },
              plannedOrders,
            }],
            policy: DEFAULT_CARRY_OPERATIONAL_POLICY,
            currentCarryAllocationUsd: carryIntent.currentAllocationUsd,
            approvedCarryBudgetUsd: carryIntent.targetAllocationUsd,
            totalCapitalUsd: detail.proposal.details['rebalanceAmountUsd'] === undefined
              ? null
              : new Decimal(carryIntent.currentAllocationUsd).plus(treasuryIntent.currentAllocationUsd).toFixed(2),
            runtimeLifecycleState: runtimeStatus.lifecycleState,
            runtimeHalted: runtimeStatus.halted,
            criticalMismatchCount: await this.options.store.countOpenMismatches(),
            carryThrottleState: 'normal',
            executionMode: this.options.executionMode,
            liveExecutionEnabled: this.options.liveExecutionEnabled,
            venueCapabilities: carryVenues,
            openPositions,
            now: new Date(),
          }),
          actorId: input.actorId,
          createdAt: new Date(),
        });
        downstreamCarryActionIds.push(...carryActions.map((action) => action.id));
      }
    }

    const treasuryDeltaUsd = new Decimal(treasuryIntent.deltaUsd);
    if (!treasuryDeltaUsd.isZero()) {
      const treasurySummary = await this.options.store.getTreasurySummary();
      if (treasurySummary !== null) {
        const treasuryAction = await this.options.store.createTreasuryAction({
          treasuryRunId: treasurySummary.treasuryRunId,
          linkedRebalanceProposalId: detail.proposal.id,
          actionType: 'rebalance_treasury_budget',
          venueId: null,
          venueName: null,
          venueMode: 'reserve',
          amountUsd: treasuryDeltaUsd.abs().toFixed(2),
          reasonCode: 'rebalance_budget_application',
          summary: treasuryDeltaUsd.greaterThan(0)
            ? `Increase treasury budget by ${treasuryDeltaUsd.toFixed(2)} USD for rebalance proposal ${detail.proposal.id}.`
            : `Reduce treasury budget by ${treasuryDeltaUsd.abs().toFixed(2)} USD for rebalance proposal ${detail.proposal.id}.`,
          details: {
            rebalanceProposalId: detail.proposal.id,
            currentAllocationUsd: treasuryIntent.currentAllocationUsd,
            targetAllocationUsd: treasuryIntent.targetAllocationUsd,
            deltaUsd: treasuryIntent.deltaUsd,
            applied,
          },
          readiness: 'actionable',
          executable: true,
          blockedReasons: [],
          approvalRequirement: detail.proposal.approvalRequirement,
          executionMode: detail.proposal.executionMode,
          simulated: detail.proposal.simulated,
          actorId: input.actorId,
          createdAt: appliedAt,
        });
        await this.options.store.approveTreasuryAction(treasuryAction.id, input.actorId);
        if (input.commandId !== null) {
          await this.options.store.queueTreasuryActionExecution({
            actionId: treasuryAction.id,
            commandId: input.commandId,
            actorId: input.actorId,
          });
        }
        await this.options.store.markTreasuryActionExecuting(treasuryAction.id);

        const treasuryExecution = await this.options.store.createTreasuryExecution({
          treasuryActionId: treasuryAction.id,
          treasuryRunId: treasurySummary.treasuryRunId,
          commandId: input.commandId,
          status: 'executing',
          executionMode: detail.proposal.executionMode,
          venueMode: 'reserve',
          simulated: detail.proposal.simulated,
          requestedBy: input.actorId,
          startedBy: input.startedBy,
          blockedReasons: [],
          outcome: {
            executionKind: 'budget_state_application',
            rebalanceProposalId: detail.proposal.id,
            currentAllocationUsd: treasuryIntent.currentAllocationUsd,
            targetAllocationUsd: treasuryIntent.targetAllocationUsd,
            deltaUsd: treasuryIntent.deltaUsd,
          },
        });
        await this.options.store.updateTreasuryExecution(treasuryExecution.id, {
          status: 'completed',
          outcomeSummary: applied
            ? 'Treasury sleeve budget state was applied as part of rebalance execution.'
            : 'Treasury sleeve budget change was recorded as a dry-run rebalance outcome.',
          outcome: {
            executionKind: 'budget_state_application',
            rebalanceProposalId: detail.proposal.id,
            currentAllocationUsd: treasuryIntent.currentAllocationUsd,
            targetAllocationUsd: treasuryIntent.targetAllocationUsd,
            deltaUsd: treasuryIntent.deltaUsd,
            applied,
          },
          lastError: null,
        });
        await this.options.store.completeTreasuryAction({
          actionId: treasuryAction.id,
          latestExecutionId: treasuryExecution.id,
        });
        downstreamTreasuryActionIds.push(treasuryAction.id);
      }
    }

    if (applied) {
      await this.options.store.applyRebalanceCurrent({
        proposalId: detail.proposal.id,
        allocatorRunId: detail.proposal.allocatorRunId,
        carryTargetAllocationUsd: carryIntent.targetAllocationUsd,
        carryTargetAllocationPct: carryIntent.targetAllocationPct,
        treasuryTargetAllocationUsd: treasuryIntent.targetAllocationUsd,
        treasuryTargetAllocationPct: treasuryIntent.targetAllocationPct,
        appliedAt,
      });
    }

    await this.options.store.updateRebalanceExecution(execution.id, {
      status: 'completed',
      outcomeSummary: applied
        ? 'Rebalance proposal was applied to the approved sleeve budget state.'
        : 'Rebalance proposal completed in dry-run mode; no sleeve budget state was changed.',
      outcome: {
        applied,
        downstreamCarryActionIds,
        downstreamTreasuryActionIds,
        carryTargetAllocationUsd: carryIntent.targetAllocationUsd,
        carryTargetAllocationPct: carryIntent.targetAllocationPct,
        treasuryTargetAllocationUsd: treasuryIntent.targetAllocationUsd,
        treasuryTargetAllocationPct: treasuryIntent.targetAllocationPct,
      },
      lastError: null,
      completedAt: appliedAt,
    });
    await this.options.store.completeRebalanceProposal({
      proposalId: detail.proposal.id,
      latestExecutionId: execution.id,
    });
    await syncBundle();
    await this.options.store.auditWriter.write({
      eventId: createId(),
      eventType: applied
        ? 'allocator.rebalance_applied'
        : 'allocator.rebalance_dry_run_completed',
      occurredAt: appliedAt.toISOString(),
      actorType: 'operator',
      actorId: input.actorId,
      sleeveId: 'allocator',
      data: {
        proposalId: detail.proposal.id,
        executionId: execution.id,
        allocatorRunId: detail.proposal.allocatorRunId,
        applied,
      },
    });

    return {
      proposalId: detail.proposal.id,
      executionId: execution.id,
      applied,
      allocatorRunId: detail.proposal.allocatorRunId,
      downstreamCarryActionIds,
      downstreamTreasuryActionIds,
    };
  }

  async executeCarryAction(input: {
    actionId: string;
    actorId: string;
    commandId: string | null;
    startedBy: string;
  }): Promise<{
    actionId: string;
    executionId: string;
    orderCount: number;
    guardrailViolations: string[];
  }> {
    const detail = await this.options.store.getCarryAction(input.actionId);
    if (detail === null) {
      throw new Error(`Carry action "${input.actionId}" was not found.`);
    }

    if (detail.action.status !== 'queued' && detail.action.status !== 'approved') {
      throw new Error(`Carry action "${input.actionId}" is not executable from status "${detail.action.status}".`);
    }

    const syncLinkedBundle = async (): Promise<void> => {
      if (detail.action.linkedRebalanceProposalId !== null) {
        await this.options.store.syncRebalanceBundleForProposal(detail.action.linkedRebalanceProposalId);
      }
    };

    const execution = await this.options.store.createCarryExecution({
      carryActionId: detail.action.id,
      strategyRunId: detail.action.strategyRunId,
      commandId: input.commandId,
      status: detail.action.executable ? 'executing' : 'failed',
      executionMode: detail.action.executionMode,
      simulated: detail.action.simulated,
      requestedBy: input.actorId,
      startedBy: input.startedBy,
      blockedReasons: detail.action.blockedReasons,
      lastError: detail.action.executable
        ? null
        : detail.action.blockedReasons.map((reason) => reason.message).join('; '),
      outcome: {
        blockedReasons: detail.action.blockedReasons,
      },
    });

    if (!detail.action.executable) {
      const errorMessage = detail.action.blockedReasons.map((reason) => reason.message).join('; ');
      await this.options.store.failCarryAction({
        actionId: detail.action.id,
        latestExecutionId: execution.id,
        errorMessage,
      });
      await syncLinkedBundle();
      throw new Error(errorMessage);
    }

    await this.options.store.markCarryActionExecuting(detail.action.id);

    const orderStore = new RuntimeOrderStore(this.options.store.db);
    const carryVenues = await this.collectCarryVenueViews(detail.action.strategyRunId);
    const carryVenueById = new Map(carryVenues.map((venue) => [venue.venueId, venue] as const));
    const currentConnectorBlocks: CarryOperationalBlockedReason[] = detail.action.executionMode === 'live'
      ? detail.plannedOrders.flatMap((plannedOrder): CarryOperationalBlockedReason[] => {
        const venue = carryVenueById.get(plannedOrder.venueId);
        if (venue === undefined) {
          return [{
            code: 'venue_execution_unsupported',
            category: 'venue_capability',
            message: `Carry venue ${plannedOrder.venueId} is not registered for execution.`,
            operatorAction: 'Register the connector and re-run carry evaluation before executing this action.',
            details: {
              venueId: plannedOrder.venueId,
            },
          }];
        }

        const blockedReasons: CarryOperationalBlockedReason[] = [];

        if (!venue.executionSupported || venue.readOnly) {
          blockedReasons.push({
            code: 'venue_execution_unsupported',
            category: 'venue_capability',
            message: `Carry venue ${plannedOrder.venueId} is not currently executable.`,
            operatorAction: 'Restore execution-capable connector posture before retrying this action.',
            details: {
              venueId: plannedOrder.venueId,
              readOnly: venue.readOnly,
              executionSupported: venue.executionSupported,
            },
          });
        }

        if (!venue.approvedForLiveUse) {
          blockedReasons.push({
            code: 'venue_live_unapproved',
            category: 'venue_capability',
            message: `Carry venue ${plannedOrder.venueId} is not approved for live use.`,
            operatorAction: 'Request and approve connector promotion before retrying this action.',
            details: {
              venueId: plannedOrder.venueId,
              promotionStatus: venue.promotionStatus,
            },
          });
        } else if (!venue.sensitiveExecutionEligible) {
          blockedReasons.push({
            code: 'venue_live_ineligible',
            category: 'venue_capability',
            message: `Carry venue ${plannedOrder.venueId} is approved but currently blocked by connector readiness evidence.`,
            operatorAction: 'Restore connector freshness and health, then re-run carry evaluation before retrying.',
            details: {
              venueId: plannedOrder.venueId,
              promotionStatus: venue.promotionStatus,
              blockers: venue.promotionBlockedReasons,
            },
          });
        }

        return blockedReasons;
      })
      : [];
    const orderResults: Array<{
      stepId: string;
      intentId: string;
      clientOrderId: string;
      venueOrderId: string | null;
      status: string;
      filledSize: string;
      averageFillPrice: string | null;
      executionReference: string | null;
      executionMode: 'real' | 'simulated' | null;
    }> = [];

    if (currentConnectorBlocks.length > 0) {
      const errorMessage = currentConnectorBlocks.map((reason) => reason.message).join('; ');
      await this.options.store.updateCarryExecution(execution.id, {
        status: 'failed',
        blockedReasons: currentConnectorBlocks,
        lastError: errorMessage,
        outcomeSummary: errorMessage,
        outcome: {
          blockedReasons: currentConnectorBlocks,
        },
        completedAt: new Date(),
      });
      await this.options.store.failCarryAction({
        actionId: detail.action.id,
        latestExecutionId: execution.id,
        errorMessage,
      });
      await syncLinkedBundle();
      await this.options.store.auditWriter.write({
        eventId: createId(),
        eventType: 'carry.execution_blocked',
        occurredAt: new Date().toISOString(),
        actorType: 'operator',
        actorId: input.actorId,
        sleeveId: 'carry',
        data: {
          carryActionId: detail.action.id,
          executionId: execution.id,
          blockedReasons: currentConnectorBlocks,
        },
      });
      throw new Error(errorMessage);
    }

    // ============================================================================
    // Phase R3: Guardrail Enforcement
    // ============================================================================
    const guardrailViolations: string[] = [];
    
    // Load guardrail config
    const guardrailConfig = await this.options.store.getGuardrailConfig('global', 'carry');
    
    // Check kill switch
    if (guardrailConfig?.killSwitchTriggered) {
      const violation = await this.options.store.recordGuardrailViolation({
        guardrailConfigId: guardrailConfig.id,
        violationType: 'kill_switch_triggered',
        violationMessage: 'Execution blocked: kill switch is triggered',
        carryActionId: detail.action.id,
        blocked: true,
      });
      guardrailViolations.push('kill_switch');
      
      await this.options.store.updateCarryExecution(execution.id, {
        status: 'failed',
        lastError: 'Execution blocked: kill switch triggered',
        outcomeSummary: 'Execution blocked by guardrail: kill switch',
        completedAt: new Date(),
      });
      await this.options.store.failCarryAction({
        actionId: detail.action.id,
        latestExecutionId: execution.id,
        errorMessage: 'Execution blocked: kill switch triggered',
      });
      throw new Error('Execution blocked: kill switch triggered');
    }
    
    // Calculate total notional
    const totalNotional = detail.plannedOrders.reduce(
      (sum, order) => sum + (parseFloat(order.requestedSize) * parseFloat(order.requestedPrice ?? '0')),
      0
    );
    
    // Check notional limits
    if (guardrailConfig?.maxSingleActionNotionalUsd && 
        totalNotional > parseFloat(guardrailConfig.maxSingleActionNotionalUsd)) {
      const violation = await this.options.store.recordGuardrailViolation({
        guardrailConfigId: guardrailConfig.id,
        violationType: 'max_notional_exceeded',
        violationMessage: `Execution blocked: notional ${totalNotional} exceeds limit ${guardrailConfig.maxSingleActionNotionalUsd}`,
        carryActionId: detail.action.id,
        attemptedNotionalUsd: String(totalNotional),
        limitNotionalUsd: guardrailConfig.maxSingleActionNotionalUsd,
        blocked: true,
      });
      guardrailViolations.push('max_notional_exceeded');
      
      await this.options.store.updateCarryExecution(execution.id, {
        status: 'failed',
        lastError: `Execution blocked: notional limit exceeded`,
        outcomeSummary: `Execution blocked by guardrail: max notional ${guardrailConfig.maxSingleActionNotionalUsd}`,
        completedAt: new Date(),
      });
      await this.options.store.failCarryAction({
        actionId: detail.action.id,
        latestExecutionId: execution.id,
        errorMessage: 'Execution blocked: notional limit exceeded',
      });
      throw new Error('Execution blocked: notional limit exceeded');
    }
    
    // Check concurrency limits
    const executingCount = await this.options.store.getExecutingActionCount();
    if (guardrailConfig?.maxConcurrentExecutions && 
        executingCount >= guardrailConfig.maxConcurrentExecutions) {
      const violation = await this.options.store.recordGuardrailViolation({
        guardrailConfigId: guardrailConfig.id,
        violationType: 'max_concurrency_exceeded',
        violationMessage: `Execution blocked: concurrency ${executingCount} >= limit ${guardrailConfig.maxConcurrentExecutions}`,
        carryActionId: detail.action.id,
        blocked: true,
      });
      guardrailViolations.push('max_concurrency_exceeded');
      
      await this.options.store.updateCarryExecution(execution.id, {
        status: 'failed',
        lastError: 'Execution blocked: concurrency limit exceeded',
        outcomeSummary: `Execution blocked by guardrail: max concurrent ${guardrailConfig.maxConcurrentExecutions}`,
        completedAt: new Date(),
      });
      await this.options.store.failCarryAction({
        actionId: detail.action.id,
        latestExecutionId: execution.id,
        errorMessage: 'Execution blocked: concurrency limit exceeded',
      });
      throw new Error('Execution blocked: concurrency limit exceeded');
    }

    // ============================================================================
    // Phase R3 Part 4: Multi-Leg Plan Creation
    // ============================================================================
    let planId: string | undefined = undefined;
    let legsCompleted = 0;
    let legsFailed = 0;
    let finalHedgeDeviation: string | null = null;
    
    // Import adapter functions
    const {
      buildMultiLegPlanInput,
      calculateExecutionOrder,
    } = await import('./adapters/carry-orchestration-adapter.js');
    const { createMultiLegPlan } = await import('@sentinel-apex/carry');
    
    // Only create multi-leg plan for 2+ orders (delta-neutral carry)
    if (detail.plannedOrders.length >= 2) {
      try {
        // Build plan input using adapter
        const planInput = buildMultiLegPlanInput(
          detail.action.id,
          detail.action.strategyRunId,
          detail.action.asset ?? 'unknown',
          detail.plannedOrders
        );
        
        // Create multi-leg plan via carry orchestration
        const planResult = createMultiLegPlan(planInput);
        
        if (planResult.ok) {
          const plan = planResult.value;
          
          // Persist plan to database
          const planRecord = await this.options.store.createMultiLegPlan({
            carryActionId: detail.action.id,
            strategyRunId: detail.action.strategyRunId,
            asset: detail.action.asset ?? 'unknown',
            notionalUsd: planInput.notionalUsd.toString(),
            legCount: plan.legs.length,
            coordinationConfig: plan.coordinationConfig as unknown as Record<string, unknown>,
            executionOrder: calculateExecutionOrder(plan.coordinationConfig, plan.legs.length),
            requestedBy: input.actorId,
          });
          
          planId = planRecord.id;
          
          // Persist legs
          for (const leg of plan.legs) {
            // Map legType: 'futures' from carry package maps to 'perp' in DB
            const legType: 'spot' | 'perp' | 'hedge' | 'rebalance' | 'settlement' = 
              leg.legType === 'futures' ? 'perp' : leg.legType;
            
            await this.options.store.createLegExecution({
              planId: planRecord.id,
              carryActionId: detail.action.id,
              legSequence: leg.legSequence,
              legType,
              side: leg.side,
              venueId: leg.venueId,
              asset: leg.asset,
              targetSize: leg.targetSize.toString(),
              targetNotionalUsd: leg.targetNotionalUsd.toString(),
              metadata: {
                marketSymbol: leg.marketSymbol,
              },
            });
          }
          
          // Update plan status to executing
          await this.options.store.updateMultiLegPlanStatus(planRecord.id, {
            status: 'executing',
            outcomeSummary: 'Plan execution started',
          });
          
          // Update execution with plan reference
          await this.options.store.updateCarryExecution(execution.id, {
            outcome: {
              blockedReasons: detail.action.blockedReasons,
              multiLegPlanId: planRecord.id,
              multiLegEnabled: true,
            },
          });
        }
      } catch (error) {
        // Log but don't fail - fall back to sequential execution
        this.options.logger.warn('Multi-leg plan creation failed, falling back to sequential execution', {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    for (const plannedOrder of detail.plannedOrders) {
      const venueSnapshot = carryVenueById.get(plannedOrder.venueId) ?? {
        venueId: plannedOrder.venueId,
        venueMode: detail.action.simulated ? 'simulated' as const : 'live' as const,
        executionSupported: false,
        readOnly: true,
        approvedForLiveUse: false,
        sensitiveExecutionEligible: false,
        promotionStatus: 'not_requested' as const,
        promotionBlockedReasons: ['carry_venue_not_registered'],
        onboardingState: 'read_only' as const,
      };
      const adapter = this.options.adapters.get(plannedOrder.venueId);
      const stepMetadata = adapter === undefined
        ? plannedOrder.metadata
        : await this.buildCarryExecutionStepMetadata(adapter, plannedOrder);
      const step = await this.options.store.createCarryExecutionStep({
        carryExecutionId: execution.id,
        carryActionId: detail.action.id,
        strategyRunId: detail.action.strategyRunId,
        plannedOrderId: plannedOrder.id,
        intentId: plannedOrder.intentId,
        venueId: plannedOrder.venueId,
        venueMode: venueSnapshot.venueMode,
        executionSupported: venueSnapshot.executionSupported,
        readOnly: venueSnapshot.readOnly,
        approvedForLiveUse: venueSnapshot.approvedForLiveUse,
        onboardingState: venueSnapshot.onboardingState,
        asset: plannedOrder.asset,
        side: plannedOrder.side,
        orderType: plannedOrder.orderType,
        requestedSize: plannedOrder.requestedSize,
        requestedPrice: plannedOrder.requestedPrice,
        reduceOnly: plannedOrder.reduceOnly,
        clientOrderId: plannedOrder.intentId,
        status: 'pending',
        simulated: detail.action.simulated,
        metadata: stepMetadata,
      });
      if (adapter === undefined) {
        await this.options.store.updateCarryExecutionStep(step.id, {
          status: 'failed',
          outcomeSummary: `Carry venue "${plannedOrder.venueId}" is not registered.`,
          lastError: `Carry venue "${plannedOrder.venueId}" is not registered.`,
          outcome: {
            attempted: false,
          },
          completedAt: new Date(),
        });
        await this.options.store.updateCarryExecution(execution.id, {
          status: 'failed',
          lastError: `Carry venue "${plannedOrder.venueId}" is not registered.`,
          completedAt: new Date(),
        });
        await this.options.store.failCarryAction({
          actionId: detail.action.id,
          latestExecutionId: execution.id,
          errorMessage: `Carry venue "${plannedOrder.venueId}" is not registered.`,
        });
        await syncLinkedBundle();
        throw new Error(`Carry venue "${plannedOrder.venueId}" is not registered.`);
      }

      try {
        const executor = new OrderExecutor(
          adapter,
          orderStore,
          {
            maxRetries: 0,
            retryDelayMs: 0,
            orderTimeoutMs: 1000,
          },
          this.options.logger,
          this.options.store.auditWriter,
        );

        const orderRecord = await executor.submitIntent({
          intentId: plannedOrder.intentId,
          venueId: plannedOrder.venueId as never,
          asset: plannedOrder.asset as never,
          side: plannedOrder.side,
          type: plannedOrder.orderType,
          size: plannedOrder.requestedSize,
          limitPrice: plannedOrder.requestedPrice,
          opportunityId: (detail.action.opportunityId ?? createId()) as never,
          reduceOnly: plannedOrder.reduceOnly,
          createdAt: new Date(plannedOrder.createdAt),
          metadata: stepMetadata,
        });
        if (detail.action.strategyRunId !== null) {
          await this.persistExecutionRecord(detail.action.strategyRunId, orderRecord);
        }
        const executionReference = readVenueExecutionReference(orderRecord.intent.metadata)
          ?? orderRecord.venueOrderId
          ?? plannedOrder.intentId;
        const executionMode = readVenueExecutionMode(orderRecord.intent.metadata);
        await this.options.store.updateCarryExecutionStep(step.id, {
          clientOrderId: plannedOrder.intentId,
          venueOrderId: orderRecord.venueOrderId,
          executionReference,
          status: orderRecord.status,
          simulated: detail.action.simulated,
          filledSize: orderRecord.filledSize,
          averageFillPrice: orderRecord.averageFillPrice,
          outcomeSummary: orderRecord.lastError === null
            ? `Execution step completed with status ${orderRecord.status}.`
            : orderRecord.lastError,
          outcome: {
            attemptCount: orderRecord.attemptCount,
            feesPaid: orderRecord.feesPaid,
            fillCount: orderRecord.fills.length,
            submittedAt: orderRecord.submittedAt?.toISOString() ?? null,
            executionReference,
            executionMode,
            marketIdentity: readCanonicalMarketIdentityFromMetadata(orderRecord.intent.metadata, {
              venueId: orderRecord.intent.venueId,
              asset: orderRecord.intent.asset,
              marketType: orderRecord.intent.metadata['instrumentType'],
              provenance: 'derived',
              capturedAtStage: 'carry_execution_step',
              source: 'carry_action_execution',
              notes: ['Carry execution outcomes expose the best market identity available after order submission.'],
            }),
          },
          lastError: orderRecord.lastError,
          metadata: orderRecord.intent.metadata,
          completedAt: orderRecord.completedAt ?? new Date(),
        });
        orderResults.push({
          stepId: step.id,
          intentId: plannedOrder.intentId,
          clientOrderId: plannedOrder.intentId,
          venueOrderId: orderRecord.venueOrderId,
          status: orderRecord.status,
          filledSize: orderRecord.filledSize,
          averageFillPrice: orderRecord.averageFillPrice,
          executionReference,
          executionMode,
        });
        
        legsCompleted++;
        
        // ============================================================================
        // Phase R3 Part 4: Update Leg Execution Status
        // ============================================================================
        if (planId !== undefined) {
          try {
            // Determine leg type from order metadata or venue naming
            const marketId = plannedOrder.marketIdentity;
            const legType: 'spot' | 'perp' | 'hedge' | 'rebalance' | 'settlement' = 
              marketId?.marketType === 'perp' || 
              plannedOrder.venueId.toLowerCase().includes('perp')
                ? 'perp' 
                : 'spot';
            
            // Query leg executions to find matching one
            const legExecutions = await this.options.store.getLegExecutionsForPlan(planId);
            const matchingLeg = legExecutions.find(
              (leg) => leg.venueId === plannedOrder.venueId && 
                     leg.legType === legType &&
                     leg.status === 'pending'
            );
            
            if (matchingLeg !== undefined) {
              await this.options.store.updateLegExecutionStatus(matchingLeg.id, {
                status: 'completed',
                executedSize: orderRecord.filledSize ?? orderRecord.intent.size,
                averageFillPrice: orderRecord.averageFillPrice ?? plannedOrder.requestedPrice ?? '0',
              });
            }
          } catch (legError) {
            // Log but don't fail execution
            this.options.logger.warn('Failed to update leg execution status', {
              error: legError instanceof Error ? legError.message : String(legError),
            });
          }
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Carry order execution failed.';
        await this.options.store.updateCarryExecutionStep(step.id, {
          status: 'failed',
          simulated: detail.action.simulated,
          outcomeSummary: message,
          outcome: {
            attempted: true,
          },
          lastError: message,
          completedAt: new Date(),
        });
        
        legsFailed++;
        
        // Update leg execution status to failed
        if (planId !== undefined) {
          try {
            const legExecutions = await this.options.store.getLegExecutionsForPlan(planId);
            const pendingLeg = legExecutions.find((leg) => leg.status === 'pending');
            
            if (pendingLeg !== undefined) {
              await this.options.store.updateLegExecutionStatus(pendingLeg.id, {
                status: 'failed',
                lastError: `Leg failed: ${message}`,
              });
            }
          } catch (legError) {
            this.options.logger.warn('Failed to update leg failure status', {
              error: legError instanceof Error ? legError.message : String(legError),
            });
          }
        }
        
        await this.options.store.updateCarryExecution(execution.id, {
          status: 'failed',
          lastError: message,
          outcomeSummary: message,
          outcome: {
            orderResults,
          },
          completedAt: new Date(),
        });
        
        await this.options.store.failCarryAction({
          actionId: detail.action.id,
          latestExecutionId: execution.id,
          errorMessage: message,
        });
        await syncLinkedBundle();
        throw error;
      }
    }

    // ============================================================================
    // Phase R3 Part 4: Finalize Multi-Leg Plan and Record Hedge State
    // ============================================================================
    if (planId !== undefined) {
      try {
        // Calculate hedge deviation from execution results
        const legExecutions = await this.options.store.getLegExecutionsForPlan(planId);
        
        const spotLegs = legExecutions.filter((l) => l.legType === 'spot');
        const perpLegs = legExecutions.filter((l) => l.legType === 'perp');
        
        const spotNotional = spotLegs.reduce(
          (sum, l) => sum + (Number(l.executedSize ?? l.targetSize) * Number(l.averageFillPrice ?? '0')),
          0
        );
        const perpNotional = perpLegs.reduce(
          (sum, l) => sum + (Number(l.executedSize ?? l.targetSize) * Number(l.averageFillPrice ?? '0')),
          0
        );
        
        const _totalNotional = spotNotional + perpNotional;
        const deviation = _totalNotional > 0 
          ? Math.abs(spotNotional - perpNotional) / _totalNotional * 100
          : 0;
        
        finalHedgeDeviation = deviation.toFixed(4);
        
        // Determine imbalance direction
        const imbalanceDirection = spotNotional > perpNotional ? 'spot_heavy' as const :
                                   perpNotional > spotNotional ? 'perp_heavy' as const :
                                   'balanced' as const;
        
        // Record hedge state
        await this.options.store.recordHedgeState({
          planId,
          carryActionId: detail.action.id,
          asset: detail.action.asset ?? 'unknown',
          spotLegId: spotLegs[0]?.id ?? null,
          perpLegId: perpLegs[0]?.id ?? null,
          notionalUsd: totalNotional.toString(),
          hedgeDeviationPct: deviation,
          imbalanceDirection,
          imbalanceThresholdBreached: deviation >= 2, // Default 2% tolerance
        });
        
        // Update plan status based on execution outcome
        const allLegsCompleted = legExecutions.every((l) => l.status === 'completed');
        const someLegsFailed = legExecutions.some((l) => l.status === 'failed');
        
        if (allLegsCompleted && legsFailed === 0) {
          await this.options.store.updateMultiLegPlanStatus(planId, {
            status: 'completed',
            outcomeSummary: `All ${legsCompleted} legs completed successfully, hedge deviation: ${finalHedgeDeviation}%`,
          });
        } else if (someLegsFailed || legsFailed > 0) {
          await this.options.store.updateMultiLegPlanStatus(planId, {
            status: 'partial',
            outcomeSummary: `${legsCompleted} legs completed, ${legsFailed} legs failed, hedge deviation: ${finalHedgeDeviation}%`,
          });
        }
      } catch (hedgeError) {
        this.options.logger.warn('Failed to record final hedge state', {
          error: hedgeError instanceof Error ? hedgeError.message : String(hedgeError),
        });
      }
    }

    await this.options.store.updateCarryExecution(execution.id, {
      status: 'completed',
      outcomeSummary: detail.action.simulated
        ? 'Carry action completed against simulated venues.'
        : 'Carry action completed against live venues.',
      outcome: {
        stepCount: orderResults.length,
        orderResults,
        executionModes: Array.from(new Set(
          orderResults
            .map((result) => result.executionMode)
            .filter((value): value is 'real' | 'simulated' => value !== null),
        )),
        guardrailViolations,
        multiLegPlanId: planId,
        legsCompleted,
        legsFailed,
        finalHedgeDeviation,
      },
      venueExecutionReference: orderResults
        .map((result) => result.executionReference)
        .filter((value): value is string => value !== null && value.length > 0)
        .join(','),
      completedAt: new Date(),
    });
    await this.options.store.completeCarryAction({
      actionId: detail.action.id,
      latestExecutionId: execution.id,
    });
    await this.refreshVenueTruthInventory(
      Array.from(new Set(detail.plannedOrders.map((plannedOrder) => plannedOrder.venueId))),
    );
    await this.refreshInternalDerivativeState({
      sourceComponent: 'carry-execution',
      sourceRunId: detail.action.strategyRunId,
      sourceReference: execution.id,
    });
    await syncLinkedBundle();
    await this.options.store.auditWriter.write({
      eventId: createId(),
      eventType: 'carry.executed',
      occurredAt: new Date().toISOString(),
      actorType: 'operator',
      actorId: input.actorId,
      sleeveId: 'carry',
      data: {
        carryActionId: detail.action.id,
        executionId: execution.id,
        orderCount: orderResults.length,
        simulated: detail.action.simulated,
        venueExecutionReferences: orderResults
          .map((result) => result.executionReference)
          .filter((value): value is string => value !== null && value.length > 0),
      },
    });

    return {
      actionId: detail.action.id,
      executionId: execution.id,
      orderCount: orderResults.length,
      guardrailViolations,
    };
  }

  // ============================================================================
  // Multi-Leg Execution (Phase R3)
  // ============================================================================
  
  // Note: The executeMultiLegCarryAction method and supporting infrastructure
  // are staged for implementation. The RuntimeStore methods for multi-leg
  // orchestration are complete (createMultiLegPlan, createLegExecution, etc.)
  // but the runtime integration requires additional type alignment work.
  // 
  // See docs/audit/phase-r3-submission-gap-analysis.md for details.

  async executeTreasuryAction(input: {
    actionId: string;
    actorId: string;
    commandId: string | null;
    startedBy: string;
  }): Promise<{
    actionId: string;
    executionId: string;
    treasuryRunId: string | null;
    venueExecutionReference: string | null;
    simulated: boolean;
  }> {
    const detail = await this.options.store.getTreasuryAction(input.actionId);
    if (detail === null) {
      throw new Error(`Treasury action "${input.actionId}" was not found.`);
    }

    if (detail.action.status !== 'queued' && detail.action.status !== 'approved') {
      throw new Error(
        `Treasury action "${input.actionId}" is not executable from status "${detail.action.status}".`,
      );
    }

    const syncLinkedBundle = async (): Promise<void> => {
      if (detail.action.linkedRebalanceProposalId !== null) {
        await this.options.store.syncRebalanceBundleForProposal(detail.action.linkedRebalanceProposalId);
      }
    };

    if (detail.action.actionType === 'rebalance_treasury_budget') {
      const execution = await this.options.store.createTreasuryExecution({
        treasuryActionId: detail.action.id,
        treasuryRunId: detail.action.treasuryRunId,
        commandId: input.commandId,
        status: 'executing',
        executionMode: detail.action.executionMode,
        venueMode: 'reserve',
        simulated: detail.action.simulated,
        requestedBy: input.actorId,
        startedBy: input.startedBy,
        blockedReasons: [],
        outcome: {
          executionKind: 'budget_state_application',
          ...detail.action.details,
        },
      });

      await this.options.store.updateTreasuryExecution(execution.id, {
        status: 'completed',
        outcomeSummary: 'Treasury budget-state action completed without venue-native execution.',
        outcome: {
          executionKind: 'budget_state_application',
          ...detail.action.details,
        },
        lastError: null,
      });
      await this.options.store.completeTreasuryAction({
        actionId: detail.action.id,
        latestExecutionId: execution.id,
      });
      await syncLinkedBundle();

      return {
        actionId: detail.action.id,
        executionId: execution.id,
        treasuryRunId: detail.action.treasuryRunId,
        venueExecutionReference: null,
        simulated: detail.action.simulated,
      };
    }

    const portfolioState = await this.options.portfolioTracker.refresh();
    const venueSnapshots = await this.collectTreasuryVenueSnapshots();
    const venueCapabilities = await this.collectTreasuryVenueCapabilities();
    const evaluation = this.options.treasuryPolicyEngine.evaluate({
      totalNavUsd: portfolioState.totalNav,
      idleCapitalUsd: portfolioState.liquidityReserve,
      venueSnapshots,
      policy: this.options.treasuryPolicy,
    });
    const recommendation: TreasuryRecommendation = {
      actionType: detail.action.actionType === 'allocate_to_venue' ? 'deposit' : 'redeem',
      venueId: detail.action.venueId,
      amountUsd: detail.action.amountUsd,
      reasonCode: detail.action.reasonCode as TreasuryRecommendation['reasonCode'],
      summary: detail.action.summary,
      details: detail.action.details,
    };
    const executionIntent = this.options.treasuryExecutionPlanner.createExecutionIntents({
      evaluation: {
        ...evaluation,
        recommendations: [recommendation],
      },
      policy: this.options.treasuryPolicy,
      executionMode: this.options.executionMode,
      liveExecutionEnabled: this.options.liveExecutionEnabled,
      venueCapabilities,
    })[0];

    if (executionIntent === undefined) {
      throw new Error(`Treasury action "${input.actionId}" could not be planned for execution.`);
    }

    const execution = await this.options.store.createTreasuryExecution({
      treasuryActionId: detail.action.id,
      treasuryRunId: detail.action.treasuryRunId,
      commandId: input.commandId,
      status: executionIntent.executable ? 'executing' : 'failed',
      executionMode: executionIntent.executionMode,
      venueMode: executionIntent.venueMode,
      simulated: executionIntent.simulated,
      requestedBy: input.actorId,
      startedBy: input.startedBy,
      blockedReasons: executionIntent.blockedReasons,
      outcome: {
        executionPlan: executionIntent.effects,
      },
      lastError: executionIntent.executable
        ? null
        : executionIntent.blockedReasons.map((reason) => reason.message).join('; '),
    });

    if (!executionIntent.executable) {
      await this.options.store.failTreasuryAction({
        actionId: detail.action.id,
        latestExecutionId: execution.id,
        errorMessage: executionIntent.blockedReasons.map((reason) => reason.message).join('; '),
      });
      await syncLinkedBundle();
      await this.options.store.auditWriter.write({
        eventId: createId(),
        eventType: 'treasury.execution_blocked',
        occurredAt: new Date().toISOString(),
        actorType: 'operator',
        actorId: input.actorId,
        sleeveId: 'treasury',
        data: {
          treasuryActionId: detail.action.id,
          executionId: execution.id,
          blockedReasons: executionIntent.blockedReasons,
        },
      });
      throw new Error(executionIntent.blockedReasons.map((reason) => reason.message).join('; '));
    }

    await this.options.store.markTreasuryActionExecuting(detail.action.id);

    if (detail.action.venueId === null) {
      await this.options.store.updateTreasuryExecution(execution.id, {
        status: 'failed',
        lastError: 'Treasury action did not target a venue.',
      });
      await this.options.store.failTreasuryAction({
        actionId: detail.action.id,
        latestExecutionId: execution.id,
        errorMessage: 'Treasury action did not target a venue.',
      });
      await syncLinkedBundle();
      throw new Error('Treasury action did not target a venue.');
    }

    const adapter = this.options.treasuryAdapters.get(detail.action.venueId);
    if (adapter === undefined) {
      await this.options.store.updateTreasuryExecution(execution.id, {
        status: 'failed',
        lastError: `Treasury venue "${detail.action.venueId}" is not registered.`,
      });
      await this.options.store.failTreasuryAction({
        actionId: detail.action.id,
        latestExecutionId: execution.id,
        errorMessage: `Treasury venue "${detail.action.venueId}" is not registered.`,
      });
      await syncLinkedBundle();
      throw new Error(`Treasury venue "${detail.action.venueId}" is not registered.`);
    }

    try {
      const result = await adapter.executeTreasuryAction({
        actionType: detail.action.actionType,
        amountUsd: detail.action.amountUsd,
        actorId: input.actorId,
        reasonCode: detail.action.reasonCode,
        executionMode: detail.action.executionMode,
      });

      await this.options.store.setTreasuryCashBalanceUsd(executionIntent.effects.idleCapitalUsd);

      const followUpSummary = await this.runTreasuryEvaluation({
        actorId: input.actorId,
        sourceRunId: null,
        portfolioState,
        idleCapitalUsdOverride: executionIntent.effects.idleCapitalUsd,
      });

      await this.options.store.updateTreasuryExecution(execution.id, {
        status: 'completed',
        outcomeSummary: result.summary,
        outcome: {
          balanceDeltaUsd: result.balanceDeltaUsd,
          allocationUsd: result.allocationUsd,
          withdrawalAvailableUsd: result.withdrawalAvailableUsd,
          followUpTreasuryRunId: followUpSummary.treasuryRunId,
          metadata: result.metadata,
        },
        venueExecutionReference: result.executionReference,
        lastError: null,
      });
      await this.options.store.completeTreasuryAction({
        actionId: detail.action.id,
        latestExecutionId: execution.id,
      });
      await syncLinkedBundle();
      await this.options.store.auditWriter.write({
        eventId: createId(),
        eventType: 'treasury.executed',
        occurredAt: new Date().toISOString(),
        actorType: 'operator',
        actorId: input.actorId,
        sleeveId: 'treasury',
        data: {
          treasuryActionId: detail.action.id,
          executionId: execution.id,
          venueExecutionReference: result.executionReference,
          followUpTreasuryRunId: followUpSummary.treasuryRunId,
          simulated: result.simulated,
        },
      });

      return {
        actionId: detail.action.id,
        executionId: execution.id,
        treasuryRunId: followUpSummary.treasuryRunId,
        venueExecutionReference: result.executionReference,
        simulated: result.simulated,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await this.options.store.updateTreasuryExecution(execution.id, {
        status: 'failed',
        lastError: message,
      });
      await this.options.store.failTreasuryAction({
        actionId: detail.action.id,
        latestExecutionId: execution.id,
        errorMessage: message,
      });
      await syncLinkedBundle();
      await this.options.store.auditWriter.write({
        eventId: createId(),
        eventType: 'treasury.execution_failed',
        occurredAt: new Date().toISOString(),
        actorType: 'operator',
        actorId: input.actorId,
        sleeveId: 'treasury',
        data: {
          treasuryActionId: detail.action.id,
          executionId: execution.id,
          error: message,
        },
      });
      throw error;
    }
  }

  async activateKillSwitch(reason: string, actorId: string): Promise<RuntimeStatusView> {
    await this.options.store.updateRuntimeStatus({
      halted: true,
      lifecycleState: 'paused',
      reason,
      lastUpdatedBy: actorId,
    });
    await this.options.store.auditWriter.write({
      eventId: createId(),
      eventType: 'runtime.kill_switch_activated',
      occurredAt: new Date().toISOString(),
      actorType: 'operator',
      actorId,
      sleeveId: this.options.sleeveId,
      data: { reason },
    });
    return this.getRuntimeStatus();
  }

  async resume(reason: string, actorId: string): Promise<RuntimeStatusView> {
    await this.options.store.updateRuntimeStatus({
      halted: false,
      lifecycleState: 'ready',
      reason,
      lastUpdatedBy: actorId,
    });
    await this.options.store.auditWriter.write({
      eventId: createId(),
      eventType: 'runtime.resumed',
      occurredAt: new Date().toISOString(),
      actorType: 'operator',
      actorId,
      sleeveId: this.options.sleeveId,
      data: { reason },
    });
    return this.getRuntimeStatus();
  }

  async setExecutionMode(mode: 'dry-run'): Promise<RuntimeStatusView> {
    await this.options.store.updateRuntimeStatus({
      executionMode: mode,
      reason: null,
      lastUpdatedBy: 'api-control',
    });
    await this.options.store.auditWriter.write({
      eventId: createId(),
      eventType: 'runtime.execution_mode_changed',
      occurredAt: new Date().toISOString(),
      actorType: 'operator',
      actorId: 'api-control',
      sleeveId: this.options.sleeveId,
      data: { mode },
    });
    return this.getRuntimeStatus();
  }

  async close(): Promise<void> {
    if (this.closed) {
      return;
    }

    await this.options.store.updateRuntimeStatus({
      lifecycleState: 'stopped',
      stoppedAt: new Date(),
      lastUpdatedBy: 'sentinel-runtime',
    });
    await this.options.store.auditWriter.write({
      eventId: createId(),
      eventType: 'runtime.stopped',
      occurredAt: new Date().toISOString(),
      actorType: 'system',
      actorId: 'sentinel-runtime',
      sleeveId: this.options.sleeveId,
      data: {},
    });
    for (const adapter of this.options.adapters.values()) {
      await adapter.disconnect();
    }
    for (const adapter of this.options.treasuryAdapters.values()) {
      await adapter.disconnect();
    }
    for (const adapter of this.options.truthAdapters.values()) {
      await adapter.disconnect();
    }
    await this.options.connection.close();
    this.started = false;
    this.closed = true;
  }

  private async computeCumulativePnl(): Promise<string> {
    const positions = await this.collectPositions();
    const total = positions.reduce(
      (running, position) => running.plus(position.unrealizedPnl).plus(position.realizedPnl),
      new Decimal(0),
    );
    return total.toFixed(8);
  }

  private async collectPositions(): Promise<PositionView[]> {
    const positions: PositionView[] = [];
    for (const adapter of this.options.adapters.values()) {
      const venuePositions = await adapter.getPositions();
      positions.push(...buildPositionViews(this.options.sleeveId, venuePositions));
    }
    return positions;
  }

  private async restoreAdaptersFromPersistence(): Promise<void> {
    const fillHistory = await this.options.store.listFillHistory();
    const simulatedAdapters = Array.from(this.options.adapters.values()).filter(
      (adapter): adapter is SimulatedVenueAdapter => adapter instanceof SimulatedVenueAdapter,
    );

    for (const adapter of simulatedAdapters) {
      adapter.resetSimulationState();
    }

    for (const fill of fillHistory) {
      const adapter = this.options.adapters.get(fill.venueId);
      if (!(adapter instanceof SimulatedVenueAdapter)) {
        continue;
      }

      adapter.replayFilledOrder({
        venueOrderId: fill.venueOrderId,
        clientOrderId: fill.clientOrderId,
        asset: fill.asset,
        side: fill.side,
        size: fill.size,
        fillPrice: fill.price,
        fee: fill.fee,
        reduceOnly: fill.reduceOnly,
        submittedAt: fill.filledAt,
        marketIdentity: fill.marketIdentity,
      });
    }
  }

  private async collectTreasuryVenueSnapshots(): Promise<TreasuryVenueSnapshot[]> {
    const snapshots: TreasuryVenueSnapshot[] = [];

    for (const adapter of this.options.treasuryAdapters.values()) {
      const [venueState, position] = await Promise.all([
        adapter.getVenueState(),
        adapter.getPosition(),
      ]);
      snapshots.push({
        venueId: venueState.venueId,
        venueName: venueState.venueName,
        mode: venueState.mode,
        liquidityTier: venueState.liquidityTier,
        healthy: venueState.healthy,
        aprBps: venueState.aprBps,
        availableCapacityUsd: venueState.availableCapacityUsd,
        currentAllocationUsd: position.currentAllocationUsd,
        withdrawalAvailableUsd: position.withdrawalAvailableUsd,
        concentrationPct: '0.00',
        updatedAt: position.updatedAt,
        metadata: venueState.metadata,
      });
    }

    return snapshots;
  }

  private async collectTreasuryVenueCapabilities(): Promise<TreasuryVenueCapabilities[]> {
    const promotionByVenueId = new Map(
      (await this.options.store.listVenues(500)).map((venue) => [venue.venueId, venue.promotion] as const),
    );
    const capabilities: TreasuryVenueCapabilities[] = [];

    for (const adapter of this.options.treasuryAdapters.values()) {
      const venueCapabilities = await adapter.getCapabilities();
      const promotion = promotionByVenueId.get(venueCapabilities.venueId);
      capabilities.push({
        ...venueCapabilities,
        approvedForLiveUse: promotion?.approvedForLiveUse ?? false,
        sensitiveExecutionEligible: promotion?.sensitiveExecutionEligible ?? false,
        promotionStatus: promotion?.promotionStatus ?? 'not_requested',
        promotionBlockedReasons: promotion?.blockers ?? venueCapabilities.missingPrerequisites,
        metadata: {
          ...venueCapabilities.metadata,
          reportedApprovedForLiveUse: venueCapabilities.approvedForLiveUse,
          connectorPromotionStatus: promotion?.promotionStatus ?? 'not_requested',
        },
      });
    }

    return capabilities;
  }

  private async persistExecutionRecord(runId: string, record: OrderRecord): Promise<void> {
    const marketIdentity = readCanonicalMarketIdentityFromMetadata(record.intent.metadata, {
      venueId: record.intent.venueId,
      asset: record.intent.asset,
      marketType: record.intent.metadata['instrumentType'],
      provenance: 'derived',
      capturedAtStage: 'execution_result',
      source: 'runtime_execution_record',
      notes: ['Execution events expose the best market identity persisted on the runtime order at submission time.'],
    });
    await this.options.store.persistExecutionEvent({
      eventId: createId(),
      runId,
      intentId: record.intent.intentId,
      clientOrderId: record.intent.intentId,
      venueOrderId: record.venueOrderId,
      eventType: 'order.execution_recorded',
      status: record.status,
      payload: {
        filledSize: record.filledSize,
        averageFillPrice: record.averageFillPrice,
        feesPaid: record.feesPaid,
        executionReference: readVenueExecutionReference(record.intent.metadata),
        executionMode: readVenueExecutionMode(record.intent.metadata),
        marketIdentity,
      },
      occurredAt: new Date(),
    });

    if (record.averageFillPrice === null || record.filledSize === '0') {
      return;
    }

    const fill: OrderFill = {
      fillId: `${record.intent.intentId}-fill-1`,
      orderId: record.intent.intentId as OrderFill['orderId'],
      filledSize: record.filledSize,
      fillPrice: record.averageFillPrice,
      fee: record.feesPaid ?? '0',
      feeAsset: record.intent.asset,
      filledAt: record.completedAt ?? record.submittedAt ?? new Date(),
    };

    await this.options.store.persistFill(record.intent.intentId, fill);
  }
}
