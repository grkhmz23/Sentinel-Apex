import { createRequire } from 'node:module';

import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  sendAndConfirmTransaction,
} from '@solana/web3.js';
import { Decimal } from 'decimal.js';

import { createLogger } from '@sentinel-apex/observability';
import { Err, Ok, type Result } from '@sentinel-apex/shared';

import type {
  VaultConfig as VoltrVaultConfig,
  VaultConfigField as VoltrVaultConfigField,
  VoltrClient as VoltrClientType,
} from '@voltr/vault-sdk';

import type {
  AddAdaptorRequest,
  AllocateStrategyRequest,
  CalibrateHighWaterMarkRequest,
  CreateVaultReceipt,
  CreateVaultRequest,
  DepositReceipt,
  DepositRequest,
  HarvestFeesRequest,
  InitializeStrategyRequest,
  LpMetadataRequest,
  RangerIntegrationStatus,
  RangerVaultConfigField,
  VaultConfig,
  VaultConfigUpdateRequest,
  VaultId,
  VaultState,
  WithdrawalReceipt,
  WithdrawalRequest,
} from './types.js';

const logger = createLogger('ranger-vault-client');
const requireFromHere = createRequire(__filename);

type VoltrSdkModule = typeof import('@voltr/vault-sdk');
type BnInstance = {
  toArrayLike(
    type: typeof Buffer,
    endian: 'le' | 'be',
    length: number,
  ): Buffer;
  toString(): string;
};
type BnConstructor = new (value: string | number | bigint) => BnInstance;
type AnchorModule = { BN: BnConstructor };

const DEFAULT_MAINNET_VAULT_PROGRAM_ID = 'vVoLTRjQmtFpiYoegx285Ze4gsLJ8ZxgFKVcuvmG1a8';
const DEFAULT_SPL_TOKEN_PROGRAM_ID = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';
const UNCAPPED_U64_MAX = '18446744073709551615';

export interface VaultClientConfig {
  connection: Connection;
  vaultProgramId?: PublicKey;
  defaultAdaptorProgramId?: PublicKey;
  adminSigner?: Keypair;
  managerSigner?: Keypair;
  mode: 'full' | 'simulated' | 'readonly';
  commitment?: 'processed' | 'confirmed' | 'finalized';
}

interface LoadedSdk {
  voltr: VoltrSdkModule;
  BN: BnConstructor;
}

export class RangerVaultClient {
  private readonly config: VaultClientConfig;
  private readonly simulatedVaults: Map<VaultId, VaultState> = new Map();
  private readonly simulatedDeposits: Map<string, DepositReceipt> = new Map();
  private readonly simulatedWithdrawals: Map<string, WithdrawalReceipt> = new Map();
  private sdk: LoadedSdk | null = null;

  constructor(config: VaultClientConfig) {
    this.config = {
      commitment: 'confirmed',
      vaultProgramId: new PublicKey(DEFAULT_MAINNET_VAULT_PROGRAM_ID),
      ...config,
    };

    logger.info('RangerVaultClient initialized', {
      mode: this.config.mode,
      hasAdminSigner: !!this.config.adminSigner,
      hasManagerSigner: !!this.config.managerSigner,
      hasDefaultAdaptorProgramId: !!this.config.defaultAdaptorProgramId,
    });
  }

  getIntegrationStatus(): RangerIntegrationStatus {
    const sdkAvailable =
      this.config.mode === 'simulated' || this.canResolve('@voltr/vault-sdk');
    const hasAdminSigner = !!this.config.adminSigner;
    const hasManagerSigner = !!this.config.managerSigner;

    if (this.config.mode === 'simulated') {
      return {
        sdkAvailable: true,
        vaultProgramConfigured: true,
        defaultAdaptorConfigured: !!this.config.defaultAdaptorProgramId,
        vaultProgramId: this.config.vaultProgramId ?? null,
        defaultAdaptorProgramId: this.config.defaultAdaptorProgramId ?? null,
        hasAdminSigner,
        hasManagerSigner,
        mode: 'simulated',
        blockerDescription: null,
      };
    }

    let mode: RangerIntegrationStatus['mode'] = this.config.mode;
    let blockerDescription: string | null = null;

    if (!sdkAvailable) {
      mode = 'unavailable';
      blockerDescription =
        'Install @voltr/vault-sdk and @coral-xyz/anchor to enable real Ranger integration.';
    } else if (!this.config.vaultProgramId) {
      mode = 'unavailable';
      blockerDescription = 'Ranger vault program ID is not configured.';
    } else if (this.config.mode === 'full' && !hasAdminSigner) {
      mode = 'unavailable';
      blockerDescription = 'Full Ranger mode requires an admin signer.';
    }

    return {
      sdkAvailable,
      vaultProgramConfigured: !!this.config.vaultProgramId,
      defaultAdaptorConfigured: !!this.config.defaultAdaptorProgramId,
      vaultProgramId: this.config.vaultProgramId ?? null,
      defaultAdaptorProgramId: this.config.defaultAdaptorProgramId ?? null,
      hasAdminSigner,
      hasManagerSigner,
      mode,
      blockerDescription,
    };
  }

  async createVault(
    request: CreateVaultRequest,
  ): Promise<Result<CreateVaultReceipt, Error>> {
    if (this.config.mode === 'simulated') {
      return this.simulateCreateVault(request);
    }

    if (this.config.mode === 'readonly') {
      return Err(new Error('Readonly Ranger client cannot create vaults.'));
    }

    const status = this.getIntegrationStatus();
    if (status.mode === 'unavailable') {
      return Err(new Error(status.blockerDescription ?? 'Ranger integration unavailable.'));
    }

    try {
      const { voltr, BN } = this.loadSdk();
      const adminSigner = this.config.adminSigner;
      if (!adminSigner) {
        return Err(new Error('Admin signer is required to create a Ranger vault.'));
      }

      const manager = request.manager ?? this.config.managerSigner?.publicKey;
      if (!manager) {
        return Err(new Error('Manager public key is required to create a Ranger vault.'));
      }

      const admin = request.admin ?? adminSigner.publicKey;
      const payer = request.payer ?? adminSigner.publicKey;
      const vaultKeypair = request.vaultKeypair ?? Keypair.generate();
      const assetMint = new PublicKey(request.config.assetMint);
      const client = new voltr.VoltrClient(this.config.connection);

      const vaultParams = {
        config: this.toVoltrVaultConfig(request.config, BN),
        name: request.config.name,
        description: request.config.description,
      };

      const ix = await client.createInitializeVaultIx(vaultParams, {
        vault: vaultKeypair,
        vaultAssetMint: assetMint,
        admin,
        manager,
        payer,
      });

      const transaction = new Transaction().add(ix);
      transaction.feePayer = payer;

      const signature = await sendAndConfirmTransaction(
        this.config.connection,
        transaction,
        [adminSigner, vaultKeypair],
        this.getConfirmOptions(),
      );

      logger.info('Created Ranger vault', {
        vault: vaultKeypair.publicKey.toBase58(),
        admin: admin.toBase58(),
        manager: manager.toBase58(),
        assetMint: assetMint.toBase58(),
      });

      return Ok({
        vaultId: vaultKeypair.publicKey.toBase58(),
        vaultAddress: vaultKeypair.publicKey,
        shareTokenMint: client.findVaultLpMint(vaultKeypair.publicKey),
        signature,
        admin,
        manager,
      });
    } catch (error) {
      return Err(this.normalizeError(error));
    }
  }

  async createLpMetadata(
    request: LpMetadataRequest,
  ): Promise<Result<{ signature: string }, Error>> {
    if (this.config.mode === 'simulated') {
      const vault = this.simulatedVaults.get(request.vaultId);
      if (!vault) {
        return Err(new Error(`Vault not found: ${request.vaultId}`));
      }

      vault.config = {
        ...vault.config,
        lpTokenName: request.name,
        lpTokenSymbol: request.symbol,
        strategyMetadataUri: request.uri,
      };
      vault.updatedAt = new Date();

      return Ok({ signature: `simulated_lp_metadata_${Date.now()}` });
    }

    if (this.config.mode === 'readonly') {
      return Err(new Error('Readonly Ranger client cannot update LP metadata.'));
    }

    try {
      const { voltr } = this.loadSdk();
      const adminSigner = this.config.adminSigner;
      if (!adminSigner) {
        return Err(new Error('Admin signer is required to update LP metadata.'));
      }

      const vault = new PublicKey(request.vaultId);
      const payer = request.payer ?? adminSigner.publicKey;
      const client = new voltr.VoltrClient(this.config.connection);

      const ix = await client.createCreateLpMetadataIx(
        {
          name: request.name,
          symbol: request.symbol,
          uri: request.uri,
        },
        {
          vault,
          admin: adminSigner.publicKey,
          payer,
        },
      );

      const transaction = new Transaction().add(ix);
      transaction.feePayer = payer;

      const signature = await sendAndConfirmTransaction(
        this.config.connection,
        transaction,
        [adminSigner],
        this.getConfirmOptions(),
      );

      return Ok({ signature });
    } catch (error) {
      return Err(this.normalizeError(error));
    }
  }

  async updateVaultConfig(
    request: VaultConfigUpdateRequest,
  ): Promise<Result<{ signature: string }, Error>> {
    if (this.config.mode === 'simulated') {
      return this.simulateConfigUpdate(request);
    }

    if (this.config.mode === 'readonly') {
      return Err(new Error('Readonly Ranger client cannot update vault config.'));
    }

    try {
      const { voltr, BN } = this.loadSdk();
      const adminSigner = this.config.adminSigner;
      if (!adminSigner) {
        return Err(new Error('Admin signer is required to update Ranger vault config.'));
      }

      const vault = new PublicKey(request.vaultId);
      const client = new voltr.VoltrClient(this.config.connection);
      const field = this.mapConfigField(voltr, request.field);
      const data = this.serializeConfigUpdateValue(BN, request.field, request.value);
      const needsVaultLpMint =
        request.field === 'managerManagementFee' ||
        request.field === 'adminManagementFee';

      const ix = await client.createUpdateVaultConfigIx(field, data, {
        vault,
        admin: adminSigner.publicKey,
        ...(needsVaultLpMint ? { vaultLpMint: client.findVaultLpMint(vault) } : {}),
      });

      const transaction = new Transaction().add(ix);
      transaction.feePayer = adminSigner.publicKey;

      const signature = await sendAndConfirmTransaction(
        this.config.connection,
        transaction,
        [adminSigner],
        this.getConfirmOptions(),
      );

      return Ok({ signature });
    } catch (error) {
      return Err(this.normalizeError(error));
    }
  }

  async addAdaptor(
    request: AddAdaptorRequest,
  ): Promise<Result<{ signature: string }, Error>> {
    if (this.config.mode === 'simulated') {
      const vault = this.simulatedVaults.get(request.vaultId);
      if (!vault) {
        return Err(new Error(`Vault not found: ${request.vaultId}`));
      }
      if (!vault.adaptorPrograms.some((program) => program.equals(request.adaptorProgramId))) {
        vault.adaptorPrograms.push(request.adaptorProgramId);
      }
      vault.updatedAt = new Date();
      return Ok({ signature: `simulated_add_adaptor_${Date.now()}` });
    }

    if (this.config.mode === 'readonly') {
      return Err(new Error('Readonly Ranger client cannot add adaptors.'));
    }

    try {
      const { voltr } = this.loadSdk();
      const adminSigner = this.config.adminSigner;
      if (!adminSigner) {
        return Err(new Error('Admin signer is required to add a Ranger adaptor.'));
      }

      const vault = new PublicKey(request.vaultId);
      const payer = request.payer ?? adminSigner.publicKey;
      const client = new voltr.VoltrClient(this.config.connection);
      const ix = await client.createAddAdaptorIx({
        vault,
        admin: adminSigner.publicKey,
        payer,
        adaptorProgram: request.adaptorProgramId,
      });

      const transaction = new Transaction().add(ix);
      transaction.feePayer = payer;

      const signature = await sendAndConfirmTransaction(
        this.config.connection,
        transaction,
        [adminSigner],
        this.getConfirmOptions(),
      );

      return Ok({ signature });
    } catch (error) {
      return Err(this.normalizeError(error));
    }
  }

  async initializeStrategy(
    request: InitializeStrategyRequest,
  ): Promise<Result<{ signature: string }, Error>> {
    if (this.config.mode === 'simulated') {
      return Ok({ signature: `simulated_initialize_strategy_${Date.now()}` });
    }

    if (this.config.mode === 'readonly') {
      return Err(new Error('Readonly Ranger client cannot initialize strategies.'));
    }

    try {
      const { voltr } = this.loadSdk();
      const adminSigner = this.config.adminSigner;
      if (!adminSigner) {
        return Err(new Error('Admin signer is required to initialize a Ranger strategy.'));
      }

      const vault = new PublicKey(request.vaultId);
      const payer = request.payer ?? adminSigner.publicKey;
      const manager = request.manager ?? this.config.managerSigner?.publicKey;
      if (!manager) {
        return Err(new Error('Manager public key is required to initialize a strategy.'));
      }

      const adaptorProgramId =
        request.adaptorProgramId ?? this.config.defaultAdaptorProgramId;
      if (!adaptorProgramId) {
        return Err(new Error('Adaptor program ID is required to initialize a strategy.'));
      }

      const client = new voltr.VoltrClient(this.config.connection);
      const ix = await client.createInitializeStrategyIx(
        {
          instructionDiscriminator: request.instructionDiscriminator ?? null,
          additionalArgs: request.additionalArgs ?? null,
        },
        {
          payer,
          manager,
          vault,
          strategy: request.strategy,
          adaptorProgram: adaptorProgramId,
          remainingAccounts: request.remainingAccounts,
        },
      );

      const transaction = new Transaction().add(ix);
      transaction.feePayer = payer;

      const signature = await sendAndConfirmTransaction(
        this.config.connection,
        transaction,
        [adminSigner],
        this.getConfirmOptions(),
      );

      return Ok({ signature });
    } catch (error) {
      return Err(this.normalizeError(error));
    }
  }

  async depositToStrategy(
    request: AllocateStrategyRequest,
  ): Promise<Result<{ signature: string }, Error>> {
    if (this.config.mode === 'simulated') {
      return Ok({ signature: `simulated_strategy_deposit_${Date.now()}` });
    }

    if (this.config.mode === 'readonly') {
      return Err(new Error('Readonly Ranger client cannot allocate to strategies.'));
    }

    try {
      const { voltr, BN } = this.loadSdk();
      const managerSigner = this.config.managerSigner;
      if (!managerSigner) {
        return Err(new Error('Manager signer is required to deposit to a strategy.'));
      }

      const vault = new PublicKey(request.vaultId);
      const adaptorProgramId =
        request.adaptorProgramId ?? this.config.defaultAdaptorProgramId;
      if (!adaptorProgramId) {
        return Err(new Error('Adaptor program ID is required for strategy allocation.'));
      }

      const vaultAssetMint =
        request.vaultAssetMint ?? (await this.resolveVaultAssetMint(vault));

      const client = new voltr.VoltrClient(this.config.connection);
      const ix = await client.createDepositStrategyIx(
        {
          depositAmount: new BN(this.toAmountString(request.amount)),
          instructionDiscriminator: request.instructionDiscriminator ?? null,
          additionalArgs: request.additionalArgs ?? null,
        },
        {
          manager: managerSigner.publicKey,
          vault,
          vaultAssetMint,
          strategy: request.strategy,
          assetTokenProgram: new PublicKey(DEFAULT_SPL_TOKEN_PROGRAM_ID),
          adaptorProgram: adaptorProgramId,
          remainingAccounts: request.remainingAccounts,
        },
      );

      const transaction = new Transaction().add(ix);
      transaction.feePayer = managerSigner.publicKey;

      const signature = await sendAndConfirmTransaction(
        this.config.connection,
        transaction,
        [managerSigner],
        this.getConfirmOptions(),
      );

      return Ok({ signature });
    } catch (error) {
      return Err(this.normalizeError(error));
    }
  }

  async withdrawFromStrategy(
    request: AllocateStrategyRequest,
  ): Promise<Result<{ signature: string }, Error>> {
    if (this.config.mode === 'simulated') {
      return Ok({ signature: `simulated_strategy_withdraw_${Date.now()}` });
    }

    if (this.config.mode === 'readonly') {
      return Err(new Error('Readonly Ranger client cannot deallocate from strategies.'));
    }

    try {
      const { voltr, BN } = this.loadSdk();
      const managerSigner = this.config.managerSigner;
      if (!managerSigner) {
        return Err(new Error('Manager signer is required to withdraw from a strategy.'));
      }

      const vault = new PublicKey(request.vaultId);
      const adaptorProgramId =
        request.adaptorProgramId ?? this.config.defaultAdaptorProgramId;
      if (!adaptorProgramId) {
        return Err(new Error('Adaptor program ID is required for strategy withdrawal.'));
      }

      const vaultAssetMint =
        request.vaultAssetMint ?? (await this.resolveVaultAssetMint(vault));

      const client = new voltr.VoltrClient(this.config.connection);
      const ix = await client.createWithdrawStrategyIx(
        {
          withdrawAmount: new BN(this.toAmountString(request.amount)),
          instructionDiscriminator: request.instructionDiscriminator ?? null,
          additionalArgs: request.additionalArgs ?? null,
        },
        {
          manager: managerSigner.publicKey,
          vault,
          vaultAssetMint,
          strategy: request.strategy,
          assetTokenProgram: new PublicKey(DEFAULT_SPL_TOKEN_PROGRAM_ID),
          adaptorProgram: adaptorProgramId,
          remainingAccounts: request.remainingAccounts,
        },
      );

      const transaction = new Transaction().add(ix);
      transaction.feePayer = managerSigner.publicKey;

      const signature = await sendAndConfirmTransaction(
        this.config.connection,
        transaction,
        [managerSigner],
        this.getConfirmOptions(),
      );

      return Ok({ signature });
    } catch (error) {
      return Err(this.normalizeError(error));
    }
  }

  async harvestFees(
    request: HarvestFeesRequest,
  ): Promise<Result<{ signature: string }, Error>> {
    if (this.config.mode === 'simulated') {
      return Ok({ signature: `simulated_harvest_fees_${Date.now()}` });
    }

    if (this.config.mode === 'readonly') {
      return Err(new Error('Readonly Ranger client cannot harvest fees.'));
    }

    try {
      const { voltr } = this.loadSdk();
      const adminSigner = this.config.adminSigner;
      const managerSigner = this.config.managerSigner;
      if (!adminSigner || !managerSigner) {
        return Err(
          new Error('Admin and manager signers are required to harvest Ranger fees.'),
        );
      }

      const vault = new PublicKey(request.vaultId);
      const ix = await new voltr.VoltrClient(this.config.connection).createHarvestFeeIx({
        harvester: request.harvester ?? adminSigner.publicKey,
        vaultManager: request.vaultManager ?? managerSigner.publicKey,
        vaultAdmin: request.vaultAdmin ?? adminSigner.publicKey,
        protocolAdmin: request.protocolAdmin,
        vault,
      });

      const transaction = new Transaction().add(ix);
      transaction.feePayer = adminSigner.publicKey;

      const signature = await sendAndConfirmTransaction(
        this.config.connection,
        transaction,
        [adminSigner],
        this.getConfirmOptions(),
      );

      return Ok({ signature });
    } catch (error) {
      return Err(this.normalizeError(error));
    }
  }

  async calibrateHighWaterMark(
    request: CalibrateHighWaterMarkRequest,
  ): Promise<Result<{ signature: string }, Error>> {
    if (this.config.mode === 'simulated') {
      return Ok({ signature: `simulated_calibrate_hwm_${Date.now()}` });
    }

    if (this.config.mode === 'readonly') {
      return Err(new Error('Readonly Ranger client cannot calibrate high water marks.'));
    }

    try {
      const { voltr } = this.loadSdk();
      const adminSigner = this.config.adminSigner;
      if (!adminSigner) {
        return Err(new Error('Admin signer is required to calibrate the high water mark.'));
      }

      const ix = await new voltr.VoltrClient(this.config.connection)
        .createCalibrateHighWaterMarkIx({
          vault: new PublicKey(request.vaultId),
          admin: adminSigner.publicKey,
        });

      const transaction = new Transaction().add(ix);
      transaction.feePayer = adminSigner.publicKey;

      const signature = await sendAndConfirmTransaction(
        this.config.connection,
        transaction,
        [adminSigner],
        this.getConfirmOptions(),
      );

      return Ok({ signature });
    } catch (error) {
      return Err(this.normalizeError(error));
    }
  }

  async getVaultState(vaultId: VaultId): Promise<Result<VaultState, Error>> {
    if (this.config.mode === 'simulated') {
      const vault = this.simulatedVaults.get(vaultId);
      return vault ? Ok({ ...vault }) : Err(new Error(`Vault not found: ${vaultId}`));
    }

    try {
      const { voltr } = this.loadSdk();
      const vault = new PublicKey(vaultId);
      const client = new voltr.VoltrClient(this.config.connection);
      const [vaultAccount, sharePrice, supplyBreakdown, highWaterMark] = await Promise.all([
        client.getVault(vault),
        client.getCurrentAssetPerLpForVault(vault),
        client.getVaultLpSupplyBreakdown(vault),
        client.getHighWaterMarkForVault(vault),
      ]);

      const adaptorPrograms =
        typeof client.fetchAllAdaptorAddReceiptAccountsOfVault === 'function'
          ? await client.fetchAllAdaptorAddReceiptAccountsOfVault(vault)
          : [];

      return Ok({
        vaultId,
        status: this.inferVaultStatus(vaultAccount),
        config: {
          assetMint: vaultAccount.asset.mint.toBase58(),
          name: vaultAccount.name,
          description: vaultAccount.description,
          maxCap: this.bnToString(vaultAccount.vaultConfiguration.maxCap),
          startAtTs: Number(this.bnToString(vaultAccount.vaultConfiguration.startAtTs)),
          lockedProfitDegradationDurationSeconds: Number(
            this.bnToString(vaultAccount.vaultConfiguration.lockedProfitDegradationDuration),
          ),
          withdrawalWaitingPeriodSeconds: Number(
            this.bnToString(vaultAccount.vaultConfiguration.withdrawalWaitingPeriod),
          ),
          managerPerformanceFeeBps: vaultAccount.feeConfiguration.managerPerformanceFee,
          adminPerformanceFeeBps: vaultAccount.feeConfiguration.adminPerformanceFee,
          managerManagementFeeBps: vaultAccount.feeConfiguration.managerManagementFee,
          adminManagementFeeBps: vaultAccount.feeConfiguration.adminManagementFee,
          redemptionFeeBps: vaultAccount.feeConfiguration.redemptionFee,
          issuanceFeeBps: vaultAccount.feeConfiguration.issuanceFee,
          strategyId: 'ranger-managed-strategy',
        },
        shareTokenMint: client.findVaultLpMint(vault),
        totalShares: new Decimal(this.bnToString(supplyBreakdown.total)),
        totalAum: new Decimal(this.bnToString(vaultAccount.asset.totalValue)),
        sharePrice: new Decimal(sharePrice),
        admin: vaultAccount.admin,
        manager: vaultAccount.manager,
        adaptorPrograms: adaptorPrograms.map((receipt) => receipt.adaptorProgram),
        createdAt: this.parseUnixSeconds(vaultAccount.vaultConfiguration.startAtTs),
        updatedAt: this.parseUnixSeconds(highWaterMark.lastUpdatedTs),
      });
    } catch (error) {
      return Err(this.normalizeError(error));
    }
  }

  async deposit(
    vaultId: VaultId,
    request: DepositRequest,
  ): Promise<Result<DepositReceipt, Error>> {
    if (this.config.mode !== 'simulated') {
      return Err(
        new Error('Vault-level user deposit execution has not been implemented in this step.'),
      );
    }

    return this.simulateDeposit(vaultId, request);
  }

  async getDeposit(depositId: string): Promise<Result<DepositReceipt | null, Error>> {
    return Ok(this.simulatedDeposits.get(depositId) ?? null);
  }

  async requestWithdrawal(
    vaultId: VaultId,
    request: WithdrawalRequest,
  ): Promise<Result<WithdrawalReceipt, Error>> {
    if (this.config.mode !== 'simulated') {
      return Err(
        new Error(
          'Vault-level user withdrawal execution has not been implemented in this step.',
        ),
      );
    }

    return this.simulateWithdrawal(vaultId, request);
  }

  async getWithdrawal(
    withdrawalId: string,
  ): Promise<Result<WithdrawalReceipt | null, Error>> {
    return Ok(this.simulatedWithdrawals.get(withdrawalId) ?? null);
  }

  async calculateNav(
    vaultId: VaultId,
  ): Promise<Result<{ nav: Decimal; sharePrice: Decimal }, Error>> {
    const vaultState = await this.getVaultState(vaultId);
    if (!vaultState.ok) {
      return vaultState;
    }

    return Ok({
      nav: vaultState.value.totalAum,
      sharePrice: vaultState.value.sharePrice,
    });
  }

  private canResolve(moduleName: string): boolean {
    try {
      requireFromHere.resolve(moduleName);
      return true;
    } catch {
      return false;
    }
  }

  private getConfirmOptions(): { commitment: 'processed' | 'confirmed' | 'finalized' } {
    return {
      commitment: this.config.commitment ?? 'confirmed',
    };
  }

  private async resolveVaultAssetMint(vault: PublicKey): Promise<PublicKey> {
    const { voltr } = this.loadSdk();
    const vaultAccount = await new voltr.VoltrClient(this.config.connection).getVault(vault);
    return vaultAccount.asset.mint;
  }

  private toAmountString(amount: Decimal | string | number): string {
    if (amount instanceof Decimal) {
      return amount.toFixed(0);
    }
    return typeof amount === 'number' ? Math.trunc(amount).toString() : amount;
  }

  private loadSdk(): LoadedSdk {
    if (this.sdk) {
      return this.sdk;
    }

    if (!this.canResolve('@voltr/vault-sdk')) {
      throw new Error(
        'Missing dependency: @voltr/vault-sdk. Install it to enable Ranger integration.',
      );
    }
    if (!this.canResolve('@coral-xyz/anchor')) {
      throw new Error(
        'Missing dependency: @coral-xyz/anchor. Install it to enable Ranger integration.',
      );
    }

    const voltr = requireFromHere('@voltr/vault-sdk') as VoltrSdkModule;
    const anchor = requireFromHere('@coral-xyz/anchor') as AnchorModule;
    this.sdk = {
      voltr,
      BN: anchor.BN,
    };
    return this.sdk;
  }

  private toVoltrVaultConfig(
    config: VaultConfig,
    BNImpl: BnConstructor,
  ): VoltrVaultConfig {
    return {
      maxCap: new BNImpl(config.maxCap === '0' ? UNCAPPED_U64_MAX : config.maxCap),
      startAtTs: new BNImpl(config.startAtTs),
      lockedProfitDegradationDuration: new BNImpl(
        config.lockedProfitDegradationDurationSeconds,
      ),
      managerPerformanceFee: config.managerPerformanceFeeBps,
      adminPerformanceFee: config.adminPerformanceFeeBps,
      managerManagementFee: config.managerManagementFeeBps,
      adminManagementFee: config.adminManagementFeeBps,
      redemptionFee: config.redemptionFeeBps,
      issuanceFee: config.issuanceFeeBps,
      withdrawalWaitingPeriod: new BNImpl(config.withdrawalWaitingPeriodSeconds),
    };
  }

  private mapConfigField(
    sdk: VoltrSdkModule,
    field: RangerVaultConfigField,
  ): VoltrVaultConfigField {
    switch (field) {
      case 'maxCap':
        return sdk.VaultConfigField.MaxCap;
      case 'startAtTs':
        return sdk.VaultConfigField.StartAtTs;
      case 'lockedProfitDegradationDuration':
        return sdk.VaultConfigField.LockedProfitDegradationDuration;
      case 'withdrawalWaitingPeriod':
        return sdk.VaultConfigField.WithdrawalWaitingPeriod;
      case 'managerPerformanceFee':
        return sdk.VaultConfigField.ManagerPerformanceFee;
      case 'adminPerformanceFee':
        return sdk.VaultConfigField.AdminPerformanceFee;
      case 'managerManagementFee':
        return sdk.VaultConfigField.ManagerManagementFee;
      case 'adminManagementFee':
        return sdk.VaultConfigField.AdminManagementFee;
      case 'redemptionFee':
        return sdk.VaultConfigField.RedemptionFee;
      case 'issuanceFee':
        return sdk.VaultConfigField.IssuanceFee;
      case 'manager':
        return sdk.VaultConfigField.Manager;
    }
  }

  private serializeConfigUpdateValue(
    BNImpl: BnConstructor,
    field: RangerVaultConfigField,
    value: string | number | PublicKey,
  ): Buffer {
    switch (field) {
      case 'maxCap':
      case 'startAtTs':
      case 'lockedProfitDegradationDuration':
      case 'withdrawalWaitingPeriod': {
        const bnValue = new BNImpl(
          typeof value === 'number' ? value : value.toString(),
        );
        return bnValue.toArrayLike(Buffer, 'le', 8);
      }
      case 'managerPerformanceFee':
      case 'adminPerformanceFee':
      case 'managerManagementFee':
      case 'adminManagementFee':
      case 'redemptionFee':
      case 'issuanceFee': {
        const fee = typeof value === 'number' ? value : Number(value.toString());
        const buffer = Buffer.alloc(2);
        buffer.writeUInt16LE(fee, 0);
        return buffer;
      }
      case 'manager':
        return value instanceof PublicKey
          ? value.toBuffer()
          : new PublicKey(value.toString()).toBuffer();
    }
  }

  private inferVaultStatus(vaultAccount: Awaited<ReturnType<VoltrClientType['getVault']>>): VaultState['status'] {
    const startAtTs = Number(this.bnToString(vaultAccount.vaultConfiguration.startAtTs));
    if (startAtTs > 0 && startAtTs * 1000 > Date.now()) {
      return 'initializing';
    }
    return 'active';
  }

  private bnToString(value: { toString(): string } | number): string {
    return typeof value === 'number' ? value.toString() : value.toString();
  }

  private parseUnixSeconds(value: { toString(): string } | number): Date | null {
    const seconds = Number(this.bnToString(value));
    if (!Number.isFinite(seconds) || seconds <= 0) {
      return null;
    }
    return new Date(seconds * 1000);
  }

  private async simulateCreateVault(
    request: CreateVaultRequest,
  ): Promise<Result<CreateVaultReceipt, Error>> {
    const admin = request.admin ?? this.config.adminSigner?.publicKey ?? Keypair.generate().publicKey;
    const manager =
      request.manager ?? this.config.managerSigner?.publicKey ?? Keypair.generate().publicKey;
    const vaultKeypair = request.vaultKeypair ?? Keypair.generate();
    const shareTokenMint = Keypair.generate().publicKey;
    const now = new Date();

    const vault: VaultState = {
      vaultId: vaultKeypair.publicKey.toBase58(),
      status: request.config.startAtTs > Math.floor(Date.now() / 1000) ? 'initializing' : 'active',
      config: request.config,
      shareTokenMint,
      totalShares: new Decimal(0),
      totalAum: new Decimal(0),
      sharePrice: new Decimal(1),
      admin,
      manager,
      adaptorPrograms: this.config.defaultAdaptorProgramId
        ? [this.config.defaultAdaptorProgramId]
        : [],
      createdAt: now,
      updatedAt: now,
    };

    this.simulatedVaults.set(vault.vaultId, vault);

    return Ok({
      vaultId: vault.vaultId,
      vaultAddress: vaultKeypair.publicKey,
      shareTokenMint,
      signature: `simulated_create_${Date.now()}`,
      admin,
      manager,
    });
  }

  private async simulateConfigUpdate(
    request: VaultConfigUpdateRequest,
  ): Promise<Result<{ signature: string }, Error>> {
    const vault = this.simulatedVaults.get(request.vaultId);
    if (!vault) {
      return Err(new Error(`Vault not found: ${request.vaultId}`));
    }

    switch (request.field) {
      case 'maxCap':
        vault.config.maxCap = request.value.toString();
        break;
      case 'startAtTs':
        vault.config.startAtTs = Number(request.value);
        break;
      case 'lockedProfitDegradationDuration':
        vault.config.lockedProfitDegradationDurationSeconds = Number(request.value);
        break;
      case 'withdrawalWaitingPeriod':
        vault.config.withdrawalWaitingPeriodSeconds = Number(request.value);
        break;
      case 'managerPerformanceFee':
        vault.config.managerPerformanceFeeBps = Number(request.value);
        break;
      case 'adminPerformanceFee':
        vault.config.adminPerformanceFeeBps = Number(request.value);
        break;
      case 'managerManagementFee':
        vault.config.managerManagementFeeBps = Number(request.value);
        break;
      case 'adminManagementFee':
        vault.config.adminManagementFeeBps = Number(request.value);
        break;
      case 'redemptionFee':
        vault.config.redemptionFeeBps = Number(request.value);
        break;
      case 'issuanceFee':
        vault.config.issuanceFeeBps = Number(request.value);
        break;
      case 'manager':
        vault.manager =
          request.value instanceof PublicKey
            ? request.value
            : new PublicKey(request.value.toString());
        break;
    }

    vault.updatedAt = new Date();
    return Ok({ signature: `simulated_update_${Date.now()}` });
  }

  private async simulateDeposit(
    vaultId: VaultId,
    request: DepositRequest,
  ): Promise<Result<DepositReceipt, Error>> {
    const vault = this.simulatedVaults.get(vaultId);
    if (!vault) {
      return Err(new Error(`Vault not found: ${vaultId}`));
    }
    if (vault.status !== 'active') {
      return Err(new Error(`Vault not active: ${vault.status}`));
    }

    const sharesToMint = request.amount.dividedBy(vault.sharePrice);
    vault.totalAum = vault.totalAum.plus(request.amount);
    vault.totalShares = vault.totalShares.plus(sharesToMint);
    vault.updatedAt = new Date();

    const waitingPeriod = vault.config.withdrawalWaitingPeriodSeconds;
    const lockExpiry =
      waitingPeriod > 0 ? new Date(Date.now() + waitingPeriod * 1000) : null;

    const receipt: DepositReceipt = {
      depositId: request.depositId,
      signature: `simulated_deposit_${Date.now()}`,
      sharesMinted: sharesToMint,
      sharePrice: vault.sharePrice,
      lockExpiry,
      status: 'confirmed',
      blockTime: new Date(),
    };

    this.simulatedDeposits.set(request.depositId, receipt);
    return Ok(receipt);
  }

  private async simulateWithdrawal(
    vaultId: VaultId,
    request: WithdrawalRequest,
  ): Promise<Result<WithdrawalReceipt, Error>> {
    const vault = this.simulatedVaults.get(vaultId);
    if (!vault) {
      return Err(new Error(`Vault not found: ${vaultId}`));
    }

    const amountReturned = request.sharesToBurn.times(vault.sharePrice);
    vault.totalAum = vault.totalAum.minus(amountReturned);
    vault.totalShares = vault.totalShares.minus(request.sharesToBurn);
    vault.updatedAt = new Date();

    const receipt: WithdrawalReceipt = {
      withdrawalId: request.withdrawalId,
      signature: `simulated_withdrawal_${Date.now()}`,
      amountReturned,
      sharesBurned: request.sharesToBurn,
      sharePrice: vault.sharePrice,
      status: 'completed',
      blockTime: new Date(),
    };

    this.simulatedWithdrawals.set(request.withdrawalId, receipt);
    return Ok(receipt);
  }

  private normalizeError(error: unknown): Error {
    return error instanceof Error ? error : new Error(String(error));
  }
}
