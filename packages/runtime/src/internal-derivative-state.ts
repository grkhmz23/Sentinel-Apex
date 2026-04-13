import Decimal from 'decimal.js';

import {
  createCanonicalMarketIdentity,
  readCanonicalMarketIdentityFromMetadata,
  type CanonicalMarketIdentity,
} from '@sentinel-apex/venue-adapters';

import type {
  DerivativeNormalizedMarketIdentityView,
  ExternalDerivativeMarketIdentityView,
  InternalDerivativeAccountLocatorMode,
  InternalDerivativeAccountStateView,
  InternalDerivativeComparisonStatus,
  InternalDerivativeCoverageItemView,
  InternalDerivativeCoverageView,
  InternalDerivativeDataProvenanceView,
  InternalDerivativeHealthStateView,
  InternalDerivativeMarketIdentityComparisonMode,
  InternalDerivativeMarketIdentityKeyType,
  InternalDerivativeMarketIdentityView,
  InternalDerivativeMarketType,
  InternalDerivativeOrderEntryView,
  InternalDerivativeOrderStateView,
  InternalDerivativePositionEntryView,
  InternalDerivativePositionSide,
  InternalDerivativePositionStateView,
  InternalDerivativeSnapshotView,
  OrderView,
  PortfolioSummaryView,
  RiskSummaryView,
  RuntimeReconciliationFindingView,
  VenueDerivativeAccountComparisonView,
  VenueDerivativeComparisonDetailView,
  VenueDerivativeComparisonSummaryView,
  VenueDerivativeHealthComparisonView,
  VenueDerivativeHealthFieldComparisonView,
  VenueDerivativeMarketIdentityComparisonView,
  VenueDerivativeOrderComparisonView,
  VenueDerivativePositionComparisonView,
  VenueSnapshotView,
  VenueTruthComparisonCoverageItemView,
} from './types.js';

const POSITION_TOLERANCE = new Decimal('0.000001');
const MARKET_IDENTITY_KEY_PRIORITY: InternalDerivativeMarketIdentityKeyType[] = [
  'market_index',
  'market_key',
  'market_symbol',
  'asset_market_type',
];

export interface InternalDerivativeTrackedVenueConfig {
  venueId: string;
  venueName: string;
  accountAddress?: string;
  authorityAddress?: string;
  subaccountId?: number;
  accountLabel?: string | null;
}

export interface InternalDerivativeFillRecord {
  venueId: string;
  venueOrderId: string;
  clientOrderId: string;
  asset: string;
  side: 'buy' | 'sell';
  size: string;
  price: string;
  fee: string;
  feeAsset: string | null;
  reduceOnly: boolean;
  filledAt: Date;
  marketIdentity: CanonicalMarketIdentity | null;
  metadata: Record<string, unknown>;
}

interface BuildInternalDerivativeSnapshotInput {
  venue: InternalDerivativeTrackedVenueConfig;
  orders: OrderView[];
  fills: InternalDerivativeFillRecord[];
  portfolioSummary: PortfolioSummaryView | null;
  riskSummary: RiskSummaryView | null;
  capturedAt: string;
  sourceComponent: string;
  sourceRunId?: string | null;
  sourceReference?: string | null;
}

interface PositionAccumulator {
  asset: string;
  marketType: InternalDerivativeMarketType;
  executedBuyQuantity: Decimal;
  executedSellQuantity: Decimal;
  fillCount: number;
  orderIds: Set<string>;
  firstFilledAt: Date | null;
  lastFilledAt: Date | null;
  netQuantity: Decimal;
  averageEntryPrice: Decimal | null;
  marketIdentities: InternalDerivativeMarketIdentityView[];
}

interface IdentityCandidate {
  kind: InternalDerivativeMarketIdentityKeyType;
  key: string;
  exact: boolean;
}

interface ExternalComparablePosition {
  entry: NonNullable<VenueSnapshotView['derivativePositionState']>['positions'][number];
  identity: ExternalDerivativeMarketIdentityView;
  matched: boolean;
}

function provenance(
  classification: InternalDerivativeDataProvenanceView['classification'],
  source: string,
  notes: string[],
): InternalDerivativeDataProvenanceView {
  return {
    classification,
    source,
    notes,
  };
}

function coverage(
  status: InternalDerivativeCoverageItemView['status'],
  reason: string | null,
  limitations: string[] = [],
): InternalDerivativeCoverageItemView {
  return {
    status,
    reason,
    limitations,
  };
}

function comparisonCoverage(
  status: VenueTruthComparisonCoverageItemView['status'],
  reason: string | null,
): VenueTruthComparisonCoverageItemView {
  return {
    status,
    reason,
  };
}

function isTerminalOrderStatus(status: string): boolean {
  return status === 'filled'
    || status === 'cancelled'
    || status === 'expired'
    || status === 'failed';
}

function hasVenueOrderId<T extends { venueOrderId: string | null }>(
  order: T,
): order is T & { venueOrderId: string } {
  return typeof order.venueOrderId === 'string' && order.venueOrderId.length > 0;
}

function normaliseDecimal(value: Decimal): string {
  return value.toFixed(8).replace(/\.?0+$/, '');
}

function normaliseNumber(value: number, precision = 6): string {
  return normaliseDecimal(new Decimal(value).toDecimalPlaces(precision));
}

function orderMarketType(order: Pick<OrderView, 'metadata'>): InternalDerivativeMarketType {
  const instrumentType = order.metadata['instrumentType'];
  if (instrumentType === 'perpetual') {
    return 'perp';
  }
  if (instrumentType === 'spot') {
    return 'spot';
  }

  return 'unknown';
}

function signedQuantity(size: string, side: 'buy' | 'sell'): Decimal {
  const amount = new Decimal(size);
  return side === 'buy' ? amount : amount.negated();
}

function positionSide(quantity: Decimal): InternalDerivativePositionSide {
  if (quantity.gt(0)) {
    return 'long';
  }
  if (quantity.lt(0)) {
    return 'short';
  }

  return 'flat';
}

function remainingOrderSize(order: Pick<OrderView, 'requestedSize' | 'filledSize'>): string {
  const remaining = new Decimal(order.requestedSize).minus(order.filledSize);
  return normaliseDecimal(Decimal.max(remaining, new Decimal(0)));
}

function extractLocatorMode(
  venue: InternalDerivativeTrackedVenueConfig,
): InternalDerivativeAccountLocatorMode {
  if (typeof venue.accountAddress === 'string' && venue.accountAddress.length > 0) {
    return 'user_account_address';
  }
  if (typeof venue.authorityAddress === 'string' && venue.authorityAddress.length > 0) {
    return 'authority_subaccount';
  }

  return 'unconfigured';
}

function parseMarketIndexFromKey(marketKey: string | null): number | null {
  if (marketKey === null) {
    return null;
  }

  const match = /^(?:perp|spot):(\d+)$/.exec(marketKey);
  if (match === null) {
    return null;
  }

  const parsed = Number.parseInt(match[1] ?? '', 10);
  return Number.isNaN(parsed) ? null : parsed;
}

function marketSymbolFromAssetAndType(
  asset: string | null,
  marketType: InternalDerivativeMarketType,
): string | null {
  if (asset === null || asset.length === 0 || marketType === 'unknown') {
    return null;
  }

  return marketType === 'perp' ? `${asset}-PERP` : asset;
}

function assetFromMarketSymbol(
  marketSymbol: string | null,
  marketType: InternalDerivativeMarketType,
): string | null {
  if (marketSymbol === null || marketSymbol.length === 0) {
    return null;
  }

  if (marketType === 'perp' && marketSymbol.endsWith('-PERP')) {
    return marketSymbol.slice(0, -5);
  }

  return marketSymbol;
}

function assetTypeKey(
  marketType: InternalDerivativeMarketType,
  asset: string | null,
): string | null {
  if (marketType === 'unknown' || asset === null || asset.length === 0) {
    return null;
  }

  return `${marketType}:${asset}`;
}

function marketIndexKey(
  marketType: InternalDerivativeMarketType,
  marketIndex: number | null,
): string | null {
  if (marketType === 'unknown' || marketIndex === null) {
    return null;
  }

  return `${marketType}:${marketIndex}`;
}

function marketSymbolKey(
  marketType: InternalDerivativeMarketType,
  marketSymbol: string | null,
): string | null {
  if (marketType === 'unknown' || marketSymbol === null || marketSymbol.length === 0) {
    return null;
  }

  return `${marketType}:${marketSymbol}`;
}

function canonicalIdentityToInternalView(
  identity: CanonicalMarketIdentity,
  fallback: {
    exactNotes: string[];
    derivedNotes: string[];
  },
): InternalDerivativeMarketIdentityView {
  const notes = identity.notes.length > 0
    ? identity.notes
    : identity.confidence === 'exact'
      ? fallback.exactNotes
      : fallback.derivedNotes;
  const classification: InternalDerivativeDataProvenanceView['classification'] = identity.provenance === 'unsupported'
    ? 'unsupported'
    : identity.confidence === 'exact'
      ? 'canonical'
      : 'derived';

  return {
    asset: identity.asset,
    marketType: identity.marketType,
    marketIndex: identity.marketIndex,
    marketKey: identity.marketKey,
    marketSymbol: identity.marketSymbol,
    normalizedKey: identity.normalizedKey,
    normalizedKeyType: identity.normalizedKeyType,
    confidence: identity.confidence === 'partial' ? 'partial' : identity.confidence,
    notes,
    provenance: provenance(
      classification,
      identity.source,
      notes,
    ),
  };
}

function buildInternalMarketIdentity(input: {
  asset: string | null;
  marketType: InternalDerivativeMarketType;
  metadata: Record<string, unknown>;
  source: string;
  exactNotes: string[];
  derivedNotes: string[];
}): InternalDerivativeMarketIdentityView {
  const canonicalIdentity = readCanonicalMarketIdentityFromMetadata(input.metadata, {
    asset: input.asset,
    marketType: input.metadata['instrumentType'] ?? input.marketType,
    provenance: 'derived',
    capturedAtStage: 'internal_snapshot',
    source: input.source,
    notes: input.derivedNotes,
  }) ?? createCanonicalMarketIdentity({
    asset: input.asset,
    marketType: input.marketType,
    provenance: input.marketType === 'unknown' ? 'unsupported' : 'derived',
    capturedAtStage: 'internal_snapshot',
    source: input.source,
    notes: input.marketType === 'unknown'
      ? ['Internal market identity is unsupported because the runtime could not infer a market type from current metadata.']
      : input.derivedNotes,
  });

  return canonicalIdentityToInternalView(canonicalIdentity, {
    exactNotes: input.exactNotes,
    derivedNotes: input.derivedNotes,
  });
}

function mergePositionMarketIdentity(
  asset: string,
  marketType: InternalDerivativeMarketType,
  identities: InternalDerivativeMarketIdentityView[],
): InternalDerivativeMarketIdentityView | null {
  if (identities.length === 0) {
    return buildInternalMarketIdentity({
      asset,
      marketType,
      metadata: {},
      source: 'runtime_fill_ledger',
      exactNotes: ['No exact market identity was persisted on source orders for this internal position row.'],
      derivedNotes: ['Internal market identity is reconstructed from the position asset and market type only.'],
    });
  }

  const uniqueNormalizedKeys = new Set(
    identities
      .map((identity) => identity.normalizedKey)
      .filter((value): value is string => value !== null),
  );

  if (uniqueNormalizedKeys.size <= 1) {
    return identities[0] ?? null;
  }

  return {
    asset,
    marketType,
    marketIndex: null,
    marketKey: null,
    marketSymbol: marketSymbolFromAssetAndType(asset, marketType),
    normalizedKey: assetTypeKey(marketType, asset),
    normalizedKeyType: marketType === 'unknown' ? 'unsupported' : 'asset_market_type',
    confidence: marketType === 'unknown' ? 'unsupported' : 'partial',
    notes: [
      'Multiple internal market identity candidates contributed to this aggregated position row.',
      'The runtime falls back to asset plus market type for comparison and keeps exact market-index parity unsupported for this row.',
    ],
    provenance: provenance(
      marketType === 'unknown' ? 'unsupported' : 'derived',
      'runtime_fill_ledger',
      ['Aggregated internal position identity was reduced to the coarsest stable comparable key.'],
    ),
  };
}

function buildExternalPositionMarketIdentity(
  position: NonNullable<VenueSnapshotView['derivativePositionState']>['positions'][number],
): ExternalDerivativeMarketIdentityView {
  const marketType = position.positionType;
  const marketIndex = position.marketIndex ?? null;
  const marketKey = position.marketKey;
  const marketSymbol = position.marketSymbol;

  if (marketIndex !== null) {
    return {
      asset: assetFromMarketSymbol(marketSymbol, marketType),
      marketType,
      marketIndex,
      marketKey,
      marketSymbol,
      normalizedKey: marketIndexKey(marketType, marketIndex),
      normalizedKeyType: 'market_index',
      confidence: 'exact',
      notes: [],
      provenance: position.provenance ?? null,
    };
  }

  if (marketKey !== null) {
    return {
      asset: assetFromMarketSymbol(marketSymbol, marketType),
      marketType,
      marketIndex: parseMarketIndexFromKey(marketKey),
      marketKey,
      marketSymbol,
      normalizedKey: marketKey,
      normalizedKeyType: 'market_key',
      confidence: 'exact',
      notes: [],
      provenance: position.provenance ?? null,
    };
  }

  if (marketSymbol !== null) {
    return {
      asset: assetFromMarketSymbol(marketSymbol, marketType),
      marketType,
      marketIndex: null,
      marketKey: null,
      marketSymbol,
      normalizedKey: marketSymbolKey(marketType, marketSymbol),
      normalizedKeyType: 'market_symbol',
      confidence: 'exact',
      notes: [],
      provenance: position.provenance ?? null,
    };
  }

  return {
    asset: null,
    marketType,
    marketIndex: null,
    marketKey: null,
    marketSymbol: null,
    normalizedKey: null,
    normalizedKeyType: 'unsupported',
    confidence: 'unsupported',
    notes: ['External position did not expose a normalized market identity.'],
    provenance: position.provenance ?? null,
  };
}

function buildExternalOrderMarketIdentity(
  order: NonNullable<VenueSnapshotView['orderState']>['openOrders'][number],
): ExternalDerivativeMarketIdentityView {
  const marketType = order.marketType ?? 'unknown';
  const marketIndex = order.marketIndex ?? null;
  const marketKey = order.marketKey;
  const marketSymbol = order.marketSymbol;

  if (marketIndex !== null) {
    return {
      asset: assetFromMarketSymbol(marketSymbol, marketType),
      marketType,
      marketIndex,
      marketKey,
      marketSymbol,
      normalizedKey: marketIndexKey(marketType, marketIndex),
      normalizedKeyType: 'market_index',
      confidence: 'exact',
      notes: [],
      provenance: order.provenance ?? null,
    };
  }

  if (marketKey !== null) {
    return {
      asset: assetFromMarketSymbol(marketSymbol, marketType),
      marketType,
      marketIndex: parseMarketIndexFromKey(marketKey),
      marketKey,
      marketSymbol,
      normalizedKey: marketKey,
      normalizedKeyType: 'market_key',
      confidence: 'exact',
      notes: [],
      provenance: order.provenance ?? null,
    };
  }

  if (marketSymbol !== null) {
    return {
      asset: assetFromMarketSymbol(marketSymbol, marketType),
      marketType,
      marketIndex: null,
      marketKey: null,
      marketSymbol,
      normalizedKey: marketSymbolKey(marketType, marketSymbol),
      normalizedKeyType: 'market_symbol',
      confidence: 'exact',
      notes: [],
      provenance: order.provenance ?? null,
    };
  }

  return {
    asset: null,
    marketType,
    marketIndex: null,
    marketKey: null,
    marketSymbol: null,
    normalizedKey: null,
    normalizedKeyType: 'unsupported',
    confidence: 'unsupported',
    notes: ['External open order did not expose a normalized market identity.'],
    provenance: order.provenance ?? null,
  };
}

function internalIdentityCandidates(
  identity: InternalDerivativeMarketIdentityView | null,
): IdentityCandidate[] {
  if (identity === null) {
    return [];
  }

  const candidates: IdentityCandidate[] = [];
  const seen = new Set<string>();
  const push = (kind: InternalDerivativeMarketIdentityKeyType, key: string | null, exact: boolean): void => {
    if (key === null || seen.has(`${kind}:${key}`)) {
      return;
    }
    seen.add(`${kind}:${key}`);
    candidates.push({ kind, key, exact });
  };

  push('market_index', marketIndexKey(identity.marketType, identity.marketIndex), true);
  push('market_key', identity.marketKey, true);
  push('market_symbol', marketSymbolKey(identity.marketType, identity.marketSymbol), identity.confidence === 'exact');
  push('asset_market_type', assetTypeKey(identity.marketType, identity.asset), false);

  return candidates;
}

function externalIdentityCandidates(
  identity: ExternalDerivativeMarketIdentityView | null,
): IdentityCandidate[] {
  if (identity === null) {
    return [];
  }

  const candidates: IdentityCandidate[] = [];
  const seen = new Set<string>();
  const push = (kind: InternalDerivativeMarketIdentityKeyType, key: string | null): void => {
    if (key === null || seen.has(`${kind}:${key}`)) {
      return;
    }
    seen.add(`${kind}:${key}`);
    candidates.push({ kind, key, exact: true });
  };

  push('market_index', marketIndexKey(identity.marketType, identity.marketIndex));
  push('market_key', identity.marketKey);
  push('market_symbol', marketSymbolKey(identity.marketType, identity.marketSymbol));
  push('asset_market_type', assetTypeKey(identity.marketType, identity.asset));

  return candidates;
}

function mismatchIdentityComparison(input: {
  comparisonMode: InternalDerivativeMarketIdentityComparisonMode;
  notes: string[];
  internalIdentity: InternalDerivativeMarketIdentityView | null;
  externalIdentity: ExternalDerivativeMarketIdentityView | null;
  normalizedIdentity: DerivativeNormalizedMarketIdentityView | null;
}): VenueDerivativeMarketIdentityComparisonView {
  return {
    comparable: input.comparisonMode !== 'unsupported',
    status: input.comparisonMode === 'unsupported' ? 'not_comparable' : 'mismatched',
    comparisonMode: input.comparisonMode,
    internalIdentity: input.internalIdentity,
    externalIdentity: input.externalIdentity,
    normalizedIdentity: input.normalizedIdentity,
    notes: input.notes,
  };
}

function compareMarketIdentity(
  internalIdentity: InternalDerivativeMarketIdentityView | null,
  externalIdentity: ExternalDerivativeMarketIdentityView | null,
): VenueDerivativeMarketIdentityComparisonView {
  if (internalIdentity === null || externalIdentity === null) {
    return {
      comparable: false,
      status: 'not_comparable',
      comparisonMode: 'unsupported',
      internalIdentity,
      externalIdentity,
      normalizedIdentity: null,
      notes: ['Both internal and external market identity are required for direct market comparison.'],
    };
  }

  const internalCandidates = internalIdentityCandidates(internalIdentity);
  const externalCandidates = externalIdentityCandidates(externalIdentity);

  for (const kind of MARKET_IDENTITY_KEY_PRIORITY) {
    for (const candidate of internalCandidates.filter((item) => item.kind === kind)) {
      const match = externalCandidates.find((item) => item.kind === kind && item.key === candidate.key);
      if (match === undefined) {
        continue;
      }

      const comparisonMode: InternalDerivativeMarketIdentityComparisonMode = (kind === 'market_index' || kind === 'market_key')
        || (kind === 'market_symbol' && candidate.exact)
        ? 'exact'
        : 'partial';

      return {
        comparable: true,
        status: 'matched',
        comparisonMode,
        internalIdentity,
        externalIdentity,
        normalizedIdentity: {
          key: candidate.key,
          keyType: kind,
          comparisonMode,
          notes: comparisonMode === 'partial'
            ? ['Market identity aligned through a derived internal key rather than a venue-native exact key.']
            : [],
        },
        notes: comparisonMode === 'partial'
          ? ['Internal market identity aligned to external venue truth through a partial or derived key.']
          : [],
      };
    }
  }

  if (
    internalIdentity.marketType === externalIdentity.marketType
    && internalIdentity.marketIndex !== null
    && externalIdentity.marketIndex !== null
  ) {
    return mismatchIdentityComparison({
      comparisonMode: 'exact',
      notes: ['Internal and external market indexes disagree for the same market type.'],
      internalIdentity,
      externalIdentity,
      normalizedIdentity: {
        key: marketIndexKey(internalIdentity.marketType, internalIdentity.marketIndex),
        keyType: 'market_index',
        comparisonMode: 'exact',
        notes: ['Exact market-index comparison detected a mismatch.'],
      },
    });
  }

  if (
    internalIdentity.marketType === externalIdentity.marketType
    && internalIdentity.marketKey !== null
    && externalIdentity.marketKey !== null
  ) {
    return mismatchIdentityComparison({
      comparisonMode: 'exact',
      notes: ['Internal and external market keys disagree for the same market type.'],
      internalIdentity,
      externalIdentity,
      normalizedIdentity: {
        key: internalIdentity.marketKey,
        keyType: 'market_key',
        comparisonMode: 'exact',
        notes: ['Exact market-key comparison detected a mismatch.'],
      },
    });
  }

  return {
    comparable: false,
    status: 'not_comparable',
    comparisonMode: 'unsupported',
    internalIdentity,
    externalIdentity,
    normalizedIdentity: null,
    notes: ['The runtime could not find a truthful normalized market identity shared by the internal and external rows.'],
  };
}

function buildAccountState(
  venue: InternalDerivativeTrackedVenueConfig,
): {
  coverage: InternalDerivativeCoverageItemView;
  state: InternalDerivativeAccountStateView | null;
} {
  const locatorMode = extractLocatorMode(venue);
  if (locatorMode === 'unconfigured') {
    return {
      coverage: coverage(
        'unsupported',
        'No internal account locator is configured for this venue.',
        ['Configure the tracked venue account address to enable canonical internal account identity.'],
      ),
      state: null,
    };
  }

  const notes = locatorMode === 'authority_subaccount' && venue.accountAddress === undefined
    ? ['The runtime tracks authority plus subaccount identity and does not derive the program account address internally.']
    : ['The runtime tracks this venue account directly from configured operator input.'];

  return {
    coverage: coverage('available', null),
    state: {
      venueId: venue.venueId,
      venueName: venue.venueName,
      configured: true,
      accountLocatorMode: locatorMode,
      accountAddress: venue.accountAddress ?? null,
      authorityAddress: venue.authorityAddress ?? null,
      subaccountId: venue.subaccountId ?? null,
      accountLabel: venue.accountLabel ?? null,
      methodology: 'runtime_operator_config',
      notes,
      provenance: provenance(
        'canonical',
        'runtime_derivative_tracking_config',
        ['Internal account identity comes from Sentinel Apex runtime configuration rather than external venue decode.'],
      ),
    },
  };
}

function buildOrderState(
  orders: OrderView[],
): {
  coverage: InternalDerivativeCoverageItemView;
  state: InternalDerivativeOrderStateView;
} {
  const openOrders = orders
    .filter((order) => !isTerminalOrderStatus(order.status))
    .map<InternalDerivativeOrderEntryView>((order) => ({
      orderKey: order.venueOrderId ?? order.clientOrderId,
      clientOrderId: order.clientOrderId,
      venueOrderId: order.venueOrderId,
      asset: order.asset,
      marketType: orderMarketType(order),
      side: order.side === 'sell' ? 'sell' : 'buy',
      status: order.status,
      requestedSize: order.requestedSize,
      filledSize: order.filledSize,
      remainingSize: remainingOrderSize(order),
      requestedPrice: order.requestedPrice,
      reduceOnly: order.reduceOnly,
      executionMode: order.executionMode,
      comparableByVenueOrderId: order.venueOrderId !== null,
      submittedAt: order.submittedAt,
      completedAt: order.completedAt,
      updatedAt: order.updatedAt,
      marketIdentity: order.marketIdentity === null
        ? buildInternalMarketIdentity({
          asset: order.asset,
          marketType: orderMarketType(order),
          metadata: order.metadata,
          source: 'runtime_orders_table',
          exactNotes: ['Internal order market identity is sourced from persisted order metadata.'],
          derivedNotes: ['Internal order market identity is derived from order asset plus instrument type.'],
        })
        : canonicalIdentityToInternalView(order.marketIdentity, {
          exactNotes: ['Internal order market identity is sourced from persisted order metadata.'],
          derivedNotes: ['Internal order market identity is derived from order asset plus instrument type.'],
        }),
      metadata: order.metadata,
      provenance: provenance(
        'canonical',
        'runtime_orders_table',
        ['Internal order inventory is read from persisted runtime order records.'],
      ),
    }))
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));

  const nonComparableCount = openOrders.filter((order) => !order.comparableByVenueOrderId).length;
  const coverageStatus = nonComparableCount > 0 ? 'partial' : 'available';
  const coverageReason = nonComparableCount > 0
    ? `${nonComparableCount} open internal order${nonComparableCount === 1 ? '' : 's'} do not yet have a venue order id for direct comparison.`
    : null;

  return {
    coverage: coverage(
      coverageStatus,
      coverageReason,
      nonComparableCount > 0
        ? ['Orders without a venue order id remain internally canonical but only partially comparable to external open-order inventory.']
        : [],
    ),
    state: {
      openOrderCount: openOrders.length,
      comparableOpenOrderCount: openOrders.length - nonComparableCount,
      nonComparableOpenOrderCount: nonComparableCount,
      openOrders,
      methodology: 'runtime_orders_table',
      notes: nonComparableCount > 0
        ? ['Some internal open orders are still awaiting venue-native order ids.']
        : ['Open internal order inventory comes directly from persisted runtime order records.'],
      provenance: provenance(
        'canonical',
        'runtime_orders_table',
        ['Open-order inventory is based on Sentinel Apex persisted order lifecycle state.'],
      ),
    },
  };
}

function applyFillToAccumulator(
  accumulator: PositionAccumulator,
  fill: InternalDerivativeFillRecord,
): void {
  const size = new Decimal(fill.size);
  const price = new Decimal(fill.price);
  const signed = signedQuantity(fill.size, fill.side);

  if (fill.side === 'buy') {
    accumulator.executedBuyQuantity = accumulator.executedBuyQuantity.plus(size);
  } else {
    accumulator.executedSellQuantity = accumulator.executedSellQuantity.plus(size);
  }

  accumulator.fillCount += 1;
  accumulator.firstFilledAt = accumulator.firstFilledAt === null || fill.filledAt < accumulator.firstFilledAt
    ? fill.filledAt
    : accumulator.firstFilledAt;
  accumulator.lastFilledAt = accumulator.lastFilledAt === null || fill.filledAt > accumulator.lastFilledAt
    ? fill.filledAt
    : accumulator.lastFilledAt;

  if (accumulator.netQuantity.eq(0) || accumulator.netQuantity.isPositive() === signed.isPositive()) {
    const existingAbs = accumulator.netQuantity.abs();
    const incomingAbs = signed.abs();
    const notional = (accumulator.averageEntryPrice ?? new Decimal(0))
      .times(existingAbs)
      .plus(price.times(incomingAbs));
    accumulator.netQuantity = accumulator.netQuantity.plus(signed);
    accumulator.averageEntryPrice = accumulator.netQuantity.eq(0)
      ? null
      : notional.div(existingAbs.plus(incomingAbs));
    return;
  }

  const existingAbs = accumulator.netQuantity.abs();
  const incomingAbs = signed.abs();

  accumulator.netQuantity = accumulator.netQuantity.plus(signed);
  if (incomingAbs.lt(existingAbs)) {
    return;
  }

  accumulator.averageEntryPrice = accumulator.netQuantity.eq(0) ? null : price;
}

function buildPositionState(
  orders: OrderView[],
  fills: InternalDerivativeFillRecord[],
): {
  coverage: InternalDerivativeCoverageItemView;
  state: InternalDerivativePositionStateView;
} {
  const ordersByClientId = new Map(orders.map((order) => [order.clientOrderId, order]));
  const grouped = new Map<string, PositionAccumulator>();

  for (const fill of fills.slice().sort((left, right) => left.filledAt.getTime() - right.filledAt.getTime())) {
    const order = ordersByClientId.get(fill.clientOrderId);
    const marketType = order === undefined ? 'unknown' : orderMarketType(order);
    const fillIdentity = fill.marketIdentity !== null
      ? canonicalIdentityToInternalView(fill.marketIdentity, {
        exactNotes: ['Internal position identity inherited exact market metadata from a persisted fill.'],
        derivedNotes: ['Internal position identity was derived from persisted fill metadata.'],
      })
      : order?.marketIdentity !== null && order?.marketIdentity !== undefined
        ? canonicalIdentityToInternalView(order.marketIdentity, {
          exactNotes: ['Internal position identity inherited exact market metadata from a source order.'],
          derivedNotes: ['Internal position identity was derived from source order asset plus market type.'],
        })
        : (order === undefined ? null : buildInternalMarketIdentity({
          asset: order.asset,
          marketType,
          metadata: order.metadata,
          source: 'runtime_fill_ledger',
          exactNotes: ['Internal position identity inherited exact market metadata from a source order.'],
          derivedNotes: ['Internal position identity was derived from source order asset plus market type.'],
        }));
    const key = fillIdentity?.confidence === 'exact' && fillIdentity.normalizedKey !== null
      ? fillIdentity.normalizedKey
      : `${marketType}:${fill.asset}`;
    const accumulator = grouped.get(key) ?? {
      asset: fill.asset,
      marketType,
      executedBuyQuantity: new Decimal(0),
      executedSellQuantity: new Decimal(0),
      fillCount: 0,
      orderIds: new Set<string>(),
      firstFilledAt: null,
      lastFilledAt: null,
      netQuantity: new Decimal(0),
      averageEntryPrice: null,
      marketIdentities: [],
    };
    accumulator.orderIds.add(fill.clientOrderId);
    if (fillIdentity !== null) {
      accumulator.marketIdentities.push(fillIdentity);
    }
    applyFillToAccumulator(accumulator, fill);
    grouped.set(key, accumulator);
  }

  const positions = Array.from(grouped.entries())
    .filter(([, accumulator]) => !accumulator.netQuantity.eq(0))
    .map<InternalDerivativePositionEntryView>(([positionKey, accumulator]) => {
      const marketIdentity = mergePositionMarketIdentity(
        accumulator.asset,
        accumulator.marketType,
        accumulator.marketIdentities,
      );

      return {
        positionKey: marketIdentity?.normalizedKey ?? positionKey,
        asset: accumulator.asset,
        marketType: accumulator.marketType,
        side: positionSide(accumulator.netQuantity),
        netQuantity: normaliseDecimal(accumulator.netQuantity),
        averageEntryPrice: accumulator.averageEntryPrice === null
          ? null
          : normaliseDecimal(accumulator.averageEntryPrice),
        executedBuyQuantity: normaliseDecimal(accumulator.executedBuyQuantity),
        executedSellQuantity: normaliseDecimal(accumulator.executedSellQuantity),
        fillCount: accumulator.fillCount,
        sourceOrderCount: accumulator.orderIds.size,
        firstFilledAt: accumulator.firstFilledAt?.toISOString() ?? null,
        lastFilledAt: accumulator.lastFilledAt?.toISOString() ?? null,
        marketIdentity,
        metadata: {},
        provenance: provenance(
          'derived',
          'runtime_fill_ledger',
          ['Internal derivative positions are derived from persisted fills joined to canonical runtime orders.'],
        ),
      };
    })
    .sort((left, right) => left.positionKey.localeCompare(right.positionKey));

  const unknownTypeCount = positions.filter((position) => position.marketType === 'unknown').length;
  const coverageStatus = unknownTypeCount > 0 ? 'partial' : 'available';
  const coverageReason = unknownTypeCount > 0
    ? `${unknownTypeCount} internal position${unknownTypeCount === 1 ? '' : 's'} cannot be mapped to a known market type from current order metadata.`
    : null;

  return {
    coverage: coverage(
      coverageStatus,
      coverageReason,
      unknownTypeCount > 0
        ? ['Unknown market-type rows remain internally tracked but only partially comparable to external venue positions.']
        : [],
    ),
    state: {
      positions,
      openPositionCount: positions.length,
      methodology: 'runtime_fill_ledger',
      notes: positions.length === 0
        ? ['No internally executed derivative inventory is currently open for this venue.']
        : ['Positions are reconstructed from persisted fills rather than external venue state.'],
      provenance: provenance(
        'derived',
        'runtime_fill_ledger',
        ['Position inventory is derived from internal fill history and preserves the runtime/execution boundary explicitly.'],
      ),
    },
  };
}

function unsupportedHealthState(
  reason: string,
  notes: string[],
): {
  coverage: InternalDerivativeCoverageItemView;
  state: InternalDerivativeHealthStateView;
} {
  return {
    coverage: coverage(
      'unsupported',
      reason,
      ['Allocator and risk summaries are not treated as exact venue-native margin state.'],
    ),
    state: {
      healthStatus: 'unknown',
      modelType: 'unsupported',
      comparisonMode: 'unsupported',
      riskPosture: null,
      collateralLikeUsd: null,
      liquidityReserveUsd: null,
      grossExposureUsd: null,
      netExposureUsd: null,
      venueExposureUsd: null,
      exposureToNavRatio: null,
      liquidityReservePct: null,
      leverage: null,
      openPositionCount: null,
      openOrderCount: null,
      openCircuitBreakers: [],
      unsupportedReasons: [reason],
      methodology: 'unsupported_internal_health_model',
      notes,
      provenance: provenance(
        'unsupported',
        'unsupported_internal_health_model',
        ['Internal health remains unsupported until sufficient internal portfolio and risk projections exist.'],
      ),
    },
  };
}

function buildHealthState(input: {
  venueId: string;
  portfolioSummary: PortfolioSummaryView | null;
  riskSummary: RiskSummaryView | null;
  positionState: InternalDerivativePositionStateView;
  orderState: InternalDerivativeOrderStateView;
}): {
  coverage: InternalDerivativeCoverageItemView;
  state: InternalDerivativeHealthStateView;
} {
  if (input.portfolioSummary === null) {
    return unsupportedHealthState(
      'No internal portfolio summary is currently persisted, so internal health posture cannot be derived.',
      ['Run a runtime cycle or projection rebuild to populate portfolio current state before deriving internal health posture.'],
    );
  }

  if (input.riskSummary === null) {
    return unsupportedHealthState(
      'No internal risk summary is currently persisted, so internal health posture cannot be derived.',
      ['Run a runtime cycle or projection rebuild to populate risk current state before deriving internal health posture.'],
    );
  }

  const totalNav = new Decimal(input.portfolioSummary.totalNav || '0');
  const venueExposure = new Decimal(input.portfolioSummary.venueExposures[input.venueId] ?? '0');
  const exposureToNavRatio = totalNav.lte(0)
    ? null
    : normaliseDecimal(venueExposure.div(totalNav));
  const riskPosture = input.riskSummary.summary.riskLevel;
  const healthStatus = riskPosture === 'high' || riskPosture === 'critical'
    ? 'degraded'
    : 'healthy';

  return {
    coverage: coverage(
      'available',
      null,
      [
        'Internal health posture is derived from internal portfolio and risk projections, not from venue-native margin math.',
        'Only band-level health comparison is currently truthful; exact margin fields remain external-only.',
      ],
    ),
    state: {
      healthStatus,
      modelType: 'internal_risk_posture',
      comparisonMode: 'status_band_only',
      riskPosture,
      collateralLikeUsd: input.portfolioSummary.liquidityReserve,
      liquidityReserveUsd: input.portfolioSummary.liquidityReserve,
      grossExposureUsd: input.portfolioSummary.grossExposure,
      netExposureUsd: input.portfolioSummary.netExposure,
      venueExposureUsd: normaliseDecimal(venueExposure),
      exposureToNavRatio,
      liquidityReservePct: input.riskSummary.summary.liquidityReservePct,
      leverage: normaliseNumber(input.riskSummary.summary.leverage, 4),
      openPositionCount: input.positionState.openPositionCount,
      openOrderCount: input.orderState.openOrderCount,
      openCircuitBreakers: [...input.riskSummary.summary.openCircuitBreakers],
      unsupportedReasons: [
        'Exact venue collateral, free collateral, margin ratio, and requirement fields remain external-only.',
      ],
      methodology: 'portfolio_current_plus_risk_current',
      notes: [
        'Internal health posture is derived from persisted portfolio and risk read models.',
        'Collateral-like posture maps to internal liquidity reserve rather than exact venue collateral accounting.',
        'This view is suitable for operator comparison and audit, but it is not a canonical venue-native margin engine.',
      ],
      provenance: provenance(
        'derived',
        'portfolio_current_plus_risk_current',
        ['Internal health posture is derived from internal runtime projections rather than external venue truth.'],
      ),
    },
  };
}

export function buildInternalDerivativeSnapshot(
  input: BuildInternalDerivativeSnapshotInput,
): Omit<InternalDerivativeSnapshotView, 'id' | 'updatedAt'> {
  const account = buildAccountState(input.venue);
  const orderState = buildOrderState(input.orders);
  const positionState = buildPositionState(input.orders, input.fills);
  const healthState = buildHealthState({
    venueId: input.venue.venueId,
    portfolioSummary: input.portfolioSummary,
    riskSummary: input.riskSummary,
    positionState: positionState.state,
    orderState: orderState.state,
  });

  const coverageView: InternalDerivativeCoverageView = {
    accountState: account.coverage,
    positionState: positionState.coverage,
    healthState: healthState.coverage,
    orderState: orderState.coverage,
  };

  return {
    venueId: input.venue.venueId,
    venueName: input.venue.venueName,
    sourceComponent: input.sourceComponent,
    sourceRunId: input.sourceRunId ?? null,
    sourceReference: input.sourceReference ?? null,
    capturedAt: input.capturedAt,
    coverage: coverageView,
    accountState: account.state,
    positionState: positionState.state,
    healthState: healthState.state,
    orderState: orderState.state,
    metadata: {
      sourceCounts: {
        totalOrders: input.orders.length,
        totalFills: input.fills.length,
        openOrders: orderState.state.openOrderCount,
        openPositions: positionState.state.openPositionCount,
      },
      healthInputs: {
        portfolioSummaryAvailable: input.portfolioSummary !== null,
        riskSummaryAvailable: input.riskSummary !== null,
      },
    },
  };
}

function countUniqueMismatchIds(findings: RuntimeReconciliationFindingView[]): number {
  return new Set(findings.map((finding) => finding.mismatchId).filter((value): value is string => value !== null)).size;
}

function compareAccountState(
  internalState: InternalDerivativeSnapshotView | null,
  externalSnapshot: VenueSnapshotView | null,
): VenueDerivativeAccountComparisonView {
  const internalAccount = internalState?.accountState ?? null;
  const externalAccount = externalSnapshot?.derivativeAccountState ?? null;

  if (internalAccount === null || externalAccount === null) {
    return {
      comparable: false,
      status: 'not_comparable',
      internalState: internalAccount,
      externalState: externalAccount,
      notes: ['Both internal and external account identity must be present for direct subaccount comparison.'],
    };
  }

  let mismatched = false;
  const notes: string[] = [];

  if (internalAccount.accountAddress !== null && externalAccount.accountAddress !== null) {
    mismatched ||= internalAccount.accountAddress !== externalAccount.accountAddress;
  }

  if (internalAccount.authorityAddress !== null && externalAccount.authorityAddress !== null) {
    mismatched ||= internalAccount.authorityAddress !== externalAccount.authorityAddress;
  }

  if (internalAccount.subaccountId !== null && externalAccount.subaccountId !== null) {
    mismatched ||= internalAccount.subaccountId !== externalAccount.subaccountId;
  }

  if (internalAccount.accountAddress === null && internalAccount.accountLocatorMode === 'authority_subaccount') {
    notes.push('Internal account identity is compared through configured authority and subaccount rather than a derived user account address.');
  }

  return {
    comparable: true,
    status: mismatched ? 'mismatched' : 'matched',
    internalState: internalAccount,
    externalState: externalAccount,
    notes,
  };
}

function externalPositionQuantity(
  position: NonNullable<VenueSnapshotView['derivativePositionState']>['positions'][number],
): Decimal | null {
  if (position.baseAssetAmount === null) {
    return null;
  }

  const quantity = new Decimal(position.baseAssetAmount);
  if (position.side === 'short') {
    return quantity.abs().negated();
  }
  if (position.side === 'long') {
    return quantity.abs();
  }

  return quantity;
}

function comparePositions(
  internalState: InternalDerivativeSnapshotView | null,
  externalSnapshot: VenueSnapshotView | null,
): {
  comparisons: VenueDerivativePositionComparisonView[];
  matchedCount: number;
  mismatchedCount: number;
  skippedInternalCount: number;
  skippedExternalCount: number;
  exactIdentityCount: number;
  partialIdentityCount: number;
  identityGapCount: number;
} {
  const internalPositions = internalState?.positionState?.positions ?? [];
  const skippedInternalCount = internalPositions.filter((position) => position.marketType === 'unknown').length;
  const externalEntries: ExternalComparablePosition[] = (externalSnapshot?.derivativePositionState?.positions ?? [])
    .map((entry) => ({
      entry,
      identity: buildExternalPositionMarketIdentity(entry),
      matched: false,
    }))
    .filter((item) => item.entry.positionType !== 'unknown');
  const skippedExternalCount = (externalSnapshot?.derivativePositionState?.positions ?? [])
    .filter((position) => position.positionType === 'unknown')
    .length;

  let matchedCount = 0;
  let mismatchedCount = 0;
  let exactIdentityCount = 0;
  let partialIdentityCount = 0;
  let identityGapCount = 0;
  const comparisons: VenueDerivativePositionComparisonView[] = [];

  const externalHasAssetTypeSibling = (
    asset: string,
    marketType: InternalDerivativeMarketType,
  ): boolean => externalEntries.some((entry) =>
    !entry.matched
    && entry.identity.asset === asset
    && entry.identity.marketType === marketType,
  );

  for (const internalPosition of internalPositions) {
    const internalIdentity = internalPosition.marketIdentity;
    let matchedExternalIndex: number | null = null;

    if (internalIdentity !== null) {
      const candidates = internalIdentityCandidates(internalIdentity);
      for (const kind of MARKET_IDENTITY_KEY_PRIORITY) {
        const sameKindCandidates = candidates.filter((candidate) => candidate.kind === kind);
        if (sameKindCandidates.length === 0) {
          continue;
        }

        const matches = externalEntries
          .map((entry, index) => ({ entry, index }))
          .filter(({ entry }) => !entry.matched)
          .filter(({ entry }) => {
            const externalCandidates = externalIdentityCandidates(entry.identity);
            return sameKindCandidates.some((candidate) =>
              externalCandidates.some((externalCandidate) =>
                externalCandidate.kind === kind && externalCandidate.key === candidate.key,
              ),
            );
          });

        if (matches.length === 1) {
          matchedExternalIndex = matches[0]?.index ?? null;
          break;
        }

        if (matches.length > 1) {
          const marketIdentityComparison: VenueDerivativeMarketIdentityComparisonView = {
            comparable: false,
            status: 'not_comparable',
            comparisonMode: 'unsupported',
            internalIdentity,
            externalIdentity: null,
            normalizedIdentity: null,
            notes: ['Multiple external positions matched the same internal normalized identity, so exact pairing is intentionally withheld.'],
          };
          identityGapCount += 1;
          comparisons.push({
            comparisonKey: internalIdentity.normalizedKey ?? internalPosition.positionKey,
            asset: internalPosition.asset,
            marketType: internalPosition.marketType,
            comparable: false,
            status: 'not_comparable',
            quantityDelta: null,
            internalPosition,
            externalPosition: null,
            marketIdentityComparison,
            notes: ['Internal position could not be paired to a unique external position row.'],
          });
          matchedExternalIndex = null;
          break;
        }
      }
    }

    if (matchedExternalIndex === null) {
      if (comparisons.some((comparison) => comparison.internalPosition?.positionKey === internalPosition.positionKey)) {
        continue;
      }

      const hasSibling = externalHasAssetTypeSibling(internalPosition.asset, internalPosition.marketType);
      const marketIdentityComparison: VenueDerivativeMarketIdentityComparisonView = {
        comparable: false,
        status: 'not_comparable',
        comparisonMode: 'unsupported',
        internalIdentity,
        externalIdentity: null,
        normalizedIdentity: null,
        notes: hasSibling
          ? ['External inventory exists for the same asset and market type, but market identity could not be aligned truthfully.']
          : ['No external position row matched this internal position identity.'],
      };
      const status: InternalDerivativeComparisonStatus = hasSibling ? 'not_comparable' : 'internal_only';
      if (status === 'not_comparable') {
        identityGapCount += 1;
      } else {
        mismatchedCount += 1;
      }
      comparisons.push({
        comparisonKey: internalIdentity?.normalizedKey ?? internalPosition.positionKey,
        asset: internalPosition.asset,
        marketType: internalPosition.marketType,
        comparable: false,
        status,
        quantityDelta: null,
        internalPosition,
        externalPosition: null,
        marketIdentityComparison,
        notes: marketIdentityComparison.notes,
      });
      continue;
    }

    const externalMatch = externalEntries[matchedExternalIndex];
    if (externalMatch === undefined) {
      continue;
    }
    externalMatch.matched = true;
    const marketIdentityComparison = compareMarketIdentity(
      internalIdentity,
      externalMatch.identity,
    );
    const externalQuantity = externalPositionQuantity(externalMatch.entry);
    const quantityDelta = externalQuantity === null
      ? null
      : normaliseDecimal(new Decimal(internalPosition.netQuantity).minus(externalQuantity));
    const deltaWithinTolerance = quantityDelta === null
      ? true
      : new Decimal(quantityDelta).abs().lte(POSITION_TOLERANCE);
    const status = marketIdentityComparison.status === 'mismatched'
      ? 'mismatched'
      : deltaWithinTolerance
        ? 'matched'
        : 'mismatched';

    if (status === 'matched') {
      matchedCount += 1;
    } else {
      mismatchedCount += 1;
    }

    if (marketIdentityComparison.comparisonMode === 'exact') {
      exactIdentityCount += 1;
    } else if (marketIdentityComparison.comparisonMode === 'partial') {
      partialIdentityCount += 1;
    }

    comparisons.push({
      comparisonKey: marketIdentityComparison.normalizedIdentity?.key
        ?? internalIdentity?.normalizedKey
        ?? externalMatch.identity.normalizedKey
        ?? internalPosition.positionKey,
      asset: internalPosition.asset,
      marketType: internalPosition.marketType,
      comparable: true,
      status,
      quantityDelta,
      internalPosition,
      externalPosition: externalMatch.entry,
      marketIdentityComparison,
      notes: marketIdentityComparison.comparisonMode === 'partial'
        ? ['Position inventory was aligned through partial market identity normalization.']
        : [],
    });
  }

  for (const externalEntry of externalEntries.filter((entry) => !entry.matched)) {
    mismatchedCount += 1;
    comparisons.push({
      comparisonKey: externalEntry.identity.normalizedKey
        ?? externalEntry.entry.marketKey
        ?? externalEntry.entry.marketSymbol
        ?? 'external-only',
      asset: externalEntry.identity.asset ?? 'unknown',
      marketType: externalEntry.identity.marketType,
      comparable: false,
      status: 'external_only',
      quantityDelta: null,
      internalPosition: null,
      externalPosition: externalEntry.entry,
      marketIdentityComparison: {
        comparable: false,
        status: 'not_comparable',
        comparisonMode: 'unsupported',
        internalIdentity: null,
        externalIdentity: externalEntry.identity,
        normalizedIdentity: null,
        notes: ['No internal position row matched this external position identity.'],
      },
      notes: [],
    });
  }

  comparisons.sort((left, right) => left.comparisonKey.localeCompare(right.comparisonKey));

  return {
    comparisons,
    matchedCount,
    mismatchedCount,
    skippedInternalCount,
    skippedExternalCount,
    exactIdentityCount,
    partialIdentityCount,
    identityGapCount,
  };
}

function compareOrders(
  internalState: InternalDerivativeSnapshotView | null,
  externalSnapshot: VenueSnapshotView | null,
): {
  comparisons: VenueDerivativeOrderComparisonView[];
  matchedCount: number;
  mismatchedCount: number;
  skippedInternalCount: number;
} {
  const internalOpenOrders = internalState?.orderState?.openOrders ?? [];
  const internalComparable = new Map(
    internalOpenOrders
      .filter(hasVenueOrderId)
      .map((order) => [order.venueOrderId, order] as const),
  );
  const skippedInternalCount = internalOpenOrders.filter((order) => order.venueOrderId === null).length;
  const externalComparable = new Map(
    (externalSnapshot?.orderState?.openOrders ?? [])
      .filter((order) => order.venueOrderId !== null)
      .map((order) => [String(order.venueOrderId), order] as const),
  );
  const keys = new Set([
    ...Array.from(internalComparable.keys()),
    ...Array.from(externalComparable.keys()),
  ]);

  let matchedCount = 0;
  let mismatchedCount = 0;
  const comparisons: VenueDerivativeOrderComparisonView[] = [];

  for (const key of Array.from(keys.values()).sort()) {
    const internalOrder = internalComparable.get(key) ?? null;
    const externalOrder = externalComparable.get(key) ?? null;
    const marketIdentityComparison = compareMarketIdentity(
      internalOrder?.marketIdentity ?? null,
      externalOrder === null ? null : buildExternalOrderMarketIdentity(externalOrder),
    );
    let status: InternalDerivativeComparisonStatus;
    let remainingSizeDelta: string | null = null;

    if (internalOrder === null) {
      status = 'external_only';
      mismatchedCount += 1;
    } else if (externalOrder === null) {
      status = 'internal_only';
      mismatchedCount += 1;
    } else {
      remainingSizeDelta = externalOrder.quantity === null
        ? null
        : normaliseDecimal(new Decimal(internalOrder.remainingSize).minus(externalOrder.quantity));
      const sameSide = internalOrder.side === externalOrder.side;
      const sameReduceOnly = internalOrder.reduceOnly === (externalOrder.reduceOnly ?? false);
      const sameRemaining = remainingSizeDelta === null
        || new Decimal(remainingSizeDelta).abs().lte(POSITION_TOLERANCE);
      const sameIdentity = marketIdentityComparison.status !== 'mismatched';
      status = sameSide && sameReduceOnly && sameRemaining && sameIdentity ? 'matched' : 'mismatched';
      if (status === 'matched') {
        matchedCount += 1;
      } else {
        mismatchedCount += 1;
      }
    }

    comparisons.push({
      comparisonKey: String(key),
      comparable: true,
      status,
      remainingSizeDelta,
      internalOrder,
      externalOrder,
      marketIdentityComparison,
      notes: marketIdentityComparison.comparisonMode === 'partial'
        ? ['Order market identity aligned through a partial normalized key.']
        : [],
    });
  }

  return {
    comparisons,
    matchedCount,
    mismatchedCount,
    skippedInternalCount,
  };
}

function healthComparison(
  internalState: InternalDerivativeSnapshotView | null,
  externalSnapshot: VenueSnapshotView | null,
): VenueDerivativeHealthComparisonView {
  const internalHealth = internalState?.healthState ?? null;
  const externalHealth = externalSnapshot?.derivativeHealthState ?? null;

  if (internalHealth === null || externalHealth === null) {
    return {
      comparable: false,
      status: 'not_comparable',
      comparisonMode: 'unsupported',
      internalState: internalHealth,
      externalState: externalHealth,
      fields: [],
      notes: ['Both internal and external health sections must be present for comparison.'],
    };
  }

  if (internalHealth.comparisonMode === 'unsupported') {
    return {
      comparable: false,
      status: 'not_comparable',
      comparisonMode: 'unsupported',
      internalState: internalHealth,
      externalState: externalHealth,
      fields: [],
      notes: ['The runtime does not yet maintain a truthfully comparable internal health posture for this venue.'],
    };
  }

  const healthStatusField: VenueDerivativeHealthFieldComparisonView = {
    field: 'healthStatus',
    comparable: internalHealth.healthStatus !== 'unknown' && externalHealth.healthStatus !== 'unknown',
    status: internalHealth.healthStatus === 'unknown' || externalHealth.healthStatus === 'unknown'
      ? 'not_comparable'
      : internalHealth.healthStatus === externalHealth.healthStatus
        ? 'matched'
        : 'mismatched',
    internalValue: internalHealth.healthStatus,
    externalValue: externalHealth.healthStatus,
    reason: internalHealth.healthStatus === 'unknown' || externalHealth.healthStatus === 'unknown'
      ? 'Health status band comparison requires both internal and external status values.'
      : null,
  };

  const unsupportedFields: VenueDerivativeHealthFieldComparisonView[] = [
    {
      field: 'collateralLikeUsd',
      comparable: false,
      status: 'not_comparable',
      internalValue: internalHealth.collateralLikeUsd,
      externalValue: externalHealth.collateralUsd,
      reason: 'Internal collateral-like posture maps to liquidity reserve, not exact venue collateral.',
    },
    {
      field: 'freeCollateralUsd',
      comparable: false,
      status: 'not_comparable',
      internalValue: internalHealth.liquidityReserveUsd,
      externalValue: externalHealth.freeCollateralUsd,
      reason: 'Internal liquidity reserve is not equivalent to venue free collateral.',
    },
    {
      field: 'initialMarginRequirementUsd',
      comparable: false,
      status: 'not_comparable',
      internalValue: null,
      externalValue: externalHealth.initialMarginRequirementUsd,
      reason: 'The runtime does not yet maintain an internal initial-margin model.',
    },
    {
      field: 'maintenanceMarginRequirementUsd',
      comparable: false,
      status: 'not_comparable',
      internalValue: null,
      externalValue: externalHealth.maintenanceMarginRequirementUsd,
      reason: 'The runtime does not yet maintain an internal maintenance-margin model.',
    },
    {
      field: 'marginRatio',
      comparable: false,
      status: 'not_comparable',
      internalValue: internalHealth.exposureToNavRatio,
      externalValue: externalHealth.marginRatio,
      reason: 'Exposure-to-NAV ratio is not the same metric as venue margin ratio.',
    },
    {
      field: 'leverage',
      comparable: false,
      status: 'not_comparable',
      internalValue: internalHealth.leverage,
      externalValue: externalHealth.leverage,
      reason: 'Internal leverage is portfolio-level and not directly equivalent to venue subaccount leverage.',
    },
  ];

  return {
    comparable: healthStatusField.comparable,
    status: healthStatusField.status,
    comparisonMode: 'status_band_only',
    internalState: internalHealth,
    externalState: externalHealth,
    fields: [healthStatusField, ...unsupportedFields],
    notes: [
      'Only band-level health-status comparison is currently truthful.',
      'Exact venue collateral and margin metrics remain external-only until the runtime owns an equivalent internal model.',
    ],
  };
}

export function buildVenueDerivativeComparisonDetail(input: {
  venueId: string;
  venueName: string;
  internalState: InternalDerivativeSnapshotView | null;
  externalSnapshot: VenueSnapshotView | null;
  activeFindings: RuntimeReconciliationFindingView[];
}): VenueDerivativeComparisonDetailView {
  const accountComparison = compareAccountState(input.internalState, input.externalSnapshot);
  const positionComparison = comparePositions(input.internalState, input.externalSnapshot);
  const orderComparison = compareOrders(input.internalState, input.externalSnapshot);
  const derivativeHealthComparison = healthComparison(input.internalState, input.externalSnapshot);

  const subaccountIdentity = input.externalSnapshot?.truthCoverage.derivativeAccountState.status !== 'available'
    ? comparisonCoverage('unsupported', 'External derivative-account truth is not available for comparison.')
    : accountComparison.comparable
      ? comparisonCoverage('available', null)
      : comparisonCoverage('unsupported', 'No internal canonical account locator is available for direct comparison.');

  const positionInventory = input.externalSnapshot?.truthCoverage.derivativePositionState.status !== 'available'
    ? comparisonCoverage('unsupported', 'External position truth is not available for comparison.')
    : input.internalState === null
      ? comparisonCoverage('unsupported', 'No internal derivative state snapshot is currently persisted for this venue.')
      : positionComparison.skippedInternalCount > 0
        || positionComparison.skippedExternalCount > 0
        || positionComparison.identityGapCount > 0
        ? comparisonCoverage(
          'partial',
          'Position comparison is available only for the subset that can be aligned truthfully.',
        )
        : comparisonCoverage('available', null);

  const marketIdentity = input.externalSnapshot?.truthCoverage.derivativePositionState.status !== 'available'
    ? comparisonCoverage('unsupported', 'External position truth is not available for market identity comparison.')
    : input.internalState === null
      ? comparisonCoverage('unsupported', 'No internal derivative state snapshot is currently persisted for this venue.')
      : positionComparison.partialIdentityCount > 0 || positionComparison.identityGapCount > 0
        ? comparisonCoverage(
          'partial',
          'Some position comparisons rely on derived market identity or remain identity-gapped.',
        )
        : comparisonCoverage('available', null);

  const orderInventory = input.externalSnapshot?.truthCoverage.orderState.status !== 'available'
    ? comparisonCoverage('unsupported', 'External open-order truth is not available for comparison.')
    : input.internalState === null
      ? comparisonCoverage('unsupported', 'No internal derivative state snapshot is currently persisted for this venue.')
      : orderComparison.skippedInternalCount > 0
        ? comparisonCoverage(
          'partial',
          'Some internal open orders do not yet have venue-native order ids for exact comparison.',
        )
        : comparisonCoverage('available', null);

  const healthState = input.externalSnapshot?.truthCoverage.derivativeHealthState.status !== 'available'
    ? comparisonCoverage('unsupported', 'External health truth is not available for comparison.')
    : derivativeHealthComparison.comparisonMode === 'status_band_only'
      ? comparisonCoverage(
        'partial',
        'Only band-level internal-vs-external health comparison is currently supported.',
      )
      : comparisonCoverage(
        derivativeHealthComparison.comparable ? 'available' : 'unsupported',
        derivativeHealthComparison.comparable
          ? null
          : derivativeHealthComparison.notes[0] ?? 'Internal health comparison is not supported.',
      );

  const summary: VenueDerivativeComparisonSummaryView = {
    internalSnapshotAt: input.internalState?.capturedAt ?? null,
    externalSnapshotAt: input.externalSnapshot?.capturedAt ?? null,
    subaccountIdentity,
    positionInventory,
    marketIdentity,
    healthState,
    orderInventory,
    healthComparisonMode: derivativeHealthComparison.comparisonMode,
    exactPositionIdentityCount: positionComparison.exactIdentityCount,
    partialPositionIdentityCount: positionComparison.partialIdentityCount,
    positionIdentityGapCount: positionComparison.identityGapCount,
    matchedPositionCount: positionComparison.matchedCount,
    mismatchedPositionCount: positionComparison.mismatchedCount,
    matchedOrderCount: orderComparison.matchedCount,
    mismatchedOrderCount: orderComparison.mismatchedCount,
    activeFindingCount: input.activeFindings.length,
    activeMismatchCount: countUniqueMismatchIds(input.activeFindings),
    notes: [
      'Internal positions are still derived from Sentinel Apex fills, but market identity is now normalized through exact or derived keys when available.',
      'Exact market-index comparison only occurs when the internal side truly has exact venue-native identity in persisted metadata.',
      'Health comparison is now band-level only; exact venue collateral and margin fields remain external-only.',
      'Internal open-order comparison still uses venue order ids for row matching, with market identity carried as additional audit detail.',
    ],
  };

  return {
    venueId: input.venueId,
    venueName: input.venueName,
    internalState: input.internalState,
    externalSnapshot: input.externalSnapshot,
    summary,
    accountComparison,
    positionComparisons: positionComparison.comparisons,
    orderComparisons: orderComparison.comparisons,
    healthComparison: derivativeHealthComparison,
    activeFindings: input.activeFindings,
  };
}
