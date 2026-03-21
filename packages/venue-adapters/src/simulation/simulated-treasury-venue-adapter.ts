import type {
  TreasuryVenueAdapter,
  TreasuryVenueCapabilities,
  TreasuryVenueExecutionRequest,
  TreasuryVenueExecutionResult,
  TreasuryVenuePosition,
  TreasuryVenueState,
} from '../interfaces/treasury-venue-adapter.js';

export interface SimulatedTreasuryVenueConfig {
  venueId: string;
  venueName: string;
  liquidityTier: 'instant' | 'same_day' | 'delayed';
  aprBps: number;
  availableCapacityUsd: string;
  currentAllocationUsd: string;
  withdrawalAvailableUsd?: string;
  healthy?: boolean;
  metadata?: Record<string, unknown>;
}

export class SimulatedTreasuryVenueAdapter implements TreasuryVenueAdapter {
  readonly venueId: string;
  readonly venueMode = 'simulated' as const;
  private connected = false;
  private currentAllocationUsd: string;
  private withdrawalAvailableUsd: string;
  private executionCounter = 0;

  constructor(private readonly config: SimulatedTreasuryVenueConfig) {
    this.venueId = config.venueId;
    this.currentAllocationUsd = config.currentAllocationUsd;
    this.withdrawalAvailableUsd = config.withdrawalAvailableUsd ?? config.currentAllocationUsd;
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
      venueId: this.config.venueId,
      venueName: this.config.venueName,
      mode: 'simulated',
      liquidityTier: this.config.liquidityTier,
      healthy: this.config.healthy ?? true,
      aprBps: this.config.aprBps,
      availableCapacityUsd: this.config.availableCapacityUsd,
      updatedAt: new Date().toISOString(),
      metadata: this.config.metadata ?? {},
    };
  }

  async getPosition(): Promise<TreasuryVenuePosition> {
    return {
      venueId: this.config.venueId,
      currentAllocationUsd: this.currentAllocationUsd,
      withdrawalAvailableUsd: this.withdrawalAvailableUsd,
      updatedAt: new Date().toISOString(),
    };
  }

  async getCapabilities(): Promise<TreasuryVenueCapabilities> {
    return {
      venueId: this.config.venueId,
      venueMode: 'simulated',
      supportsAllocation: true,
      supportsReduction: true,
      executionSupported: true,
      readOnly: false,
      approvedForLiveUse: false,
      onboardingState: 'simulated',
      missingPrerequisites: [
        'Real connector implementation',
        'Read-only validation against venue',
        'Live enable approval',
      ],
      healthy: this.config.healthy ?? true,
      metadata: {
        simulated: true,
        ...(this.config.metadata ?? {}),
      },
    };
  }

  async executeTreasuryAction(
    request: TreasuryVenueExecutionRequest,
  ): Promise<TreasuryVenueExecutionResult> {
    const currentAllocation = Number(this.currentAllocationUsd);
    const currentWithdrawal = Number(this.withdrawalAvailableUsd);
    const amount = Number(request.amountUsd);

    if (!Number.isFinite(amount) || amount <= 0) {
      throw new Error('Simulated treasury execution requires a positive amount.');
    }

    let nextAllocation = currentAllocation;
    let nextWithdrawal = currentWithdrawal;
    if (request.actionType === 'allocate_to_venue') {
      nextAllocation += amount;
      nextWithdrawal += amount;
    } else if (amount > currentWithdrawal) {
      throw new Error(
        `Simulated treasury withdrawal exceeds available withdrawal balance for ${this.config.venueId}.`,
      );
    } else {
      nextAllocation = Math.max(currentAllocation - amount, 0);
      nextWithdrawal = Math.max(currentWithdrawal - amount, 0);
    }

    this.currentAllocationUsd = nextAllocation.toFixed(2);
    this.withdrawalAvailableUsd = nextWithdrawal.toFixed(2);
    this.executionCounter += 1;

    return {
      venueId: this.config.venueId,
      venueMode: 'simulated',
      executionReference: `${this.config.venueId}-sim-treasury-${this.executionCounter}`,
      status: 'completed',
      summary: request.actionType === 'allocate_to_venue'
        ? `Simulated allocation of ${amount.toFixed(2)} USD completed.`
        : `Simulated reduction of ${amount.toFixed(2)} USD completed.`,
      simulated: true,
      balanceDeltaUsd: request.actionType === 'allocate_to_venue'
        ? amount.toFixed(2)
        : (-amount).toFixed(2),
      allocationUsd: this.currentAllocationUsd,
      withdrawalAvailableUsd: this.withdrawalAvailableUsd,
      metadata: {
        actorId: request.actorId,
        executionMode: request.executionMode,
        reasonCode: request.reasonCode,
      },
    };
  }
}
