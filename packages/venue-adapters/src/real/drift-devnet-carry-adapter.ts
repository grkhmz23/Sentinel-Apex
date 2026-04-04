/* eslint-disable @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unnecessary-type-assertion */
import {
  BASE_PRECISION,
  BN,
  DriftClient,
  FUNDING_RATE_PRECISION,
  MarketType,
  PositionDirection,
  QUOTE_PRECISION,
  calculateBidAskPrice,
  calculateReservePrice,
  configs,
  getMarketOrderParams,
  getUserAccountPublicKeySync,
  type DriftClientConfig,
  type DriftEnv,
  type OraclePriceData,
  type PerpMarketAccount,
  type PerpMarketConfig,
} from '@drift-labs/sdk';
import {
  Connection,
  Keypair,
  PublicKey,
  type Commitment,
} from '@solana/web3.js';
import Decimal from 'decimal.js';

import {
  DriftExecutionEventSubscriber,
  type DriftEventSubscriberFactory,
} from './drift-execution-event-subscriber.js';
import { DriftReadonlyTruthAdapter } from './drift-readonly-truth-adapter.js';
import {
  createCanonicalMarketIdentity,
  type CanonicalMarketIdentity,
} from '../interfaces/market-identity.js';

import type { CarryVenueCapabilities } from '../interfaces/carry-venue-adapter.js';
import type {
  AccountBalance,
  CancelOrderResult,
  MarketData,
  PlaceOrderParams,
  PlaceOrderResult,
  VenueAdapter,
  VenueExecutionEventEvidence,
  VenueExecutionEventEvidenceRequest,
  VenuePosition,
} from '../interfaces/venue-adapter.js';
import type {
  VenueCapabilitySnapshot,
  VenueTruthCoverageItem,
  VenueTruthSnapshot,
  VenueTruthSourceMetadata,
} from '../interfaces/venue-truth-adapter.js';

const DRIFT_DEVNET_CARRY_CONNECTOR_TYPE = 'drift_native_devnet_execution';
const DEFAULT_COMMITMENT: Commitment = 'confirmed';
const DEFAULT_VENUE_ID = 'drift-solana-devnet-carry';
const DEFAULT_VENUE_NAME = 'Drift Solana Devnet Carry';
const SUPPORTED_ASSET = 'BTC';
const SUPPORTED_MARKET_SYMBOL = 'BTC-PERP';
const SUPPORTED_MARKET_TYPE = 'perp';
const BASE_PRECISION_BN = BASE_PRECISION as BN;
const FUNDING_RATE_PRECISION_BN = FUNDING_RATE_PRECISION as BN;
const QUOTE_PRECISION_BN = QUOTE_PRECISION as BN;

const SUPPORTED_EXECUTION_SCOPE = [
  'devnet only',
  'carry sleeve only',
  'reduce-only BTC-PERP market orders',
  'real Solana transaction signatures persisted as execution references',
] as const;

const UNSUPPORTED_EXECUTION_SCOPE = [
  'mainnet-beta execution',
  'carry increase-exposure execution',
  'spot orders',
  'limit or post-only orders',
  'non-BTC perp markets',
  'silent fallback to simulated execution',
] as const;

interface ExecutionIdentityResolution {
  keypair: Keypair | null;
  authorityAddress: string | null;
  accountAddress: string | null;
  error: string | null;
}

interface SubmittedOrderCacheEntry {
  venueOrderId: string;
  clientOrderId: string;
  submittedAt: Date;
  requestedSize: string;
}

interface DriftExecutionClient {
  readonly program: DriftClient['program'];
  subscribe(): Promise<boolean>;
  unsubscribe(): Promise<void>;
  getPerpMarketAccount(marketIndex: number): PerpMarketAccount | undefined;
  getOracleDataForPerpMarket(marketIndex: number): OraclePriceData;
  getUserAccount(subAccountId?: number, authority?: PublicKey): DriftExecutionUserAccount | undefined;
  placePerpOrder(
    orderParams: ReturnType<typeof getMarketOrderParams>,
    txParams?: unknown,
    subAccountId?: number,
  ): Promise<string>;
}

interface DriftPerpAmmView {
  lastFundingRate: BN;
  lastFundingRateTs: BN;
  fundingPeriod: BN;
  baseAssetAmountLong: BN;
  baseAssetAmountShort: BN;
  volume24H: BN;
}

interface DriftExecutionPerpPosition {
  marketIndex: number;
  baseAssetAmount: BN;
}

interface DriftExecutionUserAccount {
  perpPositions: DriftExecutionPerpPosition[];
}

interface DriftDevnetCarryAdapterDependencies {
  createConnection?: (endpoint: string, commitment: Commitment) => Connection;
  createDriftClient?: (config: DriftClientConfig) => DriftExecutionClient;
  createEventSubscriber?: DriftEventSubscriberFactory;
  now?: () => Date;
}

export interface DriftDevnetCarryAdapterConfig {
  venueId?: string;
  venueName?: string;
  rpcEndpoint: string;
  driftEnv?: DriftEnv;
  privateKey?: string;
  subaccountId?: number;
  accountLabel?: string;
  commitment?: Commitment;
  authRequirementsSummary?: string[];
}

function normaliseDecimalString(value: string): string {
  if (!value.includes('.')) {
    return value;
  }

  return value.replace(/\.?0+$/, '');
}

function formatScaled(
  value: Decimal.Value,
  precision: Decimal.Value,
  decimals: number,
): string {
  return normaliseDecimalString(new Decimal(value).div(precision).toFixed(decimals));
}

function formatBn(value: BN, precision: BN, decimals: number): string {
  return formatScaled(value.toString(), precision.toString(), decimals);
}

function asDriftConnection(connection: Connection): DriftClientConfig['connection'] {
  return connection as unknown as DriftClientConfig['connection'];
}

function toBn(value: string, precision: BN, label: string): BN {
  const decimal = new Decimal(value);
  if (!decimal.isFinite() || decimal.lte(0)) {
    throw new Error(`Drift devnet execution requires a positive ${label}.`);
  }

  return new BN(decimal.times(precision.toString()).toFixed(0, Decimal.ROUND_DOWN));
}

function unsupportedCoverage(reason: string): VenueTruthCoverageItem {
  return {
    status: 'unsupported',
    reason,
    limitations: [],
  };
}

function createExecutionSourceMetadata(commitment: Commitment): VenueTruthSourceMetadata {
  return {
    sourceKind: 'adapter',
    sourceName: DRIFT_DEVNET_CARRY_CONNECTOR_TYPE,
    connectorDepth: 'execution_capable',
    commitment,
    observedScope: ['cluster_version'],
    provenanceNotes: [
      'This connector can submit real Drift devnet orders only for the narrow execution scope declared in its capability metadata.',
      'Promotion approval, current readiness evidence, runtime live mode, and operator authorization must all permit execution before any order is submitted.',
    ],
  };
}

function buildSecretKeyBytes(raw: string): Uint8Array {
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    throw new Error('secret key is empty');
  }

  if (trimmed.startsWith('[')) {
    const parsed = JSON.parse(trimmed) as unknown;
    if (!Array.isArray(parsed) || parsed.some((item) => typeof item !== 'number')) {
      throw new Error('JSON secret key must be an array of numbers');
    }
    return Uint8Array.from(parsed);
  }

  if (/^\d+(,\d+)+$/.test(trimmed)) {
    return Uint8Array.from(trimmed.split(',').map((value) => Number.parseInt(value, 10)));
  }

  const decoded = Uint8Array.from(Buffer.from(trimmed, 'base64'));
  if (decoded.length > 0) {
    return decoded;
  }

  throw new Error('secret key format is unsupported; use JSON array, comma-separated bytes, or base64');
}

function createExecutionWallet(keypair: Keypair): DriftClientConfig['wallet'] {
  return {
    publicKey: keypair.publicKey,
    async signTransaction(transaction) {
      transaction.partialSign(keypair);
      return transaction;
    },
    async signAllTransactions(transactions) {
      return Promise.all(transactions.map((transaction) => this.signTransaction(transaction)));
    },
  };
}

function resolveExecutionIdentity(config: DriftDevnetCarryAdapterConfig): ExecutionIdentityResolution {
  const privateKey = config.privateKey?.trim() ?? '';
  if (privateKey.length === 0) {
    return {
      keypair: null,
      authorityAddress: null,
      accountAddress: null,
      error: null,
    };
  }

  try {
    const bytes = buildSecretKeyBytes(privateKey);
    const keypair = bytes.length === 32
      ? Keypair.fromSeed(bytes)
      : Keypair.fromSecretKey(bytes);
    const authority = keypair.publicKey;
    const driftEnv = config.driftEnv ?? 'devnet';
    const accountAddress = getUserAccountPublicKeySync(
      new PublicKey(configs[driftEnv].DRIFT_PROGRAM_ID),
      authority,
      config.subaccountId ?? 0,
    );

    return {
      keypair,
      authorityAddress: authority.toBase58(),
      accountAddress: accountAddress.toBase58(),
      error: null,
    };
  } catch (error) {
    return {
      keypair: null,
      authorityAddress: null,
      accountAddress: null,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function parsePerpSide(baseAssetAmount: BN): 'long' | 'short' | 'flat' {
  const value = new Decimal(baseAssetAmount.toString());
  if (value.gt(0)) {
    return 'long';
  }
  if (value.lt(0)) {
    return 'short';
  }
  return 'flat';
}

function derivePerpMarkPrice(positionValueUsd: string | null, baseAssetAmount: string | null): string {
  if (positionValueUsd === null || baseAssetAmount === null) {
    return '0';
  }

  const base = new Decimal(baseAssetAmount);
  if (base.isZero()) {
    return '0';
  }

  return normaliseDecimalString(
    new Decimal(positionValueUsd).div(base.abs()).toFixed(6),
  );
}

export class DriftDevnetCarryAdapter implements VenueAdapter {
  readonly venueId: string;
  readonly venueType = 'dex' as const;
  readonly venueName: string;

  private readonly authRequirementsSummary: string[];
  private readonly driftEnv: DriftEnv;
  private readonly commitment: Commitment;
  private readonly subaccountId: number;
  private readonly supportedMarket: PerpMarketConfig;
  private readonly dependencies: DriftDevnetCarryAdapterDependencies;

  private connected = false;
  private connection: Connection | null = null;
  private client: DriftExecutionClient | null = null;
  private eventSubscriber: DriftExecutionEventSubscriber | null = null;
  private identity: ExecutionIdentityResolution | null = null;
  private readonly submittedOrders = new Map<string, SubmittedOrderCacheEntry>();
  private readonly submittedOrdersByClientOrderId = new Map<string, SubmittedOrderCacheEntry>();

  constructor(
    private readonly config: DriftDevnetCarryAdapterConfig,
    dependencies: DriftDevnetCarryAdapterDependencies = {},
  ) {
    this.venueId = config.venueId ?? DEFAULT_VENUE_ID;
    this.venueName = config.venueName ?? DEFAULT_VENUE_NAME;
    this.driftEnv = config.driftEnv ?? 'devnet';
    this.commitment = config.commitment ?? DEFAULT_COMMITMENT;
    this.subaccountId = config.subaccountId ?? 0;
    this.authRequirementsSummary = config.authRequirementsSummary ?? [
      'DRIFT_RPC_ENDPOINT',
      'DRIFT_EXECUTION_ENV=devnet',
      'DRIFT_PRIVATE_KEY',
      'DRIFT_EXECUTION_SUBACCOUNT_ID (optional)',
      'DRIFT_EXECUTION_ACCOUNT_LABEL (optional)',
    ];
    this.dependencies = dependencies;

    if (this.driftEnv !== 'devnet') {
      throw new Error('DriftDevnetCarryAdapter only supports Drift devnet.');
    }

    const market = configs.devnet.PERP_MARKETS.find((candidate) => candidate.symbol === SUPPORTED_MARKET_SYMBOL);
    if (market === undefined) {
      throw new Error(`Drift devnet market ${SUPPORTED_MARKET_SYMBOL} was not found in the installed SDK.`);
    }
    this.supportedMarket = market;
  }

  async connect(): Promise<void> {
    this.connected = true;
  }

  async disconnect(): Promise<void> {
    if (this.eventSubscriber !== null) {
      await this.eventSubscriber.close();
      this.eventSubscriber = null;
    }
    if (this.client !== null) {
      await this.client.unsubscribe();
      this.client = null;
    }
    this.connected = false;
  }

  isConnected(): boolean {
    return this.connected;
  }

  async getCarryCapabilities(): Promise<CarryVenueCapabilities> {
    const capability = await this.getVenueCapabilitySnapshot();
    return {
      venueId: this.venueId,
      venueMode: 'live',
      executionSupported: true,
      supportsIncreaseExposure: false,
      supportsReduceExposure: true,
      readOnly: false,
      approvedForLiveUse: false,
      sensitiveExecutionEligible: false,
      promotionStatus: 'not_requested',
      promotionBlockedReasons: capability.missingPrerequisites,
      healthy: capability.healthy,
      onboardingState: capability.onboardingState,
      missingPrerequisites: capability.missingPrerequisites,
      metadata: capability.metadata,
    };
  }

  async getVenueCapabilitySnapshot(): Promise<VenueCapabilitySnapshot> {
    const endpointConfigured = this.config.rpcEndpoint.trim().length > 0;
    const identity = this.getExecutionIdentity();
    const missingPrerequisites: string[] = [];

    if (!endpointConfigured) {
      missingPrerequisites.push(
        'Set DRIFT_RPC_ENDPOINT to a Solana devnet RPC endpoint before requesting promotion or execution.',
      );
    }

    if (identity.error !== null) {
      missingPrerequisites.push(`Configured DRIFT_PRIVATE_KEY is invalid: ${identity.error}`);
    } else if (identity.keypair === null) {
      missingPrerequisites.push(
        'Set DRIFT_PRIVATE_KEY to the Drift devnet authority secret key to enable signed execution and account truth.',
      );
    }

    return {
      venueId: this.venueId,
      venueName: this.venueName,
      sleeveApplicability: ['carry'],
      connectorType: DRIFT_DEVNET_CARRY_CONNECTOR_TYPE,
      truthMode: 'real',
      readOnlySupport: true,
      executionSupport: true,
      approvedForLiveUse: false,
      onboardingState: missingPrerequisites.length === 0 ? 'ready_for_review' : 'read_only',
      missingPrerequisites,
      authRequirementsSummary: this.authRequirementsSummary,
      healthy: true,
      healthState: 'healthy',
      degradedReason: null,
      metadata: this.buildConnectorMetadata(identity),
    };
  }

  async getVenueTruthSnapshot(): Promise<VenueTruthSnapshot> {
    const capturedAt = this.now().toISOString();
    const endpointConfigured = this.config.rpcEndpoint.trim().length > 0;
    const identity = this.getExecutionIdentity();

    if (!endpointConfigured) {
      return {
        venueId: this.venueId,
        venueName: this.venueName,
        snapshotType: 'drift_devnet_execution_connectivity',
        snapshotSuccessful: false,
        healthy: false,
        healthState: 'unavailable',
        summary: 'Drift devnet execution connector is unconfigured because no RPC endpoint is set.',
        errorMessage: 'DRIFT_RPC_ENDPOINT is required to capture truth snapshots or submit execution.',
        capturedAt,
        snapshotCompleteness: 'minimal',
        truthCoverage: {
          accountState: unsupportedCoverage('Configure DRIFT_PRIVATE_KEY after setting DRIFT_RPC_ENDPOINT to derive the Drift user account.'),
          balanceState: unsupportedCoverage('This connector does not expose generic wallet balances.'),
          capacityState: unsupportedCoverage('Carry connector does not expose treasury-style capacity.'),
          exposureState: unsupportedCoverage('Capture a successful account snapshot before derivative exposure can be observed.'),
          derivativeAccountState: unsupportedCoverage('Configure DRIFT_PRIVATE_KEY to capture Drift user-account truth.'),
          derivativePositionState: unsupportedCoverage('Configure DRIFT_PRIVATE_KEY to capture Drift position inventory.'),
          derivativeHealthState: unsupportedCoverage('Configure DRIFT_PRIVATE_KEY to capture Drift margin and health state.'),
          orderState: unsupportedCoverage('Configure DRIFT_PRIVATE_KEY to inspect Drift open-order inventory.'),
          executionReferences: unsupportedCoverage('Capture a successful account snapshot before execution references can be compared.'),
        },
        sourceMetadata: createExecutionSourceMetadata(this.commitment),
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
          endpointConfigured,
          accountAddress: identity.accountAddress,
          authorityAddress: identity.authorityAddress,
        },
        metadata: this.buildConnectorMetadata(identity),
      };
    }

    try {
      const connection = this.getConnection();
      const version = await connection.getVersion();

      if (identity.keypair === null || identity.accountAddress === null) {
        return {
          venueId: this.venueId,
          venueName: this.venueName,
          snapshotType: 'drift_devnet_execution_connectivity',
          snapshotSuccessful: true,
          healthy: true,
          healthState: 'healthy',
          summary: `RPC connectivity confirmed via getVersion (${version['solana-core']}). Account-level truth is unavailable until DRIFT_PRIVATE_KEY is configured for the execution authority.`,
          errorMessage: null,
          capturedAt,
          snapshotCompleteness: 'minimal',
          truthCoverage: {
            accountState: unsupportedCoverage('Configure DRIFT_PRIVATE_KEY to derive the Drift devnet user account.'),
            balanceState: unsupportedCoverage('This connector does not expose generic wallet balances.'),
            capacityState: unsupportedCoverage('Carry connector does not expose treasury-style capacity.'),
            exposureState: unsupportedCoverage('Configure DRIFT_PRIVATE_KEY to capture derivative exposure state.'),
            derivativeAccountState: unsupportedCoverage('Configure DRIFT_PRIVATE_KEY to capture Drift user-account truth.'),
            derivativePositionState: unsupportedCoverage('Configure DRIFT_PRIVATE_KEY to capture Drift position inventory.'),
            derivativeHealthState: unsupportedCoverage('Configure DRIFT_PRIVATE_KEY to capture Drift margin and health state.'),
            orderState: unsupportedCoverage('Configure DRIFT_PRIVATE_KEY to inspect Drift open-order inventory.'),
            executionReferences: unsupportedCoverage('Configure DRIFT_PRIVATE_KEY to capture recent execution references for the execution account.'),
          },
          sourceMetadata: {
            ...createExecutionSourceMetadata(this.commitment),
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
            rpcVersion: version['solana-core'],
            endpointConfigured,
            accountAddress: identity.accountAddress,
            authorityAddress: identity.authorityAddress,
          },
          metadata: this.buildConnectorMetadata(identity),
        };
      }

      const delegate = new DriftReadonlyTruthAdapter({
        venueId: this.venueId,
        venueName: this.venueName,
        rpcEndpoint: this.config.rpcEndpoint,
        driftEnv: this.driftEnv,
        accountAddress: identity.accountAddress,
        subaccountId: this.subaccountId,
        commitment: this.commitment,
        authRequirementsSummary: this.authRequirementsSummary,
        ...(identity.authorityAddress === null ? {} : { authorityAddress: identity.authorityAddress }),
        ...(this.config.accountLabel === undefined ? {} : { accountLabel: this.config.accountLabel }),
      });

      if (!delegate.isConnected()) {
        await delegate.connect();
      }

      const snapshot = await delegate.getVenueTruthSnapshot();
      return {
        ...snapshot,
        snapshotType: 'drift_devnet_execution_account',
        sourceMetadata: {
          ...snapshot.sourceMetadata,
          sourceName: DRIFT_DEVNET_CARRY_CONNECTOR_TYPE,
          connectorDepth: 'execution_capable',
          provenanceNotes: [
            'This connector shares the same Drift-native account truth depth as the read-only adapter.',
            'Real execution remains restricted to BTC-PERP reduce-only market orders on devnet.',
            'Promotion approval, current evidence eligibility, runtime live mode, and backend authorization all gate execution.',
          ],
        },
        metadata: {
          ...snapshot.metadata,
          ...this.buildConnectorMetadata(identity),
        },
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        venueId: this.venueId,
        venueName: this.venueName,
        snapshotType: 'drift_devnet_execution_connectivity',
        snapshotSuccessful: false,
        healthy: false,
        healthState: 'unavailable',
        summary: 'Drift devnet execution connector failed to refresh venue truth.',
        errorMessage: message,
        capturedAt,
        snapshotCompleteness: 'minimal',
        truthCoverage: {
          accountState: unsupportedCoverage('Drift devnet execution truth could not be captured because the connector failed before account state was loaded.'),
          balanceState: unsupportedCoverage('This connector does not expose generic wallet balances.'),
          capacityState: unsupportedCoverage('Carry connector does not expose treasury-style capacity.'),
          exposureState: unsupportedCoverage('Derivative exposure could not be captured because the truth refresh failed.'),
          derivativeAccountState: unsupportedCoverage('Derivative account truth could not be captured because the truth refresh failed.'),
          derivativePositionState: unsupportedCoverage('Derivative position truth could not be captured because the truth refresh failed.'),
          derivativeHealthState: unsupportedCoverage('Derivative health truth could not be captured because the truth refresh failed.'),
          orderState: unsupportedCoverage('Derivative order truth could not be captured because the truth refresh failed.'),
          executionReferences: unsupportedCoverage('Execution references could not be captured because the truth refresh failed.'),
        },
        sourceMetadata: createExecutionSourceMetadata(this.commitment),
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
          accountAddress: identity.accountAddress,
          authorityAddress: identity.authorityAddress,
        },
        metadata: this.buildConnectorMetadata(identity),
      };
    }
  }

  async getMarketData(asset: string): Promise<MarketData> {
    this.assertSupportedAsset(asset);
    const { market, oraclePriceData } = await this.loadMarketContext();
    const amm = market.amm as DriftPerpAmmView;
    const mmOraclePriceData = oraclePriceData as Parameters<typeof calculateBidAskPrice>[1];
    const [bid, ask] = calculateBidAskPrice(market.amm, mmOraclePriceData) as [BN, BN];
    const markPrice = calculateReservePrice(market, mmOraclePriceData) as BN;
    const bidDisplay = formatBn(bid, QUOTE_PRECISION_BN, 6);
    const askDisplay = formatBn(ask, QUOTE_PRECISION_BN, 6);
    const midDisplay = normaliseDecimalString(
      new Decimal(bidDisplay).plus(askDisplay).div(2).toFixed(6),
    );

    return {
      venueId: this.venueId,
      asset: SUPPORTED_ASSET,
      bid: bidDisplay,
      ask: askDisplay,
      mid: midDisplay,
      markPrice: formatBn(markPrice, QUOTE_PRECISION_BN, 6),
      indexPrice: formatBn(oraclePriceData.price as BN, QUOTE_PRECISION_BN, 6),
      fundingRate: formatBn(amm.lastFundingRate, FUNDING_RATE_PRECISION_BN, 8),
      nextFundingTime: new Date(
        Number(amm.lastFundingRateTs.add(amm.fundingPeriod).toString()) * 1000,
      ),
      openInterest: normaliseDecimalString(
        new Decimal(amm.baseAssetAmountLong.toString())
          .abs()
          .plus(new Decimal(amm.baseAssetAmountShort.toString()).abs())
          .div(BASE_PRECISION_BN.toString())
          .toFixed(9),
      ),
      volume24h: formatBn(amm.volume24H, QUOTE_PRECISION_BN, 6),
      marketIdentity: this.buildMarketIdentity('market_data'),
      updatedAt: this.now(),
    };
  }

  async getFundingRate(asset: string): Promise<{ rate: string; nextFundingTime: Date }> {
    this.assertSupportedAsset(asset);
    const { market } = await this.loadMarketContext();
    const amm = market.amm as DriftPerpAmmView;
    return {
      rate: formatBn(amm.lastFundingRate, FUNDING_RATE_PRECISION_BN, 8),
      nextFundingTime: new Date(
        Number(amm.lastFundingRateTs.add(amm.fundingPeriod).toString()) * 1000,
      ),
    };
  }

  async getBalances(): Promise<AccountBalance[]> {
    return [];
  }

  async getPositions(): Promise<VenuePosition[]> {
    const snapshot = await this.getVenueTruthSnapshot();
    const capturedAt = new Date(snapshot.capturedAt);
    const positions = snapshot.derivativePositionState?.positions ?? [];

    return positions
      .filter((position) =>
        position.positionType === 'perp'
        && position.marketSymbol === this.supportedMarket.symbol
        && position.side !== 'flat'
        && position.baseAssetAmount !== null
        && new Decimal(position.baseAssetAmount).abs().gt(0),
      )
      .map((position) => ({
        venueId: this.venueId,
        asset: SUPPORTED_ASSET,
        side: position.side === 'short' ? 'short' : 'long',
        size: normaliseDecimalString(new Decimal(position.baseAssetAmount ?? '0').abs().toFixed(9)),
        entryPrice: position.entryPrice ?? '0',
        markPrice: derivePerpMarkPrice(position.positionValueUsd ?? null, position.baseAssetAmount ?? null),
        unrealizedPnl: position.unrealizedPnlUsd ?? '0',
        marginUsed: '0',
        liquidationPrice: position.liquidationPrice ?? null,
        updatedAt: Number.isNaN(capturedAt.getTime()) ? this.now() : capturedAt,
      }));
  }

  async getExecutionEventEvidence(
    requests: VenueExecutionEventEvidenceRequest[],
  ): Promise<VenueExecutionEventEvidence[]> {
    if (requests.length === 0) {
      return [];
    }

    const subscriber = await this.getExecutionEventSubscriber();
    return subscriber.getExecutionEventEvidence(requests);
  }

  async placeOrder(params: PlaceOrderParams): Promise<PlaceOrderResult> {
    this.assertSupportedOrder(params);
    const cachedSubmission = this.submittedOrdersByClientOrderId.get(params.clientOrderId);
    if (cachedSubmission !== undefined) {
      return this.toCachedOrderResult(cachedSubmission);
    }

    const activePosition = await this.getActiveSupportedPosition();
    if (activePosition === null) {
      throw new Error(
        'Drift devnet execution is limited to reducing an existing BTC-PERP position, but no open BTC-PERP position was found.',
      );
    }

    const requestedSize = new Decimal(params.size);
    if (
      (activePosition.side === 'long' && params.side !== 'sell')
      || (activePosition.side === 'short' && params.side !== 'buy')
    ) {
      throw new Error(
        `Drift devnet execution can only reduce the current ${activePosition.side} BTC-PERP position.`,
      );
    }
    if (requestedSize.gt(activePosition.size)) {
      throw new Error(
        `Requested reduction size ${params.size} BTC exceeds the live BTC-PERP position size ${activePosition.size.toFixed(9)} BTC.`,
      );
    }

    const client = await this.getDriftClient();
    const submittedAt = this.now();

    try {
      const signature = await client.placePerpOrder(
        getMarketOrderParams({
          marketType: MarketType.PERP,
          marketIndex: this.supportedMarket.marketIndex,
          direction: params.side === 'buy' ? PositionDirection.LONG : PositionDirection.SHORT,
          baseAssetAmount: toBn(params.size, BASE_PRECISION_BN, 'order size'),
          reduceOnly: true,
        }),
        undefined,
        this.subaccountId,
      );

      const cachedOrder = {
        venueOrderId: signature,
        clientOrderId: params.clientOrderId,
        submittedAt,
        requestedSize: params.size,
      };
      this.submittedOrders.set(signature, cachedOrder);
      this.submittedOrdersByClientOrderId.set(params.clientOrderId, cachedOrder);

      return {
        venueOrderId: signature,
        clientOrderId: params.clientOrderId,
        status: 'submitted',
        filledSize: '0',
        averageFillPrice: null,
        fees: null,
        submittedAt,
        executionReference: signature,
        executionMode: 'real',
        marketIdentity: this.buildMarketIdentity('execution_result'),
      };
    } catch (error) {
      throw new Error(
        `Drift devnet execution failed while submitting a BTC-PERP reduce-only market order: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async cancelOrder(venueOrderId: string): Promise<CancelOrderResult> {
    const cachedOrder = this.submittedOrders.get(venueOrderId);
    return {
      venueOrderId,
      cancelled: false,
      reason: cachedOrder === undefined
        ? 'Unknown Drift execution reference. This connector only persists submission references for reduce-only market orders.'
        : 'Drift devnet carry execution intentionally does not expose a cancel path for the supported reduce-only market-order scope.',
    };
  }

  async getOrder(venueOrderId: string): Promise<PlaceOrderResult | null> {
    const cachedOrder = this.submittedOrders.get(venueOrderId);
    if (cachedOrder === undefined) {
      return null;
    }

    return this.toCachedOrderResult(cachedOrder);
  }

  async getStatus(): Promise<{ healthy: boolean; latencyMs: number; message?: string }> {
    const endpointConfigured = this.config.rpcEndpoint.trim().length > 0;
    if (!endpointConfigured) {
      return {
        healthy: false,
        latencyMs: 0,
        message: 'DRIFT_RPC_ENDPOINT is not configured.',
      };
    }

    const startedAt = Date.now();
    try {
      await this.getConnection().getVersion();
      return {
        healthy: true,
        latencyMs: Date.now() - startedAt,
      };
    } catch (error) {
      return {
        healthy: false,
        latencyMs: Date.now() - startedAt,
        message: error instanceof Error ? error.message : String(error),
      };
    }
  }

  private assertSupportedAsset(asset: string): void {
    if (asset.trim().toUpperCase() !== SUPPORTED_ASSET) {
      throw new Error(
        `Drift devnet carry adapter only supports ${SUPPORTED_MARKET_SYMBOL} for this phase; received asset "${asset}".`,
      );
    }
  }

  private assertSupportedOrder(params: PlaceOrderParams): void {
    this.assertSupportedAsset(params.asset);

    if (params.type !== 'market') {
      throw new Error('Drift devnet execution only supports market orders in this phase.');
    }
    if (params.reduceOnly !== true) {
      throw new Error('Drift devnet execution only supports reduce-only orders in this phase.');
    }
    if (params.postOnly === true) {
      throw new Error('Drift devnet execution does not support post-only orders in this phase.');
    }
    if (params.price !== undefined) {
      throw new Error('Drift devnet execution does not accept explicit limit prices in this phase.');
    }
    if (
      params.marketIdentity !== undefined
      && params.marketIdentity !== null
      && (
        params.marketIdentity.marketType !== SUPPORTED_MARKET_TYPE
        || params.marketIdentity.marketSymbol !== this.supportedMarket.symbol
      )
    ) {
      throw new Error(
        `Drift devnet execution is limited to ${this.supportedMarket.symbol}; the provided market identity does not match that scope.`,
      );
    }
  }

  private buildConnectorMetadata(identity: ExecutionIdentityResolution): Record<string, unknown> {
    return {
      driftEnv: this.driftEnv,
      commitment: this.commitment,
      endpointConfigured: this.config.rpcEndpoint.trim().length > 0,
      privateKeyConfigured: identity.keypair !== null,
      authorityAddressConfigured: identity.authorityAddress !== null,
      accountAddressConfigured: identity.accountAddress !== null,
      subaccountId: this.subaccountId,
      supportedAsset: SUPPORTED_ASSET,
      supportedMarketSymbol: this.supportedMarket.symbol,
      supportedMarketIndex: this.supportedMarket.marketIndex,
      executionPosture: 'devnet_execution_capable',
      connectorMode: 'execution_capable_devnet',
      supportedExecutionScope: [...SUPPORTED_EXECUTION_SCOPE],
      unsupportedExecutionScope: [...UNSUPPORTED_EXECUTION_SCOPE],
      executionReferenceKind: 'solana_signature',
      venueType: this.venueType,
    };
  }

  private buildMarketIdentity(
    capturedAtStage: CanonicalMarketIdentity['capturedAtStage'],
  ): CanonicalMarketIdentity {
    return createCanonicalMarketIdentity({
      venueId: this.venueId,
      asset: SUPPORTED_ASSET,
      marketType: SUPPORTED_MARKET_TYPE,
      marketIndex: this.supportedMarket.marketIndex,
      marketKey: `perp:${this.supportedMarket.marketIndex}`,
      marketSymbol: this.supportedMarket.symbol,
      marketName: this.supportedMarket.fullName ?? this.supportedMarket.symbol,
      aliases: [SUPPORTED_ASSET, this.supportedMarket.symbol],
      provenance: 'venue_native',
      capturedAtStage,
      source: DRIFT_DEVNET_CARRY_CONNECTOR_TYPE,
      notes: [
        'Market identity is fixed to the single BTC-PERP devnet market supported by this connector in phase 6.0.',
      ],
    });
  }

  private getExecutionIdentity(): ExecutionIdentityResolution {
    if (this.identity === null) {
      this.identity = resolveExecutionIdentity({
        ...this.config,
        driftEnv: this.driftEnv,
      });
    }

    return this.identity;
  }

  private getConnection(): Connection {
    if (this.connection === null) {
      const createConnection = this.dependencies.createConnection
        ?? ((endpoint: string, commitment: Commitment) => new Connection(endpoint, commitment));
      this.connection = createConnection(this.config.rpcEndpoint, this.commitment);
    }

    return this.connection;
  }

  private async getDriftClient(): Promise<DriftExecutionClient> {
    if (this.client !== null) {
      return this.client;
    }

    const identity = this.getExecutionIdentity();
    if (this.config.rpcEndpoint.trim().length === 0) {
      throw new Error('DRIFT_RPC_ENDPOINT is not configured.');
    }
    if (identity.error !== null) {
      throw new Error(`DRIFT_PRIVATE_KEY is invalid: ${identity.error}`);
    }
    if (identity.keypair === null) {
      throw new Error('DRIFT_PRIVATE_KEY is not configured.');
    }

    const createDriftClient = this.dependencies.createDriftClient
      ?? ((config: DriftClientConfig) => new DriftClient(config));
    const client = createDriftClient({
      connection: asDriftConnection(this.getConnection()),
      env: this.driftEnv,
      wallet: createExecutionWallet(identity.keypair),
      subAccountIds: [this.subaccountId],
      activeSubAccountId: this.subaccountId,
      perpMarketIndexes: [this.supportedMarket.marketIndex],
      spotMarketIndexes: configs.devnet.SPOT_MARKETS.map((market) => market.marketIndex),
      oracleInfos: [{
        publicKey: this.supportedMarket.oracle,
        source: this.supportedMarket.oracleSource,
      }],
      accountSubscription: {
        type: 'websocket',
        commitment: this.commitment,
      },
    });
    await client.subscribe();
    this.client = client;
    return client;
  }

  private async getExecutionEventSubscriber(): Promise<DriftExecutionEventSubscriber> {
    if (this.eventSubscriber !== null) {
      return this.eventSubscriber;
    }

    const identity = this.getExecutionIdentity();
    if (this.config.rpcEndpoint.trim().length === 0) {
      throw new Error('DRIFT_RPC_ENDPOINT is not configured.');
    }
    if (identity.error !== null) {
      throw new Error(`DRIFT_PRIVATE_KEY is invalid: ${identity.error}`);
    }
    if (identity.accountAddress === null) {
      throw new Error('DRIFT_PRIVATE_KEY is not configured.');
    }

    const client = await this.getDriftClient();
    this.eventSubscriber = new DriftExecutionEventSubscriber({
      connection: this.getConnection(),
      program: client.program,
      accountAddress: identity.accountAddress,
      subaccountId: this.subaccountId,
      marketIndex: this.supportedMarket.marketIndex,
      commitment: this.commitment,
    }, this.dependencies.createEventSubscriber === undefined
      ? {}
      : {
        createEventSubscriber: this.dependencies.createEventSubscriber,
      });

    return this.eventSubscriber;
  }

  private async loadMarketContext(): Promise<{
    market: PerpMarketAccount;
    oraclePriceData: OraclePriceData;
  }> {
    const client = await this.getDriftClient();
    const market = client.getPerpMarketAccount(this.supportedMarket.marketIndex);
    if (market === undefined) {
      throw new Error(
        `Drift SDK did not return market state for ${this.supportedMarket.symbol} on devnet.`,
      );
    }

    return {
      market,
      oraclePriceData: client.getOracleDataForPerpMarket(this.supportedMarket.marketIndex),
    };
  }

  private async getActiveSupportedPosition(): Promise<{
    side: 'long' | 'short';
    size: Decimal;
  } | null> {
    const client = await this.getDriftClient();
    const userAccount = client.getUserAccount(this.subaccountId);
    if (userAccount === undefined) {
      return null;
    }

    const position = userAccount.perpPositions.find(
      (candidate) => candidate.marketIndex === this.supportedMarket.marketIndex,
    );
    if (position === undefined) {
      return null;
    }

    const side = parsePerpSide(position.baseAssetAmount);
    if (side === 'flat') {
      return null;
    }

    return {
      side,
      size: new Decimal(position.baseAssetAmount.toString()).abs().div(BASE_PRECISION_BN.toString()),
    };
  }

  private now(): Date {
    return this.dependencies.now?.() ?? new Date();
  }

  private toCachedOrderResult(cachedOrder: SubmittedOrderCacheEntry): PlaceOrderResult {
    return {
      venueOrderId: cachedOrder.venueOrderId,
      clientOrderId: cachedOrder.clientOrderId,
      status: 'submitted',
      filledSize: '0',
      averageFillPrice: null,
      fees: null,
      submittedAt: cachedOrder.submittedAt,
      executionReference: cachedOrder.venueOrderId,
      executionMode: 'real',
      marketIdentity: this.buildMarketIdentity('execution_result'),
    };
  }
}
