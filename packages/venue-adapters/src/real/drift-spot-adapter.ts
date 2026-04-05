/* eslint-disable @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unnecessary-type-assertion */
import {
  BN,
  DriftClient,
  MarketType,
  PositionDirection,
  QUOTE_PRECISION,
  SPOT_MARKET_BALANCE_PRECISION,
  SpotBalanceType,
  configs,
  getMarketOrderParams,
  getUserAccountPublicKeySync,
  type DriftClientConfig,
  type DriftEnv,
  type OraclePriceData,
  type SpotMarketAccount,
  type SpotMarketConfig,
} from '@drift-labs/sdk';
import {
  Connection,
  Keypair,
  PublicKey,
  type Commitment,
} from '@solana/web3.js';
import Decimal from 'decimal.js';

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
  VenuePosition,
} from '../interfaces/venue-adapter.js';
import type {
  VenueCapabilitySnapshot,
  VenueTruthCoverageItem,
  VenueTruthSnapshot,
  VenueTruthSourceMetadata,
} from '../interfaces/venue-truth-adapter.js';

const DRIFT_SPOT_CONNECTOR_TYPE = 'drift_native_spot_execution';
const DEFAULT_COMMITMENT: Commitment = 'confirmed';
const DEFAULT_VENUE_ID = 'drift-solana-spot';
const DEFAULT_VENUE_NAME = 'Drift Solana Spot';
const SUPPORTED_ASSET = 'BTC';
const SUPPORTED_MARKET_SYMBOL = 'BTC';
const SUPPORTED_MARKET_TYPE = 'spot';
const _QUOTE_PRECISION_BN = QUOTE_PRECISION as BN;
const _SPOT_PRECISION_BN = SPOT_MARKET_BALANCE_PRECISION as BN;

const SUPPORTED_EXECUTION_SCOPE = [
  'spot market orders only',
  'BTC spot market (market index 1)',
  'buy/sell spot assets for delta-neutral hedge leg',
  'real Solana transaction signatures persisted as execution references',
] as const;

const UNSUPPORTED_EXECUTION_SCOPE = [
  'perp orders',
  'margin trading',
  'borrow/lend',
  'limit or post-only orders',
  'non-BTC spot markets',
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

interface DriftSpotExecutionClient {
  readonly program: DriftClient['program'];
  subscribe(): Promise<boolean>;
  unsubscribe(): Promise<void>;
  getSpotMarketAccount(marketIndex: number): SpotMarketAccount | undefined;
  getOracleDataForSpotMarket(marketIndex: number): OraclePriceData;
  getUserAccount(subAccountId?: number, authority?: PublicKey): DriftSpotExecutionUserAccount | undefined;
  placeSpotOrder(
    orderParams: ReturnType<typeof getMarketOrderParams>,
    txParams?: unknown,
    subAccountId?: number,
  ): Promise<string>;
}

interface DriftSpotExecutionUserAccount {
  spotPositions: Array<{
    marketIndex: number;
    balanceType: SpotBalanceType;
    scaledBalance: BN;
  }>;
}

interface DriftSpotMarketDecimals {
  precision: BN;
  decimals: number;
}

interface DriftSpotAdapterDependencies {
  createConnection?: (endpoint: string, commitment: Commitment) => Connection;
  createDriftClient?: (config: DriftClientConfig) => DriftSpotExecutionClient;
  now?: () => Date;
}

export interface DriftSpotAdapterConfig {
  venueId?: string;
  venueName?: string;
  rpcEndpoint: string;
  driftEnv?: DriftEnv;
  privateKey?: string;
  subaccountId?: number;
  accountLabel?: string;
  commitment?: Commitment;
  authRequirementsSummary?: string[];
  /**
   * When true, allows execution. This is a safety flag that must be
   * explicitly set in addition to proper environment configuration.
   */
  executionEnabled?: boolean;
}

function normaliseDecimalString(value: string): string {
  if (!value.includes('.')) {
    return value;
  }
  return value.replace(/\.?0+$/, '');
}

// function formatScaled(
//   value: Decimal.Value,
//   precision: Decimal.Value,
//   decimals: number,
// ): string {
//   return normaliseDecimalString(new Decimal(value).div(precision).toFixed(decimals));
// }

// function formatBn(value: BN, precision: BN, decimals: number): string {
//   return formatScaled(value.toString(), precision.toString(), decimals);
// }

function asDriftConnection(connection: Connection): DriftClientConfig['connection'] {
  return connection as unknown as DriftClientConfig['connection'];
}

function toBn(value: string, precision: BN, label: string): BN {
  const decimal = new Decimal(value);
  if (!decimal.isFinite() || decimal.lte(0)) {
    throw new Error(`Drift spot execution requires a positive ${label}.`);
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
    sourceName: DRIFT_SPOT_CONNECTOR_TYPE,
    connectorDepth: 'execution_capable',
    commitment,
    observedScope: ['cluster_version'],
    provenanceNotes: [
      'This connector can submit real Drift spot market orders for BTC.',
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

function resolveExecutionIdentity(config: DriftSpotAdapterConfig): ExecutionIdentityResolution {
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

function getSpotMarketDecimals(market: SpotMarketAccount): DriftSpotMarketDecimals {
  const decimals = market.decimals ?? 6;
  const precision = new BN(10).pow(new BN(decimals));
  return { precision, decimals };
}

// eslint-disable-next-line @typescript-eslint/naming-convention
function _parseSpotBalance(
  balanceType: SpotBalanceType,
  scaledBalance: BN,
  precision: BN,
): { side: 'long' | 'short'; size: Decimal } {
  const size = new Decimal(scaledBalance.toString()).div(precision.toString());
  // Deposit = long (holding the asset), Borrow = short (owe the asset)
  return balanceType === SpotBalanceType.DEPOSIT
    ? { side: 'long', size }
    : { side: 'short', size: size.abs() };
}

export class DriftSpotAdapter implements VenueAdapter {
  readonly venueId: string;
  readonly venueType = 'dex' as const;
  readonly venueName: string;

  private readonly authRequirementsSummary: string[];
  private readonly driftEnv: DriftEnv;
  private readonly commitment: Commitment;
  private readonly subaccountId: number;
  private readonly supportedMarket: SpotMarketConfig;
  private readonly dependencies: DriftSpotAdapterDependencies;
  private readonly executionEnabled: boolean;

  private connected = false;
  private connection: Connection | null = null;
  private client: DriftSpotExecutionClient | null = null;
  private identity: ExecutionIdentityResolution | null = null;
  private readonly submittedOrders = new Map<string, SubmittedOrderCacheEntry>();
  private readonly submittedOrdersByClientOrderId = new Map<string, SubmittedOrderCacheEntry>();

  constructor(
    private readonly config: DriftSpotAdapterConfig,
    dependencies: DriftSpotAdapterDependencies = {},
  ) {
    this.venueId = config.venueId ?? DEFAULT_VENUE_ID;
    this.venueName = config.venueName ?? DEFAULT_VENUE_NAME;
    this.driftEnv = config.driftEnv ?? 'mainnet-beta';
    this.commitment = config.commitment ?? DEFAULT_COMMITMENT;
    this.subaccountId = config.subaccountId ?? 0;
    this.executionEnabled = config.executionEnabled ?? false;
    this.authRequirementsSummary = config.authRequirementsSummary ?? [
      'DRIFT_RPC_ENDPOINT',
      'DRIFT_PRIVATE_KEY',
      'DRIFT_SPOT_EXECUTION_ENABLED=true',
      'DRIFT_EXECUTION_SUBACCOUNT_ID (optional)',
      'DRIFT_EXECUTION_ACCOUNT_LABEL (optional)',
    ];
    this.dependencies = dependencies;

    if (this.driftEnv !== 'mainnet-beta' && this.driftEnv !== 'devnet') {
      throw new Error('DriftSpotAdapter only supports mainnet-beta or devnet.');
    }

    // BTC spot market is typically index 1 in Drift
    const market = configs[this.driftEnv].SPOT_MARKETS.find(
      (candidate) => candidate.symbol === SUPPORTED_MARKET_SYMBOL,
    );
    if (market === undefined) {
      throw new Error(`Drift ${this.driftEnv} spot market ${SUPPORTED_MARKET_SYMBOL} was not found in the installed SDK.`);
    }
    this.supportedMarket = market;
  }

  async connect(): Promise<void> {
    this.connected = true;
  }

  async disconnect(): Promise<void> {
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
        'Spot execution is not enabled. Set executionEnabled=true in config to enable spot trading.',
      );
    }

    if (identity.error !== null) {
      missingPrerequisites.push(`Configured DRIFT_PRIVATE_KEY is invalid: ${identity.error}`);
    } else if (identity.keypair === null) {
      missingPrerequisites.push(
        'Set DRIFT_PRIVATE_KEY to the Drift authority secret key to enable signed execution and account truth.',
      );
    }

    return {
      venueId: this.venueId,
      venueName: this.venueName,
      sleeveApplicability: ['carry'],
      connectorType: DRIFT_SPOT_CONNECTOR_TYPE,
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
        snapshotType: 'drift_spot_execution_connectivity',
        snapshotSuccessful: false,
        healthy: false,
        healthState: 'unavailable',
        summary: 'Drift spot execution connector is unconfigured because no RPC endpoint is set.',
        errorMessage: 'DRIFT_RPC_ENDPOINT is required to capture truth snapshots or submit execution.',
        capturedAt,
        snapshotCompleteness: 'minimal',
        truthCoverage: {
          accountState: unsupportedCoverage('Configure DRIFT_PRIVATE_KEY after setting DRIFT_RPC_ENDPOINT to derive the Drift user account.'),
          balanceState: unsupportedCoverage('This connector does not expose generic wallet balances.'),
          capacityState: unsupportedCoverage('Spot connector does not expose treasury-style capacity.'),
          exposureState: unsupportedCoverage('Capture a successful account snapshot before spot exposure can be observed.'),
          derivativeAccountState: unsupportedCoverage('Spot connector does not support derivative accounts.'),
          derivativePositionState: unsupportedCoverage('Spot connector tracks spot positions, not derivatives.'),
          derivativeHealthState: unsupportedCoverage('Spot connector does not track derivative health.'),
          orderState: unsupportedCoverage('Configure DRIFT_PRIVATE_KEY to inspect open-order inventory.'),
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
          snapshotType: 'drift_spot_execution_connectivity',
          snapshotSuccessful: true,
          healthy: true,
          healthState: 'healthy',
          summary: `RPC connectivity confirmed via getVersion (${version['solana-core']}). Account-level truth is unavailable until DRIFT_PRIVATE_KEY is configured.`,
          errorMessage: null,
          capturedAt,
          snapshotCompleteness: 'minimal',
          truthCoverage: {
            accountState: unsupportedCoverage('Configure DRIFT_PRIVATE_KEY to derive the Drift user account.'),
            balanceState: unsupportedCoverage('Configure DRIFT_PRIVATE_KEY to capture spot balance state.'),
            capacityState: unsupportedCoverage('Spot connector does not expose treasury-style capacity.'),
            exposureState: unsupportedCoverage('Configure DRIFT_PRIVATE_KEY to capture spot exposure state.'),
            derivativeAccountState: unsupportedCoverage('Spot connector does not support derivative accounts.'),
            derivativePositionState: unsupportedCoverage('Spot connector tracks spot positions.'),
            derivativeHealthState: unsupportedCoverage('Spot connector does not track derivative health.'),
            orderState: unsupportedCoverage('Configure DRIFT_PRIVATE_KEY to inspect open-order inventory.'),
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
            accountAddress: identity.accountAddress,
            authorityAddress: identity.authorityAddress,
          },
          metadata: this.buildConnectorMetadata(identity),
        };
      }

      // Use readonly adapter for account truth
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
        snapshotType: 'drift_spot_execution_account',
        sourceMetadata: {
          ...snapshot.sourceMetadata,
          sourceName: DRIFT_SPOT_CONNECTOR_TYPE,
          connectorDepth: 'execution_capable',
          provenanceNotes: [
            'This connector captures spot market truth for the Drift spot BTC market.',
            'Real execution is restricted to BTC spot market orders.',
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
        snapshotType: 'drift_spot_execution_connectivity',
        snapshotSuccessful: false,
        healthy: false,
        healthState: 'unavailable',
        summary: 'Drift spot execution connector failed to refresh venue truth.',
        errorMessage: message,
        capturedAt,
        snapshotCompleteness: 'minimal',
        truthCoverage: {
          accountState: unsupportedCoverage('Spot truth could not be captured because the connector failed.'),
          balanceState: unsupportedCoverage('Spot balance truth could not be captured.'),
          capacityState: unsupportedCoverage('Spot connector does not expose treasury-style capacity.'),
          exposureState: unsupportedCoverage('Spot exposure could not be captured.'),
          derivativeAccountState: unsupportedCoverage('Spot connector does not support derivative accounts.'),
          derivativePositionState: unsupportedCoverage('Spot positions could not be captured.'),
          derivativeHealthState: unsupportedCoverage('Spot connector does not track derivative health.'),
          orderState: unsupportedCoverage('Spot orders could not be captured.'),
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
          accountAddress: identity.accountAddress,
          authorityAddress: identity.authorityAddress,
        },
        metadata: this.buildConnectorMetadata(identity),
      };
    }
  }

  async getMarketData(asset: string): Promise<MarketData> {
    this.assertSupportedAsset(asset);
    const { oraclePriceData } = await this.loadMarketContext();

    // For spot markets, use oracle price directly and estimate a small spread
    const oraclePrice = new Decimal(oraclePriceData.price.toString());
    const oraclePrecision = new Decimal(QUOTE_PRECISION.toString());
    const price = oraclePrice.div(oraclePrecision);

    // Estimate 0.1% spread for spot markets (conservative estimate)
    const spreadPct = 0.001;
    const bid = price.times(1 - spreadPct);
    const ask = price.times(1 + spreadPct);

    return {
      venueId: this.venueId,
      asset: SUPPORTED_ASSET,
      bid: bid.toFixed(6),
      ask: ask.toFixed(6),
      mid: price.toFixed(6),
      markPrice: price.toFixed(6),
      indexPrice: price.toFixed(6),
      fundingRate: '0', // Spot markets don't have funding rates
      nextFundingTime: new Date(Date.now() + 24 * 60 * 60 * 1000), // N/A for spot
      openInterest: '0', // N/A for spot
      volume24h: '0', // Would need historical data
      marketIdentity: this.buildMarketIdentity('market_data'),
      updatedAt: this.now(),
    };
  }

  async getFundingRate(asset: string): Promise<{ rate: string; nextFundingTime: Date }> {
    this.assertSupportedAsset(asset);
    // Spot markets don't have funding rates
    return {
      rate: '0',
      nextFundingTime: new Date(Date.now() + 24 * 60 * 60 * 1000),
    };
  }

  async getBalances(): Promise<AccountBalance[]> {
    // Get spot balances from the user account
    try {
      const client = await this.getDriftClient();
      const userAccount = client.getUserAccount(this.subaccountId);
      if (userAccount === undefined) {
        return [];
      }

      const balances: AccountBalance[] = [];
      for (const position of userAccount.spotPositions) {
        if (position.scaledBalance.isZero()) {
          continue;
        }

        const market = client.getSpotMarketAccount(position.marketIndex);
        if (market === undefined) {
          continue;
        }

        const { precision } = getSpotMarketDecimals(market);
        const tokenAmount = new Decimal(position.scaledBalance.toString()).div(precision.toString());
        const marketConfig = configs[this.driftEnv].SPOT_MARKETS.find(m => m.marketIndex === position.marketIndex);

        balances.push({
          venueId: this.venueId,
          asset: marketConfig?.symbol ?? `SPOT-${position.marketIndex}`,
          available: tokenAmount.toFixed(market.decimals ?? 6),
          locked: '0',
          total: tokenAmount.toFixed(market.decimals ?? 6),
          updatedAt: this.now(),
        });
      }

      return balances;
    } catch {
      return [];
    }
  }

  async getPositions(): Promise<VenuePosition[]> {
    const snapshot = await this.getVenueTruthSnapshot();
    const capturedAt = new Date(snapshot.capturedAt);

    // For spot, we treat spot balances as positions
    const balances = await this.getBalances();
    const positions: VenuePosition[] = [];

    for (const balance of balances) {
      const size = new Decimal(balance.total);
      if (size.isZero()) {
        continue;
      }

      // Get current price for PnL calculation
      let markPrice = '0';
      try {
        const marketData = await this.getMarketData(balance.asset);
        markPrice = marketData.markPrice;
      } catch {
        // Use cached price if available
      }

      positions.push({
        venueId: this.venueId,
        asset: balance.asset,
        side: 'long', // Spot is always long (holding the asset)
        size: size.abs().toFixed(8),
        entryPrice: markPrice, // Simplified - would need cost basis tracking
        markPrice,
        unrealizedPnl: '0', // Spot doesn't have unrealized PnL like perps
        marginUsed: '0',
        liquidationPrice: null,
        updatedAt: Number.isNaN(capturedAt.getTime()) ? this.now() : capturedAt,
      });
    }

    return positions;
  }

  async placeOrder(params: PlaceOrderParams): Promise<PlaceOrderResult> {
    if (!this.executionEnabled) {
      throw new Error('Drift spot execution is disabled. Set executionEnabled=true in config to enable.');
    }

    this.assertSupportedOrder(params);

    const cachedSubmission = this.submittedOrdersByClientOrderId.get(params.clientOrderId);
    if (cachedSubmission !== undefined) {
      return this.toCachedOrderResult(cachedSubmission);
    }

    const client = await this.getDriftClient();
    const market = client.getSpotMarketAccount(this.supportedMarket.marketIndex);
    if (market === undefined) {
      throw new Error(`Spot market ${this.supportedMarket.symbol} not found`);
    }

    const { precision } = getSpotMarketDecimals(market);
    const submittedAt = this.now();

    try {
      // For spot orders, we use placeSpotOrder which is similar to perp
      const signature = await client.placeSpotOrder(
        getMarketOrderParams({
          marketType: MarketType.SPOT,
          marketIndex: this.supportedMarket.marketIndex,
          direction: params.side === 'buy' ? PositionDirection.LONG : PositionDirection.SHORT,
          baseAssetAmount: toBn(params.size, precision, 'order size'),
          reduceOnly: params.reduceOnly ?? false,
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
        `Drift spot execution failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async cancelOrder(venueOrderId: string): Promise<CancelOrderResult> {
    const cachedOrder = this.submittedOrders.get(venueOrderId);
    return {
      venueOrderId,
      cancelled: false,
      reason: cachedOrder === undefined
        ? 'Unknown Drift spot execution reference.'
        : 'Drift spot execution does not expose a cancel path for market orders.',
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
        `Drift spot adapter only supports ${SUPPORTED_MARKET_SYMBOL} for this phase; received asset "${asset}".`,
      );
    }
  }

  private assertSupportedOrder(params: PlaceOrderParams): void {
    this.assertSupportedAsset(params.asset);

    if (params.type !== 'market') {
      throw new Error('Drift spot execution only supports market orders in this phase.');
    }
    if (params.postOnly === true) {
      throw new Error('Drift spot execution does not support post-only orders in this phase.');
    }
    if (params.price !== undefined) {
      throw new Error('Drift spot execution does not accept explicit limit prices in this phase.');
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
      supportedAsset: SUPPORTED_ASSET,
      supportedMarketSymbol: this.supportedMarket.symbol,
      supportedMarketIndex: this.supportedMarket.marketIndex,
      executionPosture: 'spot_execution_capable',
      connectorMode: 'spot_execution',
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
      marketKey: `spot:${this.supportedMarket.marketIndex}`,
      marketSymbol: this.supportedMarket.symbol,
      marketName: this.supportedMarket.symbol,
      aliases: [SUPPORTED_ASSET, this.supportedMarket.symbol],
      provenance: 'venue_native',
      capturedAtStage,
      source: DRIFT_SPOT_CONNECTOR_TYPE,
      notes: [
        'Market identity is fixed to the single BTC spot market supported by this connector.',
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

  private async getDriftClient(): Promise<DriftSpotExecutionClient> {
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
      perpMarketIndexes: [], // No perps for spot adapter
      spotMarketIndexes: configs[this.driftEnv].SPOT_MARKETS.map((market) => market.marketIndex),
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

  private async loadMarketContext(): Promise<{
    market: SpotMarketAccount;
    oraclePriceData: OraclePriceData;
  }> {
    const client = await this.getDriftClient();
    const market = client.getSpotMarketAccount(this.supportedMarket.marketIndex);
    if (market === undefined) {
      throw new Error(
        `Drift SDK did not return market state for spot ${this.supportedMarket.symbol} on ${this.driftEnv}.`,
      );
    }

    return {
      market,
      oraclePriceData: client.getOracleDataForSpotMarket(this.supportedMarket.marketIndex),
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
