/**
 * Ranger Earn Integration Types
 * 
 * This module defines the types and interfaces for integrating with Ranger Earn.
 * 
 * IMPORTANT: This is an integration boundary. The actual Ranger SDK or program
 * IDs may not be publicly available. This module provides:
 * 1. Strong typing for Ranger-compatible operations
 * 2. Interface contracts that can work with Ranger OR internal vault implementations
 * 3. Clear documentation of external dependencies
 * 
 * EXTERNAL BLOCKER: Ranger SDK/program IDs not publicly documented.
 * This implementation provides the strongest truthful integration boundary possible.
 */

import { PublicKey } from '@solana/web3.js';
import { Decimal } from 'decimal.js';
import { z } from 'zod';

// =============================================================================
// Domain Primitives
// =============================================================================

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

// =============================================================================
// Vault Configuration
// =============================================================================

export const VaultConfigSchema = z.object({
  /** Base asset for the vault (e.g., USDC) */
  baseAsset: z.string(),
  
  /** Minimum deposit amount */
  minDeposit: z.string(),
  
  /** Maximum vault capacity */
  maxCapacity: z.string(),
  
  /** Lock period in seconds (3 months = ~7.9M seconds) */
  lockPeriodSeconds: z.number().int().positive(),
  
  /** Performance fee in basis points (e.g., 1000 = 10%) */
  performanceFeeBps: z.number().int().min(0).max(10000),
  
  /** Management fee in basis points (e.g., 100 = 1%) */
  managementFeeBps: z.number().int().min(0).max(10000),
  
  /** Strategy identifier */
  strategyId: z.string(),
  
  /** Strategy metadata URI (IPFS or similar) */
  strategyMetadataUri: z.string().optional(),
  
  /** Emergency admin public key */
  emergencyAdmin: z.string().optional(),
});

export type VaultConfig = z.infer<typeof VaultConfigSchema>;

// =============================================================================
// Vault State
// =============================================================================

export interface VaultState {
  /** Unique vault identifier */
  vaultId: VaultId;
  
  /** Vault status */
  status: VaultStatus;
  
  /** Vault configuration */
  config: VaultConfig;
  
  /** Share token mint address */
  shareTokenMint: ShareTokenMint | null;
  
  /** Total shares outstanding */
  totalShares: Decimal;
  
  /** Total base asset under management */
  totalAum: Decimal;
  
  /** Current share price (NAV) */
  sharePrice: Decimal;
  
  /** Vault authority/owner */
  authority: PublicKey;
  
  /** Strategy program address */
  strategyProgram: PublicKey | null;
  
  /** Creation timestamp */
  createdAt: Date;
  
  /** Last update timestamp */
  updatedAt: Date;
}

// =============================================================================
// Deposit Flow
// =============================================================================

export interface DepositRequest {
  /** Deposit identifier (generated locally) */
  depositId: string;
  
  /** Depositor wallet address */
  depositor: PublicKey;
  
  /** Amount in base asset units */
  amount: Decimal;
  
  /** Minimum shares to receive (slippage protection) */
  minSharesOut: Decimal;
  
  /** Request timestamp */
  requestedAt: Date;
}

export interface DepositReceipt {
  /** Deposit identifier */
  depositId: string;
  
  /** Transaction signature */
  signature: string;
  
  /** Shares minted */
  sharesMinted: Decimal;
  
  /** Share price at deposit */
  sharePrice: Decimal;
  
  /** Lock expiry timestamp */
  lockExpiry: Date;
  
  /** Deposit status */
  status: DepositStatus;
  
  /** Block timestamp */
  blockTime: Date;
}

// =============================================================================
// Withdrawal Flow
// =============================================================================

export interface WithdrawalRequest {
  /** Withdrawal identifier */
  withdrawalId: string;
  
  /** Shareholder wallet address */
  shareholder: PublicKey;
  
  /** Shares to burn */
  sharesToBurn: Decimal;
  
  /** Minimum base asset to receive (slippage protection) */
  minAmountOut: Decimal;
  
  /** Request timestamp */
  requestedAt: Date;
}

export interface WithdrawalReceipt {
  /** Withdrawal identifier */
  withdrawalId: string;
  
  /** Transaction signature */
  signature: string;
  
  /** Base asset amount returned */
  amountReturned: Decimal;
  
  /** Shares burned */
  sharesBurned: Decimal;
  
  /** Share price at withdrawal */
  sharePrice: Decimal;
  
  /** Withdrawal status */
  status: WithdrawalStatus;
  
  /** Block timestamp */
  blockTime: Date;
}

// =============================================================================
// Strategy Adapter Interface
// =============================================================================

export interface StrategyExecutionContext {
  /** Vault identifier */
  vaultId: VaultId;
  
  /** Strategy program address */
  strategyProgram: PublicKey;
  
  /** Vault authority (signer) */
  authority: PublicKey;
  
  /** Current AUM */
  currentAum: Decimal;
  
  /** Target allocation by venue/leg */
  targetAllocations: Map<string, Decimal>;
}

export interface StrategyInstruction {
  /** Instruction identifier */
  instructionId: string;
  
  /** Instruction data (serialized) */
  data: Buffer;
  
  /** Required accounts */
  accounts: Array<{
    pubkey: PublicKey;
    isSigner: boolean;
    isWritable: boolean;
  }>;
  
  /** Human-readable description */
  description: string;
}

export interface StrategyAdapter {
  /** Strategy identifier */
  readonly strategyId: StrategyId;
  
  /** Generate rebalance instructions based on target allocations */
  generateRebalanceInstructions(
    context: StrategyExecutionContext
  ): Promise<StrategyInstruction[]>;
  
  /** Calculate current strategy NAV */
  calculateNav(
    context: StrategyExecutionContext
  ): Promise<Decimal>;
  
  /** Check if strategy is in compliance with policy */
  checkCompliance(
    context: StrategyExecutionContext
  ): Promise<{ compliant: boolean; violations: string[] }>;
}

// =============================================================================
// Ranger Integration Status
// =============================================================================

export interface RangerIntegrationStatus {
  /** Whether Ranger SDK is available */
  sdkAvailable: boolean;
  
  /** Whether vault factory program is configured */
  factoryConfigured: boolean;
  
  /** Whether strategy adapter program is configured */
  strategyAdapterConfigured: boolean;
  
  /** Configured vault factory program ID (if any) */
  vaultFactoryProgramId: PublicKey | null;
  
  /** Configured strategy adapter program ID (if any) */
  strategyAdapterProgramId: PublicKey | null;
  
  /** Integration mode */
  mode: 'full' | 'simulated' | 'readonly' | 'unavailable';
  
  /** Blocker description if not fully available */
  blockerDescription: string | null;
}

// =============================================================================
// Submission Evidence
// =============================================================================

export interface VaultSubmissionEvidence {
  /** Vault identifier */
  vaultId: VaultId;
  
  /** Vault address on-chain */
  vaultAddress: PublicKey;
  
  /** Share token mint */
  shareTokenMint: ShareTokenMint;
  
  /** Strategy program address */
  strategyProgram: PublicKey;
  
  /** Authority address */
  authority: PublicKey;
  
  /** Creation transaction signature */
  creationSignature: string;
  
  /** Current vault state summary */
  state: VaultState;
  
  /** Historical deposits (summary) */
  depositSummary: {
    count: number;
    totalAmount: Decimal;
    lastDepositAt: Date | null;
  };
  
  /** Historical withdrawals (summary) */
  withdrawalSummary: {
    count: number;
    totalAmount: Decimal;
    lastWithdrawalAt: Date | null;
  };
}
