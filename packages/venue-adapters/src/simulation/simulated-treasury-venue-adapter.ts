import type {
  TreasuryVenueAdapter,
  TreasuryVenueCapabilities,
  TreasuryVenueExecutionRequest,
  TreasuryVenueExecutionResult,
  TreasuryVenuePosition,
  TreasuryVenueState,
} from '../interfaces/treasury-venue-adapter.js';
import type {
  VenueCapabilitySnapshot,
  VenueTruthSnapshot,
} from '../interfaces/venue-truth-adapter.js';

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
      sensitiveExecutionEligible: false,
      promotionStatus: 'not_requested',
      promotionBlockedReasons: [],
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

  async getVenueCapabilitySnapshot(): Promise<VenueCapabilitySnapshot> {
    return {
      venueId: this.config.venueId,
      venueName: this.config.venueName,
      sleeveApplicability: ['treasury'],
      connectorType: 'simulated_treasury_adapter',
      truthMode: 'simulated',
      readOnlySupport: false,
      executionSupport: true,
      approvedForLiveUse: false,
      onboardingState: 'simulated',
      missingPrerequisites: [
        'Real connector implementation',
        'Read-only validation against venue',
        'Live enable approval',
      ],
      authRequirementsSummary: [],
      healthy: this.config.healthy ?? true,
      healthState: (this.config.healthy ?? true) ? 'healthy' : 'degraded',
      degradedReason: (this.config.healthy ?? true) ? null : 'simulated_treasury_health_flag_false',
      metadata: {
        simulated: true,
        liquidityTier: this.config.liquidityTier,
        ...(this.config.metadata ?? {}),
      },
    };
  }

  async getVenueTruthSnapshot(): Promise<VenueTruthSnapshot> {
    const [venueState, position] = await Promise.all([
      this.getVenueState(),
      this.getPosition(),
    ]);

    return {
      venueId: venueState.venueId,
      venueName: venueState.venueName,
      snapshotType: 'simulated_treasury_state',
      snapshotSuccessful: true,
      healthy: venueState.healthy,
      healthState: venueState.healthy ? 'healthy' : 'degraded',
      summary: `Allocation ${position.currentAllocationUsd} USD, withdrawal availability ${position.withdrawalAvailableUsd} USD.`,
      errorMessage: null,
      capturedAt: position.updatedAt,
      snapshotCompleteness: 'complete',
      truthCoverage: {
        accountState: {
          status: 'unsupported',
          reason: 'Simulated treasury adapters do not expose a stable venue account identity.',
          limitations: [],
        },
        balanceState: {
          status: 'unsupported',
          reason: 'Treasury venue truth is modeled as capacity and allocation, not account balances.',
          limitations: [],
        },
        capacityState: {
          status: 'available',
          reason: null,
          limitations: [],
        },
        exposureState: {
          status: 'available',
          reason: null,
          limitations: [],
        },
        derivativeAccountState: {
          status: 'unsupported',
          reason: 'Simulated treasury adapters do not expose venue-native derivative account metadata.',
          limitations: [],
        },
        derivativePositionState: {
          status: 'unsupported',
          reason: 'Simulated treasury adapters do not expose venue-native derivative position state.',
          limitations: [],
        },
        derivativeHealthState: {
          status: 'unsupported',
          reason: 'Simulated treasury adapters do not expose venue-native derivative margin or health state.',
          limitations: [],
        },
        orderState: {
          status: 'unsupported',
          reason: 'Simulated treasury adapters do not expose venue-native open order state.',
          limitations: [],
        },
        executionReferences: {
          status: 'unsupported',
          reason: 'Simulated treasury truth does not include external execution references.',
          limitations: [],
        },
      },
      sourceMetadata: {
        sourceKind: 'simulation',
        sourceName: 'simulated_treasury_adapter',
        connectorDepth: 'simulation',
        observedScope: ['capacity', 'allocation'],
      },
      accountState: null,
      balanceState: null,
      capacityState: {
        availableCapacityUsd: venueState.availableCapacityUsd,
        currentAllocationUsd: position.currentAllocationUsd,
        withdrawalAvailableUsd: position.withdrawalAvailableUsd,
        liquidityTier: venueState.liquidityTier,
        aprBps: venueState.aprBps,
      },
      exposureState: {
        exposures: [{
          exposureKey: `${venueState.venueId}:allocation`,
          exposureType: 'allocation',
          assetKey: 'USD',
          quantity: position.currentAllocationUsd,
          quantityDisplay: position.currentAllocationUsd,
          accountAddress: null,
        }],
        methodology: 'treasury_allocation_state',
      },
      derivativeAccountState: null,
      derivativePositionState: null,
      derivativeHealthState: null,
      orderState: null,
      executionReferenceState: null,
      payload: {
        liquidityTier: venueState.liquidityTier,
        aprBps: venueState.aprBps,
        availableCapacityUsd: venueState.availableCapacityUsd,
        currentAllocationUsd: position.currentAllocationUsd,
        withdrawalAvailableUsd: position.withdrawalAvailableUsd,
      },
      metadata: {
        simulated: true,
        ...(venueState.metadata ?? {}),
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
