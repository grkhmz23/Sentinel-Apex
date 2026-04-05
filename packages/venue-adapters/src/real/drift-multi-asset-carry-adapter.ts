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

const DRIFT_MULTI_ASSET_CARRY_CONNECTOR_TYPE = 'drift_native_multi_asset_execution';
const DEFAULT_COMMITMENT: Commitment = 'confirmed';
const DEFAULT_VENUE_ID_PREFIX = 'drift-solana';
const BASE_PRECISION_BN = BASE_PRECISION as BN;
const FUNDING_RATE_PRECISION_BN = FUNDING_RATE_PRECISION as BN;
const QUOTE_PRECISION_BN = QUOTE_PRECISION as BN;

// Default supported assets for carry strategy
export const DEFAULT_SUPPORTED_ASSETS = ['BTC', 'ETH', 'SOL'] as const;
export type SupportedAsset = typeof DEFAULT_SUPPORTED_ASSETS[number];

const SUPPORTED_EXECUTION_SCOPE = [
  'multi-asset perp market orders',
  'BTC-PERP, ETH-PERP, SOL-PERP markets',
  'market orders that can open, add to, or reduce positions',
  'real Solana transaction signatures persisted as execution references',
] as const;

const UNSUPPORTED_EXECUTION_SCOPE = [
  'spot orders (use DriftSpotAdapter)',
  'limit or post-only orders',
  'assets outside BTC, ETH, SOL',
  'crossing opposite-side positions with non-reduce-only orders',
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
  asset: string;
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

interface DriftMultiAssetCarryAdapterDependencies {
  createConnection?: (endpoint: string, commitment: Commitment) => Connection;
  createDriftClient?: (config: DriftClientConfig) => DriftExecutionClient;
  createEventSubscriber?: DriftEventSubscriberFactory;
  now?: () => Date;
}

export interface DriftMultiAssetCarryAdapterConfig {
  venueId?: string;
  venueName?: string;
  rpcEndpoint: string;
  driftEnv?: DriftEnv;
  privateKey?: string;
  subaccountId?: number;
  accountLabel?: string;
  commitment?: Commitment;
  authRequirementsSummary?: string[];
  /** List of assets to support (default: BTC, ETH, SOL) */
  supportedAssets?: string[];
  /** When true, allows execution. Must be explicitly set. */
  executionEnabled?: boolean;
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
    throw new Error(`Drift execution requires a positive ${label}.`);
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
    sourceName: DRIFT_MULTI_ASSET_CARRY_CONNECTOR_TYPE,
    connectorDepth: 'execution_capable',
    commitment,
    observedScope: ['cluster_version'],
    provenanceNotes: [
      'This connector can submit real Drift multi-asset perp orders.',
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

function resolveExecutionIdentity(config: DriftMultiAssetCarryAdapterConfig): ExecutionIdentityResolution {
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
    const driftEnv = config.driftEnv ?? 'mainnet-beta';
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

function positionSideFromOrderSide(side: 'buy' | 'sell'): 'long' | 'short' {
  return side === 'buy' ? 'long' : 'short';
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

function getMarketSymbol(asset: string): string {
  return `${asset}-PERP`;
}

export class DriftMultiAssetCarryAdapter implements VenueAdapter {
  readonly venueId: string;
  readonly venueType = 'dex' as const;
  readonly venueName: string;
  readonly supportedAssets: string[];

  private readonly authRequirementsSummary: string[];
  private readonly driftEnv: DriftEnv;
  private readonly commitment: Commitment;
  private readonly subaccountId: number;
  private readonly supportedMarkets: Map<string, PerpMarketConfig>;
  private readonly dependencies: DriftMultiAssetCarryAdapterDependencies;
  private readonly executionEnabled: boolean;

  private connected = false;
  private connection: Connection | null = null;
  private client: DriftExecutionClient | null = null;
  private eventSubscriber: DriftExecutionEventSubscriber | null = null;
  private identity: ExecutionIdentityResolution | null = null;
  private readonly submittedOrders = new Map<string, SubmittedOrderCacheEntry>();
  private readonly submittedOrdersByClientOrderId = new Map<string, SubmittedOrderCacheEntry>();

  constructor(
    private readonly config: DriftMultiAssetCarryAdapterConfig,
    dependencies: DriftMultiAssetCarryAdapterDependencies = {},
  ) {
    this.venueId = config.venueId ?? `${DEFAULT_VENUE_ID_PREFIX}-${config.driftEnv ?? 'mainnet'}-carry`;
    this.venueName = config.venueName ?? `Drift Solana ${config.driftEnv ?? 'mainnet'}-beta Carry`;
    this.driftEnv = config.driftEnv ?? 'mainnet-beta';
    this.commitment = config.commitment ?? DEFAULT_COMMITMENT;
    this.subaccountId = config.subaccountId ?? 0;
    this.executionEnabled = config.executionEnabled ?? false;
    this.supportedAssets = config.supportedAssets ?? [...DEFAULT_SUPPORTED_ASSETS];
    this.authRequirementsSummary = config.authRequirementsSummary ?? [
      'DRIFT_RPC_ENDPOINT',
      'DRIFT_PRIVATE_KEY',
      'DRIFT_EXECUTION_ENABLED=true',
      'DRIFT_EXECUTION_SUBACCOUNT_ID (optional)',
    ];
    this.dependencies = dependencies;

    // Load market configs for all supported assets
    this.supportedMarkets = new Map();
    for (const asset of this.supportedAssets) {
      const marketSymbol = getMarketSymbol(asset);
      const market = configs[this.driftEnv].PERP_MARKETS.find(
        (candidate) => candidate.symbol === marketSymbol,
      );
      if (market !== undefined) {
        this.supportedMarkets.set(asset, market);
      }
    }

    if (this.supportedMarkets.size === 0) {
      throw new Error(`No supported perp markets found for assets: ${this.supportedAssets.join(', ')}`);
    }
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
      supportsIncreaseExposure: true,
      supportsReduceExposure: true,
      readOnly: false,
      approvedForLiveUse: this.executionEnabled && capability.missingPrerequisites.length === 0,
      sensitiveExecutionEligible: this.executionEnabled,
      promotionStatus: this.executionEnabled ? 'approved' : 'not_requested',
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
        'Set DRIFT_RPC_ENDPOINT to a Solana RPC endpoint before requesting promotion or execution.',
      );
    }

    if (!this.executionEnabled) {
      missingPrerequisites.push(
        'Execution is not enabled. Set executionEnabled=true in config to enable trading.',
      );
    }

    if (identity.error !== null) {
      missingPrerequisites.push(`Configured DRIFT_PRIVATE_KEY is invalid: ${identity.error}`);
    } else if (identity.keypair === null) {
      missingPrerequisites.push(
        'Set DRIFT_PRIVATE_KEY to the Drift authority secret key to enable signed execution.',
      );
    }

    return {
      venueId: this.venueId,
      venueName: this.venueName,
      sleeveApplicability: ['carry'],
      connectorType: DRIFT_MULTI_ASSET_CARRY_CONNECTOR_TYPE,
      truthMode: 'real',
      readOnlySupport: true,
      executionSupport: true,
      approvedForLiveUse: this.executionEnabled && missingPrerequisites.length === 0,
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
        snapshotType: 'drift_multi_asset_execution_connectivity',
        snapshotSuccessful: false,
        healthy: false,
        healthState: 'unavailable',
        summary: 'Drift multi-asset execution connector is unconfigured because no RPC endpoint is set.',
        errorMessage: 'DRIFT_RPC_ENDPOINT is required to capture truth snapshots or submit execution.',
        capturedAt,
        snapshotCompleteness: 'minimal',
        truthCoverage: {
          accountState: unsupportedCoverage('Configure DRIFT_PRIVATE_KEY after setting DRIFT_RPC_ENDPOINT.'),
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
          executionEnabled: this.executionEnabled,
          supportedAssets: this.supportedAssets,
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
          snapshotType: 'drift_multi_asset_execution_connectivity',
          snapshotSuccessful: true,
          healthy: true,
          healthState: 'healthy',
          summary: `RPC connectivity confirmed via getVersion (${version['solana-core']}). Account-level truth is unavailable until DRIFT_PRIVATE_KEY is configured.`,
          errorMessage: null,
          capturedAt,
          snapshotCompleteness: 'minimal',
          truthCoverage: {
            accountState: unsupportedCoverage('Configure DRIFT_PRIVATE_KEY to derive the Drift user account.'),
            balanceState: unsupportedCoverage('This connector does not expose generic wallet balances.'),
            capacityState: unsupportedCoverage('Carry connector does not expose treasury-style capacity.'),
            exposureState: unsupportedCoverage('Configure DRIFT_PRIVATE_KEY to capture derivative exposure state.'),
            derivativeAccountState: unsupportedCoverage('Configure DRIFT_PRIVATE_KEY to capture Drift user-account truth.'),
            derivativePositionState: unsupportedCoverage('Configure DRIFT_PRIVATE_KEY to capture Drift position inventory.'),
            derivativeHealthState: unsupportedCoverage('Configure DRIFT_PRIVATE_KEY to capture Drift margin and health state.'),
            orderState: unsupportedCoverage('Configure DRIFT_PRIVATE_KEY to inspect Drift open-order inventory.'),
            executionReferences: unsupportedCoverage('Configure DRIFT_PRIVATE_KEY to capture recent execution references.'),
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
            executionEnabled: this.executionEnabled,
            supportedAssets: this.supportedAssets,
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
        snapshotType: 'drift_multi_asset_execution_account',
        sourceMetadata: {
          ...snapshot.sourceMetadata,
          sourceName: DRIFT_MULTI_ASSET_CARRY_CONNECTOR_TYPE,
          connectorDepth: 'execution_capable',
          provenanceNotes: [
            'This connector captures multi-asset perp market truth for Drift.',
            `Supported assets: ${this.supportedAssets.join(', ')}.`,
            'Real execution requires promotion approval and live mode authorization.',
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
        snapshotType: 'drift_multi_asset_execution_connectivity',
        snapshotSuccessful: false,
        healthy: false,
        healthState: 'unavailable',
        summary: 'Drift multi-asset execution connector failed to refresh venue truth.',
        errorMessage: message,
        capturedAt,
        snapshotCompleteness: 'minimal',
        truthCoverage: {
          accountState: unsupportedCoverage('Truth could not be captured because the connector failed.'),
          balanceState: unsupportedCoverage('Balance truth could not be captured.'),
          capacityState: unsupportedCoverage('Carry connector does not expose treasury-style capacity.'),
          exposureState: unsupportedCoverage('Derivative exposure could not be captured.'),
          derivativeAccountState: unsupportedCoverage('Derivative account truth could not be captured.'),
          derivativePositionState: unsupportedCoverage('Derivative position truth could not be captured.'),
          derivativeHealthState: unsupportedCoverage('Derivative health truth could not be captured.'),
          orderState: unsupportedCoverage('Derivative order truth could not be captured.'),
          executionReferences: unsupportedCoverage('Execution references could not be captured.'),
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
          executionEnabled: this.executionEnabled,
          supportedAssets: this.supportedAssets,
          accountAddress: identity.accountAddress,
          authorityAddress: identity.authorityAddress,
        },
        metadata: this.buildConnectorMetadata(identity),
      };
    }
  }

  async getMarketData(asset: string): Promise<MarketData> {
    const marketConfig = this.getMarketConfig(asset);
    const { market, oraclePriceData } = await this.loadMarketContext(marketConfig);
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
      asset: asset.toUpperCase(),
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
      marketIdentity: this.buildMarketIdentity(asset, 'market_data'),
      updatedAt: this.now(),
    };
  }

  async getFundingRate(asset: string): Promise<{ rate: string; nextFundingTime: Date }> {
    const marketConfig = this.getMarketConfig(asset);
    const { market } = await this.loadMarketContext(marketConfig);
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
        && position.side !== 'flat'
        && position.baseAssetAmount !== null
        && new Decimal(position.baseAssetAmount).abs().gt(0)
        && position.marketSymbol !== null
      )
      .map((position) => {
        const asset = this.extractAssetFromMarketSymbol(position.marketSymbol ?? '');
        return {
          venueId: this.venueId,
          asset: asset || 'UNKNOWN',
          side: position.side === 'short' ? 'short' : 'long',
          size: normaliseDecimalString(new Decimal(position.baseAssetAmount ?? '0').abs().toFixed(9)),
          entryPrice: position.entryPrice ?? '0',
          markPrice: derivePerpMarkPrice(position.positionValueUsd ?? null, position.baseAssetAmount ?? null),
          unrealizedPnl: position.unrealizedPnlUsd ?? '0',
          marginUsed: '0',
          liquidationPrice: position.liquidationPrice ?? null,
          updatedAt: Number.isNaN(capturedAt.getTime()) ? this.now() : capturedAt,
        };
      });
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
    if (!this.executionEnabled) {
      throw new Error('Execution is disabled. Set executionEnabled=true in config to enable.');
    }

    this.assertSupportedOrder(params);
    const cachedSubmission = this.submittedOrdersByClientOrderId.get(params.clientOrderId);
    if (cachedSubmission !== undefined) {
      return this.toCachedOrderResult(cachedSubmission);
    }

    const reduceOnly = params.reduceOnly === true;
    const activePosition = await this.getActivePosition(params.asset);
    const requestedSize = new Decimal(params.size);
    const marketConfig = this.getMarketConfig(params.asset);

    if (reduceOnly) {
      if (activePosition === null) {
        throw new Error(
          `Reduce-only execution requires an existing ${params.asset}-PERP position, but no open position was found.`,
        );
      }

      if (
        (activePosition.side === 'long' && params.side !== 'sell')
        || (activePosition.side === 'short' && params.side !== 'buy')
      ) {
        throw new Error(
          `Reduce-only execution can only reduce the current ${activePosition.side} ${params.asset}-PERP position.`,
        );
      }
      if (requestedSize.gt(activePosition.size)) {
        throw new Error(
          `Requested reduction size ${params.size} exceeds the live ${params.asset}-PERP position size ${activePosition.size.toFixed(9)}.`,
        );
      }
    } else if (
      activePosition !== null
      && activePosition.side !== positionSideFromOrderSide(params.side)
    ) {
      throw new Error(
        `Execution cannot cross the current ${activePosition.side} ${params.asset}-PERP position with a non-reduce-only ${params.side} order; reduce that position first.`,
      );
    }

    const client = await this.getDriftClient();
    const submittedAt = this.now();

    try {
      const signature = await client.placePerpOrder(
        getMarketOrderParams({
          marketType: MarketType.PERP,
          marketIndex: marketConfig.marketIndex,
          direction: params.side === 'buy' ? PositionDirection.LONG : PositionDirection.SHORT,
          baseAssetAmount: toBn(params.size, BASE_PRECISION_BN, 'order size'),
          reduceOnly,
        }),
        undefined,
        this.subaccountId,
      );

      const cachedOrder = {
        venueOrderId: signature,
        clientOrderId: params.clientOrderId,
        submittedAt,
        requestedSize: params.size,
        asset: params.asset,
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
        marketIdentity: this.buildMarketIdentity(params.asset, 'execution_result'),
      };
    } catch (error) {
      throw new Error(
        `Execution failed for ${params.asset}-PERP: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async cancelOrder(venueOrderId: string): Promise<CancelOrderResult> {
    const cachedOrder = this.submittedOrders.get(venueOrderId);
    return {
      venueOrderId,
      cancelled: false,
      reason: cachedOrder === undefined
        ? 'Unknown execution reference. This connector only persists submission references for market orders.'
        : 'Drift execution does not expose a cancel path for the supported market-order scope.',
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

  private getMarketConfig(asset: string): PerpMarketConfig {
    const upperAsset = asset.trim().toUpperCase();
    const market = this.supportedMarkets.get(upperAsset);
    if (market === undefined) {
      throw new Error(
        `Asset "${asset}" is not supported. Supported assets: ${this.supportedAssets.join(', ')}`,
      );
    }
    return market;
  }

  private extractAssetFromMarketSymbol(marketSymbol: string): string | null {
    // Extract asset from symbol like "BTC-PERP" -> "BTC"
    const match = marketSymbol.match(/^([A-Z]+)-PERP$/);
    return match?.[1] ?? null;
  }

  private assertSupportedOrder(params: PlaceOrderParams): void {
    const upperAsset = params.asset.trim().toUpperCase();
    if (!this.supportedAssets.includes(upperAsset)) {
      throw new Error(
        `Asset "${params.asset}" is not supported. Supported assets: ${this.supportedAssets.join(', ')}`,
      );
    }

    if (params.type !== 'market') {
      throw new Error('Execution only supports market orders.');
    }
    if (params.postOnly === true) {
      throw new Error('Execution does not support post-only orders.');
    }
    if (params.price !== undefined) {
      throw new Error('Execution does not accept explicit limit prices.');
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
      executionEnabled: this.executionEnabled,
      supportedAssets: this.supportedAssets,
      availableMarkets: Array.from(this.supportedMarkets.entries()).map(([asset, market]) => ({
        asset,
        marketIndex: market.marketIndex,
        symbol: market.symbol,
      })),
      executionPosture: 'multi_asset_execution_capable',
      connectorMode: 'execution_capable_multi_asset',
      supportedExecutionScope: [...SUPPORTED_EXECUTION_SCOPE],
      unsupportedExecutionScope: [...UNSUPPORTED_EXECUTION_SCOPE],
      executionReferenceKind: 'solana_signature',
      venueType: this.venueType,
    };
  }

  private buildMarketIdentity(
    asset: string,
    capturedAtStage: CanonicalMarketIdentity['capturedAtStage'],
  ): CanonicalMarketIdentity {
    const marketConfig = this.getMarketConfig(asset);
    return createCanonicalMarketIdentity({
      venueId: this.venueId,
      asset: asset.toUpperCase(),
      marketType: 'perp',
      marketIndex: marketConfig.marketIndex,
      marketKey: `perp:${marketConfig.marketIndex}`,
      marketSymbol: marketConfig.symbol,
      marketName: marketConfig.fullName ?? marketConfig.symbol,
      aliases: [asset.toUpperCase(), marketConfig.symbol],
      provenance: 'venue_native',
      capturedAtStage,
      source: DRIFT_MULTI_ASSET_CARRY_CONNECTOR_TYPE,
      notes: [
        `Market identity for ${marketConfig.symbol} on Drift ${this.driftEnv}.`,
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

    const perpMarketIndexes = Array.from(this.supportedMarkets.values()).map(m => m.marketIndex);

    const createDriftClient = this.dependencies.createDriftClient
      ?? ((config: DriftClientConfig) => new DriftClient(config));
    const client = createDriftClient({
      connection: asDriftConnection(this.getConnection()),
      env: this.driftEnv,
      wallet: createExecutionWallet(identity.keypair),
      subAccountIds: [this.subaccountId],
      activeSubAccountId: this.subaccountId,
      perpMarketIndexes,
      spotMarketIndexes: configs[this.driftEnv].SPOT_MARKETS.map((market) => market.marketIndex),
      oracleInfos: Array.from(this.supportedMarkets.values()).map(market => ({
        publicKey: market.oracle,
        source: market.oracleSource,
      })),
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
    const primaryMarket = this.supportedMarkets.values().next().value as PerpMarketConfig | undefined;

    this.eventSubscriber = new DriftExecutionEventSubscriber({
      connection: this.getConnection(),
      program: client.program,
      accountAddress: identity.accountAddress,
      subaccountId: this.subaccountId,
      marketIndex: primaryMarket?.marketIndex ?? 0,
      commitment: this.commitment,
    }, this.dependencies.createEventSubscriber === undefined
      ? {}
      : {
        createEventSubscriber: this.dependencies.createEventSubscriber,
      });

    return this.eventSubscriber;
  }

  private async loadMarketContext(marketConfig: PerpMarketConfig): Promise<{
    market: PerpMarketAccount;
    oraclePriceData: OraclePriceData;
  }> {
    const client = await this.getDriftClient();
    const market = client.getPerpMarketAccount(marketConfig.marketIndex);
    if (market === undefined) {
      throw new Error(
        `Drift SDK did not return market state for ${marketConfig.symbol} on ${this.driftEnv}.`,
      );
    }

    return {
      market,
      oraclePriceData: client.getOracleDataForPerpMarket(marketConfig.marketIndex),
    };
  }

  private async getActivePosition(asset: string): Promise<{
    side: 'long' | 'short';
    size: Decimal;
  } | null> {
    const marketConfig = this.getMarketConfig(asset);
    const client = await this.getDriftClient();
    const userAccount = client.getUserAccount(this.subaccountId);
    if (userAccount === undefined) {
      return null;
    }

    const position = userAccount.perpPositions.find(
      (candidate) => candidate.marketIndex === marketConfig.marketIndex,
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
      marketIdentity: this.buildMarketIdentity(cachedOrder.asset, 'execution_result'),
    };
  }
}
