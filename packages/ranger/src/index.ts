/**
 * @sentinel-apex/ranger — Ranger Earn Integration
 * 
 * This package provides integration with Ranger Earn vault infrastructure.
 * 
 * IMPORTANT: This is an integration boundary. The actual Ranger SDK may not be
 * publicly available. This package provides:
 * 
 * 1. Strong interfaces for Ranger-compatible operations
 * 2. Working simulated mode for development/testing
 * 3. Clear documentation of external blockers
 * 
 * EXTERNAL BLOCKER: Ranger SDK/program IDs not publicly documented.
 * The implementation provides the strongest truthful integration boundary possible.
 */

// =============================================================================
// Types
// =============================================================================

export type {
  VaultId,
  StrategyId,
  ShareTokenMint,
  VaultStatus,
  DepositStatus,
  WithdrawalStatus,
  VaultConfig,
  VaultState,
  DepositRequest,
  DepositReceipt,
  WithdrawalRequest,
  WithdrawalReceipt,
  StrategyExecutionContext,
  StrategyInstruction,
  StrategyAdapter,
  RangerIntegrationStatus,
  VaultSubmissionEvidence,
} from './types.js';

export {
  VaultStatusSchema,
  DepositStatusSchema,
  WithdrawalStatusSchema,
  VaultConfigSchema,
} from './types.js';

// =============================================================================
// Vault Client
// =============================================================================

export {
  RangerVaultClient,
  type VaultClientConfig,
} from './vault-client.js';

// =============================================================================
// Factory Client
// =============================================================================

export {
  RangerVaultFactoryClient,
  initializeFactoryClient,
  getFactoryClient,
  type FactoryClientConfig,
} from './factory-client.js';

// =============================================================================
// Strategy Adapter
// =============================================================================

export {
  RangerCarryStrategyAdapter,
  RangerStrategyAdapterFactory,
  type StrategyAdapterConfig,
  type StrategyAdapterFactory,
  type CarryLegAllocation,
  type CarryStrategyConfig,
} from './strategy-adapter.js';

// =============================================================================
// Version
// =============================================================================

export const RANGER_INTEGRATION_VERSION = '0.1.0';
export const RANGER_INTEGRATION_STATUS = 'integration-boundary';
