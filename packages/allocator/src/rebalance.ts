import Decimal from 'decimal.js';

import type {
  AllocatorDecision,
  AllocatorRationale,
  AllocatorSleeveId,
  AllocatorTargetAllocation,
} from './types.js';

export type RebalanceProposalStatus =
  | 'proposed'
  | 'approved'
  | 'queued'
  | 'executing'
  | 'completed'
  | 'failed'
  | 'rejected'
  | 'cancelled';
export type RebalanceIntentStatus = RebalanceProposalStatus;
export type RebalanceExecutionMode = 'dry-run' | 'live';
export type RebalanceApprovalRequirement = 'operator' | 'admin';
export type RebalanceReadiness = 'actionable' | 'blocked' | 'unsupported';
export type RebalanceActionType =
  | 'increase_treasury_allocation'
  | 'reduce_treasury_allocation'
  | 'increase_carry_budget'
  | 'reduce_carry_budget'
  | 'rebalance_between_sleeves';
export type RebalanceBlockedReasonCode =
  | 'below_minimum_action_size'
  | 'runtime_not_ready'
  | 'critical_mismatch_pressure'
  | 'carry_throttle_active'
  | 'carry_budget_execution_pending'
  | 'treasury_reserve_shortfall'
  | 'insufficient_treasury_idle_capital'
  | 'live_execution_disabled';

export interface RebalanceBlockedReason {
  code: RebalanceBlockedReasonCode;
  message: string;
  operatorAction: string;
  details: Record<string, unknown>;
}

export interface RebalancePlannerPolicy {
  minimumActionableUsd: string;
}

export interface RebalancePlannerSystemInput {
  runtimeLifecycleState: 'ready' | 'paused' | 'degraded' | 'stopped' | 'starting';
  runtimeHalted: boolean;
  criticalMismatchCount: number;
  executionMode: RebalanceExecutionMode;
  liveExecutionEnabled: boolean;
}

export interface RebalancePlannerTreasuryInput {
  idleCapitalUsd: string;
  reserveShortfallUsd: string;
}

export interface RebalanceProposalIntent {
  sleeveId: AllocatorSleeveId;
  sourceSleeveId: AllocatorSleeveId | null;
  targetSleeveId: AllocatorSleeveId | null;
  actionType: Exclude<RebalanceActionType, 'rebalance_between_sleeves'>;
  status: RebalanceIntentStatus;
  readiness: RebalanceReadiness;
  executable: boolean;
  currentAllocationUsd: string;
  currentAllocationPct: number;
  targetAllocationUsd: string;
  targetAllocationPct: number;
  deltaUsd: string;
  rationale: AllocatorRationale[];
  blockedReasons: RebalanceBlockedReason[];
  details: Record<string, unknown>;
}

export interface RebalanceProposal {
  allocatorRunId: string;
  actionType: RebalanceActionType;
  status: RebalanceProposalStatus;
  summary: string;
  executionMode: RebalanceExecutionMode;
  simulated: boolean;
  executable: boolean;
  approvalRequirement: RebalanceApprovalRequirement;
  rationale: AllocatorRationale[];
  blockedReasons: RebalanceBlockedReason[];
  intents: RebalanceProposalIntent[];
  details: Record<string, unknown>;
}

export interface RebalancePlannerInput {
  allocatorRunId: string;
  decision: AllocatorDecision;
  system: RebalancePlannerSystemInput;
  treasury: RebalancePlannerTreasuryInput;
  policy?: Partial<RebalancePlannerPolicy>;
}

export const DEFAULT_REBALANCE_POLICY: RebalancePlannerPolicy = {
  minimumActionableUsd: '2500',
};

function buildBlockedReason(
  code: RebalanceBlockedReasonCode,
  message: string,
  operatorAction: string,
  details: Record<string, unknown> = {},
): RebalanceBlockedReason {
  return {
    code,
    message,
    operatorAction,
    details,
  };
}

function findTarget(
  decision: AllocatorDecision,
  sleeveId: AllocatorSleeveId,
): AllocatorTargetAllocation {
  const target = decision.targets.find((candidate) => candidate.sleeveId === sleeveId);
  if (target === undefined) {
    throw new Error(`Missing allocator target for sleeve "${sleeveId}".`);
  }

  return target;
}

function createIntent(
  sleeveTarget: AllocatorTargetAllocation,
  actionType: Exclude<RebalanceActionType, 'rebalance_between_sleeves'>,
  sourceSleeveId: AllocatorSleeveId | null,
  targetSleeveId: AllocatorSleeveId | null,
  blockedReasons: RebalanceBlockedReason[],
): RebalanceProposalIntent {
  return {
    sleeveId: sleeveTarget.sleeveId,
    sourceSleeveId,
    targetSleeveId,
    actionType,
    status: 'proposed',
    readiness: blockedReasons.length === 0 ? 'actionable' : 'blocked',
    executable: blockedReasons.length === 0,
    currentAllocationUsd: sleeveTarget.currentAllocationUsd,
    currentAllocationPct: sleeveTarget.currentAllocationPct,
    targetAllocationUsd: sleeveTarget.targetAllocationUsd,
    targetAllocationPct: sleeveTarget.targetAllocationPct,
    deltaUsd: sleeveTarget.deltaUsd,
    rationale: sleeveTarget.rationale,
    blockedReasons,
    details: sleeveTarget.metadata,
  };
}

export class SentinelRebalancePlanner {
  createProposal(input: RebalancePlannerInput): RebalanceProposal | null {
    const policy: RebalancePlannerPolicy = {
      ...DEFAULT_REBALANCE_POLICY,
      ...input.policy,
    };
    const carry = findTarget(input.decision, 'carry');
    const treasury = findTarget(input.decision, 'treasury');
    const carryDeltaUsd = new Decimal(carry.deltaUsd);
    const treasuryDeltaUsd = new Decimal(treasury.deltaUsd);
    const rebalanceAmountUsd = Decimal.max(carryDeltaUsd.abs(), treasuryDeltaUsd.abs());
    const blockedReasons: RebalanceBlockedReason[] = [];

    if (rebalanceAmountUsd.eq(0)) {
      return null;
    }

    if (rebalanceAmountUsd.lt(policy.minimumActionableUsd)) {
      blockedReasons.push(buildBlockedReason(
        'below_minimum_action_size',
        `Allocator delta ${rebalanceAmountUsd.toFixed(2)} USD is below the minimum actionable rebalance size.`,
        'Wait for a larger allocator delta before approving a rebalance proposal.',
        {
          rebalanceAmountUsd: rebalanceAmountUsd.toFixed(2),
          minimumActionableUsd: policy.minimumActionableUsd,
        },
      ));
    }

    if (
      input.system.runtimeHalted
      || input.system.runtimeLifecycleState === 'paused'
      || input.system.runtimeLifecycleState === 'stopped'
      || input.system.runtimeLifecycleState === 'starting'
    ) {
      blockedReasons.push(buildBlockedReason(
        'runtime_not_ready',
        'Runtime is not in a state that permits rebalance approval or execution.',
        'Resume the runtime and return it to ready state before approving a rebalance proposal.',
        {
          runtimeLifecycleState: input.system.runtimeLifecycleState,
          runtimeHalted: input.system.runtimeHalted,
        },
      ));
    }

    if (input.system.criticalMismatchCount > 0) {
      blockedReasons.push(buildBlockedReason(
        'critical_mismatch_pressure',
        'Critical mismatch pressure blocks rebalance approval until recovery posture improves.',
        'Resolve or verify critical mismatches before approving a rebalance proposal.',
        { criticalMismatchCount: input.system.criticalMismatchCount },
      ));
    }

    if (input.system.executionMode === 'live' && !input.system.liveExecutionEnabled) {
      blockedReasons.push(buildBlockedReason(
        'live_execution_disabled',
        'Live rebalance application is disabled for this runtime.',
        'Keep the proposal in dry-run or enable live mode only after operator signoff.',
        {
          executionMode: input.system.executionMode,
          liveExecutionEnabled: input.system.liveExecutionEnabled,
        },
      ));
    }

    const movingIntoCarry = carryDeltaUsd.greaterThan(0);

    if (
      movingIntoCarry
      && (
        carry.status === 'degraded'
        || carry.status === 'blocked'
        || carry.throttleState === 'de_risk'
        || carry.throttleState === 'blocked'
      )
    ) {
      blockedReasons.push(buildBlockedReason(
        'carry_throttle_active',
        'Carry sleeve is throttled or degraded, so its budget cannot be increased.',
        'Keep capital in Treasury until carry health and throttle state normalize.',
        {
          carryStatus: carry.status,
          carryThrottleState: carry.throttleState,
        },
      ));
    }

    if (movingIntoCarry && new Decimal(input.treasury.reserveShortfallUsd).greaterThan(0)) {
      blockedReasons.push(buildBlockedReason(
        'treasury_reserve_shortfall',
        'Treasury reserve is short, so capital cannot be reallocated away from Treasury.',
        'Restore reserve coverage before approving a Treasury-to-Carry rebalance.',
        {
          reserveShortfallUsd: input.treasury.reserveShortfallUsd,
        },
      ));
    }

    if (movingIntoCarry && new Decimal(input.treasury.idleCapitalUsd).lt(rebalanceAmountUsd)) {
      blockedReasons.push(buildBlockedReason(
        'insufficient_treasury_idle_capital',
        'Treasury does not have enough idle capital to fund the requested carry increase without additional venue reductions.',
        'Free treasury liquidity through explicit treasury actions before approving this rebalance.',
        {
          idleCapitalUsd: input.treasury.idleCapitalUsd,
          rebalanceAmountUsd: rebalanceAmountUsd.toFixed(2),
        },
      ));
    }

    const intents: RebalanceProposalIntent[] = movingIntoCarry
      ? [
        createIntent(carry, 'increase_carry_budget', 'treasury', 'carry', blockedReasons),
        createIntent(treasury, 'reduce_treasury_allocation', 'treasury', 'carry', blockedReasons),
      ]
      : [
        createIntent(carry, 'reduce_carry_budget', 'carry', 'treasury', blockedReasons),
        createIntent(treasury, 'increase_treasury_allocation', 'carry', 'treasury', blockedReasons),
      ];

    return {
      allocatorRunId: input.allocatorRunId,
      actionType: 'rebalance_between_sleeves',
      status: 'proposed',
      summary: movingIntoCarry
        ? `Rebalance ${rebalanceAmountUsd.toFixed(2)} USD from Treasury to Carry budget.`
        : `Rebalance ${rebalanceAmountUsd.toFixed(2)} USD from Carry to Treasury budget.`,
      executionMode: input.system.executionMode,
      simulated: input.system.executionMode !== 'live',
      executable: blockedReasons.length === 0,
      approvalRequirement: input.system.executionMode === 'live' ? 'admin' : 'operator',
      rationale: input.decision.rationale,
      blockedReasons,
      intents,
      details: {
        rebalanceAmountUsd: rebalanceAmountUsd.toFixed(2),
        carryCurrentAllocationUsd: carry.currentAllocationUsd,
        carryTargetAllocationUsd: carry.targetAllocationUsd,
        treasuryCurrentAllocationUsd: treasury.currentAllocationUsd,
        treasuryTargetAllocationUsd: treasury.targetAllocationUsd,
      },
    };
  }
}
