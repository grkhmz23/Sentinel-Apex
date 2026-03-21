import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import * as runtimeApiServer from './lib/runtime-api.server';
import {
  createCommand,
  createDashboardSession,
  createMismatch,
  createMismatchDetail,
  createOverview,
  createRecoveryEvent,
  createReconciliationFinding,
  createReconciliationRun,
  createTreasuryAction,
  createTreasuryActionDetail,
  createTreasuryAllocation,
  createTreasuryExecution,
  createTreasuryExecutionDetail,
  createTreasuryPolicy,
  createTreasurySummary,
  createTreasuryVenue,
  createTreasuryVenueDetail,
} from './test/fixtures';
import MismatchDetailPage from '../app/mismatches/[mismatchId]/page';
import MismatchesPage from '../app/mismatches/page';
import OverviewPage from '../app/page';
import ReconciliationPage from '../app/reconciliation/page';
import TreasuryActionDetailPage from '../app/treasury/actions/[actionId]/page';
import TreasuryExecutionDetailPage from '../app/treasury/executions/[executionId]/page';
import TreasuryPage from '../app/treasury/page';
import TreasuryVenueDetailPage from '../app/treasury/venues/[venueId]/page';
import TreasuryVenuesPage from '../app/treasury/venues/page';

import type { ReactNode } from 'react';

vi.mock('next/link', () => ({
  default: ({ children, href }: { children?: ReactNode; href: string }) => <a href={href}>{children}</a>,
}));

vi.mock('./components/quick-actions', () => ({
  QuickActions: () => <div>Quick actions</div>,
}));

vi.mock('./components/treasury-actions', () => ({
  TreasuryActions: () => <div>Treasury actions</div>,
}));

vi.mock('./components/treasury-action-table', () => ({
  TreasuryActionTable: () => <div>Treasury action table</div>,
}));

vi.mock('./components/mismatch-action-panel', () => ({
  MismatchActionPanel: () => <div>Mismatch actions</div>,
}));

vi.mock('./components/app-shell', () => ({
  AppShell: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
}));

vi.mock('./lib/auth.server', () => ({
  requireDashboardSession: vi.fn(async () => createDashboardSession()),
}));

vi.mock('./lib/runtime-api.server', () => ({
  loadOverviewPageData: vi.fn(async () => ({
    data: {
      overview: createOverview(),
      mismatches: [createMismatch()],
      commands: [createCommand()],
      recoveryOutcomes: [createRecoveryEvent()],
      reconciliationRuns: [createReconciliationRun()],
      activeFindings: [createReconciliationFinding()],
    },
    error: null,
  })),
  listMismatches: vi.fn(async () => [createMismatch()]),
  getMismatchDetail: vi.fn(async () => createMismatchDetail()),
  loadReconciliationPageData: vi.fn(async () => ({
    data: {
      summary: createOverview().reconciliationSummary,
      runs: [createReconciliationRun()],
      findings: [createReconciliationFinding()],
    },
    error: null,
  })),
  loadTreasuryPageData: vi.fn(async () => ({
    data: {
      summary: createTreasurySummary(),
      allocations: [createTreasuryAllocation()],
      policy: createTreasuryPolicy(),
      actions: [createTreasuryAction()],
      executions: [createTreasuryExecution()],
      venues: [createTreasuryVenue()],
    },
    error: null,
  })),
  loadTreasuryActionDetailPageData: vi.fn(async () => ({
    data: {
      detail: createTreasuryActionDetail(),
    },
    error: null,
  })),
  loadTreasuryExecutionDetailPageData: vi.fn(async () => ({
    data: {
      detail: createTreasuryExecutionDetail(),
    },
    error: null,
  })),
  loadTreasuryVenuesPageData: vi.fn(async () => ({
    data: {
      venues: [createTreasuryVenue()],
    },
    error: null,
  })),
  loadTreasuryVenueDetailPageData: vi.fn(async () => ({
    data: {
      detail: createTreasuryVenueDetail(),
    },
    error: null,
  })),
}));

describe('ops dashboard pages', () => {
  it('renders the overview with API-backed status data', async () => {
    render(await OverviewPage());

    expect(screen.getByText('Control Plane Status')).toBeInTheDocument();
    expect(screen.getAllByText('ready').length).toBeGreaterThan(0);
    expect(screen.getByText('Recent Mismatches')).toBeInTheDocument();
    expect(screen.getByText('Recent Commands')).toBeInTheDocument();
  });

  it('renders mismatch list and mismatch detail views', async () => {
    render(await MismatchesPage({ searchParams: {} }));

    expect(screen.getByText('Integrity Incident Queue')).toBeInTheDocument();
    expect(screen.getByText('BTC projected position does not match venue state.')).toBeInTheDocument();

    render(await MismatchDetailPage({ params: { mismatchId: 'mismatch-1' } }));

    expect(screen.getByText('Mismatch Detail')).toBeInTheDocument();
    expect(screen.getByText('Safe operator controls')).toBeInTheDocument();
    expect(screen.getByText('Remediation History')).toBeInTheDocument();
  });

  it('renders reconciliation runs and findings from server data', async () => {
    render(await ReconciliationPage({ searchParams: {} }));

    expect(screen.getByText('Runs and Findings')).toBeInTheDocument();
    expect(screen.getByText('Recent reconciliation runs')).toBeInTheDocument();
    expect(screen.getByText('Recent reconciliation findings')).toBeInTheDocument();
  });

  it('renders treasury summary, allocations, and actions from server data', async () => {
    render(await TreasuryPage());

    expect(screen.getByText('Treasury Sleeve')).toBeInTheDocument();
    expect(screen.getByText('Atlas Treasury T0')).toBeInTheDocument();
    expect(screen.getByText('Execution History')).toBeInTheDocument();
    expect(screen.getByText('Venue Readiness')).toBeInTheDocument();
  });

  it('renders treasury action, execution, and venue detail workflows', async () => {
    render(await TreasuryActionDetailPage({ params: { actionId: 'treasury-action-1' } }));
    expect(screen.getByText('Treasury Action Detail')).toBeInTheDocument();
    expect(screen.getByText('Blocked Reasons')).toBeInTheDocument();
    expect(screen.getByText('Timeline')).toBeInTheDocument();

    render(await TreasuryExecutionDetailPage({ params: { executionId: 'treasury-execution-1' } }));
    expect(screen.getByText('Treasury Execution Detail')).toBeInTheDocument();
    expect(screen.getByText('Outcome Controls')).toBeInTheDocument();

    render(await TreasuryVenuesPage());
    expect(screen.getByText('Connector Readiness')).toBeInTheDocument();
    expect(screen.getByText('Venue Inventory')).toBeInTheDocument();

    render(await TreasuryVenueDetailPage({ params: { venueId: 'atlas-t1-sim' } }));
    expect(screen.getByText('Treasury Venue Detail')).toBeInTheDocument();
    expect(screen.getByText('Onboarding Readiness')).toBeInTheDocument();
  });

  it('renders error and empty states when data is unavailable', async () => {
    vi.mocked(runtimeApiServer.loadOverviewPageData).mockResolvedValueOnce({
      data: null,
      error: 'API unavailable',
    });
    vi.mocked(runtimeApiServer.listMismatches).mockResolvedValueOnce([]);

    render(await OverviewPage());
    expect(screen.getByText('Overview unavailable')).toBeInTheDocument();

    render(await MismatchesPage({ searchParams: {} }));
    expect(screen.getByText('No results')).toBeInTheDocument();
  });

  it('redirects when no dashboard session is available', async () => {
    const redirectError = new Error('NEXT_REDIRECT');
    const authModule = await import('./lib/auth.server');
    vi.mocked(authModule.requireDashboardSession).mockRejectedValueOnce(redirectError);

    await expect(OverviewPage()).rejects.toThrow('NEXT_REDIRECT');
  });
});
