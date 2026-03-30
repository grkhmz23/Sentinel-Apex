import type {
  AllocatorDecisionDetailView,
  AllocatorRunView,
  AllocatorSleeveTargetView,
  AllocatorSummaryView,
  CarryActionDetailView,
  CarryActionView,
  CarryExecutionDetailView,
  CarryExecutionView,
  CarryVenueView,
  RebalanceBundleDetailView,
  RebalanceBundleView,
  RebalanceExecutionGraphView,
  RebalanceProposalView,
  RuntimeCommandView,
  RuntimeMismatchDetailView,
  RuntimeMismatchView,
  RuntimeOverviewView,
  RuntimeReconciliationFindingView,
  RuntimeReconciliationRunView,
  RuntimeReconciliationSummaryView,
  RuntimeRecoveryEventView,
  TreasuryActionDetailView,
  TreasuryExecutionView,
  TreasuryExecutionDetailView,
  TreasuryActionView,
  TreasuryAllocationView,
  TreasuryPolicyView,
  TreasurySummaryView,
  TreasuryVenueDetailView,
  TreasuryVenueView,
} from '@sentinel-apex/runtime';

import { getDashboardApiBaseUrl, getDashboardApiKey } from './env.server';

import type {
  ApiEnvelope,
  AllocatorDecisionPageData,
  AllocatorPageData,
  CarryActionDetailPageData,
  CarryExecutionDetailPageData,
  CarryExecutionsPageData,
  CarryPageData,
  DashboardPageState,
  MismatchListFilters,
  OperationsPageData,
  OverviewPageData,
  ReconciliationFilters,
  ReconciliationPageData,
  TreasuryActionDetailPageData,
  TreasuryExecutionDetailPageData,
  TreasuryExecutionsPageData,
  TreasuryPageData,
  RebalanceProposalPageData,
  RebalanceBundlePageData,
  TreasuryVenueDetailPageData,
  TreasuryVenuesPageData,
} from './types';

const ALLOCATOR_API_PREFIX = '/api/v1/allocator';
const CARRY_API_PREFIX = '/api/v1/carry';
const API_PREFIX = '/api/v1/runtime';
const TREASURY_API_PREFIX = '/api/v1/treasury';

async function fetchRuntimeApi<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const response = await fetch(`${getDashboardApiBaseUrl()}${API_PREFIX}${path}`, {
    ...init,
    headers: {
      'content-type': 'application/json',
      'x-api-key': getDashboardApiKey(),
      ...(init.headers ?? {}),
    },
    cache: 'no-store',
  });

  const payload = (await response.json()) as ApiEnvelope<T> & {
    error?: { message?: string };
  };

  if (!response.ok) {
    throw new Error(payload.error?.message ?? `Runtime API request failed: ${response.status}`);
  }

  return payload.data;
}

async function fetchAllocatorApi<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const response = await fetch(`${getDashboardApiBaseUrl()}${ALLOCATOR_API_PREFIX}${path}`, {
    ...init,
    headers: {
      'content-type': 'application/json',
      'x-api-key': getDashboardApiKey(),
      ...(init.headers ?? {}),
    },
    cache: 'no-store',
  });

  const payload = (await response.json()) as ApiEnvelope<T> & {
    error?: { message?: string };
  };

  if (!response.ok) {
    throw new Error(payload.error?.message ?? `Allocator API request failed: ${response.status}`);
  }

  return payload.data;
}

async function fetchTreasuryApi<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const response = await fetch(`${getDashboardApiBaseUrl()}${TREASURY_API_PREFIX}${path}`, {
    ...init,
    headers: {
      'content-type': 'application/json',
      'x-api-key': getDashboardApiKey(),
      ...(init.headers ?? {}),
    },
    cache: 'no-store',
  });

  const payload = (await response.json()) as ApiEnvelope<T> & {
    error?: { message?: string };
  };

  if (!response.ok) {
    throw new Error(payload.error?.message ?? `Runtime API request failed: ${response.status}`);
  }

  return payload.data;
}

async function fetchCarryApi<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const response = await fetch(`${getDashboardApiBaseUrl()}${CARRY_API_PREFIX}${path}`, {
    ...init,
    headers: {
      'content-type': 'application/json',
      'x-api-key': getDashboardApiKey(),
      ...(init.headers ?? {}),
    },
    cache: 'no-store',
  });

  const payload = (await response.json()) as ApiEnvelope<T> & {
    error?: { message?: string };
  };

  if (!response.ok) {
    throw new Error(payload.error?.message ?? `Carry API request failed: ${response.status}`);
  }

  return payload.data;
}

function buildSearchParams(params: Record<string, string | number | undefined>): string {
  const searchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') {
      searchParams.set(key, String(value));
    }
  }

  const query = searchParams.toString();
  return query === '' ? '' : `?${query}`;
}

export async function getRuntimeOverview(): Promise<RuntimeOverviewView> {
  return fetchRuntimeApi<RuntimeOverviewView>('/status');
}

export async function getAllocatorSummary(): Promise<AllocatorSummaryView | null> {
  return fetchAllocatorApi<AllocatorSummaryView | null>('/summary');
}

export async function listAllocatorTargets(limit = 20): Promise<AllocatorSleeveTargetView[]> {
  return fetchAllocatorApi<AllocatorSleeveTargetView[]>(`/targets${buildSearchParams({ limit })}`);
}

export async function listAllocatorDecisions(limit = 20): Promise<AllocatorRunView[]> {
  return fetchAllocatorApi<AllocatorRunView[]>(`/decisions${buildSearchParams({ limit })}`);
}

export async function getAllocatorDecisionDetail(
  allocatorRunId: string,
): Promise<AllocatorDecisionDetailView> {
  return fetchAllocatorApi<AllocatorDecisionDetailView>(`/decisions/${allocatorRunId}`);
}

export async function listRebalanceProposals(limit = 20): Promise<RebalanceProposalView[]> {
  return fetchAllocatorApi<RebalanceProposalView[]>(`/rebalance-proposals${buildSearchParams({ limit })}`);
}

export async function listDecisionRebalanceProposals(
  allocatorRunId: string,
): Promise<RebalanceProposalView[]> {
  return fetchAllocatorApi<RebalanceProposalView[]>(`/decisions/${allocatorRunId}/rebalance-proposals`);
}

export async function getRebalanceProposalDetail(
  proposalId: string,
): Promise<RebalanceExecutionGraphView> {
  return fetchAllocatorApi<RebalanceExecutionGraphView>(`/rebalance-proposals/${proposalId}/execution-graph`);
}

export async function listRebalanceBundles(limit = 20): Promise<RebalanceBundleView[]> {
  return fetchAllocatorApi<RebalanceBundleView[]>(`/rebalance-bundles${buildSearchParams({ limit })}`);
}

export async function getRebalanceBundleForProposal(
  proposalId: string,
): Promise<RebalanceBundleDetailView> {
  return fetchAllocatorApi<RebalanceBundleDetailView>(`/rebalance-proposals/${proposalId}/bundle`);
}

export async function getRebalanceBundleDetail(bundleId: string): Promise<RebalanceBundleDetailView> {
  return fetchAllocatorApi<RebalanceBundleDetailView>(`/rebalance-bundles/${bundleId}`);
}

export async function listCarryRecommendations(limit = 20): Promise<CarryActionView[]> {
  return fetchCarryApi<CarryActionView[]>(`/recommendations${buildSearchParams({ limit })}`);
}

export async function listCarryActions(limit = 20): Promise<CarryActionView[]> {
  return fetchCarryApi<CarryActionView[]>(`/actions${buildSearchParams({ limit })}`);
}

export async function getCarryActionDetail(actionId: string): Promise<CarryActionDetailView> {
  return fetchCarryApi<CarryActionDetailView>(`/actions/${actionId}`);
}

export async function listCarryExecutions(limit = 20): Promise<CarryExecutionView[]> {
  return fetchCarryApi<CarryExecutionView[]>(`/executions${buildSearchParams({ limit })}`);
}

export async function listCarryExecutionsForAction(actionId: string): Promise<CarryExecutionView[]> {
  return fetchCarryApi<CarryExecutionView[]>(`/actions/${actionId}/executions`);
}

export async function getCarryExecutionDetail(
  executionId: string,
): Promise<CarryExecutionDetailView> {
  return fetchCarryApi<CarryExecutionDetailView>(`/executions/${executionId}`);
}

export async function listCarryVenues(limit = 20): Promise<CarryVenueView[]> {
  return fetchCarryApi<CarryVenueView[]>(`/venues${buildSearchParams({ limit })}`);
}

export async function listRuntimeCommands(limit = 20): Promise<RuntimeCommandView[]> {
  return fetchRuntimeApi<RuntimeCommandView[]>(`/commands${buildSearchParams({ limit })}`);
}

export async function listMismatches(
  filters: MismatchListFilters & { limit?: number } = {},
): Promise<RuntimeMismatchView[]> {
  return fetchRuntimeApi<RuntimeMismatchView[]>(`/mismatches${buildSearchParams({
    limit: filters.limit ?? 100,
    status: filters.status,
    severity: filters.severity,
    sourceKind: filters.sourceKind,
    category: filters.category,
  })}`);
}

export async function getMismatchDetail(mismatchId: string): Promise<RuntimeMismatchDetailView> {
  return fetchRuntimeApi<RuntimeMismatchDetailView>(`/mismatches/${mismatchId}`);
}

export async function listRecoveryEvents(limit = 20): Promise<RuntimeRecoveryEventView[]> {
  return fetchRuntimeApi<RuntimeRecoveryEventView[]>(`/recovery-events${buildSearchParams({ limit })}`);
}

export async function listRecoveryOutcomes(limit = 20): Promise<RuntimeRecoveryEventView[]> {
  return fetchRuntimeApi<RuntimeRecoveryEventView[]>(`/recovery-outcomes${buildSearchParams({ limit })}`);
}

export async function listReconciliationRuns(limit = 20): Promise<RuntimeReconciliationRunView[]> {
  return fetchRuntimeApi<RuntimeReconciliationRunView[]>(`/reconciliation/runs${buildSearchParams({ limit })}`);
}

export async function listReconciliationFindings(
  filters: ReconciliationFilters & { limit?: number } = {},
): Promise<RuntimeReconciliationFindingView[]> {
  return fetchRuntimeApi<RuntimeReconciliationFindingView[]>(`/reconciliation/findings${buildSearchParams({
    limit: filters.limit ?? 100,
    findingType: filters.findingType,
    severity: filters.severity,
    status: filters.status,
  })}`);
}

export async function getReconciliationSummary(): Promise<RuntimeReconciliationSummaryView | null> {
  return fetchRuntimeApi<RuntimeReconciliationSummaryView | null>('/reconciliation/summary');
}

export async function getTreasurySummary(): Promise<TreasurySummaryView | null> {
  return fetchTreasuryApi<TreasurySummaryView | null>('/summary');
}

export async function listTreasuryAllocations(limit = 20): Promise<TreasuryAllocationView[]> {
  return fetchTreasuryApi<TreasuryAllocationView[]>(`/allocations${buildSearchParams({ limit })}`);
}

export async function getTreasuryPolicy(): Promise<TreasuryPolicyView | null> {
  return fetchTreasuryApi<TreasuryPolicyView | null>('/policy');
}

export async function listTreasuryActions(limit = 20): Promise<TreasuryActionView[]> {
  return fetchTreasuryApi<TreasuryActionView[]>(`/actions${buildSearchParams({ limit })}`);
}

export async function getTreasuryActionDetail(actionId: string): Promise<TreasuryActionDetailView> {
  return fetchTreasuryApi<TreasuryActionDetailView>(`/actions/${actionId}`);
}

export async function listTreasuryExecutions(limit = 20): Promise<TreasuryExecutionView[]> {
  return fetchTreasuryApi<TreasuryExecutionView[]>(`/executions${buildSearchParams({ limit })}`);
}

export async function listTreasuryExecutionsForAction(actionId: string): Promise<TreasuryExecutionView[]> {
  return fetchTreasuryApi<TreasuryExecutionView[]>(`/actions/${actionId}/executions`);
}

export async function getTreasuryExecutionDetail(
  executionId: string,
): Promise<TreasuryExecutionDetailView> {
  return fetchTreasuryApi<TreasuryExecutionDetailView>(`/executions/${executionId}`);
}

export async function listTreasuryVenues(limit = 20): Promise<TreasuryVenueView[]> {
  return fetchTreasuryApi<TreasuryVenueView[]>(`/venues${buildSearchParams({ limit })}`);
}

export async function getTreasuryVenueDetail(venueId: string): Promise<TreasuryVenueDetailView> {
  return fetchTreasuryApi<TreasuryVenueDetailView>(`/venues/${venueId}`);
}

export async function loadOverviewPageData(): Promise<DashboardPageState<OverviewPageData>> {
  try {
    const [overview, mismatches, commands, recoveryOutcomes, reconciliationRuns, activeFindings] =
      await Promise.all([
        getRuntimeOverview(),
        listMismatches({ limit: 8 }),
        listRuntimeCommands(8),
        listRecoveryOutcomes(8),
        listReconciliationRuns(6),
        listReconciliationFindings({ limit: 8, status: 'active' }),
      ]);

    return {
      data: {
        overview,
        mismatches,
        commands,
        recoveryOutcomes,
        reconciliationRuns,
        activeFindings,
      },
      error: null,
    };
  } catch (error) {
    return {
      data: null,
      error: error instanceof Error ? error.message : 'Failed to load overview data.',
    };
  }
}

export async function loadAllocatorPageData(): Promise<DashboardPageState<AllocatorPageData>> {
  try {
    const [summary, targets, decisions] = await Promise.all([
      getAllocatorSummary(),
      listAllocatorTargets(20),
      listAllocatorDecisions(20),
    ]);

    return {
      data: {
        summary,
        targets,
        decisions,
        rebalanceProposals: await listRebalanceProposals(10),
      },
      error: null,
    };
  } catch (error) {
    return {
      data: null,
      error: error instanceof Error ? error.message : 'Failed to load allocator data.',
    };
  }
}

export async function loadAllocatorDecisionPageData(
  allocatorRunId: string,
): Promise<DashboardPageState<AllocatorDecisionPageData>> {
  try {
    const [detail, rebalanceProposals] = await Promise.all([
      getAllocatorDecisionDetail(allocatorRunId),
      listDecisionRebalanceProposals(allocatorRunId),
    ]);
    return {
      data: { detail, rebalanceProposals },
      error: null,
    };
  } catch (error) {
    return {
      data: null,
      error: error instanceof Error ? error.message : 'Failed to load allocator decision detail.',
    };
  }
}

export async function loadRebalanceProposalPageData(
  proposalId: string,
): Promise<DashboardPageState<RebalanceProposalPageData>> {
  try {
    const bundle = await getRebalanceBundleForProposal(proposalId);
    return {
      data: { bundle },
      error: null,
    };
  } catch (error) {
    return {
      data: null,
      error: error instanceof Error ? error.message : 'Failed to load rebalance proposal.',
    };
  }
}

export async function loadRebalanceBundlePageData(
  bundleId: string,
): Promise<DashboardPageState<RebalanceBundlePageData>> {
  try {
    const bundle = await getRebalanceBundleDetail(bundleId);
    return {
      data: { bundle },
      error: null,
    };
  } catch (error) {
    return {
      data: null,
      error: error instanceof Error ? error.message : 'Failed to load rebalance proposal.',
    };
  }
}

export async function loadCarryPageData(): Promise<DashboardPageState<CarryPageData>> {
  try {
    const [recommendations, actions, executions, venues] = await Promise.all([
      listCarryRecommendations(20),
      listCarryActions(20),
      listCarryExecutions(20),
      listCarryVenues(20),
    ]);

    return {
      data: {
        recommendations,
        actions,
        executions,
        venues,
      },
      error: null,
    };
  } catch (error) {
    return {
      data: null,
      error: error instanceof Error ? error.message : 'Failed to load carry data.',
    };
  }
}

export async function loadCarryActionDetailPageData(
  actionId: string,
): Promise<DashboardPageState<CarryActionDetailPageData>> {
  try {
    return {
      data: {
        detail: await getCarryActionDetail(actionId),
      },
      error: null,
    };
  } catch (error) {
    return {
      data: null,
      error: error instanceof Error ? error.message : 'Failed to load carry action detail.',
    };
  }
}

export async function loadCarryExecutionsPageData(): Promise<DashboardPageState<CarryExecutionsPageData>> {
  try {
    return {
      data: {
        executions: await listCarryExecutions(50),
      },
      error: null,
    };
  } catch (error) {
    return {
      data: null,
      error: error instanceof Error ? error.message : 'Failed to load carry executions.',
    };
  }
}

export async function loadCarryExecutionDetailPageData(
  executionId: string,
): Promise<DashboardPageState<CarryExecutionDetailPageData>> {
  try {
    return {
      data: {
        detail: await getCarryExecutionDetail(executionId),
      },
      error: null,
    };
  } catch (error) {
    return {
      data: null,
      error: error instanceof Error ? error.message : 'Failed to load carry execution detail.',
    };
  }
}

export async function loadTreasuryPageData(): Promise<DashboardPageState<TreasuryPageData>> {
  try {
    const [summary, allocations, policy, actions, executions, venues] = await Promise.all([
      getTreasurySummary(),
      listTreasuryAllocations(20),
      getTreasuryPolicy(),
      listTreasuryActions(20),
      listTreasuryExecutions(20),
      listTreasuryVenues(20),
    ]);

    return {
      data: {
        summary,
        allocations,
        policy,
        actions,
        executions,
        venues,
      },
      error: null,
    };
  } catch (error) {
    return {
      data: null,
      error: error instanceof Error ? error.message : 'Failed to load treasury data.',
    };
  }
}

export async function loadTreasuryActionDetailPageData(
  actionId: string,
): Promise<DashboardPageState<TreasuryActionDetailPageData>> {
  try {
    const detail = await getTreasuryActionDetail(actionId);
    return {
      data: { detail },
      error: null,
    };
  } catch (error) {
    return {
      data: null,
      error: error instanceof Error ? error.message : 'Failed to load treasury action detail.',
    };
  }
}

export async function loadTreasuryExecutionDetailPageData(
  executionId: string,
): Promise<DashboardPageState<TreasuryExecutionDetailPageData>> {
  try {
    const detail = await getTreasuryExecutionDetail(executionId);
    return {
      data: { detail },
      error: null,
    };
  } catch (error) {
    return {
      data: null,
      error: error instanceof Error ? error.message : 'Failed to load treasury execution detail.',
    };
  }
}

export async function loadTreasuryExecutionsPageData(): Promise<DashboardPageState<TreasuryExecutionsPageData>> {
  try {
    const executions = await listTreasuryExecutions(50);
    return {
      data: { executions },
      error: null,
    };
  } catch (error) {
    return {
      data: null,
      error: error instanceof Error ? error.message : 'Failed to load treasury executions.',
    };
  }
}

export async function loadTreasuryVenuesPageData(): Promise<DashboardPageState<TreasuryVenuesPageData>> {
  try {
    const venues = await listTreasuryVenues(50);
    return {
      data: { venues },
      error: null,
    };
  } catch (error) {
    return {
      data: null,
      error: error instanceof Error ? error.message : 'Failed to load treasury venues.',
    };
  }
}

export async function loadTreasuryVenueDetailPageData(
  venueId: string,
): Promise<DashboardPageState<TreasuryVenueDetailPageData>> {
  try {
    const detail = await getTreasuryVenueDetail(venueId);
    return {
      data: { detail },
      error: null,
    };
  } catch (error) {
    return {
      data: null,
      error: error instanceof Error ? error.message : 'Failed to load treasury venue detail.',
    };
  }
}

export async function loadReconciliationPageData(
  filters: ReconciliationFilters,
): Promise<DashboardPageState<ReconciliationPageData>> {
  try {
    const [summary, runs, findings] = await Promise.all([
      getReconciliationSummary(),
      listReconciliationRuns(20),
      listReconciliationFindings({ ...filters, limit: 50 }),
    ]);

    return {
      data: {
        summary,
        runs,
        findings,
      },
      error: null,
    };
  } catch (error) {
    return {
      data: null,
      error: error instanceof Error ? error.message : 'Failed to load reconciliation data.',
    };
  }
}

export async function loadOperationsPageData(): Promise<DashboardPageState<OperationsPageData>> {
  try {
    const [commands, recoveryEvents, recoveryOutcomes] = await Promise.all([
      listRuntimeCommands(50),
      listRecoveryEvents(50),
      listRecoveryOutcomes(50),
    ]);

    return {
      data: {
        commands,
        recoveryEvents,
        recoveryOutcomes,
      },
      error: null,
    };
  } catch (error) {
    return {
      data: null,
      error: error instanceof Error ? error.message : 'Failed to load operations data.',
    };
  }
}
