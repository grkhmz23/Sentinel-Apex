import type {
  VenueAccountStateSnapshot,
  VenueBalanceEntrySnapshot,
  VenueBalanceStateSnapshot,
  VenueCapabilitySnapshot,
  VenueDerivativeAccountModel,
  VenueDerivativeAccountStateSnapshot,
  VenueDerivativeHealthStateSnapshot,
  VenueDerivativePositionStateSnapshot,
  VenueExecutionReferenceEntrySnapshot,
  VenueExecutionReferenceStateSnapshot,
  VenueExposureEntrySnapshot,
  VenueOrderEntrySnapshot,
  VenueOrderStateSnapshot,
  VenueTruthAdapter,
  VenueTruthCoverage,
  VenueTruthCoverageItem,
  VenueTruthSnapshot,
} from '../interfaces/venue-truth-adapter.js';

interface JsonRpcResponse<T> {
  result?: T;
  error?: {
    code: number;
    message: string;
  };
}

interface SolanaRpcContext {
  slot: number;
}

interface SolanaVersionResult {
  'solana-core': string;
}

interface SolanaBalanceResult {
  context: SolanaRpcContext;
  value: number;
}

interface SolanaAccountInfoResult {
  context: SolanaRpcContext;
  value: {
    data?: [string, string] | string | null;
    executable: boolean;
    lamports: number;
    owner: string;
    rentEpoch: number;
    space: number;
  } | null;
}

interface SolanaTokenAccountsResult {
  context: SolanaRpcContext;
  value: Array<{
    pubkey: string;
    account: {
      data?: {
        parsed?: {
          info?: {
            mint?: string;
            tokenAmount?: {
              amount?: string;
              decimals?: number;
              uiAmountString?: string | null;
            };
          };
        };
      };
    };
  }>;
}

interface SolanaSignatureResultItem {
  signature: string;
  slot: number;
  blockTime: number | null;
  confirmationStatus: string | null;
  err: Record<string, unknown> | null;
  memo: string | null;
}

export interface SolanaRpcReadonlyTruthAdapterConfig {
  venueId: string;
  venueName: string;
  rpcEndpoint: string;
  accountAddress?: string;
  accountLabel?: string;
  authRequirementsSummary?: string[];
  recentSignatureLimit?: number;
}

type FetchLike = typeof fetch;

const TOKEN_PROGRAM_ID = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';
const SYSTEM_PROGRAM_ID = '11111111111111111111111111111111';
const DEFAULT_RECENT_SIGNATURE_LIMIT = 10;

function unsupportedCoverage(reason: string): VenueTruthCoverageItem {
  return {
    status: 'unsupported',
    reason,
    limitations: [],
  };
}

function isoFromUnixSeconds(value: number | null): string | null {
  return value === null ? null : new Date(value * 1000).toISOString();
}

function extractAccountDataBase64(accountInfo: SolanaAccountInfoResult | null): string | null {
  const data = accountInfo?.value?.data;
  if (Array.isArray(data) && data[1] === 'base64') {
    return data[0];
  }
  if (typeof data === 'string' && data.length > 0) {
    return data;
  }

  return null;
}

function deriveRawDiscriminatorHex(accountInfo: SolanaAccountInfoResult | null): string | null {
  const encoded = extractAccountDataBase64(accountInfo);
  if (encoded === null) {
    return null;
  }

  const raw = Buffer.from(encoded, 'base64');
  if (raw.length < 8) {
    return null;
  }

  return raw.subarray(0, 8).toString('hex');
}

function classifyDerivativeAccountModel(
  accountInfo: SolanaAccountInfoResult | null,
): VenueDerivativeAccountModel {
  if (accountInfo?.value === null || accountInfo === null) {
    return 'unknown';
  }
  if (accountInfo.value.executable) {
    return 'executable_program';
  }
  if (accountInfo.value.owner === SYSTEM_PROGRAM_ID) {
    return 'wallet';
  }

  return 'program_account';
}

export class SolanaRpcReadonlyTruthAdapter implements VenueTruthAdapter {
  readonly venueId: string;
  readonly venueName: string;

  private connected = false;
  private readonly authRequirementsSummary: string[];
  private readonly recentSignatureLimit: number;

  constructor(
    private readonly config: SolanaRpcReadonlyTruthAdapterConfig,
    private readonly fetchImpl: FetchLike = fetch,
  ) {
    this.venueId = config.venueId;
    this.venueName = config.venueName;
    this.authRequirementsSummary = config.authRequirementsSummary ?? [
      'DRIFT_RPC_ENDPOINT',
      'DRIFT_READONLY_ACCOUNT_ADDRESS',
    ];
    this.recentSignatureLimit = config.recentSignatureLimit ?? DEFAULT_RECENT_SIGNATURE_LIMIT;
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
    const missingPrerequisites = this.config.accountAddress === undefined || this.config.accountAddress === ''
      ? ['Set DRIFT_READONLY_ACCOUNT_ADDRESS to enable account, balance, and recent-reference snapshots.']
      : [];

    return {
      venueId: this.venueId,
      venueName: this.venueName,
      sleeveApplicability: ['carry'],
      connectorType: 'solana_rpc_readonly',
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
        endpointConfigured: this.config.rpcEndpoint.length > 0,
        accountAddressConfigured: missingPrerequisites.length === 0,
        accountLabel: this.config.accountLabel ?? null,
        recentSignatureLimit: this.recentSignatureLimit,
      },
    };
  }

  async getVenueTruthSnapshot(): Promise<VenueTruthSnapshot> {
    const capturedAt = new Date().toISOString();
    const sourceMetadata = {
      sourceKind: 'json_rpc' as const,
      sourceName: 'solana_rpc_readonly',
      observedScope: this.config.accountAddress === undefined || this.config.accountAddress === ''
        ? ['cluster_version']
        : [
          'cluster_version',
          'account_identity',
          'native_balance',
          'spl_token_balances',
          'recent_signatures',
          'derivative_account_metadata',
          'order_reference_context',
        ],
    };

    try {
      const version = await this.callRpc<SolanaVersionResult>('getVersion', []);
      const rpcVersion = version['solana-core'];
      const accountAddress = this.config.accountAddress;

      if (accountAddress === undefined || accountAddress === '') {
        return {
          venueId: this.venueId,
          venueName: this.venueName,
          snapshotType: 'solana_rpc_version',
          snapshotSuccessful: true,
          healthy: true,
          healthState: 'healthy',
          summary: `RPC connectivity confirmed via getVersion (${rpcVersion}). Account-level truth is unavailable until DRIFT_READONLY_ACCOUNT_ADDRESS is configured.`,
          errorMessage: null,
          capturedAt,
          snapshotCompleteness: 'minimal',
          truthCoverage: {
            accountState: unsupportedCoverage('Configure DRIFT_READONLY_ACCOUNT_ADDRESS to capture account identity.'),
            balanceState: unsupportedCoverage('Configure DRIFT_READONLY_ACCOUNT_ADDRESS to capture balance state.'),
            capacityState: unsupportedCoverage('Generic Solana RPC does not expose treasury-style venue capacity.'),
            exposureState: unsupportedCoverage('Configure DRIFT_READONLY_ACCOUNT_ADDRESS to derive balance-backed exposure.'),
            derivativeAccountState: unsupportedCoverage(
              'Configure DRIFT_READONLY_ACCOUNT_ADDRESS to inspect candidate derivative account metadata.',
            ),
            derivativePositionState: unsupportedCoverage(
              'Generic Solana RPC does not decode venue-native derivative positions without a venue SDK or IDL.',
            ),
            derivativeHealthState: unsupportedCoverage(
              'Generic Solana RPC does not decode venue-native margin or health state without a venue SDK or IDL.',
            ),
            orderState: unsupportedCoverage(
              'Configure DRIFT_READONLY_ACCOUNT_ADDRESS to capture reference-only order context from recent signatures.',
            ),
            executionReferences: unsupportedCoverage('Configure DRIFT_READONLY_ACCOUNT_ADDRESS to inspect recent transaction references.'),
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
          payload: {
            rpcVersion,
            accountAddress: null,
            accountLabel: this.config.accountLabel ?? null,
          },
          metadata: {
            endpoint: this.config.rpcEndpoint,
          },
        };
      }

      const sectionErrors: string[] = [];

      const accountInfoResult = await this.tryRpc<SolanaAccountInfoResult>('getAccountInfo', [
        accountAddress,
        { encoding: 'base64', commitment: 'processed' },
      ]);
      if (accountInfoResult.error !== null) {
        sectionErrors.push(accountInfoResult.error);
      }

      const nativeBalanceResult = await this.tryRpc<SolanaBalanceResult>('getBalance', [
        accountAddress,
        { commitment: 'processed' },
      ]);
      if (nativeBalanceResult.error !== null) {
        sectionErrors.push(nativeBalanceResult.error);
      }

      const tokenAccountsResult = await this.tryRpc<SolanaTokenAccountsResult>('getTokenAccountsByOwner', [
        accountAddress,
        { programId: TOKEN_PROGRAM_ID },
        { encoding: 'jsonParsed', commitment: 'processed' },
      ]);
      if (tokenAccountsResult.error !== null) {
        sectionErrors.push(tokenAccountsResult.error);
      }

      const signaturesResult = await this.tryRpc<SolanaSignatureResultItem[]>('getSignaturesForAddress', [
        accountAddress,
        { limit: this.recentSignatureLimit },
      ]);
      if (signaturesResult.error !== null) {
        sectionErrors.push(signaturesResult.error);
      }

      const nativeLamports = nativeBalanceResult.result?.value ?? null;
      const nativeBalanceDisplay = nativeLamports === null ? null : (nativeLamports / 1_000_000_000).toFixed(9);
      const balanceEntries = this.buildBalanceEntries(
        accountAddress,
        nativeBalanceResult.result,
        tokenAccountsResult.result,
      );
      const executionReferences = this.buildExecutionReferences(accountAddress, signaturesResult.result ?? null);
      const exposureEntries = this.buildExposureEntries(balanceEntries);
      const derivativeAccountState = this.buildDerivativeAccountState(
        accountAddress,
        rpcVersion,
        accountInfoResult.result,
      );
      const orderState = this.buildOrderState(accountAddress, signaturesResult.result ?? null);
      const derivativePositionState = this.buildDerivativePositionState();
      const derivativeHealthState = this.buildDerivativeHealthState();

      const accountState: VenueAccountStateSnapshot | null = accountInfoResult.result === null
        ? null
        : {
          accountAddress,
          accountLabel: this.config.accountLabel ?? null,
          accountExists: accountInfoResult.result.value !== null,
          ownerProgram: accountInfoResult.result.value?.owner ?? null,
          executable: accountInfoResult.result.value?.executable ?? null,
          lamports: accountInfoResult.result.value === null ? null : String(accountInfoResult.result.value.lamports),
          nativeBalanceDisplay,
          observedSlot: String(accountInfoResult.result.context.slot),
          rentEpoch: accountInfoResult.result.value === null ? null : String(accountInfoResult.result.value.rentEpoch),
          dataLength: accountInfoResult.result.value?.space ?? null,
        };

      const balanceState: VenueBalanceStateSnapshot | null = nativeBalanceResult.result === null
        && tokenAccountsResult.result === null
        ? null
        : {
          balances: balanceEntries,
          totalTrackedBalances: balanceEntries.length,
          observedSlot: nativeBalanceResult.result !== null
            ? String(nativeBalanceResult.result.context.slot)
            : tokenAccountsResult.result !== null
              ? String(tokenAccountsResult.result.context.slot)
              : null,
        };

      const executionReferenceState: VenueExecutionReferenceStateSnapshot | null = signaturesResult.result === null
        ? null
        : {
          referenceLookbackLimit: this.recentSignatureLimit,
          references: executionReferences,
          oldestReferenceAt: executionReferences.length === 0
            ? null
            : executionReferences[executionReferences.length - 1]?.blockTime ?? null,
        };

      const truthCoverage = this.buildTruthCoverage({
        accountInfoResult: accountInfoResult.result,
        accountInfoError: accountInfoResult.error,
        balanceError: nativeBalanceResult.error,
        tokenBalanceError: tokenAccountsResult.error,
        signatureError: signaturesResult.error,
        signatureCount: executionReferences.length,
      });
      const snapshotCompleteness = this.deriveSnapshotCompleteness(sectionErrors, truthCoverage);

      return {
        venueId: this.venueId,
        venueName: this.venueName,
        snapshotType: 'solana_rpc_account_state',
        snapshotSuccessful: true,
        healthy: sectionErrors.length === 0,
        healthState: sectionErrors.length === 0 ? 'healthy' : 'degraded',
        summary: sectionErrors.length === 0
          ? `Read-only Solana account snapshot captured for ${this.config.accountLabel ?? accountAddress} with ${balanceEntries.length} balances, ${executionReferences.length} recent references, and ${derivativeAccountState?.accountModel ?? 'unknown'} derivative-account classification.`
          : `Read-only Solana account snapshot partially captured for ${this.config.accountLabel ?? accountAddress}.`,
        errorMessage: sectionErrors.length === 0 ? null : sectionErrors.join('; '),
        capturedAt,
        snapshotCompleteness,
        truthCoverage,
        sourceMetadata,
        accountState,
        balanceState,
        capacityState: null,
        exposureState: {
          exposures: exposureEntries,
          methodology: 'balance_derived_spot_exposure',
        },
        derivativeAccountState,
        derivativePositionState,
        derivativeHealthState,
        orderState,
        executionReferenceState,
        payload: {
          rpcVersion,
          accountAddress,
          accountLabel: this.config.accountLabel ?? null,
          nativeBalanceLamports: nativeLamports === null ? null : String(nativeLamports),
          nativeBalanceSol: nativeBalanceDisplay,
          balances: balanceEntries,
          derivativeAccountModel: derivativeAccountState?.accountModel ?? null,
          derivativeAccountDecoded: derivativeAccountState?.decoded ?? false,
          derivativeAccountRawDiscriminatorHex: derivativeAccountState?.rawDiscriminatorHex ?? null,
          orderReferenceMode: orderState?.referenceMode ?? 'none',
          orderReferenceCount: orderState?.openOrders.length ?? 0,
          recentSignatures: executionReferences,
          sectionErrors,
        },
        metadata: {
          endpoint: this.config.rpcEndpoint,
          recentSignatureLimit: this.recentSignatureLimit,
        },
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const accountConfigured = this.config.accountAddress !== undefined && this.config.accountAddress !== '';
      return {
        venueId: this.venueId,
        venueName: this.venueName,
        snapshotType: 'solana_rpc_error',
        snapshotSuccessful: false,
        healthy: false,
        healthState: 'unavailable',
        summary: `Read-only RPC snapshot failed for ${this.venueName}.`,
        errorMessage: message,
        capturedAt,
        snapshotCompleteness: 'minimal',
        truthCoverage: {
          accountState: accountConfigured
            ? {
              status: 'partial',
              reason: `Snapshot failed before account identity could be captured: ${message}`,
              limitations: [],
            }
            : unsupportedCoverage('Configure DRIFT_READONLY_ACCOUNT_ADDRESS to capture account identity.'),
          balanceState: accountConfigured
            ? {
              status: 'partial',
              reason: `Snapshot failed before balance state could be captured: ${message}`,
              limitations: ['SPL token balances are only available when account-level RPC reads succeed.'],
            }
            : unsupportedCoverage('Configure DRIFT_READONLY_ACCOUNT_ADDRESS to capture balance state.'),
          capacityState: unsupportedCoverage('Generic Solana RPC does not expose treasury-style venue capacity.'),
          exposureState: accountConfigured
            ? {
              status: 'partial',
              reason: `Snapshot failed before exposure could be derived: ${message}`,
              limitations: ['Exposure is balance-derived and does not include Drift-native derivative positions.'],
            }
            : unsupportedCoverage('Configure DRIFT_READONLY_ACCOUNT_ADDRESS to derive balance-backed exposure.'),
          derivativeAccountState: accountConfigured
            ? {
              status: 'partial',
              reason: `Snapshot failed before derivative-account metadata could be captured: ${message}`,
              limitations: ['Generic Solana RPC metadata does not decode venue-native account authority or subaccount state.'],
            }
            : unsupportedCoverage('Configure DRIFT_READONLY_ACCOUNT_ADDRESS to inspect candidate derivative account metadata.'),
          derivativePositionState: unsupportedCoverage(
            'Generic Solana RPC does not decode venue-native derivative positions without a venue SDK or IDL.',
          ),
          derivativeHealthState: unsupportedCoverage(
            'Generic Solana RPC does not decode venue-native margin or health state without a venue SDK or IDL.',
          ),
          orderState: accountConfigured
            ? {
              status: 'partial',
              reason: `Snapshot failed before order-reference context could be captured: ${message}`,
              limitations: ['Order state is limited to reference-only recent signatures and does not include venue-native open orders.'],
            }
            : unsupportedCoverage(
              'Configure DRIFT_READONLY_ACCOUNT_ADDRESS to capture reference-only order context from recent signatures.',
            ),
          executionReferences: accountConfigured
            ? {
              status: 'partial',
              reason: `Snapshot failed before recent references could be captured: ${message}`,
              limitations: ['Execution references are limited to recent account signatures.'],
            }
            : unsupportedCoverage('Configure DRIFT_READONLY_ACCOUNT_ADDRESS to inspect recent transaction references.'),
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
          accountAddress: this.config.accountAddress ?? null,
        },
      };
    }
  }

  private buildTruthCoverage(input: {
    accountInfoResult: SolanaAccountInfoResult | null;
    accountInfoError: string | null;
    balanceError: string | null;
    tokenBalanceError: string | null;
    signatureError: string | null;
    signatureCount: number;
  }): VenueTruthCoverage {
    const balanceError = input.balanceError;
    const tokenBalanceError = input.tokenBalanceError;
    const balanceCoverageReason = balanceError !== null && tokenBalanceError !== null
      ? `${balanceError}; ${tokenBalanceError}`
      : balanceError ?? tokenBalanceError;
    const derivativeAccountCoverage = this.buildDerivativeAccountCoverage(
      input.accountInfoResult,
      input.accountInfoError,
    );
    const orderCoverage = this.buildOrderCoverage(input.signatureError, input.signatureCount);

    return {
      accountState: input.accountInfoError === null
        ? {
          status: 'available',
          reason: null,
          limitations: [],
        }
        : {
          status: 'partial',
          reason: input.accountInfoError,
          limitations: [],
        },
      balanceState: balanceCoverageReason === null
        ? {
          status: 'available',
          reason: null,
          limitations: ['SPL balances are limited to token-program accounts visible through getTokenAccountsByOwner.'],
        }
        : {
          status: 'partial',
          reason: balanceCoverageReason,
          limitations: ['SPL balances are limited to token-program accounts visible through getTokenAccountsByOwner.'],
        },
      capacityState: unsupportedCoverage('Generic Solana RPC does not expose treasury-style venue capacity.'),
      exposureState: balanceCoverageReason === null
        ? {
          status: 'available',
          reason: null,
          limitations: ['Exposure is balance-derived and does not include Drift-native derivative positions.'],
        }
        : {
          status: 'partial',
          reason: balanceCoverageReason,
          limitations: ['Exposure is balance-derived and does not include Drift-native derivative positions.'],
        },
      derivativeAccountState: derivativeAccountCoverage,
      derivativePositionState: unsupportedCoverage(
        'Generic Solana RPC does not decode venue-native derivative positions without a Drift or venue-specific decode path.',
      ),
      derivativeHealthState: unsupportedCoverage(
        'Generic Solana RPC does not decode venue-native margin or health state without a Drift or venue-specific decode path.',
      ),
      orderState: orderCoverage,
      executionReferences: input.signatureError === null
        ? {
          status: 'available',
          reason: null,
          limitations: ['Execution references are limited to recent account signatures.'],
        }
        : {
          status: 'partial',
          reason: input.signatureError,
          limitations: ['Execution references are limited to recent account signatures.'],
      },
    };
  }

  private buildDerivativeAccountCoverage(
    accountInfo: SolanaAccountInfoResult | null,
    accountInfoError: string | null,
  ): VenueTruthCoverageItem {
    if (accountInfoError !== null) {
      return {
        status: 'partial',
        reason: accountInfoError,
        limitations: ['Derivative account coverage is limited to raw Solana account metadata.'],
      };
    }

    if (accountInfo === null) {
      return {
        status: 'partial',
        reason: 'Account metadata was not returned by getAccountInfo.',
        limitations: ['Derivative account coverage is limited to raw Solana account metadata.'],
      };
    }

    if (accountInfo.value === null) {
      return {
        status: 'partial',
        reason: 'Tracked account does not currently exist on-chain.',
        limitations: ['Derivative account coverage is limited to raw Solana account metadata.'],
      };
    }

    const accountModel = classifyDerivativeAccountModel(accountInfo);
    if (accountModel === 'program_account') {
      return {
        status: 'partial',
        reason: 'Program-owned account metadata is visible, but venue-native derivative decoding is not implemented.',
        limitations: [
          'Authority, subaccount, positions, and health require a venue SDK or IDL-backed decoder.',
        ],
      };
    }

    if (accountModel === 'wallet') {
      return unsupportedCoverage(
        'Tracked account is a wallet account; generic Solana RPC does not reveal venue-native derivative semantics from this account alone.',
      );
    }

    if (accountModel === 'executable_program') {
      return unsupportedCoverage(
        'Tracked account is executable program code, not a venue-native trading account.',
      );
    }

    return unsupportedCoverage('Venue-native derivative account semantics are not available for the tracked account.');
  }

  private buildOrderCoverage(
    signatureError: string | null,
    signatureCount: number,
  ): VenueTruthCoverageItem {
    if (signatureError !== null) {
      return {
        status: 'partial',
        reason: signatureError,
        limitations: ['Order state is limited to reference-only recent signatures and not venue-native open orders.'],
      };
    }

    return {
      status: 'partial',
      reason: signatureCount > 0
        ? 'Order context is reference-only and derived from recent account signatures.'
        : 'Recent account signatures were visible, but no order-like references were observed within the lookback window.',
      limitations: ['Order state is limited to reference-only recent signatures and not venue-native open orders.'],
    };
  }

  private buildBalanceEntries(
    accountAddress: string,
    nativeBalance: SolanaBalanceResult | null,
    tokenAccounts: SolanaTokenAccountsResult | null,
  ): VenueBalanceEntrySnapshot[] {
    const balances: VenueBalanceEntrySnapshot[] = [];

    if (nativeBalance !== null) {
      balances.push({
        assetKey: 'SOL',
        assetSymbol: 'SOL',
        assetType: 'native',
        accountAddress,
        amountAtomic: String(nativeBalance.value),
        amountDisplay: (nativeBalance.value / 1_000_000_000).toFixed(9),
        decimals: 9,
        observedSlot: String(nativeBalance.context.slot),
      });
    }

    for (const tokenAccount of tokenAccounts?.value ?? []) {
      const tokenAmount = tokenAccount.account.data?.parsed?.info?.tokenAmount;
      const mint = tokenAccount.account.data?.parsed?.info?.mint;
      if (tokenAmount?.amount === undefined || mint === undefined) {
        continue;
      }

      balances.push({
        assetKey: mint,
        assetSymbol: null,
        assetType: 'spl_token',
        accountAddress: tokenAccount.pubkey,
        amountAtomic: tokenAmount.amount,
        amountDisplay: tokenAmount.uiAmountString ?? tokenAmount.amount,
        decimals: tokenAmount.decimals ?? null,
        observedSlot: String(tokenAccounts?.context.slot ?? ''),
      });
    }

    return balances;
  }

  private buildExposureEntries(
    balances: VenueBalanceEntrySnapshot[],
  ): VenueExposureEntrySnapshot[] {
    return balances.map((balance) => ({
      exposureKey: `${balance.assetKey}:${balance.accountAddress ?? 'native'}`,
      exposureType: 'balance_derived_spot',
      assetKey: balance.assetKey,
      quantity: balance.amountAtomic,
      quantityDisplay: balance.amountDisplay,
      accountAddress: balance.accountAddress,
    }));
  }

  private buildDerivativeAccountState(
    accountAddress: string,
    rpcVersion: string,
    accountInfo: SolanaAccountInfoResult | null,
  ): VenueDerivativeAccountStateSnapshot | null {
    if (accountInfo === null) {
      return null;
    }

    const accountModel = classifyDerivativeAccountModel(accountInfo);
    const notes: string[] = [];

    if (accountInfo.value === null) {
      notes.push('Tracked account was not found at capture time.');
    } else if (accountModel === 'wallet') {
      notes.push('Tracked account is a generic Solana wallet account rather than a venue-native derivative account.');
    } else if (accountModel === 'program_account') {
      notes.push('Program-owned account metadata was captured from raw RPC.');
      notes.push('Venue-native decode is unavailable in the current repo because no Drift or Anchor decoder is present.');
    } else if (accountModel === 'executable_program') {
      notes.push('Tracked account is executable program code, not a venue-native trading account.');
    }

    return {
      venue: this.venueId,
      accountAddress,
      accountLabel: this.config.accountLabel ?? null,
      accountExists: accountInfo.value !== null,
      ownerProgram: accountInfo.value?.owner ?? null,
      accountModel,
      venueAccountType: null,
      decoded: false,
      authorityAddress: null,
      subaccountId: null,
      observedSlot: String(accountInfo.context.slot),
      rpcVersion,
      dataLength: accountInfo.value?.space ?? null,
      rawDiscriminatorHex: deriveRawDiscriminatorHex(accountInfo),
      notes,
    };
  }

  private buildDerivativePositionState(): VenueDerivativePositionStateSnapshot | null {
    return null;
  }

  private buildDerivativeHealthState(): VenueDerivativeHealthStateSnapshot | null {
    return null;
  }

  private deriveSnapshotCompleteness(
    sectionErrors: string[],
    truthCoverage: VenueTruthCoverage,
  ): VenueTruthSnapshot['snapshotCompleteness'] {
    if (sectionErrors.length > 0) {
      return 'partial';
    }

    if (
      truthCoverage.derivativeAccountState.status === 'partial'
      || truthCoverage.orderState.status === 'partial'
    ) {
      return 'partial';
    }

    return 'complete';
  }

  private buildExecutionReferences(
    accountAddress: string,
    signatures: SolanaSignatureResultItem[] | null,
  ): VenueExecutionReferenceEntrySnapshot[] {
    return (signatures ?? []).map((signature) => ({
      referenceType: 'solana_signature',
      reference: signature.signature,
      accountAddress,
      slot: String(signature.slot),
      blockTime: isoFromUnixSeconds(signature.blockTime),
      confirmationStatus: signature.confirmationStatus,
      errored: signature.err !== null,
      memo: signature.memo,
    }));
  }

  private buildOrderState(
    accountAddress: string,
    signatures: SolanaSignatureResultItem[] | null,
  ): VenueOrderStateSnapshot | null {
    if (signatures === null) {
      return null;
    }

    const openOrders: VenueOrderEntrySnapshot[] = signatures.map((signature) => ({
      venueOrderId: null,
      reference: signature.signature,
      marketKey: null,
      marketSymbol: null,
      side: 'unknown',
      status: signature.confirmationStatus ?? (signature.err === null ? 'observed_reference' : 'errored_reference'),
      orderType: null,
      price: null,
      quantity: null,
      reduceOnly: null,
      accountAddress,
      slot: String(signature.slot),
      placedAt: isoFromUnixSeconds(signature.blockTime),
      metadata: {
        errored: signature.err !== null,
        memo: signature.memo,
        referenceType: 'solana_signature',
        referenceOnly: true,
      },
    }));

    return {
      openOrderCount: null,
      openOrders,
      referenceMode: 'recent_account_signatures',
      methodology: 'recent_account_signatures_reference_context',
      notes: [
        'This section is reference-only context derived from recent account signatures.',
        'It is not a venue-native open-orders decode and may include non-order transactions.',
      ],
    };
  }

  private async tryRpc<T>(method: string, params: unknown[]): Promise<{
    result: T | null;
    error: string | null;
  }> {
    try {
      return {
        result: await this.callRpc<T>(method, params),
        error: null,
      };
    } catch (error) {
      return {
        result: null,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  private async callRpc<T>(method: string, params: unknown[]): Promise<T> {
    const response = await this.fetchImpl(this.config.rpcEndpoint, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: `${this.venueId}:${method}`,
        method,
        params,
      }),
    });

    if (!response.ok) {
      throw new Error(`RPC ${method} failed with status ${response.status}.`);
    }

    const payload = await response.json() as JsonRpcResponse<T>;
    if (payload.error !== undefined) {
      throw new Error(`RPC ${method} error ${payload.error.code}: ${payload.error.message}`);
    }
    if (payload.result === undefined) {
      throw new Error(`RPC ${method} returned no result.`);
    }

    return payload.result;
  }
}
