import type {
  AllocatorDecisionDetailView,
  AllocatorRunView,
  AllocatorSleeveTargetView,
  AllocatorSummaryView,
  CarryActionDetailView,
  CarryActionView,
  CarryStrategyProfileView,
  CarryExecutionDetailView,
  CarryExecutionView,
  CarryVenueView,
  RebalanceBundleDetailView,
  RebalanceEscalationQueueItemView,
  RebalanceEscalationQueueSummaryView,
  RebalanceProposalView,
  RuntimeCommandView,
  RuntimeMismatchDetailView,
  RuntimeMismatchSourceKind,
  RuntimeMismatchStatus,
  RuntimeMismatchView,
  RuntimeOverviewView,
  RuntimeReconciliationFindingSeverity,
  RuntimeReconciliationFindingStatus,
  RuntimeReconciliationFindingType,
  RuntimeReconciliationFindingView,
  RuntimeReconciliationRunView,
  RuntimeReconciliationSummaryView,
  RuntimeRemediationActionType,
  RuntimeRecoveryEventView,
  TreasuryExecutionView,
  TreasuryExecutionDetailView,
  TreasuryActionView,
  TreasuryActionDetailView,
  TreasuryAllocationView,
  TreasuryPolicyView,
  TreasurySummaryView,
  VenueDetailView,
  VenueInventoryItemView,
  VenueInventorySummaryView,
  VenueTruthSummaryView,
  TreasuryVenueDetailView,
  TreasuryVenueView,
} from '@sentinel-apex/runtime';

export interface ApiEnvelope<T> {
  data: T;
  meta?: Record<string, unknown>;
}

export interface ApiErrorEnvelope {
  error: {
    code: string;
    message: string;
    correlationId?: string;
  };
}

export interface DashboardPageState<T> {
  data: T | null;
  error: string | null;
}

export interface MismatchListFilters {
  status?: RuntimeMismatchStatus;
  severity?: string;
  sourceKind?: RuntimeMismatchSourceKind;
  category?: string;
}

export interface ReconciliationFilters {
  findingType?: RuntimeReconciliationFindingType;
  severity?: RuntimeReconciliationFindingSeverity;
  status?: RuntimeReconciliationFindingStatus;
}

export interface OverviewPageData {
  overview: RuntimeOverviewView;
  mismatches: RuntimeMismatchView[];
  commands: RuntimeCommandView[];
  recoveryOutcomes: RuntimeRecoveryEventView[];
  reconciliationRuns: RuntimeReconciliationRunView[];
  activeFindings: RuntimeReconciliationFindingView[];
}

export interface AllocatorPageData {
  summary: AllocatorSummaryView | null;
  targets: AllocatorSleeveTargetView[];
  decisions: AllocatorRunView[];
  rebalanceProposals: RebalanceProposalView[];
}

export interface AllocatorDecisionPageData {
  detail: AllocatorDecisionDetailView;
  rebalanceProposals: RebalanceProposalView[];
}

export interface RebalanceProposalPageData {
  bundle: RebalanceBundleDetailView;
}

export interface RebalanceBundlePageData {
  bundle: RebalanceBundleDetailView;
}

export interface EscalationsPageData {
  escalations: RebalanceEscalationQueueItemView[];
  summary: RebalanceEscalationQueueSummaryView;
}

export interface VenuesPageData {
  venues: VenueInventoryItemView[];
  summary: VenueInventorySummaryView;
  truthSummary: VenueTruthSummaryView;
}

export interface VenueDetailPageData {
  detail: VenueDetailView;
}

export interface ReconciliationPageData {
  summary: RuntimeReconciliationSummaryView | null;
  runs: RuntimeReconciliationRunView[];
  findings: RuntimeReconciliationFindingView[];
}

export interface OperationsPageData {
  commands: RuntimeCommandView[];
  recoveryEvents: RuntimeRecoveryEventView[];
  recoveryOutcomes: RuntimeRecoveryEventView[];
}

export interface TreasuryPageData {
  summary: TreasurySummaryView | null;
  allocations: TreasuryAllocationView[];
  policy: TreasuryPolicyView | null;
  actions: TreasuryActionView[];
  executions: TreasuryExecutionView[];
  venues: TreasuryVenueView[];
}

export interface CarryPageData {
  strategyProfile: CarryStrategyProfileView;
  recommendations: CarryActionView[];
  actions: CarryActionView[];
  executions: CarryExecutionView[];
  venues: CarryVenueView[];
}

export interface CarryActionDetailPageData {
  detail: CarryActionDetailView;
}

export interface CarryExecutionsPageData {
  executions: CarryExecutionView[];
}

export interface CarryExecutionDetailPageData {
  detail: CarryExecutionDetailView;
}

export interface TreasuryActionDetailPageData {
  detail: TreasuryActionDetailView;
}

export interface TreasuryExecutionDetailPageData {
  detail: TreasuryExecutionDetailView;
}

export interface TreasuryExecutionsPageData {
  executions: TreasuryExecutionView[];
}

export interface TreasuryVenuesPageData {
  venues: TreasuryVenueView[];
}

export interface TreasuryVenueDetailPageData {
  detail: TreasuryVenueDetailView;
}

export interface MismatchPageData {
  mismatches: RuntimeMismatchView[];
  filters: MismatchListFilters;
}

export interface MismatchDetailPageData {
  detail: RuntimeMismatchDetailView;
}

export interface ActionRequestBody {
  summary?: string;
  verificationOutcome?: 'verified' | 'failed';
  remediationType?: RuntimeRemediationActionType;
}
