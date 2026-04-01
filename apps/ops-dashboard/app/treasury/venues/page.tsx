import Link from 'next/link';

import { AppShell } from '../../../src/components/app-shell';
import { EmptyState } from '../../../src/components/empty-state';
import { ErrorState } from '../../../src/components/error-state';
import { Panel } from '../../../src/components/panel';
import { StatusBadge } from '../../../src/components/status-badge';
import { requireDashboardSession } from '../../../src/lib/auth.server';
import { formatDateTime } from '../../../src/lib/format';
import { loadTreasuryVenuesPageData } from '../../../src/lib/runtime-api.server';
import { formatOnboardingState, treasuryModeTone, treasuryOnboardingTone } from '../../../src/lib/treasury-display';

export const dynamic = 'force-dynamic';

export default async function TreasuryVenuesPage(): Promise<JSX.Element> {
  const session = await requireDashboardSession('/treasury/venues');
  const state = await loadTreasuryVenuesPageData();

  if (state.error !== null || state.data === null) {
    return (
      <AppShell session={session}>
        <ErrorState message={state.error ?? 'Treasury venue readiness unavailable.'} title="Venue readiness unavailable" />
      </AppShell>
    );
  }

  return (
    <AppShell session={session}>
      <div className="page">
        <header className="page__header">
          <div>
            <p className="eyebrow">Treasury Venues</p>
            <h1>Connector Readiness</h1>
          </div>
          <div className="inline-links">
            <Link href="/treasury">Back to treasury</Link>
          </div>
        </header>

        <Panel subtitle="Simulation boundaries, capability metadata, and live-use approval posture" title="Venue Inventory">
          {state.data.venues.length === 0 ? (
            <EmptyState message="No treasury venue snapshots are available yet." title="No venues" />
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Venue</th>
                  <th>Mode</th>
                  <th>Onboarding</th>
                  <th>Execution</th>
                  <th>Missing prerequisites</th>
                  <th>Last snapshot</th>
                </tr>
              </thead>
              <tbody>
                {state.data.venues.map((venue) => (
                  <tr key={venue.venueId}>
                    <td>
                      <div className="stack stack--compact">
                        <Link href={`/treasury/venues/${venue.venueId}`}>{venue.venueName}</Link>
                        <span className="panel__hint">{venue.readinessLabel}</span>
                        <Link href={`/venues/${venue.venueId}`}>Global venue detail</Link>
                      </div>
                    </td>
                    <td><StatusBadge label={venue.simulationState} tone={treasuryModeTone(venue.venueMode)} /></td>
                    <td><StatusBadge label={formatOnboardingState(venue.onboardingState)} tone={treasuryOnboardingTone(venue.onboardingState)} /></td>
                    <td>{venue.executionSupported ? 'Execution-capable' : venue.readOnly ? 'Read-only' : 'Unsupported'}</td>
                    <td>{venue.missingPrerequisites.join(', ') || 'None documented'}</td>
                    <td>{formatDateTime(venue.lastSnapshotAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Panel>
      </div>
    </AppShell>
  );
}
