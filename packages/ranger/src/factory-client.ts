/**
 * Ranger Vault Factory Client
 *
 * Compatibility wrapper around vault creation and submission-evidence helpers.
 * Ranger now documents direct vault initialization through the SDK; this class
 * remains as a light helper for older call sites.
 */

import { Connection, PublicKey, Keypair } from '@solana/web3.js';
import { Decimal } from 'decimal.js';

import { createLogger } from '@sentinel-apex/observability';
import { Result, Ok, Err } from '@sentinel-apex/shared';

import type {
  VaultId,
  VaultConfig,
  VaultState,
  VaultSubmissionEvidence,
} from './types.js';

const logger = createLogger('ranger-factory-client');

// =============================================================================
// Configuration
// =============================================================================

export interface FactoryClientConfig {
  /** Solana connection */
  connection: Connection;
  
  /** Optional legacy program ID hint retained for compatibility */
  factoryProgramId?: PublicKey;
  
  /** Signer keypair */
  signer?: Keypair;
  
  /** Execution mode */
  mode: 'full' | 'simulated' | 'readonly';
}

// =============================================================================
// Factory Client
// =============================================================================

export class RangerVaultFactoryClient {
  private config: FactoryClientConfig;
  private vaultCounter = 0;
  
  constructor(config: FactoryClientConfig) {
    this.config = config;
    
    logger.info('RangerVaultFactoryClient initialized', {
      mode: config.mode,
      hasProgramId: !!config.factoryProgramId,
    });
  }
  
  /**
   * Check if vault creation helpers are available
   */
  isAvailable(): boolean {
    return this.config.mode === 'simulated' || this.config.mode === 'full';
  }
  
  /**
   * Create a new vault through the compatibility wrapper.
   *
   * Returns the vault ID and on-chain address
   */
  async createVault(
    config: VaultConfig,
    creator: PublicKey
  ): Promise<Result<{
    vaultId: VaultId;
    vaultAddress: PublicKey;
    shareTokenMint: PublicKey;
    signature: string;
  }, Error>> {
    if (!this.isAvailable()) {
      return Err(new Error('Ranger vault creation helper not available.'));
    }
    
    if (this.config.mode === 'simulated') {
      const result = await this.simulateCreateVault(config, creator);
      if (!result.ok) return result;
      return Ok(result.value);
    }
    
    // Full mode is handled by RangerVaultClient now.
    logger.error('Real vault factory creation not implemented', {
      reason: 'Use RangerVaultClient.createVault for full SDK-backed creation',
    });
    
    return Err(
      new Error('Use RangerVaultClient.createVault for real Ranger vault creation.'),
    );
  }
  
  /**
   * Get list of vaults created by a specific authority
   */
  async getVaultsByAuthority(_authority: PublicKey): Promise<Result<VaultId[], Error>> {
    if (this.config.mode === 'simulated') {
      // Return simulated vaults
      return Ok([]);
    }
    
    // Would query on-chain accounts
    return Ok([]);
  }
  
  /**
   * Get vault address in simulated mode.
   */
  async getVaultAddress(vaultId: VaultId): Promise<Result<PublicKey, Error>> {
    // For simulated mode, generate deterministic key
    if (this.config.mode === 'simulated') {
      // Use vaultId to generate deterministic address
      const seed = Buffer.from(vaultId);
      const keypair = Keypair.fromSeed(seed.slice(0, 32));
      return Ok(keypair.publicKey);
    }
    
    // Would derive PDA from program seeds
    return Err(new Error('PDA derivation not implemented'));
  }
  
  /**
   * Generate submission evidence for a vault
   * 
   * This creates the evidence package needed for hackathon submission
   */
  async generateSubmissionEvidence(
    vaultId: VaultId,
    vaultState: VaultState
  ): Promise<Result<VaultSubmissionEvidence, Error>> {
    if (!vaultState.shareTokenMint) {
      return Err(new Error('Vault does not have a share token mint'));
    }
    
    if (vaultState.adaptorPrograms.length === 0) {
      return Err(new Error('Vault does not have any adaptor programs attached'));
    }

    const evidence: VaultSubmissionEvidence = {
      vaultId,
      vaultAddress: vaultState.admin,
      shareTokenMint: vaultState.shareTokenMint,
      adaptorPrograms: vaultState.adaptorPrograms,
      admin: vaultState.admin,
      manager: vaultState.manager,
      creationSignature: 'pending', // Would fetch from creation tx
      state: vaultState,
      depositSummary: {
        count: 0,
        totalAmount: new Decimal(0),
        lastDepositAt: null,
      },
      withdrawalSummary: {
        count: 0,
        totalAmount: new Decimal(0),
        lastWithdrawalAt: null,
      },
    };
    
    return Ok(evidence);
  }
  
  // ===========================================================================
  // Simulation Helpers
  // ===========================================================================
  
  private async simulateCreateVault(
    config: VaultConfig,
    creator: PublicKey
  ): Promise<Result<{
    vaultId: VaultId;
    vaultAddress: PublicKey;
    shareTokenMint: PublicKey;
    signature: string;
  }, Error>> {
    this.vaultCounter++;
    const vaultId = `ranger_sim_${Date.now()}_${this.vaultCounter}`;
    
    // Generate deterministic addresses
    const vaultSeed = Buffer.from(`vault:${vaultId}`);
    const vaultKeypair = Keypair.fromSeed(vaultSeed.slice(0, 32));
    
    const mintSeed = Buffer.from(`mint:${vaultId}`);
    const mintKeypair = Keypair.fromSeed(mintSeed.slice(0, 32));
    
    logger.info('Simulated vault factory creation', {
      vaultId,
      vaultAddress: vaultKeypair.publicKey.toBase58(),
      shareTokenMint: mintKeypair.publicKey.toBase58(),
      creator: creator.toBase58(),
      assetMint: config.assetMint,
      maxCap: config.maxCap,
    });
    
    return Ok({
      vaultId,
      vaultAddress: vaultKeypair.publicKey,
      shareTokenMint: mintKeypair.publicKey,
      signature: `simulated_factory_${Date.now()}`,
    });
  }
}

// =============================================================================
// Factory Client Singleton
// =============================================================================

let globalFactoryClient: RangerVaultFactoryClient | null = null;

export function initializeFactoryClient(
  config: FactoryClientConfig
): RangerVaultFactoryClient {
  globalFactoryClient = new RangerVaultFactoryClient(config);
  return globalFactoryClient;
}

export function getFactoryClient(): RangerVaultFactoryClient | null {
  return globalFactoryClient;
}
