/**
 * @sentinel-apex/ranger — Ranger Earn integration
 *
 * This package now targets the public Voltr/Ranger SDK surface documented by
 * Ranger. It keeps a simulated mode for local tests and can degrade gracefully
 * when optional SDK dependencies are not installed yet.
 */

// =============================================================================
// Types
// =============================================================================

export type {
  CreateVaultReceipt,
  CreateVaultRequest,
  LpMetadataRequest,
  AddAdaptorRequest,
  InitializeStrategyRequest,
  AllocateStrategyRequest,
  HarvestFeesRequest,
  CalibrateHighWaterMarkRequest,
  AccountMetaInput,
  RangerVaultConfigField,
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
  VaultConfigUpdateRequest,
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
export const RANGER_INTEGRATION_STATUS = 'sdk-backed';
