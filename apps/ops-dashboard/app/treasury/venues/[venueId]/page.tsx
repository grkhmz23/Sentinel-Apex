import Link from 'next/link';

import { AppShell } from '../../../../src/components/app-shell';
import { DefinitionList } from '../../../../src/components/definition-list';
import { EmptyState } from '../../../../src/components/empty-state';
import { ErrorState } from '../../../../src/components/error-state';
import { Panel } from '../../../../src/components/panel';
import { StatusBadge } from '../../../../src/components/status-badge';
import { requireDashboardSession } from '../../../../src/lib/auth.server';
import { formatDateTime, formatUsd } from '../../../../src/lib/format';
import { loadTreasuryVenueDetailPageData } from '../../../../src/lib/runtime-api.server';
import { formatOnboardingState, treasuryModeTone, treasuryOnboardingTone, treasuryStatusTone } from '../../../../src/lib/treasury-display';

export const dynamic = 'force-dynamic';

export default async function TreasuryVenueDetailPage(
  { params }: { params: { venueId: string } },
): Promise<JSX.Element> {
  const session = await requireDashboardSession(`/treasury/venues/${params.venueId}`);
  const state = await loadTreasuryVenueDetailPageData(params.venueId);

  if (state.error !== null || state.data === null) {
    return (
      <AppShell session={session}>
        <ErrorState message={state.error ?? 'Treasury venue detail unavailable.'} title="Venue detail unavailable" />
      </AppShell>
    );
  }

  const { venue, latestSummary, policy, recentActions, recentExecutions } = state.data.detail;

  return (
    <AppShell session={session}>
      <div className="page">
        <header className="page__header">
          <div>
            <p className="eyebrow">Treasury Venue Detail</p>
            <h1>{venue.venueName}</h1>
            <p className="panel__hint">{venue.venueId}</p>
          </div>
          <div className="button-row">
            <StatusBadge label={venue.simulationState} tone={treasuryModeTone(venue.venueMode)} />
            <StatusBadge label={formatOnboardingState(venue.onboardingState)} tone={treasuryOnboardingTone(venue.onboardingState)} />
          </div>
        </header>

        <div className="inline-links">
          <Link href="/treasury">Back to treasury</Link>
          <Link href="/treasury/venues">Venue inventory</Link>
        </div>

        <div className="grid grid--two-column">
          <Panel subtitle="Connector capability, readiness, and liquidity state" title="Overview">
            <DefinitionList
              items={[
                { label: 'Mode', value: <StatusBadge label={venue.venueMode} tone={treasuryModeTone(venue.venueMode)} /> },
                { label: 'Liquidity tier', value: venue.liquidityTier },
                { label: 'Healthy', value: venue.healthy ? 'Yes' : 'No' },
                { label: 'Execution supported', value: venue.executionSupported ? 'Yes' : 'No' },
                { label: 'Read only', value: venue.readOnly ? 'Yes' : 'No' },
                { label: 'Approved for live', value: venue.approvedForLiveUse ? 'Yes' : 'No' },
                { label: 'Current allocation', value: formatUsd(venue.currentAllocationUsd) },
                { label: 'Withdrawal available', value: formatUsd(venue.withdrawalAvailableUsd) },
                { label: 'Capacity', value: formatUsd(venue.availableCapacityUsd) },
                { label: 'Concentration', value: `${venue.concentrationPct}%` },
                { label: 'APR', value: `${(venue.aprBps / 100).toFixed(2)}%` },
                { label: 'Last snapshot', value: formatDateTime(venue.lastSnapshotAt) },
              ]}
            />
          </Panel>

          <Panel subtitle="Explicit remaining steps before real connector live enablement" title="Onboarding Readiness">
            <DefinitionList
              items={[
                { label: 'Readiness label', value: venue.readinessLabel },
                { label: 'Onboarding state', value: formatOnboardingState(venue.onboardingState) },
                { label: 'Missing prerequisites', value: venue.missingPrerequisites.join(', ') || 'None documented' },
                { label: 'Policy eligible', value: policy?.policy.eligibleVenues.includes(venue.venueId) ? 'Yes' : 'No' },
                { label: 'Max venue allocation', value: policy === null ? 'Unavailable' : `${policy.policy.maxAllocationPctPerVenue}%` },
                { label: 'Current reserve', value: latestSummary === null ? 'Unavailable' : formatUsd(latestSummary.reserveStatus.currentReserveUsd) },
              ]}
            />
          </Panel>
        </div>

        <div className="grid grid--two-column">
          <Panel subtitle="Recent treasury actions linked to this venue" title="Recent Actions">
            {recentActions.length === 0 ? (
              <EmptyState message="No recent treasury actions are linked to this venue." title="No recent actions" />
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th>Action</th>
                    <th>Status</th>
                    <th>Amount</th>
                    <th>Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {recentActions.map((action) => (
                    <tr key={action.id}>
                      <td><Link href={`/treasury/actions/${action.id}`}>{action.summary}</Link></td>
                      <td><StatusBadge label={action.status} tone={treasuryStatusTone(action.status)} /></td>
                      <td>{formatUsd(action.amountUsd)}</td>
                      <td>{formatDateTime(action.updatedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Panel>

          <Panel subtitle="Recent execution attempts against this venue" title="Recent Executions">
            {recentExecutions.length === 0 ? (
              <EmptyState message="No recent treasury executions are linked to this venue." title="No recent executions" />
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th>Execution</th>
                    <th>Status</th>
                    <th>Requested By</th>
                    <th>Completed</th>
                  </tr>
                </thead>
                <tbody>
                  {recentExecutions.map((execution) => (
                    <tr key={execution.id}>
                      <td><Link href={`/treasury/executions/${execution.id}`}>{execution.id}</Link></td>
                      <td><StatusBadge label={execution.status} tone={treasuryStatusTone(execution.status)} /></td>
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
