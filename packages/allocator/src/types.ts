export type AllocatorSleeveId = 'carry' | 'treasury';
export type AllocatorSleeveKind = 'carry' | 'treasury';
export type AllocatorSleeveStatus = 'active' | 'throttled' | 'degraded' | 'blocked';
export type AllocatorThrottleState = 'normal' | 'throttled' | 'de_risk' | 'blocked';
export type AllocatorRegimeState = 'normal' | 'cautious' | 'defensive' | 'recovery';
export type AllocatorPressureLevel = 'normal' | 'elevated' | 'high';
export type AllocatorRecommendationType =
  | 'increase_budget'
  | 'decrease_budget'
  | 'hold_budget'
  | 'de_risk'
  | 'increase_reserve_buffer';
export type AllocatorRecommendationPriority = 'low' | 'medium' | 'high';
export type AllocatorRationaleSeverity = 'info' | 'warning' | 'critical';

export interface AllocatorPolicy {
  baselineTargetPct: Record<AllocatorSleeveId, number>;
  minimumTreasuryPct: number;
  maximumCarryPct: number;
  degradedCarryCapPct: number;
  elevatedMismatchCarryCapPct: number;
  reserveShortfallCarryCapPct: number;
  weakCarryCarryCapPct: number;
  carryOpportunityScoreFloor: number;
  carryOpportunityScoreStrong: number;
}

export interface AllocatorSleeveDefinition {
  sleeveId: AllocatorSleeveId;
  kind: AllocatorSleeveKind;
  name: string;
  reserveManaged: boolean;
  executionMode: 'dry-run' | 'live';
  supportsAllocatorBudgeting: boolean;
}

export interface AllocatorSleeveSnapshot {
  sleeveId: AllocatorSleeveId;
  kind: AllocatorSleeveKind;
  name: string;
  currentAllocationUsd: string;
  currentAllocationPct: number;
  minAllocationPct: number;
  maxAllocationPct: number;
  capacityUsd: string | null;
  status: AllocatorSleeveStatus;
  throttleState: AllocatorThrottleState;
  healthy: boolean;
  actionability: 'actionable' | 'observe_only' | 'blocked';
  opportunityScore: number | null;
  metadata: Record<string, unknown>;
}

export interface AllocatorSystemState {
  totalCapitalUsd: string;
  reserveConstrainedCapitalUsd: string;
  allocatableCapitalUsd: string;
  runtimeLifecycleState: 'ready' | 'paused' | 'degraded' | 'stopped' | 'starting';
  runtimeHalted: boolean;
  openMismatchCount: number;
  criticalMismatchCount: number;
  degradedReasonCount: number;
  treasuryReserveCoveragePct: number;
  treasuryReserveShortfallUsd: string;
  carryOpportunityCount: number;
  carryApprovedOpportunityCount: number;
  carryOpportunityScore: number;
  recentReconciliationIssues: number;
}

export interface AllocatorPolicyInput {
  policy: AllocatorPolicy;
  sleeves: AllocatorSleeveSnapshot[];
  system: AllocatorSystemState;
  evaluatedAt: string;
  sourceReference: string | null;
}

export interface AllocatorRationale {
  code: string;
  severity: AllocatorRationaleSeverity;
  summary: string;
  details: Record<string, unknown>;
}

export interface AllocatorBudgetConstraint {
  code: string;
  summary: string;
  binding: boolean;
  details: Record<string, unknown>;
}

export interface AllocatorTargetAllocation {
  sleeveId: AllocatorSleeveId;
  sleeveName: string;
  sleeveKind: AllocatorSleeveKind;
  currentAllocationUsd: string;
  currentAllocationPct: number;
  targetAllocationUsd: string;
  targetAllocationPct: number;
  minAllocationPct: number;
  maxAllocationPct: number;
  deltaUsd: string;
  status: AllocatorSleeveStatus;
  throttleState: AllocatorThrottleState;
  opportunityScore: number | null;
  capacityUsd: string | null;
  rationale: AllocatorRationale[];
  metadata: Record<string, unknown>;
}

export interface AllocatorRecommendation {
  recommendationType: AllocatorRecommendationType;
  sleeveId: AllocatorSleeveId;
  priority: AllocatorRecommendationPriority;
  summary: string;
  details: Record<string, unknown>;
  rationale: AllocatorRationale[];
}

export interface AllocatorDecision {
  regimeState: AllocatorRegimeState;
  pressureLevel: AllocatorPressureLevel;
  totalCapitalUsd: string;
  reserveConstrainedCapitalUsd: string;
  allocatableCapitalUsd: string;
  targets: AllocatorTargetAllocation[];
  recommendations: AllocatorRecommendation[];
  rationale: AllocatorRationale[];
  constraints: AllocatorBudgetConstraint[];
}
