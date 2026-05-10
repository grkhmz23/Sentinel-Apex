import type {
  TreasuryVenueAdapter,
  TreasuryVenueCapabilities,
  TreasuryVenueExecutionRequest,
  TreasuryVenueExecutionResult,
  TreasuryVenuePosition,
  TreasuryVenueState,
} from '../interfaces/treasury-venue-adapter.js';

export interface PusdTreasuryAdapterConfig {
  venueId?: string;
  venueName?: string;
  idleBalancePusd: string;
  simulatedLiquidityCarryPusd?: string;
  simulatedLendingCarryPusd?: string;
}

export class PusdTreasuryAdapter implements TreasuryVenueAdapter {
  readonly venueId: string;
  readonly venueMode = 'simulated' as const;
  private connected = false;

  constructor(private readonly config: PusdTreasuryAdapterConfig) {
    this.venueId = config.venueId ?? 'pusd-treasury-dry-run';
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

  async getVenueState(): Promise<TreasuryVenueState> {
    return {
      venueId: this.venueId,
      venueName: this.config.venueName ?? 'PUSD Treasury Dry-Run',
      mode: 'simulated',
      liquidityTier: 'instant',
      healthy: true,
      aprBps: 275,
      availableCapacityUsd: this.config.simulatedLiquidityCarryPusd ?? '250000',
      updatedAt: new Date().toISOString(),
      metadata: {
        asset: 'PUSD',
        dryRun: true,
        simulation: true,
        supportsReadOnlyBalance: true,
        supportsSimulation: true,
        supportsLiveExecution: false,
        strategies: [
          'idle PUSD treasury',
          'simulated PUSD/USDC liquidity carry',
          'simulated PUSD lending carry',
        ],
      },
    };
  }

  async getPosition(): Promise<TreasuryVenuePosition> {
    return {
      venueId: this.venueId,
      currentAllocationUsd: this.config.idleBalancePusd,
      withdrawalAvailableUsd: this.config.idleBalancePusd,
      updatedAt: new Date().toISOString(),
    };
  }

  async getCapabilities(): Promise<TreasuryVenueCapabilities> {
    return {
      venueId: this.venueId,
      venueMode: 'simulated',
      supportsAllocation: true,
      supportsReduction: true,
      executionSupported: false,
      readOnly: true,
      approvedForLiveUse: false,
      sensitiveExecutionEligible: false,
      promotionStatus: 'not_requested',
      promotionBlockedReasons: ['Phase PUSD-1 disables live execution.'],
      onboardingState: 'simulated',
      missingPrerequisites: [
        'Live PUSD venue integration',
        'Operator-approved signing flow',
        'Post-trade confirmation adapter',
      ],
      healthy: true,
      metadata: {
        asset: 'PUSD',
        dryRun: true,
        supportsReadOnlyBalance: true,
        supportsSimulation: true,
        supportsLiveExecution: false,
      },
    };
  }

  async executeTreasuryAction(
    _request: TreasuryVenueExecutionRequest,
  ): Promise<TreasuryVenueExecutionResult> {
    throw new Error('PUSD treasury adapter is dry-run only in Phase PUSD-1; live execution is disabled.');
  }
}
