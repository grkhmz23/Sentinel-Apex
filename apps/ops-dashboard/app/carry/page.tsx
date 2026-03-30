import Link from 'next/link';

import { AppShell } from '../../src/components/app-shell';
import { CarryActionTable } from '../../src/components/carry-action-table';
import { CarryActions } from '../../src/components/carry-actions';
import { EmptyState } from '../../src/components/empty-state';
import { ErrorState } from '../../src/components/error-state';
import { Panel } from '../../src/components/panel';
import { StatusBadge } from '../../src/components/status-badge';
import { requireDashboardSession } from '../../src/lib/auth.server';
import { carryModeTone, carryOnboardingTone, carryStatusTone, formatCarryOnboardingState } from '../../src/lib/carry-display';
import { formatDateTime, formatUsd } from '../../src/lib/format';
import { loadCarryPageData } from '../../src/lib/runtime-api.server';

export const dynamic = 'force-dynamic';

export default async function CarryPage(): Promise<JSX.Element> {
  const session = await requireDashboardSession('/carry');
  const state = await loadCarryPageData();

  if (state.error !== null || state.data === null) {
    return (
      <AppShell session={session}>
        <ErrorState message={state.error ?? 'Carry view unavailable.'} title="Carry unavailable" />
      </AppShell>
    );
  }

  const { recommendations, actions, executions, venues } = state.data;

  return (
    <AppShell session={session}>
      <div className="page">
        <header className="page__header">
          <div>
            <p className="eyebrow">Apex Carry</p>
            <h1>Carry Sleeve</h1>
          </div>
          <div className="stack stack--compact">
            <CarryActions />
            <Link href="/carry/executions">Execution drill-through</Link>
          </div>
        </header>

        <div className="grid grid--two-column">
          <Panel subtitle="Execution-ready carry recommendations with backend-enforced gating" title="Recommendations">
            {recommendations.length === 0 ? (
              <EmptyState message="No carry recommendations are currently persisted." title="No recommendations" />
            ) : (
              <CarryActionTable actions={recommendations} />
            )}
          </Panel>

          <Panel subtitle="Venue readiness, simulation state, and execution support boundaries" title="Venue Readiness">
            {venues.length === 0 ? (
              <EmptyState message="No carry venue snapshots are persisted yet." title="No venues" />
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th>Venue</th>
                    <th>Mode</th>
                    <th>Onboarding</th>
                    <th>Execution</th>
                    <th>Missing</th>
                  </tr>
                </thead>
                <tbody>
                  {venues.map((venue) => (
                    <tr key={venue.venueId}>
                      <td>{venue.venueId}</td>
                      <td><StatusBadge label={venue.venueMode} tone={carryModeTone(venue.venueMode)} /></td>
                      <td><StatusBadge label={formatCarryOnboardingState(venue.onboardingState)} tone={carryOnboardingTone(venue.onboardingState)} /></td>
                      <td>{venue.executionSupported ? 'Supported' : 'Unsupported'}</td>
                      <td>{venue.missingPrerequisites.join(', ') || 'None'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Panel>
        </div>

        <div className="grid">
          <Panel subtitle="Durable carry action lifecycle, including simulated and blocked states" title="Action History">
            {actions.length === 0 ? (
              <EmptyState message="No carry actions are currently persisted." title="No actions" />
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th>Action</th>
                    <th>Status</th>
                    <th>Mode</th>
                    <th>Notional</th>
                    <th>Source</th>
                    <th>Created</th>
                  </tr>
                </thead>
                <tbody>
                  {actions.map((action) => (
                    <tr key={action.id}>
                      <td>
                        <div className="stack stack--compact">
                          <Link href={`/carry/actions/${action.id}`}>{action.actionType}</Link>
                          <span className="panel__hint">{action.summary}</span>
                        </div>
                      </td>
                      <td><StatusBadge label={action.status} tone={carryStatusTone(action.status)} /></td>
                      <td>{action.executionMode}{action.simulated ? ' / simulated' : ''}</td>
                      <td>{formatUsd(action.notionalUsd)}</td>
                      <td>{action.sourceKind}</td>
                      <td>{formatDateTime(action.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Panel>
        </div>

        <div className="grid">
          <Panel subtitle="Recent downstream execution attempts and outcomes" title="Execution History">
            {executions.length === 0 ? (
              <EmptyState message="No carry execution attempts are currently persisted." title="No executions" />
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th>Status</th>
                    <th>Action</th>
                    <th>Mode</th>
                    <th>Requested By</th>
                    <th>Completed</th>
                  </tr>
                </thead>
                <tbody>
                  {executions.map((execution) => (
                    <tr key={execution.id}>
                      <td><StatusBadge label={execution.status} tone={carryStatusTone(execution.status)} /></td>
                      <td>
                        <div className="stack stack--compact">
                          <Link href={`/carry/executions/${execution.id}`}>{execution.id}</Link>
                          <Link href={`/carry/actions/${execution.carryActionId}`}>{execution.carryActionId}</Link>
                        </div>
                      </td>
                      <td>{execution.executionMode}{execution.simulated ? ' / simulated' : ''}</td>
                      <td>{execution.requestedBy}</td>
                      <td>{formatDateTime(execution.completedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Panel>
        </div>
      </div>
    </AppShell>
  );
}
