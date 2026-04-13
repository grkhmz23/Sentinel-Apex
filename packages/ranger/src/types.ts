import type { Keypair, PublicKey } from '@solana/web3.js';
import { Decimal } from 'decimal.js';
import { z } from 'zod';

export type VaultId = string;
export type StrategyId = string;
export type ShareTokenMint = PublicKey;

export const VaultStatusSchema = z.enum([
  'initializing',
  'active',
  'paused',
  'wind_down',
  'closed',
]);

export type VaultStatus = z.infer<typeof VaultStatusSchema>;

export const DepositStatusSchema = z.enum([
  'pending',
  'confirmed',
  'failed',
  'cancelled',
]);

export type DepositStatus = z.infer<typeof DepositStatusSchema>;

export const WithdrawalStatusSchema = z.enum([
  'pending',
  'requested',
  'processing',
  'completed',
  'failed',
  'cancelled',
]);

export type WithdrawalStatus = z.infer<typeof WithdrawalStatusSchema>;

export const VaultConfigSchema = z.object({
  assetMint: z.string().min(32).max(64),
  name: z.string().min(1).max(32),
  description: z.string().min(1).max(64),
  maxCap: z.string(),
  startAtTs: z.number().int().nonnegative(),
  lockedProfitDegradationDurationSeconds: z.number().int().nonnegative(),
  withdrawalWaitingPeriodSeconds: z.number().int().nonnegative(),
  managerPerformanceFeeBps: z.number().int().min(0).max(10000),
  adminPerformanceFeeBps: z.number().int().min(0).max(10000),
  managerManagementFeeBps: z.number().int().min(0).max(10000),
  adminManagementFeeBps: z.number().int().min(0).max(10000),
  redemptionFeeBps: z.number().int().min(0).max(10000),
  issuanceFeeBps: z.number().int().min(0).max(10000),
  strategyId: z.string(),
  strategyMetadataUri: z.string().optional(),
  lpTokenName: z.string().max(32).optional(),
  lpTokenSymbol: z.string().max(10).optional(),
});

export type VaultConfig = z.infer<typeof VaultConfigSchema>;

export interface VaultState {
  vaultId: VaultId;
  status: VaultStatus;
  config: VaultConfig;
  shareTokenMint: ShareTokenMint | null;
  totalShares: Decimal;
  totalAum: Decimal;
  sharePrice: Decimal;
  admin: PublicKey;
  manager: PublicKey;
  adaptorPrograms: PublicKey[];
  createdAt: Date | null;
  updatedAt: Date | null;
}

export interface CreateVaultRequest {
  config: VaultConfig;
  admin?: PublicKey;
  manager?: PublicKey;
  payer?: PublicKey;
  vaultKeypair?: Keypair;
}

export interface CreateVaultReceipt {
  vaultId: VaultId;
  vaultAddress: PublicKey;
  shareTokenMint: PublicKey | null;
  signature: string;
  admin: PublicKey;
  manager: PublicKey;
}

export interface LpMetadataRequest {
  vaultId: VaultId;
  name: string;
  symbol: string;
  uri: string;
  payer?: PublicKey;
}

export interface AccountMetaInput {
  pubkey: PublicKey;
  isSigner: boolean;
  isWritable: boolean;
}

export type RangerVaultConfigField =
  | 'maxCap'
  | 'startAtTs'
  | 'lockedProfitDegradationDuration'
  | 'withdrawalWaitingPeriod'
  | 'managerPerformanceFee'
  | 'adminPerformanceFee'
  | 'managerManagementFee'
  | 'adminManagementFee'
  | 'redemptionFee'
  | 'issuanceFee'
  | 'manager';

export interface VaultConfigUpdateRequest {
  vaultId: VaultId;
  field: RangerVaultConfigField;
  value: string | number | PublicKey;
}

export interface AddAdaptorRequest {
  vaultId: VaultId;
  adaptorProgramId: PublicKey;
  payer?: PublicKey;
}

export interface InitializeStrategyRequest {
  vaultId: VaultId;
  strategy: PublicKey;
  adaptorProgramId?: PublicKey;
  payer?: PublicKey;
  manager?: PublicKey;
  instructionDiscriminator?: Buffer | null;
  additionalArgs?: Buffer | null;
  remainingAccounts: AccountMetaInput[];
}

export interface AllocateStrategyRequest {
  vaultId: VaultId;
  strategy: PublicKey;
  amount: Decimal | string | number;
  vaultAssetMint?: PublicKey;
  adaptorProgramId?: PublicKey;
  instructionDiscriminator?: Buffer | null;
  additionalArgs?: Buffer | null;
  remainingAccounts: AccountMetaInput[];
}

export interface HarvestFeesRequest {
  vaultId: VaultId;
  harvester?: PublicKey;
  vaultManager?: PublicKey;
  vaultAdmin?: PublicKey;
  protocolAdmin: PublicKey;
}

export interface CalibrateHighWaterMarkRequest {
  vaultId: VaultId;
}

export interface DepositRequest {
  depositId: string;
  depositor: PublicKey;
  amount: Decimal;
  minSharesOut: Decimal;
  requestedAt: Date;
}

export interface DepositReceipt {
  depositId: string;
  signature: string;
  sharesMinted: Decimal;
  sharePrice: Decimal;
  lockExpiry: Date | null;
  status: DepositStatus;
  blockTime: Date;
}

export interface WithdrawalRequest {
  withdrawalId: string;
  shareholder: PublicKey;
  sharesToBurn: Decimal;
  minAmountOut: Decimal;
  requestedAt: Date;
}

export interface WithdrawalReceipt {
  withdrawalId: string;
  signature: string;
  amountReturned: Decimal;
  sharesBurned: Decimal;
  sharePrice: Decimal;
  status: WithdrawalStatus;
  blockTime: Date;
}

export interface StrategyExecutionContext {
  vaultId: VaultId;
  strategyProgram: PublicKey;
  authority: PublicKey;
  currentAum: Decimal;
  targetAllocations: Map<string, Decimal>;
}

export interface StrategyInstruction {
  instructionId: string;
  data: Buffer;
  accounts: AccountMetaInput[];
  description: string;
}

export interface StrategyAdapter {
  readonly strategyId: StrategyId;
  generateRebalanceInstructions(
    context: StrategyExecutionContext
  ): Promise<StrategyInstruction[]>;
  calculateNav(
    context: StrategyExecutionContext
  ): Promise<Decimal>;
  checkCompliance(
    context: StrategyExecutionContext
  ): Promise<{ compliant: boolean; violations: string[] }>;
}

export interface RangerIntegrationStatus {
  sdkAvailable: boolean;
  vaultProgramConfigured: boolean;
  defaultAdaptorConfigured: boolean;
  vaultProgramId: PublicKey | null;
  defaultAdaptorProgramId: PublicKey | null;
  hasAdminSigner: boolean;
  hasManagerSigner: boolean;
  mode: 'full' | 'simulated' | 'readonly' | 'unavailable';
  blockerDescription: string | null;
}

export interface VaultSubmissionEvidence {
  vaultId: VaultId;
  vaultAddress: PublicKey;
  shareTokenMint: ShareTokenMint;
  adaptorPrograms: PublicKey[];
  admin: PublicKey;
  manager: PublicKey;
  creationSignature: string;
  state: VaultState;
  depositSummary: {
    count: number;
    totalAmount: Decimal;
    lastDepositAt: Date | null;
  };
  withdrawalSummary: {
    count: number;
    totalAmount: Decimal;
    lastWithdrawalAt: Date | null;
  };
}
