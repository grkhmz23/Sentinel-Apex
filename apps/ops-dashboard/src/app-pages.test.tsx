import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import * as runtimeApiServer from './lib/runtime-api.server';
import {
  createCommand,
  createMismatch,
  createMismatchDetail,
  createOverview,
  createRecoveryEvent,
  createReconciliationFinding,
  createReconciliationRun,
} from './test/fixtures';
import MismatchDetailPage from '../app/mismatches/[mismatchId]/page';
import MismatchesPage from '../app/mismatches/page';
import OverviewPage from '../app/page';
import ReconciliationPage from '../app/reconciliation/page';

import type { ReactNode } from 'react';

vi.mock('next/link', () => ({
  default: ({ children, href }: { children?: ReactNode; href: string }) => <a href={href}>{children}</a>,
}));

vi.mock('./components/quick-actions', () => ({
  QuickActions: () => <div>Quick actions</div>,
}));

vi.mock('./components/mismatch-action-panel', () => ({
  MismatchActionPanel: () => <div>Mismatch actions</div>,
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
});
