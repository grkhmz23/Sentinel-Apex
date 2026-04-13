import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import * as runtimeApiServer from './lib/runtime-api.server';
import {
  createAllocatorDecisionDetail,
  createAllocatorRun,
  createAllocatorSummary,
  createAllocatorTarget,
  createCarryAction,
  createCarryActionDetail,
  createCarryExecutionDetail,
  createCarryExecution,
  createCarryStrategyProfile,
  createCarryVenue,
    createCommand,
    createDashboardSession,
    createMismatch,
    createMismatchDetail,
    createOverview,
    createSubmissionDossier,
    createSubmissionEvidence,
    createSubmissionExportBundle,
    createRebalanceBundleDetail,
  createRebalanceEscalationQueueItem,
  createRebalanceEscalationQueueSummary,
  createRebalanceProposal,
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
  createVenueDetail,
  createVenueInventoryItem,
  createVenueInventorySummary,
  createVenueTruthSummary,
  createTreasuryVenue,
  createTreasuryVenueDetail,
} from './test/fixtures';
import AllocatorDecisionPage from '../app/allocator/decisions/[allocatorRunId]/page';
import EscalationsPage from '../app/allocator/escalations/page';
import AllocatorPage from '../app/allocator/page';
import RebalanceBundlePage from '../app/allocator/rebalance-bundles/[bundleId]/page';
import RebalanceProposalPage from '../app/allocator/rebalance-proposals/[proposalId]/page';
import CarryActionDetailPage from '../app/carry/actions/[actionId]/page';
import CarryExecutionDetailPage from '../app/carry/executions/[executionId]/page';
import CarryExecutionsPage from '../app/carry/executions/page';
import CarryPage from '../app/carry/page';
import MismatchDetailPage from '../app/mismatches/[mismatchId]/page';
import MismatchesPage from '../app/mismatches/page';
import OverviewPage from '../app/page';
import ReconciliationPage from '../app/reconciliation/page';
import SubmissionPage from '../app/submission/page';
import TreasuryActionDetailPage from '../app/treasury/actions/[actionId]/page';
import TreasuryExecutionDetailPage from '../app/treasury/executions/[executionId]/page';
import TreasuryExecutionsPage from '../app/treasury/executions/page';
import TreasuryPage from '../app/treasury/page';
import TreasuryVenueDetailPage from '../app/treasury/venues/[venueId]/page';
import TreasuryVenuesPage from '../app/treasury/venues/page';
import VenueDetailPage from '../app/venues/[venueId]/page';
import VenuesPage from '../app/venues/page';

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

vi.mock('./components/carry-action-table', () => ({
  CarryActionTable: () => <div>Carry action table</div>,
}));

vi.mock('./components/carry-actions', () => ({
  CarryActions: () => <div>Carry actions</div>,
}));

vi.mock('./components/submission-ranger-actions', () => ({
  SubmissionRangerActions: () => <div>Submission Ranger actions</div>,
}));

vi.mock('./components/submission-requirements-actions', () => ({
  SubmissionRequirementsActions: () => <div>Submission requirements actions</div>,
}));

vi.mock('./components/connector-promotion-actions', () => ({
  ConnectorPromotionActions: () => <div>Connector promotion actions</div>,
}));

vi.mock('./components/rebalance-proposal-actions', () => ({
  RebalanceProposalActions: () => <div>Rebalance proposal actions</div>,
}));

vi.mock('./components/rebalance-bundle-recovery-actions', () => ({
  RebalanceBundleRecoveryActions: () => <div>Rebalance bundle recovery actions</div>,
}));

vi.mock('./components/rebalance-bundle-resolution-actions', () => ({
  RebalanceBundleResolutionActions: () => <div>Rebalance bundle resolution actions</div>,
}));

vi.mock('./components/rebalance-bundle-escalation-actions', () => ({
  RebalanceBundleEscalationActions: () => <div>Rebalance bundle escalation actions</div>,
}));

vi.mock('./components/rebalance-escalation-queue-actions', () => ({
  RebalanceEscalationQueueActions: () => <div>Rebalance escalation queue actions</div>,
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
  loadAllocatorPageData: vi.fn(async () => ({
    data: {
      summary: createAllocatorSummary(),
      targets: [createAllocatorTarget()],
      decisions: [createAllocatorRun()],
      rebalanceProposals: [createRebalanceProposal()],
    },
    error: null,
  })),
  loadSubmissionPageData: vi.fn(async () => ({
    data: {
      dossier: createSubmissionDossier(),
      evidence: [createSubmissionEvidence()],
      exportBundle: createSubmissionExportBundle(),
    },
    error: null,
  })),
  loadAllocatorDecisionPageData: vi.fn(async () => ({
    data: {
      detail: createAllocatorDecisionDetail(),
      rebalanceProposals: [createRebalanceProposal()],
    },
    error: null,
  })),
  loadRebalanceProposalPageData: vi.fn(async () => ({
    data: {
      bundle: createRebalanceBundleDetail(),
    },
    error: null,
  })),
  loadRebalanceBundlePageData: vi.fn(async () => ({
    data: {
      bundle: createRebalanceBundleDetail(),
    },
    error: null,
  })),
  loadEscalationsPageData: vi.fn(async () => ({
    data: {
      escalations: [createRebalanceEscalationQueueItem()],
      summary: createRebalanceEscalationQueueSummary(),
    },
    error: null,
  })),
  loadVenuesPageData: vi.fn(async () => ({
    data: {
      venues: [createVenueInventoryItem()],
      summary: createVenueInventorySummary(),
      truthSummary: createVenueTruthSummary(),
    },
    error: null,
  })),
  loadVenueDetailPageData: vi.fn(async () => ({
    data: {
      detail: createVenueDetail(),
    },
    error: null,
  })),
  loadCarryPageData: vi.fn(async () => ({
    data: {
      strategyProfile: createCarryStrategyProfile(),
      opportunities: [],
      recommendations: [createCarryAction()],
      actions: [createCarryAction()],
      executions: [createCarryExecution()],
      venues: [createCarryVenue()],
    },
    error: null,
  })),
  loadCarryActionDetailPageData: vi.fn(async () => ({
    data: {
      detail: createCarryActionDetail(),
    },
    error: null,
  })),
  loadCarryExecutionsPageData: vi.fn(async () => ({
    data: {
      executions: [createCarryExecution()],
    },
    error: null,
  })),
  loadCarryExecutionDetailPageData: vi.fn(async () => ({
    data: {
      detail: createCarryExecutionDetail(),
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
  loadTreasuryExecutionsPageData: vi.fn(async () => ({
    data: {
      executions: [createTreasuryExecution()],
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

  it('renders the submission dossier with readiness blockers and evidence links', async () => {
    render(await SubmissionPage());

    expect(screen.getByText('Submission Dossier')).toBeInTheDocument();
    expect(screen.getByText('Submission Profile')).toBeInTheDocument();
    expect(screen.getByText('Readiness Checks')).toBeInTheDocument();
    expect(screen.getByText('Supported Scope')).toBeInTheDocument();
    expect(screen.getByText('Blocked Scope')).toBeInTheDocument();
    expect(screen.getByText('Submission Requirements')).toBeInTheDocument();
    expect(screen.getByText('Ranger Actions')).toBeInTheDocument();
    expect(screen.getByText('Verification Evidence')).toBeInTheDocument();
    expect(screen.getByText('Export Bundle')).toBeInTheDocument();
    expect(screen.getByText(/realized APY evidence is not currently persisted/i)).toBeInTheDocument();
    expect(screen.getByText('Open wallet in Solscan')).toBeInTheDocument();
    expect(screen.getByText(/Primary submission trade/)).toBeInTheDocument();
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

  it('renders allocator overview and decision detail views', async () => {
    render(await AllocatorPage());

    expect(screen.getByText('Allocator')).toBeInTheDocument();
    expect(screen.getByText('Current versus target budget per sleeve')).toBeInTheDocument();
    expect(screen.getByText('Decision History')).toBeInTheDocument();
    expect(screen.getByText('Rebalance Proposals')).toBeInTheDocument();

    render(await AllocatorDecisionPage({ params: { allocatorRunId: 'allocator-run-1' } }));

    expect(screen.getByText('Allocator Decision Detail')).toBeInTheDocument();
    expect(screen.getByText('Per-sleeve budget targets')).toBeInTheDocument();
    expect(screen.getByText('Persisted rebalance and budget recommendations')).toBeInTheDocument();

    render(await RebalanceProposalPage({ params: { proposalId: 'rebalance-proposal-1' } }));

    expect(screen.getByText('Rebalance Proposal Detail')).toBeInTheDocument();
    expect(screen.getByText('Sleeve Intents')).toBeInTheDocument();
    expect(screen.getByText('Carry Downstream')).toBeInTheDocument();
    expect(screen.getByText('Timeline')).toBeInTheDocument();

    render(await RebalanceBundlePage({ params: { bundleId: 'rebalance-bundle-1' } }));

    expect(screen.getByText('Rebalance Bundle Detail')).toBeInTheDocument();
    expect(screen.getByText('Child Rollup')).toBeInTheDocument();
    expect(screen.getByText('Partial Progress')).toBeInTheDocument();
    expect(screen.getByText('Recovery Candidates')).toBeInTheDocument();
    expect(screen.getByText('Recovery History')).toBeInTheDocument();
    expect(screen.getByText('Escalation Ownership')).toBeInTheDocument();
    expect(screen.getByText('Escalation Workflow')).toBeInTheDocument();
    expect(screen.getByText('Escalation History')).toBeInTheDocument();
    expect(screen.getByText('Resolution Options')).toBeInTheDocument();
    expect(screen.getByText('Resolution History')).toBeInTheDocument();

    render(await EscalationsPage({ searchParams: {} }));

    expect(screen.getByText('Escalations Queue')).toBeInTheDocument();
    expect(screen.getByText('Queue Summary')).toBeInTheDocument();
    expect(screen.getByText('Triage Board')).toBeInTheDocument();
    expect(screen.getByText('Rebalance escalation queue actions')).toBeInTheDocument();
  });

  it('renders carry overview and carry action detail views', async () => {
    render(await CarryPage());

    expect(screen.getByText('Carry Sleeve')).toBeInTheDocument();
    expect(screen.getByText('Strategy Profile')).toBeInTheDocument();
    expect(screen.getByText('Eligibility Checks')).toBeInTheDocument();
    expect(screen.getByText('Recommendations')).toBeInTheDocument();
    expect(screen.getByText('Venue Readiness')).toBeInTheDocument();
    expect(screen.getByText('Execution History')).toBeInTheDocument();

    render(await CarryActionDetailPage({ params: { actionId: 'carry-action-1' } }));

    expect(screen.getByText('Carry Action Detail')).toBeInTheDocument();
    expect(screen.getByText('Strategy Snapshot')).toBeInTheDocument();
    expect(screen.getByText('Blocked Reasons')).toBeInTheDocument();
    expect(screen.getByText('Planned Orders')).toBeInTheDocument();
    expect(screen.getByText('Executions')).toBeInTheDocument();
    expect(screen.getByText('Identity')).toBeInTheDocument();
    expect(screen.getByText(/derived \/ partial via strategy_intent/i)).toBeInTheDocument();

    render(await CarryExecutionsPage());

    expect(screen.getByText('Carry Executions')).toBeInTheDocument();
    expect(screen.getByText('Execution Attempts')).toBeInTheDocument();

    render(await CarryExecutionDetailPage({ params: { executionId: 'carry-execution-1' } }));

    expect(screen.getByText('Carry Execution Detail')).toBeInTheDocument();
    expect(screen.getByText('Execution Steps')).toBeInTheDocument();
    expect(screen.getByText('Timeline')).toBeInTheDocument();
    expect(screen.getByText(/derived \/ partial via execution_result/i)).toBeInTheDocument();
  });

  it('renders ineligible carry strategy states without implying live readiness', async () => {
    vi.mocked(runtimeApiServer.loadCarryPageData).mockResolvedValueOnce({
      data: {
        strategyProfile: createCarryStrategyProfile({
          yieldSourceCategory: 'dex_lp',
          eligibility: {
            status: 'ineligible',
            summary: 'Strategy metadata does not currently satisfy all Build-A-Bear product-policy rules and remains blocked.',
            blockedReasons: ['yield_source_category_disallowed'],
            ruleResults: [{
              ruleKey: 'allowed_yield_source',
              status: 'fail',
              summary: 'Yield source category dex_lp is explicitly disallowed for Build-A-Bear.',
              blockedReason: 'yield_source_category_disallowed',
              details: {},
            }],
          },
        }),
        opportunities: [],
        recommendations: [createCarryAction()],
        actions: [createCarryAction()],
        executions: [createCarryExecution()],
        venues: [createCarryVenue()],
      },
      error: null,
    });

    render(await CarryPage());

    expect(screen.getByText(/yield_source_category_disallowed/i)).toBeInTheDocument();
    expect(screen.getByText(/dex_lp is explicitly disallowed/i)).toBeInTheDocument();
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

    render(await TreasuryExecutionsPage());
    expect(screen.getByText('Treasury Execution History')).toBeInTheDocument();
    expect(screen.getByText('Direct treasury execution drill-through with mode and reference visibility')).toBeInTheDocument();

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

  it('renders generic venue inventory and venue detail workflows', async () => {
    render(await VenuesPage());
    expect(screen.getByText('Connector Inventory')).toBeInTheDocument();
    expect(screen.getByText('Drift Solana Read-Only')).toBeInTheDocument();
    expect(screen.getByText('Derivative-aware venues')).toBeInTheDocument();
    expect(screen.getByText('Venue-native read-only')).toBeInTheDocument();
    expect(screen.getAllByText('derivative_aware').length).toBeGreaterThan(0);

    render(await VenueDetailPage({ params: { venueId: 'drift-solana-readonly' } }));
    expect(screen.getByText('Capability Overview')).toBeInTheDocument();
    expect(screen.getByText('Reconciliation Coverage')).toBeInTheDocument();
    expect(screen.getByText('Internal Derivative State')).toBeInTheDocument();
    expect(screen.getByText('Internal Inventory')).toBeInTheDocument();
    expect(screen.getByText('Comparison Detail')).toBeInTheDocument();
    expect(screen.getByText('Promotion Workflow')).toBeInTheDocument();
    expect(screen.getByText('Promotion Evidence')).toBeInTheDocument();
    expect(screen.getByText('Promotion History')).toBeInTheDocument();
    expect(screen.getByText('Connector promotion actions')).toBeInTheDocument();
    expect(screen.getByText('Internal health status')).toBeInTheDocument();
    expect(screen.getByText('Risk posture')).toBeInTheDocument();
    expect(screen.getByText('Market identity comparison')).toBeInTheDocument();
    expect(screen.getAllByText('Identity basis').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Health comparison mode').length).toBeGreaterThan(0);
    expect(screen.getByText('Derivative Account State')).toBeInTheDocument();
    expect(screen.getByText('Position Inventory')).toBeInTheDocument();
    expect(screen.getByText('Health And Margin')).toBeInTheDocument();
    expect(screen.getByText('Order Inventory')).toBeInTheDocument();
    expect(screen.getByText('Execution References')).toBeInTheDocument();
    expect(screen.getByText('Snapshot History')).toBeInTheDocument();
    expect(screen.getByText('authority_subaccount')).toBeInTheDocument();
    expect(screen.getByText('not_comparable')).toBeInTheDocument();
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
