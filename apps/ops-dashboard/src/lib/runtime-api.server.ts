import type {
  RuntimeCommandView,
  RuntimeMismatchDetailView,
  RuntimeMismatchView,
  RuntimeOverviewView,
  RuntimeReconciliationFindingView,
  RuntimeReconciliationRunView,
  RuntimeReconciliationSummaryView,
  RuntimeRecoveryEventView,
  TreasuryExecutionView,
  TreasuryActionView,
  TreasuryAllocationView,
  TreasuryPolicyView,
  TreasurySummaryView,
} from '@sentinel-apex/runtime';

import { getDashboardApiBaseUrl, getDashboardApiKey } from './env.server';

import type {
  ApiEnvelope,
  DashboardPageState,
  MismatchListFilters,
  OperationsPageData,
  OverviewPageData,
  ReconciliationFilters,
  ReconciliationPageData,
  TreasuryPageData,
} from './types';

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

export async function listTreasuryExecutions(limit = 20): Promise<TreasuryExecutionView[]> {
  return fetchTreasuryApi<TreasuryExecutionView[]>(`/executions${buildSearchParams({ limit })}`);
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

export async function loadTreasuryPageData(): Promise<DashboardPageState<TreasuryPageData>> {
  try {
    const [summary, allocations, policy, actions, executions] = await Promise.all([
      getTreasurySummary(),
      listTreasuryAllocations(20),
      getTreasuryPolicy(),
      listTreasuryActions(20),
      listTreasuryExecutions(20),
    ]);

    return {
      data: {
        summary,
        allocations,
        policy,
        actions,
        executions,
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
