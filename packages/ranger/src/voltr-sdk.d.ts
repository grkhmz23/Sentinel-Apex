declare module '@coral-xyz/anchor' {
  export class BN {
    constructor(value: string | number | bigint);
    toArrayLike(
      type: typeof Buffer,
      endian: 'le' | 'be',
      length: number,
    ): Buffer;
  }
}

declare module '@voltr/vault-sdk' {
  import type { PublicKey, Connection, Signer, TransactionInstruction } from '@solana/web3.js';
  import type { BN } from '@coral-xyz/anchor';

  export const VAULT_PROGRAM_ID: PublicKey;
  export const LENDING_ADAPTOR_PROGRAM_ID: PublicKey;
  export const DRIFT_ADAPTOR_PROGRAM_ID: PublicKey;
  export const METADATA_PROGRAM_ID: PublicKey;
  export const SEEDS: Record<string, Buffer>;

  export enum VaultConfigField {
    MaxCap = 'maxCap',
    StartAtTs = 'startAtTs',
    LockedProfitDegradationDuration = 'lockedProfitDegradationDuration',
    WithdrawalWaitingPeriod = 'withdrawalWaitingPeriod',
    ManagerPerformanceFee = 'managerPerformanceFee',
    AdminPerformanceFee = 'adminPerformanceFee',
    ManagerManagementFee = 'managerManagementFee',
    AdminManagementFee = 'adminManagementFee',
    RedemptionFee = 'redemptionFee',
    IssuanceFee = 'issuanceFee',
    Manager = 'manager',
  }

  export interface VaultConfig {
    maxCap: BN;
    startAtTs: BN;
    lockedProfitDegradationDuration: BN;
    managerPerformanceFee: number;
    adminPerformanceFee: number;
    managerManagementFee: number;
    adminManagementFee: number;
    redemptionFee: number;
    issuanceFee: number;
    withdrawalWaitingPeriod: BN;
  }

  export interface VaultParams {
    config: VaultConfig;
    name: string;
    description: string;
  }

  export interface VaultAccount {
    name: string;
    description: string;
    asset: {
      mint: PublicKey;
      totalValue: BN | { toString(): string };
    };
    vaultConfiguration: {
      maxCap: BN | { toString(): string };
      startAtTs: BN | { toString(): string };
      lockedProfitDegradationDuration: BN | { toString(): string };
      withdrawalWaitingPeriod: BN | { toString(): string };
    };
    feeConfiguration: {
      managerPerformanceFee: number;
      adminPerformanceFee: number;
      managerManagementFee: number;
      adminManagementFee: number;
      redemptionFee: number;
      issuanceFee: number;
    };
    admin: PublicKey;
    manager: PublicKey;
  }

  export interface HighWaterMarkAccount {
    highestAssetPerLp: number;
    lastUpdatedTs: number;
  }

  export interface VaultLpSupplyBreakdown {
    circulating: BN | { toString(): string };
    unharvestedFees: BN | { toString(): string };
    unrealisedFees: BN | { toString(): string };
    total: BN | { toString(): string };
  }

  export interface AdaptorAddReceiptAccount {
    adaptorProgram: PublicKey;
  }

  export class VoltrClient {
    constructor(connection: Connection, wallet?: Signer);
    createInitializeVaultIx(
      vaultParams: VaultParams,
      accounts: {
        vault: Signer;
        vaultAssetMint: PublicKey;
        admin: PublicKey;
        manager: PublicKey;
        payer: PublicKey;
      },
    ): Promise<TransactionInstruction>;
    createCreateLpMetadataIx(
      args: { name: string; symbol: string; uri: string },
      accounts: { vault: PublicKey; admin: PublicKey; payer: PublicKey },
    ): Promise<TransactionInstruction>;
    createUpdateVaultConfigIx(
      field: VaultConfigField,
      data: Buffer,
      accounts: { vault: PublicKey; admin: PublicKey; vaultLpMint?: PublicKey },
    ): Promise<TransactionInstruction>;
    createAddAdaptorIx(accounts: {
      vault: PublicKey;
      admin: PublicKey;
      payer: PublicKey;
      adaptorProgram: PublicKey;
    }): Promise<TransactionInstruction>;
    createInitializeStrategyIx(
      args: {
        instructionDiscriminator?: Buffer | null;
        additionalArgs?: Buffer | null;
      },
      accounts: {
        payer: PublicKey;
        manager: PublicKey;
        vault: PublicKey;
        strategy: PublicKey;
        adaptorProgram: PublicKey;
        remainingAccounts: Array<{
          pubkey: PublicKey;
          isSigner: boolean;
          isWritable: boolean;
        }>;
      },
    ): Promise<TransactionInstruction>;
    createDepositStrategyIx(
      args: {
        depositAmount: BN;
        instructionDiscriminator?: Buffer | null;
        additionalArgs?: Buffer | null;
      },
      accounts: {
        manager: PublicKey;
        vault: PublicKey;
        vaultAssetMint: PublicKey;
        strategy: PublicKey;
        assetTokenProgram: PublicKey;
        adaptorProgram: PublicKey;
        remainingAccounts: Array<{
          pubkey: PublicKey;
          isSigner: boolean;
          isWritable: boolean;
        }>;
      },
    ): Promise<TransactionInstruction>;
    createWithdrawStrategyIx(
      args: {
        withdrawAmount: BN;
        instructionDiscriminator?: Buffer | null;
        additionalArgs?: Buffer | null;
      },
      accounts: {
        manager: PublicKey;
        vault: PublicKey;
        vaultAssetMint: PublicKey;
        strategy: PublicKey;
        assetTokenProgram: PublicKey;
        adaptorProgram: PublicKey;
        remainingAccounts: Array<{
          pubkey: PublicKey;
          isSigner: boolean;
          isWritable: boolean;
        }>;
      },
    ): Promise<TransactionInstruction>;
    createHarvestFeeIx(accounts: {
      harvester: PublicKey;
      vaultManager: PublicKey;
      vaultAdmin: PublicKey;
      protocolAdmin: PublicKey;
      vault: PublicKey;
    }): Promise<TransactionInstruction>;
    createCalibrateHighWaterMarkIx(accounts: {
      vault: PublicKey;
      admin: PublicKey;
    }): Promise<TransactionInstruction>;
    getVault(vault: PublicKey): Promise<VaultAccount>;
    findVaultLpMint(vault: PublicKey): PublicKey;
    getCurrentAssetPerLpForVault(vault: PublicKey): Promise<number>;
    getVaultLpSupplyBreakdown(vault: PublicKey): Promise<VaultLpSupplyBreakdown>;
    getHighWaterMarkForVault(vault: PublicKey): Promise<HighWaterMarkAccount>;
    fetchAllAdaptorAddReceiptAccountsOfVault?(
      vault: PublicKey,
    ): Promise<AdaptorAddReceiptAccount[]>;
  }
}
