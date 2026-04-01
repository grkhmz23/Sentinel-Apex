import {
  AMM_TO_QUOTE_PRECISION_RATIO,
  BASE_PRECISION,
  DriftClient,
  OneShotUserAccountSubscriber,
  PRICE_PRECISION,
  QUOTE_PRECISION,
  User,
  UserStatus,
  calculateEntryPrice,
  configs,
  getUserAccountPublicKeySync,
} from '@drift-labs/sdk';
import {
  Connection,
  Keypair,
  PublicKey,
  type AccountInfo,
  type Commitment,
  type ConfirmedSignatureInfo,
} from '@solana/web3.js';
import Decimal from 'decimal.js';

import type {
  VenueAccountStateSnapshot,
  VenueCapabilitySnapshot,
  VenueDerivativeAccountStateSnapshot,
  VenueDerivativeHealthStateSnapshot,
  VenueDerivativeHealthStatus,
  VenueDerivativePositionEntrySnapshot,
  VenueDerivativePositionStateSnapshot,
  VenueExecutionReferenceEntrySnapshot,
  VenueExecutionReferenceStateSnapshot,
  VenueExposureEntrySnapshot,
  VenueExposureStateSnapshot,
  VenueOrderEntrySnapshot,
  VenueOrderStateSnapshot,
  VenueTruthAdapter,
  VenueTruthCoverage,
  VenueTruthCoverageItem,
  VenueTruthDataProvenance,
  VenueTruthSnapshot,
  VenueTruthSourceMetadata,
} from '../interfaces/venue-truth-adapter.js';
import type {
  DriftEnv,
  IWallet,
  OracleInfo,
  Order,
  PerpMarketConfig,
  PerpPosition,
  SpotMarketConfig,
  SpotPosition,
  UserAccount,
} from '@drift-labs/sdk';

type DriftAccountLocatorMode =
  | 'unconfigured'
  | 'user_account_address'
  | 'authority_subaccount';

type DriftSnapshotSection =
  | 'accountState'
  | 'exposureState'
  | 'derivativeAccountState'
  | 'derivativePositionState'
  | 'derivativeHealthState'
  | 'orderState'
  | 'executionReferences';

interface LoadedDriftReadonlySnapshot {
  accountLocatorMode: Exclude<DriftAccountLocatorMode, 'unconfigured'>;
  accountExists: boolean;
  observedSlot: string | null;
  sourceMetadata: VenueTruthSourceMetadata;
  sectionErrors: Partial<Record<DriftSnapshotSection, string>>;
  accountState: VenueAccountStateSnapshot | null;
  exposureState: VenueExposureStateSnapshot | null;
  derivativeAccountState: VenueDerivativeAccountStateSnapshot | null;
  derivativePositionState: VenueDerivativePositionStateSnapshot | null;
  derivativeHealthState: VenueDerivativeHealthStateSnapshot | null;
  orderState: VenueOrderStateSnapshot | null;
  executionReferenceState: VenueExecutionReferenceStateSnapshot | null;
  payload: Record<string, unknown>;
  metadata: Record<string, unknown>;
}

interface DriftReadonlySnapshotLoadInput {
  accountAddress: PublicKey;
  accountLabel: string | null;
  accountLocatorMode: Exclude<DriftAccountLocatorMode, 'unconfigured'>;
  commitment: Commitment;
  connection: Connection;
  driftEnv: DriftEnv;
  recentSignatureLimit: number;
  rpcVersion: string;
  venueId: string;
}

interface DriftReadonlyTruthAdapterDependencies {
  createConnection?: (endpoint: string, commitment: Commitment) => Connection;
  loadSnapshot?: (input: DriftReadonlySnapshotLoadInput) => Promise<LoadedDriftReadonlySnapshot>;
}

type DriftSdkConnection = ConstructorParameters<typeof DriftClient>[0]['connection'];

interface DriftMarketMaps {
  perpByIndex: Map<number, PerpMarketConfig>;
  spotByIndex: Map<number, SpotMarketConfig>;
}

interface StringConvertible {
  toString(): string;
}

interface BnMathLike extends StringConvertible {
  abs(): BnMathLike;
  div(value: unknown): BnMathLike;
  mul(value: unknown): BnMathLike;
}

export interface DriftReadonlyTruthAdapterConfig {
  venueId: string;
  venueName: string;
  rpcEndpoint: string;
  driftEnv?: DriftEnv;
  accountAddress?: string;
  authorityAddress?: string;
  subaccountId?: number;
  accountLabel?: string;
  commitment?: Commitment;
  authRequirementsSummary?: string[];
  recentSignatureLimit?: number;
}

const DEFAULT_RECENT_SIGNATURE_LIMIT = 10;
const DRIFT_CONNECTOR_TYPE = 'drift_native_readonly';

const EXACT_PROVENANCE: VenueTruthDataProvenance = {
  classification: 'exact',
  source: 'drift_user_account_decode',
  notes: [
    'Values were decoded directly from the Drift user account or returned verbatim from Solana RPC.',
  ],
};

function mixedProvenance(notes: string[]): VenueTruthDataProvenance {
  return {
    classification: 'mixed',
    source: 'drift_user_account_with_market_context',
    notes,
  };
}

function derivedProvenance(notes: string[]): VenueTruthDataProvenance {
  return {
    classification: 'derived',
    source: 'drift_sdk_margin_math',
    notes,
  };
}

function coverage(
  status: VenueTruthCoverageItem['status'],
  reason: string | null,
  limitations: string[] = [],
): VenueTruthCoverageItem {
  return {
    status,
    reason,
    limitations,
  };
}

function unsupportedCoverage(reason: string, limitations: string[] = []): VenueTruthCoverageItem {
  return coverage('unsupported', reason, limitations);
}

function partialCoverage(reason: string, limitations: string[] = []): VenueTruthCoverageItem {
  return coverage('partial', reason, limitations);
}

function availableCoverage(limitations: string[] = []): VenueTruthCoverageItem {
  return coverage('available', null, limitations);
}

function normaliseDecimalString(value: string): string {
  if (!value.includes('.')) {
    return value;
  }

  return value.replace(/\.?0+$/, '');
}

function formatScaled(value: Decimal.Value, decimals: number): string {
  return normaliseDecimalString(new Decimal(value).toFixed(decimals));
}

function asStringConvertible(value: unknown): StringConvertible {
  return value as StringConvertible;
}

function asBnMathLike(value: unknown): BnMathLike {
  return value as BnMathLike;
}

function stringifyNumeric(value: unknown): string {
  return asStringConvertible(value).toString();
}

function decimalFromUnknown(value: unknown): Decimal {
  return new Decimal(stringifyNumeric(value));
}

function formatBn(value: unknown, precision: unknown, decimals: number): string {
  return formatScaled(decimalFromUnknown(value).div(stringifyNumeric(precision)), decimals);
}

function isZeroNumeric(value: unknown): boolean {
  return stringifyNumeric(value) === '0';
}

function isNegativeOneNumeric(value: unknown): boolean {
  return stringifyNumeric(value) === '-1';
}

function optionalStringifyNumeric(value: unknown): string | null {
  return value === null || value === undefined ? null : stringifyNumeric(value);
}

function multiplyBn(left: unknown, right: unknown): BnMathLike {
  return asBnMathLike(left).mul(right);
}

function divideBn(left: unknown, right: unknown): BnMathLike {
  return asBnMathLike(left).div(right);
}

function absoluteBn(value: unknown): BnMathLike {
  return asBnMathLike(value).abs();
}

function formatLamports(lamports: bigint | number): string {
  return formatScaled(new Decimal(lamports.toString()).div('1000000000'), 9);
}

function variantName(value: unknown): string {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return 'unknown';
  }

  const [first] = Object.keys(value as Record<string, unknown>);
  return first ?? 'unknown';
}

function isoFromUnixSeconds(value: number | null): string | null {
  return value === null ? null : new Date(value * 1000).toISOString();
}

function extractRawDiscriminatorHex(accountInfo: AccountInfo<Buffer>): string | null {
  if (accountInfo.data.length < 8) {
    return null;
  }

  return accountInfo.data.subarray(0, 8).toString('hex');
}

function decodeStatusFlags(status: number): string[] {
  const flags: Array<[number, string]> = [
    [UserStatus.BEING_LIQUIDATED, 'being_liquidated'],
    [UserStatus.BANKRUPT, 'bankrupt'],
    [UserStatus.REDUCE_ONLY, 'reduce_only'],
    [UserStatus.ADVANCED_LP, 'advanced_lp'],
    [UserStatus.PROTECTED_MAKER, 'protected_maker'],
  ];

  return flags
    .filter(([mask]) => (status & mask) === mask)
    .map(([, label]) => label);
}

function positionSideFromQuantity(quantity: string | null): VenueDerivativePositionEntrySnapshot['side'] {
  if (quantity === null) {
    return 'unknown';
  }

  const decimal = new Decimal(quantity);
  if (decimal.gt(0)) {
    return 'long';
  }
  if (decimal.lt(0)) {
    return 'short';
  }

  return 'flat';
}

function orderSideFromDirection(direction: unknown): VenueOrderEntrySnapshot['side'] {
  const name = variantName(direction);
  if (name === 'long') {
    return 'buy';
  }
  if (name === 'short') {
    return 'sell';
  }

  return 'unknown';
}

function buildMarketMaps(driftEnv: DriftEnv): DriftMarketMaps {
  return {
    perpByIndex: new Map(configs[driftEnv].PERP_MARKETS.map((market) => [market.marketIndex, market])),
    spotByIndex: new Map(configs[driftEnv].SPOT_MARKETS.map((market) => [market.marketIndex, market])),
  };
}

function createReadonlyWallet(publicKey: PublicKey): IWallet {
  return {
    publicKey,
    async signTransaction() {
      throw new Error('DriftReadonlyTruthAdapter is read-only and does not sign transactions.');
    },
    async signAllTransactions() {
      throw new Error('DriftReadonlyTruthAdapter is read-only and does not sign transactions.');
    },
  };
}

function asDriftConnection(connection: Connection): DriftSdkConnection {
  return connection as unknown as DriftSdkConnection;
}

function finalityForCommitment(commitment: Commitment): 'confirmed' | 'finalized' {
  return commitment === 'finalized' ? 'finalized' : 'confirmed';
}

function resolveAccountLocator(
  config: DriftReadonlyTruthAdapterConfig,
): {
  mode: DriftAccountLocatorMode;
  accountAddress: PublicKey | null;
  accountLabel: string | null;
  authorityAddress: PublicKey | null;
  subaccountId: number;
} {
  const accountLabel = config.accountLabel ?? null;
  const subaccountId = config.subaccountId ?? 0;

  if (config.accountAddress !== undefined && config.accountAddress !== '') {
    return {
      mode: 'user_account_address',
      accountAddress: new PublicKey(config.accountAddress),
      accountLabel,
      authorityAddress: config.authorityAddress !== undefined && config.authorityAddress !== ''
        ? new PublicKey(config.authorityAddress)
        : null,
      subaccountId,
    };
  }

  if (config.authorityAddress !== undefined && config.authorityAddress !== '') {
    const authorityAddress = new PublicKey(config.authorityAddress);
    const accountAddress = getUserAccountPublicKeySync(
      new PublicKey(configs[config.driftEnv ?? 'mainnet-beta'].DRIFT_PROGRAM_ID),
      authorityAddress,
      subaccountId,
    );

    return {
      mode: 'authority_subaccount',
      accountAddress,
      accountLabel,
      authorityAddress,
      subaccountId,
    };
  }

  return {
    mode: 'unconfigured',
    accountAddress: null,
    accountLabel,
    authorityAddress: null,
    subaccountId,
  };
}

function activePerpMarketIndexes(userAccount: {
  perpPositions: UserAccount['perpPositions'];
  orders: UserAccount['orders'];
}): number[] {
  const indexes = new Set<number>();

  for (const position of userAccount.perpPositions) {
    const hasInventory = !isZeroNumeric(position.baseAssetAmount)
      || !isZeroNumeric(position.quoteAssetAmount)
      || position.openOrders > 0
      || optionalStringifyNumeric(position.isolatedPositionScaledBalance) !== null
        && optionalStringifyNumeric(position.isolatedPositionScaledBalance) !== '0';
    if (hasInventory) {
      indexes.add(position.marketIndex);
    }
  }

  for (const order of userAccount.orders) {
    if (variantName(order.status) === 'open' && variantName(order.marketType) === 'perp') {
      indexes.add(order.marketIndex);
    }
  }

  return Array.from(indexes.values()).sort((a, b) => a - b);
}

function buildOracleInfos(
  driftEnv: DriftEnv,
  perpMarketIndexes: number[],
): { spotMarketIndexes: number[]; oracleInfos: OracleInfo[] } {
  const unique = new Map<string, OracleInfo>();
  const spotMarketIndexes = configs[driftEnv].SPOT_MARKETS.map((market) => market.marketIndex);

  for (const market of configs[driftEnv].SPOT_MARKETS) {
    unique.set(`${market.oracle.toBase58()}:${variantName(market.oracleSource)}`, {
      publicKey: market.oracle,
      source: market.oracleSource,
    });
  }

  for (const marketIndex of perpMarketIndexes) {
    const market = configs[driftEnv].PERP_MARKETS.find((candidate) => candidate.marketIndex === marketIndex);
    if (market !== undefined) {
      unique.set(`${market.oracle.toBase58()}:${variantName(market.oracleSource)}`, {
        publicKey: market.oracle,
        source: market.oracleSource,
      });
    }
  }

  return {
    spotMarketIndexes,
    oracleInfos: Array.from(unique.values()),
  };
}

function buildBasePerpPositionEntry(
  position: PerpPosition,
  marketSymbol: string | null,
): VenueDerivativePositionEntrySnapshot {
  const baseAssetAmount = formatBn(position.baseAssetAmount, BASE_PRECISION, 9);
  const entryPrice = isZeroNumeric(position.baseAssetAmount)
    ? null
    : formatBn(calculateEntryPrice(position), PRICE_PRECISION, 6);
  const breakEvenPrice = isZeroNumeric(position.baseAssetAmount)
    ? null
    : formatBn(
      absoluteBn(
        divideBn(
          multiplyBn(
            multiplyBn(position.quoteBreakEvenAmount, PRICE_PRECISION),
            AMM_TO_QUOTE_PRECISION_RATIO,
          ),
          position.baseAssetAmount,
        ),
      ),
      PRICE_PRECISION,
      6,
    );

  return {
    marketIndex: position.marketIndex,
    marketKey: `perp:${position.marketIndex}`,
    marketSymbol,
    positionType: 'perp',
    side: positionSideFromQuantity(baseAssetAmount),
    baseAssetAmount,
    quoteAssetAmount: formatBn(position.quoteAssetAmount, QUOTE_PRECISION, 6),
    entryPrice,
    breakEvenPrice,
    unrealizedPnlUsd: null,
    liquidationPrice: null,
    positionValueUsd: null,
    openOrders: position.openOrders,
    openBids: formatBn(position.openBids, BASE_PRECISION, 9),
    openAsks: formatBn(position.openAsks, BASE_PRECISION, 9),
    metadata: {
      settledPnlUsd: formatBn(position.settledPnl, QUOTE_PRECISION, 6),
      lpShares: stringifyNumeric(position.lpShares),
      isolatedPositionScaledBalance: optionalStringifyNumeric(position.isolatedPositionScaledBalance) ?? '0',
      positionFlag: position.positionFlag,
    },
    provenance: {
      ...EXACT_PROVENANCE,
      notes: [
        'Base size, quote amounts, and order inventory were decoded directly from the Drift perp position.',
        'Unrealized PnL, position value, and liquidation price require live market and oracle context.',
      ],
    },
  };
}

function buildBaseSpotPositionEntry(
  position: SpotPosition,
  marketSymbol: string | null,
): VenueDerivativePositionEntrySnapshot {
  const side = variantName(position.balanceType) === 'borrow' ? 'short' : 'long';

  return {
    marketIndex: position.marketIndex,
    marketKey: `spot:${position.marketIndex}`,
    marketSymbol,
    positionType: 'spot',
    side,
    baseAssetAmount: null,
    quoteAssetAmount: null,
    entryPrice: null,
    breakEvenPrice: null,
    unrealizedPnlUsd: null,
    liquidationPrice: null,
    positionValueUsd: null,
    openOrders: position.openOrders,
    openBids: null,
    openAsks: null,
    metadata: {
      balanceType: variantName(position.balanceType),
      scaledBalance: stringifyNumeric(position.scaledBalance),
      cumulativeDeposits: stringifyNumeric(position.cumulativeDeposits),
      rawOpenBids: stringifyNumeric(position.openBids),
      rawOpenAsks: stringifyNumeric(position.openAsks),
    },
    provenance: {
      ...EXACT_PROVENANCE,
      notes: [
        'Spot position inventory was decoded from the Drift user account.',
        'Token amounts require Drift spot-market interest state and are omitted until market context loads.',
      ],
    },
  };
}

function enrichPositionEntry(
  entry: VenueDerivativePositionEntrySnapshot,
  user: User,
  marketMaps: DriftMarketMaps,
): VenueDerivativePositionEntrySnapshot {
  if (entry.marketIndex === undefined || entry.marketIndex === null) {
    return entry;
  }

  if (entry.positionType === 'perp') {
    const unrealizedPnlUsd = formatBn(user.getUnrealizedPNL(true, entry.marketIndex), QUOTE_PRECISION, 6);
    const liquidationPriceBn: unknown = user.liquidationPrice(entry.marketIndex);
    const liquidationPrice = isNegativeOneNumeric(liquidationPriceBn)
      ? null
      : formatBn(liquidationPriceBn, PRICE_PRECISION, 6);
    const positionValueUsd = formatBn(
      user.getPerpPositionValue(
        entry.marketIndex,
        user.driftClient.getOracleDataForPerpMarket(entry.marketIndex),
      ),
      QUOTE_PRECISION,
      6,
    );

    return {
      ...entry,
      unrealizedPnlUsd,
      liquidationPrice,
      positionValueUsd,
      provenance: mixedProvenance([
        'Inventory came directly from the Drift user account.',
        'Unrealized PnL, notional value, and liquidation price were derived with Drift SDK math and live market/oracle accounts.',
      ]),
    };
  }

  const spotMarketConfig = marketMaps.spotByIndex.get(entry.marketIndex);
  const spotMarketAccount = user.driftClient.getSpotMarketAccount(entry.marketIndex);
  if (spotMarketAccount === undefined) {
    return entry;
  }
  const tokenAmount: unknown = user.getTokenAmount(entry.marketIndex);
  const liquidationPriceBn: unknown = user.spotLiquidationPrice(entry.marketIndex);

  return {
    ...entry,
    marketSymbol: entry.marketSymbol ?? spotMarketConfig?.symbol ?? null,
    baseAssetAmount: formatScaled(
      decimalFromUnknown(tokenAmount).div(new Decimal(10).pow(spotMarketAccount.decimals)),
      spotMarketAccount.decimals,
    ),
    liquidationPrice: isNegativeOneNumeric(liquidationPriceBn)
      ? null
      : formatBn(liquidationPriceBn, PRICE_PRECISION, 6),
    positionValueUsd: formatBn(user.getSpotPositionValue(entry.marketIndex), QUOTE_PRECISION, 6),
    provenance: mixedProvenance([
      'Spot position identity came directly from the Drift user account.',
      'Token amount and liquidation price were derived with Drift spot-market state and current oracle data.',
    ]),
  };
}

function buildExposureEntries(
  positions: VenueDerivativePositionEntrySnapshot[],
  accountAddress: string,
): VenueExposureEntrySnapshot[] {
  return positions
    .filter((position) => position.baseAssetAmount !== null && position.side !== 'flat')
    .map((position) => ({
      exposureKey: `${position.marketKey ?? 'unknown'}:${accountAddress}`,
      exposureType: 'position',
      assetKey: position.marketSymbol ?? position.marketKey ?? 'unknown',
      quantity: position.baseAssetAmount ?? '0',
      quantityDisplay: position.baseAssetAmount ?? '0',
      accountAddress,
    }));
}

function buildOrderEntry(
  order: Order,
  marketMaps: DriftMarketMaps,
  accountAddress: string,
): VenueOrderEntrySnapshot {
  const marketType = variantName(order.marketType);
  const marketConfig = marketType === 'perp'
    ? marketMaps.perpByIndex.get(order.marketIndex)
    : marketMaps.spotByIndex.get(order.marketIndex);
  const spotMarketPrecision = Number(stringifyNumeric(
    marketMaps.spotByIndex.get(order.marketIndex)?.precisionExp ?? 0,
  ));
  const quantity = marketType === 'perp'
    ? formatBn(order.baseAssetAmount, BASE_PRECISION, 9)
    : marketMaps.spotByIndex.get(order.marketIndex) !== undefined
      ? formatScaled(
        decimalFromUnknown(order.baseAssetAmount).div(new Decimal(10).pow(spotMarketPrecision)),
        spotMarketPrecision,
      )
      : stringifyNumeric(order.baseAssetAmount);

  const explicitPrice = isZeroNumeric(order.price) && order.oraclePriceOffset !== 0
    ? null
    : formatBn(order.price, PRICE_PRECISION, 6);

  return {
    marketIndex: order.marketIndex,
    venueOrderId: String(order.orderId),
    reference: order.userOrderId === 0 ? null : String(order.userOrderId),
    marketKey: `${marketType}:${order.marketIndex}`,
    marketSymbol: marketConfig?.symbol ?? null,
    marketType: marketType === 'perp' || marketType === 'spot' ? marketType : 'unknown',
    userOrderId: order.userOrderId,
    side: orderSideFromDirection(order.direction),
    status: variantName(order.status),
    orderType: variantName(order.orderType),
    price: explicitPrice,
    quantity,
    reduceOnly: order.reduceOnly,
    accountAddress,
    slot: stringifyNumeric(order.slot),
    placedAt: null,
    metadata: {
      oraclePriceOffset: order.oraclePriceOffset,
      postOnly: order.postOnly,
      immediateOrCancel: order.immediateOrCancel,
      triggerPrice: isZeroNumeric(order.triggerPrice)
        ? null
        : formatBn(order.triggerPrice, PRICE_PRECISION, 6),
      triggerCondition: variantName(order.triggerCondition),
      auctionDuration: order.auctionDuration,
      auctionStartPrice: isZeroNumeric(order.auctionStartPrice)
        ? null
        : formatBn(order.auctionStartPrice, PRICE_PRECISION, 6),
      auctionEndPrice: isZeroNumeric(order.auctionEndPrice)
        ? null
        : formatBn(order.auctionEndPrice, PRICE_PRECISION, 6),
      baseAssetAmountFilled: stringifyNumeric(order.baseAssetAmountFilled),
      quoteAssetAmount: stringifyNumeric(order.quoteAssetAmount),
      quoteAssetAmountFilled: stringifyNumeric(order.quoteAssetAmountFilled),
      bitFlags: order.bitFlags,
    },
    provenance: EXACT_PROVENANCE,
  };
}

function buildExecutionReferences(
  accountAddress: string,
  signatures: ConfirmedSignatureInfo[],
  referenceLookbackLimit: number,
): VenueExecutionReferenceStateSnapshot {
  const references: VenueExecutionReferenceEntrySnapshot[] = signatures.map((signature) => ({
    referenceType: 'solana_signature',
    reference: signature.signature,
    accountAddress,
    slot: String(signature.slot),
    blockTime: isoFromUnixSeconds(signature.blockTime ?? null),
    confirmationStatus: signature.confirmationStatus ?? null,
    errored: signature.err !== null,
    memo: signature.memo ?? null,
  }));

  return {
    referenceLookbackLimit,
    references,
    oldestReferenceAt: references.at(-1)?.blockTime ?? null,
  };
}

function deriveHealthStatus(
  healthScore: number,
  canBeLiquidated: boolean,
): VenueDerivativeHealthStatus {
  if (canBeLiquidated || healthScore <= 0) {
    return 'liquidation_risk';
  }
  if (healthScore < 50) {
    return 'degraded';
  }

  return 'healthy';
}

async function loadDriftReadonlySnapshot(
  input: DriftReadonlySnapshotLoadInput,
): Promise<LoadedDriftReadonlySnapshot> {
  const accountInfo = await input.connection.getAccountInfoAndContext(
    input.accountAddress,
    input.commitment,
  );
  const observedSlot = String(accountInfo.context.slot);
  const accountValue = accountInfo.value;
  const marketMaps = buildMarketMaps(input.driftEnv);
  const sourceMetadata: VenueTruthSourceMetadata = {
    sourceKind: 'adapter',
    sourceName: DRIFT_CONNECTOR_TYPE,
    connectorDepth: 'drift_native_readonly',
    commitment: input.commitment,
    observedSlot,
    observedScope: accountValue === null
      ? ['cluster_version', 'drift_user_account_lookup']
      : ['cluster_version', 'drift_user_account_lookup', 'drift_user_account_decode', 'drift_open_orders'],
    provenanceNotes: [
      'This connector is read-only and never signs or submits transactions.',
      'Derivative health and valuation metrics are Drift SDK calculations over decoded user, market, and oracle state.',
    ],
  };

  const accountState: VenueAccountStateSnapshot = {
    accountAddress: input.accountAddress.toBase58(),
    accountLabel: input.accountLabel,
    accountExists: accountValue !== null,
    ownerProgram: accountValue?.owner.toBase58() ?? null,
    executable: accountValue?.executable ?? null,
    lamports: accountValue === null ? null : String(accountValue.lamports),
    nativeBalanceDisplay: accountValue === null ? null : formatLamports(accountValue.lamports),
    observedSlot,
    rentEpoch: accountValue === null ? null : String(accountValue.rentEpoch),
    dataLength: accountValue?.data.length ?? null,
  };

  if (accountValue === null) {
    return {
      accountLocatorMode: input.accountLocatorMode,
      accountExists: false,
      observedSlot,
      sourceMetadata,
      sectionErrors: {
        derivativeAccountState: 'Configured Drift user account was not found on chain.',
        derivativePositionState: 'Configured Drift user account was not found on chain.',
        derivativeHealthState: 'Configured Drift user account was not found on chain.',
        orderState: 'Configured Drift user account was not found on chain.',
        executionReferences: 'Configured Drift user account was not found on chain.',
      },
      accountState,
      exposureState: null,
      derivativeAccountState: {
        venue: input.venueId,
        accountAddress: input.accountAddress.toBase58(),
        accountLabel: input.accountLabel,
        accountExists: false,
        ownerProgram: null,
        accountModel: 'unknown',
        venueAccountType: 'drift_user',
        decoded: false,
        authorityAddress: null,
        subaccountId: null,
        userName: null,
        delegateAddress: null,
        marginMode: null,
        poolId: null,
        marginTradingEnabled: null,
        openOrderCount: null,
        openAuctionCount: null,
        statusFlags: [],
        observedSlot,
        rpcVersion: input.rpcVersion,
        dataLength: null,
        rawDiscriminatorHex: null,
        notes: [
          'The configured Drift user account address was resolved and queried successfully.',
          'No account exists at that address, so no venue-native user decode was possible.',
        ],
        provenance: EXACT_PROVENANCE,
      },
      derivativePositionState: null,
      derivativeHealthState: null,
      orderState: null,
      executionReferenceState: null,
      payload: {
        accountAddress: input.accountAddress.toBase58(),
        accountLocatorMode: input.accountLocatorMode,
        accountExists: false,
        driftEnv: input.driftEnv,
        rpcVersion: input.rpcVersion,
      },
      metadata: {
        driftEnv: input.driftEnv,
        commitment: input.commitment,
      },
    };
  }

  const decodeWallet = createReadonlyWallet(Keypair.generate().publicKey);
  const decodeClient = new DriftClient({
    connection: asDriftConnection(input.connection),
    env: input.driftEnv,
    wallet: decodeWallet,
    skipLoadUsers: true,
    accountSubscription: {
      type: 'websocket',
      commitment: input.commitment,
    },
  });
  const userProgramAccount = decodeClient.program.account['user'];
  if (userProgramAccount === undefined) {
    throw new Error('Drift SDK user account coder is unavailable.');
  }
  const userAccount: UserAccount = userProgramAccount.coder.accounts.decodeUnchecked(
    'User',
    accountValue.data,
  );
  const openOrders = userAccount.orders
    .filter((order) => variantName(order.status) === 'open')
    .map((order) => buildOrderEntry(order, marketMaps, input.accountAddress.toBase58()));
  const basePositions: VenueDerivativePositionEntrySnapshot[] = [
    ...userAccount.perpPositions
      .filter((position) => !isZeroNumeric(position.baseAssetAmount)
        || !isZeroNumeric(position.quoteAssetAmount)
        || position.openOrders > 0
        || optionalStringifyNumeric(position.isolatedPositionScaledBalance) !== null
          && optionalStringifyNumeric(position.isolatedPositionScaledBalance) !== '0')
      .map((position) => buildBasePerpPositionEntry(
        position,
        marketMaps.perpByIndex.get(position.marketIndex)?.symbol ?? null,
      )),
    ...userAccount.spotPositions
      .filter((position) => !isZeroNumeric(position.scaledBalance)
        || position.openOrders > 0
        || !isZeroNumeric(position.openBids)
        || !isZeroNumeric(position.openAsks))
      .map((position) => buildBaseSpotPositionEntry(
        position,
        marketMaps.spotByIndex.get(position.marketIndex)?.symbol ?? null,
      )),
  ];
  const derivativeAccountState: VenueDerivativeAccountStateSnapshot = {
    venue: input.venueId,
    accountAddress: input.accountAddress.toBase58(),
    accountLabel: input.accountLabel,
    accountExists: true,
    ownerProgram: accountValue.owner.toBase58(),
    accountModel: 'program_account',
    venueAccountType: 'drift_user',
    decoded: true,
    authorityAddress: userAccount.authority.toBase58(),
    subaccountId: userAccount.subAccountId,
    userName: Buffer.from(userAccount.name).toString('utf8').trim() || null,
    delegateAddress: userAccount.delegate.toBase58(),
    marginMode: variantName(userAccount.marginMode),
    poolId: userAccount.poolId,
    marginTradingEnabled: userAccount.isMarginTradingEnabled,
    openOrderCount: userAccount.openOrders,
    openAuctionCount: userAccount.openAuctions,
    statusFlags: decodeStatusFlags(userAccount.status),
    observedSlot,
    rpcVersion: input.rpcVersion,
    dataLength: accountValue.data.length,
    rawDiscriminatorHex: extractRawDiscriminatorHex(accountValue),
    notes: [
      'The Drift user account was decoded directly with the Drift SDK account coder.',
      'Order inventory in this snapshot comes directly from the user account, while health and liquidation metrics are SDK-derived.',
    ],
    provenance: EXACT_PROVENANCE,
  };

  const sectionErrors: LoadedDriftReadonlySnapshot['sectionErrors'] = {};
  let positions = basePositions;
  let derivativeHealthState: VenueDerivativeHealthStateSnapshot | null = null;
  let exposureState: VenueExposureStateSnapshot | null = null;
  let executionReferenceState: VenueExecutionReferenceStateSnapshot | null = null;

  let driftClient: DriftClient | null = null;
  let user: User | null = null;

  try {
    const perpMarketIndexes = activePerpMarketIndexes(userAccount);
    const { spotMarketIndexes, oracleInfos } = buildOracleInfos(input.driftEnv, perpMarketIndexes);
    driftClient = new DriftClient({
      connection: asDriftConnection(input.connection),
      env: input.driftEnv,
      wallet: createReadonlyWallet(userAccount.authority),
      skipLoadUsers: true,
      perpMarketIndexes,
      spotMarketIndexes,
      oracleInfos,
      accountSubscription: {
        type: 'websocket',
        commitment: input.commitment,
      },
    });
    await driftClient.subscribe();

    const subscribedUser = new User({
      driftClient,
      userAccountPublicKey: input.accountAddress,
      accountSubscription: {
        type: 'custom',
        userAccountSubscriber: new OneShotUserAccountSubscriber(
          driftClient.program,
          input.accountAddress,
          userAccount,
          Number(observedSlot),
          input.commitment,
        ),
      },
    });
    user = subscribedUser;
    await subscribedUser.subscribe(userAccount);

    positions = positions.map((entry) => enrichPositionEntry(entry, subscribedUser, marketMaps));
    exposureState = {
      exposures: buildExposureEntries(positions, input.accountAddress.toBase58()),
      methodology: 'drift_position_inventory_exposure',
      provenance: derivedProvenance([
        'Exposure rows were derived from decoded Drift position inventory.',
        'They are convenience views for operator inspection, not a canonical risk-normalization model.',
      ]),
    };

    const healthScore = subscribedUser.getHealth();
    const liquidatable = subscribedUser.canBeLiquidated().canBeLiquidated;
    derivativeHealthState = {
      healthStatus: deriveHealthStatus(healthScore, liquidatable),
      healthScore,
      collateralUsd: formatBn(subscribedUser.getTotalCollateral(), QUOTE_PRECISION, 6),
      marginRatio: formatScaled(decimalFromUnknown(subscribedUser.getMarginRatio()).div('10000'), 4),
      leverage: formatScaled(decimalFromUnknown(subscribedUser.getLeverage()).div('10000'), 4),
      maintenanceMarginRequirementUsd: formatBn(subscribedUser.getMaintenanceMarginRequirement(), QUOTE_PRECISION, 6),
      initialMarginRequirementUsd: formatBn(subscribedUser.getInitialMarginRequirement(), QUOTE_PRECISION, 6),
      freeCollateralUsd: formatBn(subscribedUser.getFreeCollateral(), QUOTE_PRECISION, 6),
      methodology: 'drift_sdk_margin_calculation',
      notes: [
        'Health, collateral, leverage, and margin metrics are derived from the decoded Drift user account plus subscribed market and oracle accounts.',
        'healthStatus is an operator-facing category: liquidation_risk if the SDK reports liquidatability, degraded when healthScore is below 50, otherwise healthy.',
      ],
      provenance: derivedProvenance([
        'All health and margin metrics are SDK-derived from venue-native state.',
      ]),
    };
    sourceMetadata.observedScope.push(
      'drift_position_inventory',
      'drift_margin_health',
      'drift_market_context',
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    sectionErrors.derivativePositionState = `Drift market-context enrichment failed: ${message}`;
    sectionErrors.derivativeHealthState = `Drift health calculation failed: ${message}`;
    sectionErrors.exposureState = `Derived exposure summary could not be built: ${message}`;
  } finally {
    if (user !== null) {
      await user.unsubscribe().catch(() => undefined);
    }
    if (driftClient !== null) {
      await driftClient.unsubscribe().catch(() => undefined);
    }
    await decodeClient.unsubscribe().catch(() => undefined);
  }

  try {
    const signatures = await input.connection.getSignaturesForAddress(
      input.accountAddress,
      { limit: input.recentSignatureLimit },
      finalityForCommitment(input.commitment),
    );
    executionReferenceState = buildExecutionReferences(
      input.accountAddress.toBase58(),
      signatures,
      input.recentSignatureLimit,
    );
    sourceMetadata.observedScope.push('recent_signatures');
  } catch (error) {
    sectionErrors.executionReferences = error instanceof Error ? error.message : String(error);
  }

  return {
    accountLocatorMode: input.accountLocatorMode,
    accountExists: true,
    observedSlot,
    sourceMetadata,
    sectionErrors,
    accountState,
    exposureState,
    derivativeAccountState,
    derivativePositionState: {
      positions,
      openPositionCount: positions.filter((position) => position.side !== 'flat').length,
      methodology: sectionErrors.derivativePositionState === undefined
        ? 'drift_user_account_with_market_context'
        : 'drift_user_account_partial_decode',
      notes: sectionErrors.derivativePositionState === undefined
        ? [
          'Perp and spot inventory was decoded from the Drift user account.',
          'Valuation, liquidation, and token-amount enrichments used subscribed Drift market and oracle state where required.',
        ]
        : [
          'Base position inventory was decoded from the Drift user account.',
          'Some market-context enrichments were unavailable, so valuation or token-amount fields may be null.',
        ],
      provenance: sectionErrors.derivativePositionState === undefined
        ? mixedProvenance([
          'Inventory is exact venue-native state.',
          'Valuation and liquidation fields are SDK-derived from current market/oracle context.',
        ])
        : EXACT_PROVENANCE,
    },
    derivativeHealthState,
    orderState: {
      openOrderCount: openOrders.length,
      openOrders,
      referenceMode: 'venue_open_orders',
      methodology: 'drift_user_account_open_orders',
      notes: [
        'Open-order inventory was decoded directly from the Drift user account.',
        'placedAt remains null because this read-only path does not backfill transaction timestamps for each individual order.',
      ],
      provenance: EXACT_PROVENANCE,
    },
    executionReferenceState,
    payload: {
      accountAddress: input.accountAddress.toBase58(),
      accountLocatorMode: input.accountLocatorMode,
      authorityAddress: derivativeAccountState.authorityAddress,
      subaccountId: derivativeAccountState.subaccountId,
      openOrderCount: openOrders.length,
      openPositionCount: positions.filter((position) => position.side !== 'flat').length,
      healthScore: derivativeHealthState?.healthScore ?? null,
      driftEnv: input.driftEnv,
      rpcVersion: input.rpcVersion,
      sectionErrors,
    },
    metadata: {
      driftEnv: input.driftEnv,
      commitment: input.commitment,
    },
  };
}

export class DriftReadonlyTruthAdapter implements VenueTruthAdapter {
  readonly venueId: string;
  readonly venueName: string;

  private connected = false;
  private readonly authRequirementsSummary: string[];
  private readonly recentSignatureLimit: number;
  private readonly driftEnv: DriftEnv;
  private readonly commitment: Commitment;

  constructor(
    private readonly config: DriftReadonlyTruthAdapterConfig,
    private readonly dependencies: DriftReadonlyTruthAdapterDependencies = {},
  ) {
    this.venueId = config.venueId;
    this.venueName = config.venueName;
    this.authRequirementsSummary = config.authRequirementsSummary ?? [
      'DRIFT_RPC_ENDPOINT',
      'DRIFT_READONLY_ENV',
      'DRIFT_READONLY_ACCOUNT_ADDRESS or DRIFT_READONLY_AUTHORITY_ADDRESS',
    ];
    this.recentSignatureLimit = config.recentSignatureLimit ?? DEFAULT_RECENT_SIGNATURE_LIMIT;
    this.driftEnv = config.driftEnv ?? 'mainnet-beta';
    this.commitment = config.commitment ?? 'confirmed';
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
    const missingPrerequisites: string[] = [];

    try {
      const locator = resolveAccountLocator({
        ...this.config,
        driftEnv: this.driftEnv,
      });
      if (locator.mode === 'unconfigured') {
        missingPrerequisites.push(
          'Set DRIFT_READONLY_ACCOUNT_ADDRESS or DRIFT_READONLY_AUTHORITY_ADDRESS to enable Drift-native user, position, health, and order snapshots.',
        );
      }
    } catch (error) {
      missingPrerequisites.push(
        `Configured Drift account locator is invalid: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    return {
      venueId: this.venueId,
      venueName: this.venueName,
      sleeveApplicability: ['carry'],
      connectorType: DRIFT_CONNECTOR_TYPE,
      truthMode: 'real',
      readOnlySupport: true,
      executionSupport: false,
      approvedForLiveUse: false,
      onboardingState: 'read_only',
      missingPrerequisites,
      authRequirementsSummary: this.authRequirementsSummary,
      healthy: true,
      healthState: 'healthy',
      degradedReason: null,
      metadata: {
        driftEnv: this.driftEnv,
        commitment: this.commitment,
        endpointConfigured: this.config.rpcEndpoint.length > 0,
        accountAddressConfigured: this.config.accountAddress !== undefined && this.config.accountAddress !== '',
        authorityAddressConfigured: this.config.authorityAddress !== undefined && this.config.authorityAddress !== '',
        subaccountId: this.config.subaccountId ?? 0,
        recentSignatureLimit: this.recentSignatureLimit,
        executionPosture: 'read_only',
      },
    };
  }

  async getVenueTruthSnapshot(): Promise<VenueTruthSnapshot> {
    const capturedAt = new Date().toISOString();
    const sourceMetadata: VenueTruthSourceMetadata = {
      sourceKind: 'adapter',
      sourceName: DRIFT_CONNECTOR_TYPE,
      connectorDepth: 'drift_native_readonly',
      commitment: this.commitment,
      observedScope: ['cluster_version'],
      provenanceNotes: [
        'This connector is read-only and does not submit, sign, or route live execution.',
      ],
    };

    try {
      const locator = resolveAccountLocator({
        ...this.config,
        driftEnv: this.driftEnv,
      });
      const connection = (this.dependencies.createConnection ?? ((endpoint, commitment) => new Connection(endpoint, commitment)))(
        this.config.rpcEndpoint,
        this.commitment,
      );
      const version = await connection.getVersion();
      const rpcVersion = version['solana-core'];

      if (locator.mode === 'unconfigured' || locator.accountAddress === null) {
        return {
          venueId: this.venueId,
          venueName: this.venueName,
          snapshotType: 'drift_native_connectivity',
          snapshotSuccessful: true,
          healthy: true,
          healthState: 'healthy',
          summary: `Drift-native read-only connectivity confirmed via getVersion (${rpcVersion}). User-account decode is unavailable until a Drift account locator is configured.`,
          errorMessage: null,
          capturedAt,
          snapshotCompleteness: 'minimal',
          truthCoverage: {
            accountState: unsupportedCoverage('Configure a Drift read-only account locator to capture user account identity.'),
            balanceState: unsupportedCoverage(
              'Drift-native decode does not emit generic wallet balances. Use derivative positions for collateral inventory once a user account is configured.',
            ),
            capacityState: unsupportedCoverage('Read-only Drift connector does not expose treasury-style venue capacity.'),
            exposureState: unsupportedCoverage('Configure a Drift read-only account locator to derive position-backed exposure.'),
            derivativeAccountState: unsupportedCoverage('Configure a Drift read-only account locator to decode Drift user-account semantics.'),
            derivativePositionState: unsupportedCoverage('Configure a Drift read-only account locator to decode Drift-native positions.'),
            derivativeHealthState: unsupportedCoverage('Configure a Drift read-only account locator to compute Drift health and margin state.'),
            orderState: unsupportedCoverage('Configure a Drift read-only account locator to decode Drift-native open-order inventory.'),
            executionReferences: unsupportedCoverage('Configure a Drift read-only account locator to inspect recent transaction references.'),
          },
          sourceMetadata: {
            ...sourceMetadata,
            observedScope: ['cluster_version'],
          },
          accountState: null,
          balanceState: null,
          capacityState: null,
          exposureState: null,
          derivativeAccountState: null,
          derivativePositionState: null,
          derivativeHealthState: null,
          orderState: null,
          executionReferenceState: null,
          payload: {
            driftEnv: this.driftEnv,
            rpcVersion,
            accountLocatorMode: 'unconfigured',
          },
          metadata: {
            endpoint: this.config.rpcEndpoint,
            driftEnv: this.driftEnv,
            commitment: this.commitment,
          },
        };
      }

      const loaded = await (this.dependencies.loadSnapshot ?? loadDriftReadonlySnapshot)({
        accountAddress: locator.accountAddress,
        accountLabel: locator.accountLabel,
        accountLocatorMode: locator.mode,
        commitment: this.commitment,
        connection,
        driftEnv: this.driftEnv,
        recentSignatureLimit: this.recentSignatureLimit,
        rpcVersion,
        venueId: this.venueId,
      });

      const truthCoverage = this.buildTruthCoverage(loaded);
      const snapshotCompleteness = this.deriveSnapshotCompleteness(locator.mode, loaded, truthCoverage);
      const sectionErrors = Object.values(loaded.sectionErrors).filter((value): value is string => value !== undefined);
      const healthState = loaded.accountExists && sectionErrors.length === 0 ? 'healthy' : 'degraded';
      const healthScore = loaded.derivativeHealthState?.healthScore ?? null;
      const openPositionCount = loaded.derivativePositionState?.openPositionCount ?? 0;
      const openOrderCount = loaded.orderState?.openOrderCount ?? 0;

      return {
        venueId: this.venueId,
        venueName: this.venueName,
        snapshotType: 'drift_native_user_account',
        snapshotSuccessful: true,
        healthy: healthState === 'healthy',
        healthState,
        summary: loaded.accountExists
          ? `Drift-native read-only snapshot captured for ${loaded.derivativeAccountState?.userName ?? locator.accountLabel ?? locator.accountAddress.toBase58()} with ${openPositionCount} positions, ${openOrderCount} open orders, and health score ${healthScore ?? 'unavailable'}.`
          : `Drift-native read-only snapshot captured, but the configured user account ${locator.accountAddress.toBase58()} does not exist on chain.`,
        errorMessage: sectionErrors.length === 0 ? null : sectionErrors.join('; '),
        capturedAt,
        snapshotCompleteness,
        truthCoverage,
        sourceMetadata: loaded.sourceMetadata,
        accountState: loaded.accountState,
        balanceState: null,
        capacityState: null,
        exposureState: loaded.exposureState,
        derivativeAccountState: loaded.derivativeAccountState,
        derivativePositionState: loaded.derivativePositionState,
        derivativeHealthState: loaded.derivativeHealthState,
        orderState: loaded.orderState,
        executionReferenceState: loaded.executionReferenceState,
        payload: {
          ...loaded.payload,
          truthCoverage,
          sourceMetadata: loaded.sourceMetadata,
        },
        metadata: {
          endpoint: this.config.rpcEndpoint,
          ...loaded.metadata,
        },
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        venueId: this.venueId,
        venueName: this.venueName,
        snapshotType: 'drift_native_error',
        snapshotSuccessful: false,
        healthy: false,
        healthState: 'unavailable',
        summary: `Drift-native read-only snapshot failed for ${this.venueName}.`,
        errorMessage: message,
        capturedAt,
        snapshotCompleteness: 'minimal',
        truthCoverage: {
          accountState: partialCoverage(`Snapshot failed before account identity could be captured: ${message}`),
          balanceState: unsupportedCoverage(
            'Drift-native decode does not emit generic wallet balances. Use derivative positions for collateral inventory once a user account is configured.',
          ),
          capacityState: unsupportedCoverage('Read-only Drift connector does not expose treasury-style venue capacity.'),
          exposureState: partialCoverage(`Snapshot failed before exposure could be derived: ${message}`),
          derivativeAccountState: partialCoverage(`Snapshot failed before Drift user-account decode completed: ${message}`),
          derivativePositionState: partialCoverage(`Snapshot failed before Drift position inventory completed: ${message}`),
          derivativeHealthState: partialCoverage(`Snapshot failed before Drift health calculation completed: ${message}`),
          orderState: partialCoverage(`Snapshot failed before Drift open-order inventory completed: ${message}`),
          executionReferences: partialCoverage(`Snapshot failed before recent execution references could be captured: ${message}`),
        },
        sourceMetadata,
        accountState: null,
        balanceState: null,
        capacityState: null,
        exposureState: null,
        derivativeAccountState: null,
        derivativePositionState: null,
        derivativeHealthState: null,
        orderState: null,
        executionReferenceState: null,
        payload: {},
        metadata: {
          endpoint: this.config.rpcEndpoint,
          driftEnv: this.driftEnv,
          commitment: this.commitment,
        },
      };
    }
  }

  private buildTruthCoverage(
    loaded: LoadedDriftReadonlySnapshot,
  ): VenueTruthCoverage {
    const accountMissingReason = loaded.accountExists
      ? null
      : 'Configured Drift user account was not found on chain.';

    return {
      accountState: loaded.accountExists
        ? availableCoverage()
        : partialCoverage(accountMissingReason ?? 'Configured Drift user account was not found on chain.'),
      balanceState: unsupportedCoverage(
        'Drift-native read-only decode exposes collateral and borrow inventory via derivative positions, not generic wallet balanceState.',
      ),
      capacityState: unsupportedCoverage('Read-only Drift connector does not expose treasury-style venue capacity.'),
      exposureState: loaded.exposureState !== null && loaded.sectionErrors.exposureState === undefined
        ? availableCoverage([
          'Exposure rows are derived convenience views over decoded position inventory and are not a canonical risk-normalization model.',
        ])
        : loaded.accountExists
          ? partialCoverage(
            loaded.sectionErrors.exposureState
              ?? 'Decoded position inventory was present, but exposure summaries could not be completed.',
            ['Use derivativePositionState as the authoritative venue-native inventory view.'],
          )
          : partialCoverage(accountMissingReason ?? 'Configured Drift user account was not found on chain.'),
      derivativeAccountState: loaded.derivativeAccountState?.decoded
        ? availableCoverage()
        : partialCoverage(
          loaded.sectionErrors.derivativeAccountState
            ?? accountMissingReason
            ?? 'Drift user-account decode was not available for this snapshot.',
        ),
      derivativePositionState: loaded.derivativePositionState !== null && loaded.sectionErrors.derivativePositionState === undefined
        ? availableCoverage([
          'Inventory is venue-native; some valuation fields are derived from Drift SDK math and current market/oracle state.',
        ])
        : partialCoverage(
          loaded.sectionErrors.derivativePositionState
            ?? accountMissingReason
            ?? 'Drift position inventory could not be fully decoded for this snapshot.',
        ),
      derivativeHealthState: loaded.derivativeHealthState !== null && loaded.sectionErrors.derivativeHealthState === undefined
        ? availableCoverage([
          'Health, collateral, leverage, and margin fields are Drift SDK calculations over venue-native state.',
        ])
        : partialCoverage(
          loaded.sectionErrors.derivativeHealthState
            ?? accountMissingReason
            ?? 'Drift health state could not be computed for this snapshot.',
        ),
      orderState: loaded.orderState !== null && loaded.sectionErrors.orderState === undefined
        ? availableCoverage([
          'Open-order inventory is decoded exactly from the Drift user account.',
          'placedAt is intentionally null because this path does not backfill per-order transaction timestamps.',
        ])
        : partialCoverage(
          loaded.sectionErrors.orderState
            ?? accountMissingReason
            ?? 'Drift open-order inventory could not be decoded for this snapshot.',
        ),
      executionReferences: loaded.executionReferenceState !== null && loaded.sectionErrors.executionReferences === undefined
        ? availableCoverage([
          'Execution references are recent Solana signatures for the tracked Drift user account.',
        ])
        : loaded.accountExists
          ? partialCoverage(
            loaded.sectionErrors.executionReferences
              ?? 'Recent transaction references could not be captured for this snapshot.',
          )
          : partialCoverage(accountMissingReason ?? 'Configured Drift user account was not found on chain.'),
    };
  }

  private deriveSnapshotCompleteness(
    locatorMode: Exclude<DriftAccountLocatorMode, 'unconfigured'>,
    loaded: LoadedDriftReadonlySnapshot,
    truthCoverage: VenueTruthCoverage,
  ): VenueTruthSnapshot['snapshotCompleteness'] {
    if (locatorMode === 'user_account_address' || locatorMode === 'authority_subaccount') {
      const supportedStatuses = [
        truthCoverage.accountState.status,
        truthCoverage.exposureState.status,
        truthCoverage.derivativeAccountState.status,
        truthCoverage.derivativePositionState.status,
        truthCoverage.derivativeHealthState.status,
        truthCoverage.orderState.status,
        truthCoverage.executionReferences.status,
      ];

      if (loaded.accountExists && supportedStatuses.every((status) => status === 'available' || status === 'unsupported')) {
        return 'complete';
      }

      return 'partial';
    }

    return 'minimal';
  }
}
