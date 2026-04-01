import Decimal from 'decimal.js';

import type {
  InternalDerivativeAccountLocatorMode,
  InternalDerivativeAccountStateView,
  InternalDerivativeComparisonStatus,
  InternalDerivativeCoverageItemView,
  InternalDerivativeCoverageView,
  InternalDerivativeDataProvenanceView,
  InternalDerivativeMarketType,
  InternalDerivativeOrderEntryView,
  InternalDerivativeOrderStateView,
  InternalDerivativePositionEntryView,
  InternalDerivativePositionSide,
  InternalDerivativePositionStateView,
  InternalDerivativeSnapshotView,
  OrderView,
  RuntimeReconciliationFindingView,
  VenueDerivativeAccountComparisonView,
  VenueDerivativeComparisonDetailView,
  VenueDerivativeComparisonSummaryView,
  VenueDerivativeHealthComparisonView,
  VenueDerivativeOrderComparisonView,
  VenueDerivativePositionComparisonView,
  VenueSnapshotView,
  VenueTruthComparisonCoverageItemView,
} from './types.js';

const POSITION_TOLERANCE = new Decimal('0.000001');

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
}

interface BuildInternalDerivativeSnapshotInput {
  venue: InternalDerivativeTrackedVenueConfig;
  orders: OrderView[];
  fills: InternalDerivativeFillRecord[];
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
}

interface ExternalPositionAggregate {
  comparisonKey: string;
  asset: string;
  marketType: InternalDerivativeMarketType;
  quantity: Decimal;
  entry: NonNullable<VenueSnapshotView['derivativePositionState']>['positions'][number];
  aggregatedFromCount: number;
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
        'No internal Drift account locator is configured for this venue.',
        ['Configure DRIFT_READONLY_ACCOUNT_ADDRESS or DRIFT_READONLY_AUTHORITY_ADDRESS to enable canonical internal account identity.'],
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
    const key = `${marketType}:${fill.asset}`;
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
    };
    accumulator.orderIds.add(fill.clientOrderId);
    applyFillToAccumulator(accumulator, fill);
    grouped.set(key, accumulator);
  }

  const positions = Array.from(grouped.entries())
    .filter(([, accumulator]) => !accumulator.netQuantity.eq(0))
    .map<InternalDerivativePositionEntryView>(([positionKey, accumulator]) => ({
      positionKey,
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
      metadata: {},
      provenance: provenance(
        'derived',
        'runtime_fill_ledger',
        ['Internal derivative positions are derived from persisted fills joined to canonical runtime orders.'],
      ),
    }))
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
        ? ['Unknown market-type rows remain internally tracked but only partially comparable to Drift-native external positions.']
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

function buildUnsupportedHealthState(): {
  coverage: InternalDerivativeCoverageItemView;
  state: InternalDerivativeSnapshotView['healthState'];
} {
  return {
    coverage: coverage(
      'unsupported',
      'The runtime does not yet compute a canonical internal Drift health or margin model.',
      ['Allocator and risk summaries are not treated as venue-native margin state.'],
    ),
    state: {
      healthStatus: 'unknown',
      methodology: 'unsupported_internal_health_model',
      notes: ['No truthful internal Drift health computation path is currently implemented.'],
      provenance: provenance(
        'estimated',
        'unsupported_internal_health_model',
        ['Health remains intentionally unsupported until the runtime has a canonical venue-aligned internal model.'],
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
  const healthState = buildUnsupportedHealthState();

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
    },
  };
}

function externalPositionAsset(
  position: NonNullable<VenueSnapshotView['derivativePositionState']>['positions'][number],
): string | null {
  if (position.marketSymbol === null) {
    return null;
  }

  return position.positionType === 'perp' && position.marketSymbol.endsWith('-PERP')
    ? position.marketSymbol.slice(0, -5)
    : position.marketSymbol;
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

function aggregateExternalPositions(
  snapshot: VenueSnapshotView | null,
): {
  comparable: Map<string, ExternalPositionAggregate>;
  skippedCount: number;
} {
  const comparable = new Map<string, ExternalPositionAggregate>();
  let skippedCount = 0;

  for (const position of snapshot?.derivativePositionState?.positions ?? []) {
    if (position.positionType === 'unknown') {
      skippedCount += 1;
      continue;
    }

    const asset = externalPositionAsset(position);
    const quantity = externalPositionQuantity(position);
    if (asset === null || quantity === null) {
      skippedCount += 1;
      continue;
    }

    const comparisonKey = `${position.positionType}:${asset}`;
    const existing = comparable.get(comparisonKey);
    if (existing === undefined) {
      comparable.set(comparisonKey, {
        comparisonKey,
        asset,
        marketType: position.positionType,
        quantity,
        entry: {
          ...position,
          baseAssetAmount: normaliseDecimal(quantity),
        },
        aggregatedFromCount: 1,
      });
      continue;
    }

    const nextQuantity = existing.quantity.plus(quantity);
    comparable.set(comparisonKey, {
      ...existing,
      quantity: nextQuantity,
      entry: {
        ...existing.entry,
        baseAssetAmount: normaliseDecimal(nextQuantity),
        metadata: {
          ...existing.entry.metadata,
          aggregatedComparison: true,
        },
      },
      aggregatedFromCount: existing.aggregatedFromCount + 1,
    });
  }

  return {
    comparable,
    skippedCount,
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

function comparePositions(
  internalState: InternalDerivativeSnapshotView | null,
  externalSnapshot: VenueSnapshotView | null,
): {
  comparisons: VenueDerivativePositionComparisonView[];
  matchedCount: number;
  mismatchedCount: number;
  skippedInternalCount: number;
  skippedExternalCount: number;
} {
  const internalComparable = new Map(
    (internalState?.positionState?.positions ?? [])
      .filter((position) => position.marketType !== 'unknown')
      .map((position) => [position.positionKey, position] as const),
  );
  const skippedInternalCount = (internalState?.positionState?.positions ?? [])
    .filter((position) => position.marketType === 'unknown')
    .length;
  const { comparable: externalComparable, skippedCount: skippedExternalCount } = aggregateExternalPositions(externalSnapshot);
  const keys = new Set([
    ...Array.from(internalComparable.keys()),
    ...Array.from(externalComparable.keys()),
  ]);

  let matchedCount = 0;
  let mismatchedCount = 0;
  const comparisons: VenueDerivativePositionComparisonView[] = [];

  for (const key of Array.from(keys.values()).sort()) {
    const internalPosition = internalComparable.get(key) ?? null;
    const externalPosition = externalComparable.get(key)?.entry ?? null;
    const quantityDelta = internalPosition === null || externalPosition === null || externalPosition.baseAssetAmount === null
      ? null
      : normaliseDecimal(
        new Decimal(internalPosition.netQuantity).minus(externalPosition.baseAssetAmount),
      );
    let status: InternalDerivativeComparisonStatus;

    if (internalPosition === null) {
      status = 'external_only';
      mismatchedCount += 1;
    } else if (externalPosition === null) {
      status = 'internal_only';
      mismatchedCount += 1;
    } else {
      const delta = new Decimal(internalPosition.netQuantity).minus(externalPosition.baseAssetAmount ?? '0').abs();
      status = delta.lte(POSITION_TOLERANCE) ? 'matched' : 'mismatched';
      if (status === 'matched') {
        matchedCount += 1;
      } else {
        mismatchedCount += 1;
      }
    }

    const externalAggregate = externalComparable.get(key);
    comparisons.push({
      comparisonKey: key,
      asset: internalPosition?.asset ?? externalAggregate?.asset ?? key.split(':')[1] ?? 'unknown',
      marketType: internalPosition?.marketType ?? externalAggregate?.marketType ?? 'unknown',
      comparable: true,
      status,
      quantityDelta,
      internalPosition,
      externalPosition,
      notes: externalAggregate !== undefined
        && externalAggregate.aggregatedFromCount > 1
        ? ['External venue positions were aggregated by asset and market type for comparison.']
        : [],
    });
  }

  return {
    comparisons,
    matchedCount,
    mismatchedCount,
    skippedInternalCount,
    skippedExternalCount,
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
      const sameType = internalOrder.metadata['instrumentType'] === undefined
        || internalOrder.marketType === externalOrder.marketType
        || externalOrder.marketType === undefined;
      const sameRemaining = remainingSizeDelta === null
        || new Decimal(remainingSizeDelta).abs().lte(POSITION_TOLERANCE);
      status = sameSide && sameReduceOnly && sameType && sameRemaining ? 'matched' : 'mismatched';
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
      notes: [],
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
  return {
    comparable: false,
    status: 'not_comparable',
    internalState: internalState?.healthState ?? null,
    externalState: externalSnapshot?.derivativeHealthState ?? null,
    notes: ['The runtime does not yet maintain a canonical internal Drift health model, so health reconciliation remains intentionally unsupported.'],
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
    ? comparisonCoverage('unsupported', 'External Drift derivative-account truth is not available for comparison.')
    : accountComparison.comparable
      ? comparisonCoverage('available', null)
      : comparisonCoverage('unsupported', 'No internal canonical Drift account locator is available for direct comparison.');

  const positionInventory = input.externalSnapshot?.truthCoverage.derivativePositionState.status !== 'available'
    ? comparisonCoverage('unsupported', 'External Drift position truth is not available for comparison.')
    : input.internalState === null
      ? comparisonCoverage('unsupported', 'No internal derivative state snapshot is currently persisted for this venue.')
      : positionComparison.skippedInternalCount > 0 || positionComparison.skippedExternalCount > 0
        ? comparisonCoverage(
          'partial',
          'Position comparison is available only for the subset that can be aligned by asset and market type.',
        )
        : comparisonCoverage('available', null);

  const orderInventory = input.externalSnapshot?.truthCoverage.orderState.status !== 'available'
    ? comparisonCoverage('unsupported', 'External Drift open-order truth is not available for comparison.')
    : input.internalState === null
      ? comparisonCoverage('unsupported', 'No internal derivative state snapshot is currently persisted for this venue.')
      : orderComparison.skippedInternalCount > 0
        ? comparisonCoverage(
          'partial',
          'Some internal open orders do not yet have venue-native order ids for exact comparison.',
        )
        : comparisonCoverage('available', null);

  const summary: VenueDerivativeComparisonSummaryView = {
    internalSnapshotAt: input.internalState?.capturedAt ?? null,
    externalSnapshotAt: input.externalSnapshot?.capturedAt ?? null,
    subaccountIdentity,
    positionInventory,
    healthState: comparisonCoverage(
      'unsupported',
      derivativeHealthComparison.notes[0] ?? 'Internal health comparison is not supported.',
    ),
    orderInventory,
    matchedPositionCount: positionComparison.matchedCount,
    mismatchedPositionCount: positionComparison.mismatchedCount,
    matchedOrderCount: orderComparison.matchedCount,
    mismatchedOrderCount: orderComparison.mismatchedCount,
    activeFindingCount: input.activeFindings.length,
    activeMismatchCount: countUniqueMismatchIds(input.activeFindings),
    notes: [
      'Internal positions are derived from Sentinel Apex fills and compared against external Drift positions by asset plus market type.',
      'Internal open-order comparison uses venue order ids where they exist; orders without a venue order id remain operator-visible but only partially comparable.',
      'Health comparison remains intentionally unsupported until the runtime has a canonical venue-aligned internal model.',
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
