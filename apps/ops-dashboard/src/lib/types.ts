import type {
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
  TreasuryActionView,
  TreasuryAllocationView,
  TreasuryPolicyView,
  TreasurySummaryView,
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
