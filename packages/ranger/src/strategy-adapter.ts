/**
 * Ranger Strategy Adapter
 * 
 * Adapter for connecting Sentinel Apex strategy execution to Ranger Earn vaults.
 * 
 * This provides the bridge between:
 * - Sentinel's carry/treasury/allocator logic
 * - Ranger's strategy execution model
 * 
 * EXTERNAL BLOCKER: Without Ranger SDK, this implements the interface boundary
 * that would plug into Ranger's strategy adapter program.
 */

import { Connection, PublicKey } from '@solana/web3.js';
import { Decimal } from 'decimal.js';

import { createLogger } from '@sentinel-apex/observability';
import { Result, Ok, Err } from '@sentinel-apex/shared';

import type {
  StrategyId,
  StrategyExecutionContext,
  StrategyInstruction,
  StrategyAdapter,
} from './types.js';

const logger = createLogger('ranger-strategy-adapter');

// =============================================================================
// Configuration
// =============================================================================

export interface StrategyAdapterConfig {
  /** Solana connection */
  connection: Connection;
  
  /** Strategy adapter program ID */
  strategyProgramId: PublicKey;
  
  /** Optional perp venue program ID for live strategy integration */
  perpVenueProgramId?: PublicKey;
  
  /** Execution mode */
  mode: 'full' | 'simulated' | 'readonly';
}

// =============================================================================
// Carry Strategy Adapter
// 
// Implements delta-neutral carry strategy for Ranger vaults
// =============================================================================

export interface CarryLegAllocation {
  /** Market identifier (e.g., "BTC-PERP") */
  market: string;
  
  /** Leg type */
  side: 'long' | 'short';
  
  /** Target notional */
  targetNotional: Decimal;
  
  /** Venue identifier */
  venue: string;
}

export interface CarryStrategyConfig {
  /** Base asset */
  baseAsset: string;
  
  /** Maximum gross exposure */
  maxGrossExposure: Decimal;
  
  /** Target funding rate threshold */
  minFundingRateThreshold: Decimal;
  
  /** Rebalance threshold (deviation triggers rebalance) */
  rebalanceThresholdPct: number;
  
  /** Approved venues */
  approvedVenues: string[];
  
  /** Approved markets */
  approvedMarkets: string[];
}

export class RangerCarryStrategyAdapter implements StrategyAdapter {
  readonly strategyId = 'sentinel-apex-delta-neutral-carry-v1';
  
  private config: StrategyAdapterConfig;
  private carryConfig: CarryStrategyConfig;
  
  constructor(
    config: StrategyAdapterConfig,
    carryConfig: CarryStrategyConfig
  ) {
    this.config = config;
    this.carryConfig = carryConfig;
    
    logger.info('RangerCarryStrategyAdapter initialized', {
      strategyId: this.strategyId,
      mode: config.mode,
      baseAsset: carryConfig.baseAsset,
      approvedVenues: carryConfig.approvedVenues,
    });
  }
  
  /**
   * Generate rebalance instructions for carry strategy
   * 
   * This would create instructions to:
   * 1. Adjust the perp leg on the configured venue
   * 2. Adjust spot leg (if applicable)
   * 3. Rebalance hedge ratio
   */
  async generateRebalanceInstructions(
    context: StrategyExecutionContext
  ): Promise<StrategyInstruction[]> {
    const instructions: StrategyInstruction[] = [];
    
    // Calculate target allocations
    const allocations = this.calculateTargetAllocations(context);
    
    // Generate instructions for each leg
    for (const allocation of allocations) {
      const instruction = await this.createLegInstruction(
        context,
        allocation
      );
      
      if (instruction) {
        instructions.push(instruction);
      }
    }
    
    logger.info('Generated rebalance instructions', {
      vaultId: context.vaultId,
      instructionCount: instructions.length,
      totalAllocations: allocations.length,
    });
    
    return instructions;
  }
  
  /**
   * Calculate current NAV
   * 
   * For carry strategy:
   * NAV = spot_position_value + perp_position_pnl + funding_received
   */
  async calculateNav(context: StrategyExecutionContext): Promise<Decimal> {
    // In simulated mode, return current AUM
    if (this.config.mode === 'simulated') {
      return context.currentAum;
    }
    
    // Full mode: Would fetch from the configured perp venue and spot venues
    // EXTERNAL BLOCKER: Requires venue-specific position decoding
    logger.warn('Real NAV calculation not implemented', {
      vaultId: context.vaultId,
      reason: 'Venue position fetch not implemented',
    });
    
    return context.currentAum;
  }
  
  /**
   * Check strategy compliance
   */
  async checkCompliance(
    context: StrategyExecutionContext
  ): Promise<{ compliant: boolean; violations: string[] }> {
    const violations: string[] = [];
    
    // Check max exposure
    const totalExposure = Array.from(context.targetAllocations.values())
      .reduce((sum, val) => sum.plus(val.abs()), new Decimal(0));
    
    if (totalExposure.greaterThan(this.carryConfig.maxGrossExposure)) {
      violations.push(
        `Gross exposure ${totalExposure.toString()} exceeds maximum ${this.carryConfig.maxGrossExposure.toString()}`
      );
    }
    
    // Check venue approvals
    for (const key of context.targetAllocations.keys()) {
      const parts = key.split(':');
      const venue = parts[0];
      if (!venue || !this.carryConfig.approvedVenues.includes(venue)) {
        violations.push(`Venue ${venue ?? key} not in approved list`);
      }
    }
    
    // Check base asset
    if (this.carryConfig.baseAsset !== 'USDC') {
      violations.push('Strategy requires USDC base asset');
    }
    
    return {
      compliant: violations.length === 0,
      violations,
    };
  }
  
  // ===========================================================================
  // Helper Methods
  // ===========================================================================
  
  private calculateTargetAllocations(
    context: StrategyExecutionContext
  ): CarryLegAllocation[] {
    const allocations: CarryLegAllocation[] = [];
    
    // Convert context allocations to leg allocations
    for (const [key, notional] of context.targetAllocations.entries()) {
      // Parse key format: "venue:market:side"
      const parts = key.split(':');
      if (parts.length !== 3) continue;
      
      const [venue, market, side] = parts;
      
      if (!venue || !market || !side) continue;
      if (side !== 'long' && side !== 'short') continue;
      
      allocations.push({
        market,
        side,
        targetNotional: notional,
        venue,
      });
    }
    
    return allocations;
  }
  
  private async createLegInstruction(
    context: StrategyExecutionContext,
    allocation: CarryLegAllocation
  ): Promise<StrategyInstruction | null> {
    const instructionId = `rebalance_${allocation.venue}_${allocation.market}_${Date.now()}`;
    
    // In simulated mode, return placeholder instruction
    if (this.config.mode === 'simulated') {
      return {
        instructionId,
        data: Buffer.from(JSON.stringify({
          action: 'rebalance',
          market: allocation.market,
          side: allocation.side,
          targetNotional: allocation.targetNotional.toString(),
        })),
        accounts: [
          {
            pubkey: context.authority,
            isSigner: true,
            isWritable: false,
          },
          {
            pubkey: context.strategyProgram,
            isSigner: false,
            isWritable: true,
          },
        ],
        description: `Rebalance ${allocation.venue} ${allocation.market} ${allocation.side} to ${allocation.targetNotional.toString()}`,
      };
    }
    
    // Full mode: Would construct the actual venue instruction
    // EXTERNAL BLOCKER: Requires venue-specific instruction construction
    logger.warn('Real instruction construction not implemented', {
      vaultId: context.vaultId,
      allocation,
      reason: 'Venue instruction builder not integrated',
    });
    
    return null;
  }
}

// =============================================================================
// Strategy Adapter Factory
// =============================================================================

export interface StrategyAdapterFactory {
  createAdapter(strategyId: StrategyId): Promise<Result<StrategyAdapter, Error>>;
}

export class RangerStrategyAdapterFactory implements StrategyAdapterFactory {
  private config: StrategyAdapterConfig;
  private adapters: Map<StrategyId, StrategyAdapter> = new Map();
  
  constructor(config: StrategyAdapterConfig) {
    this.config = config;
  }
  
  async createAdapter(strategyId: StrategyId): Promise<Result<StrategyAdapter, Error>> {
    // Check cache
    const cached = this.adapters.get(strategyId);
    if (cached) {
      return Ok(cached);
    }
    
    // Create appropriate adapter based on strategy ID
    switch (strategyId) {
      case 'sentinel-apex-delta-neutral-carry-v1':
      case 'delta-neutral-carry': {
        const adapter = new RangerCarryStrategyAdapter(
          this.config,
          {
            baseAsset: 'USDC',
            maxGrossExposure: new Decimal(1000000), // $1M
            minFundingRateThreshold: new Decimal(0.0001), // 0.01%
            rebalanceThresholdPct: 5,
            approvedVenues: ['jupiter-perps'],
            approvedMarkets: ['BTC-PERP', 'ETH-PERP', 'SOL-PERP'],
          }
        );
        this.adapters.set(strategyId, adapter);
        return Ok(adapter);
      }
      
      default:
        return Err(new Error(`Unknown strategy: ${strategyId}`));
    }
  }
  
  /**
   * Register a custom adapter
   */
  registerAdapter(strategyId: StrategyId, adapter: StrategyAdapter): void {
    this.adapters.set(strategyId, adapter);
    logger.info('Registered custom strategy adapter', { strategyId });
  }
}
