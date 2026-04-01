import Link from 'next/link';

import { AppShell } from '../../src/components/app-shell';
import { DefinitionList } from '../../src/components/definition-list';
import { EmptyState } from '../../src/components/empty-state';
import { ErrorState } from '../../src/components/error-state';
import { Panel } from '../../src/components/panel';
import { StatusBadge } from '../../src/components/status-badge';
import { requireDashboardSession } from '../../src/lib/auth.server';
import { formatDateTime } from '../../src/lib/format';
import { loadVenuesPageData } from '../../src/lib/runtime-api.server';

export const dynamic = 'force-dynamic';

function toneForTruthMode(mode: 'simulated' | 'real'): 'warn' | 'good' {
  return mode === 'real' ? 'good' : 'warn';
}

function toneForHealthState(state: string): 'good' | 'warn' | 'bad' {
  if (state === 'healthy') {
    return 'good';
  }
  if (state === 'degraded') {
    return 'warn';
  }
  return 'bad';
}

function toneForOnboarding(state: string): 'neutral' | 'warn' | 'good' {
  if (state === 'approved_for_live') {
    return 'good';
  }
  if (state === 'read_only' || state === 'ready_for_review') {
    return 'warn';
  }
  return 'neutral';
}

function toneForTruthProfile(
  profile: string,
): 'neutral' | 'good' | 'warn' | 'bad' {
  if (profile === 'derivative_aware') {
    return 'good';
  }
  if (profile === 'generic_wallet') {
    return 'warn';
  }
  if (profile === 'capacity_only') {
    return 'neutral';
  }
  return 'bad';
}

export default async function VenuesPage(): Promise<JSX.Element> {
  const session = await requireDashboardSession('/venues');
  const state = await loadVenuesPageData();

  if (state.error !== null || state.data === null) {
    return (
      <AppShell session={session}>
        <ErrorState message={state.error ?? 'Venue inventory unavailable.'} title="Venue inventory unavailable" />
      </AppShell>
    );
  }

  const { venues, summary, truthSummary } = state.data;

  return (
    <AppShell session={session}>
      <div className="page">
        <header className="page__header">
          <div>
            <p className="eyebrow">Venue Truth</p>
            <h1>Connector Inventory</h1>
          </div>
        </header>

        <div className="grid grid--metrics">
          <Panel subtitle="Cross-connector maturity, freshness, and degradation counts" title="Summary">
            <DefinitionList
              items={[
                { label: 'Total venues', value: String(summary.totalVenues) },
                { label: 'Simulated only', value: String(summary.simulatedOnly) },
                { label: 'Real read-only', value: String(summary.realReadOnly) },
                { label: 'Real execution-capable', value: String(summary.realExecutionCapable) },
                { label: 'Derivative-aware', value: String(summary.derivativeAware) },
                { label: 'Generic wallet', value: String(summary.genericWallet) },
                { label: 'Capacity only', value: String(summary.capacityOnly) },
                { label: 'Approved live', value: String(summary.approvedForLiveUse) },
                { label: 'Degraded', value: String(summary.degraded) },
                { label: 'Unavailable', value: String(summary.unavailable) },
                { label: 'Stale', value: String(summary.stale) },
              ]}
            />
          </Panel>

          <Panel subtitle="Depth of account, balance, exposure, and reference truth across the venue inventory" title="Truth Depth">
            <DefinitionList
              items={[
                { label: 'Drift-native read-only', value: String(truthSummary.connectorDepth.drift_native_readonly) },
                { label: 'Generic RPC read-only', value: String(truthSummary.connectorDepth.generic_rpc_readonly) },
                { label: 'Execution-capable depth', value: String(truthSummary.connectorDepth.execution_capable) },
                { label: 'Complete snapshots', value: String(truthSummary.completeSnapshots) },
                { label: 'Partial snapshots', value: String(truthSummary.partialSnapshots) },
                { label: 'Minimal snapshots', value: String(truthSummary.minimalSnapshots) },
                { label: 'Derivative-aware venues', value: String(truthSummary.derivativeAwareVenues) },
                { label: 'Generic wallet venues', value: String(truthSummary.genericWalletVenues) },
                { label: 'Capacity-only venues', value: String(truthSummary.capacityOnlyVenues) },
                { label: 'Decoded derivative accounts', value: String(truthSummary.decodedDerivativeAccountVenues) },
                { label: 'Decoded derivative positions', value: String(truthSummary.decodedDerivativePositionVenues) },
                { label: 'Health metric venues', value: String(truthSummary.healthMetricVenues) },
                { label: 'Venue open-order inventory', value: String(truthSummary.venueOpenOrderInventoryVenues) },
                { label: 'Derivative positions available', value: String(truthSummary.derivativePositionState.available) },
                { label: 'Derivative health available', value: String(truthSummary.derivativeHealthState.available) },
                { label: 'Order state available', value: String(truthSummary.orderState.available) },
                { label: 'Execution refs available', value: String(truthSummary.executionReferences.available) },
              ]}
            />
          </Panel>
        </div>

        <Panel subtitle="Real versus simulated connector truth, capability posture, and snapshot freshness" title="Venue Inventory">
          {venues.length === 0 ? (
            <EmptyState message="No venue snapshots have been ingested yet." title="No venues" />
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Venue</th>
                  <th>Truth</th>
                  <th>Capabilities</th>
                  <th>Health</th>
                  <th>Depth</th>
                  <th>Freshness</th>
                  <th>Missing prerequisites</th>
                </tr>
              </thead>
              <tbody>
                {venues.map((venue) => (
                  <tr key={venue.venueId}>
                    <td>
                      <div className="stack stack--compact">
                        <Link href={`/venues/${venue.venueId}`}>{venue.venueName}</Link>
                        <span className="panel__hint">{venue.venueId}</span>
                        <span className="panel__hint">{venue.connectorType}</span>
                        <span className="panel__hint">{venue.sourceMetadata.connectorDepth ?? 'depth not recorded'}</span>
                      </div>
                    </td>
                    <td>
                      <div className="stack stack--compact">
                        <StatusBadge label={venue.truthMode} tone={toneForTruthMode(venue.truthMode)} />
                        <StatusBadge label={venue.truthProfile} tone={toneForTruthProfile(venue.truthProfile)} />
                        <span className="panel__hint">{venue.sleeveApplicability.join(', ')}</span>
                      </div>
                    </td>
                    <td>
                      <div className="stack stack--compact">
                        <span>{venue.executionSupport ? 'Execution-capable' : venue.readOnlySupport ? 'Read-only' : 'Unsupported'}</span>
                        <StatusBadge label={venue.onboardingState} tone={toneForOnboarding(venue.onboardingState)} />
                        <span className="panel__hint">{venue.approvedForLiveUse ? 'Approved for live' : 'Not approved for live'}</span>
                      </div>
                    </td>
                    <td>
                      <div className="stack stack--compact">
                        <StatusBadge label={venue.healthState} tone={toneForHealthState(venue.healthState)} />
                        <span className="panel__hint">{venue.latestErrorMessage ?? venue.latestSnapshotSummary}</span>
                      </div>
                    </td>
                    <td>
                      <div className="stack stack--compact">
                        <StatusBadge
                          label={venue.snapshotCompleteness}
                          tone={venue.snapshotCompleteness === 'complete' ? 'good' : venue.snapshotCompleteness === 'partial' ? 'warn' : 'bad'}
                        />
                        <span className="panel__hint">
                          acct {venue.truthCoverage.accountState.status}, bal {venue.truthCoverage.balanceState.status}
                        </span>
                        <span className="panel__hint">
                          deriv acct {venue.truthCoverage.derivativeAccountState.status}, positions {venue.truthCoverage.derivativePositionState.status}
                        </span>
                        <span className="panel__hint">
                          health {venue.truthCoverage.derivativeHealthState.status}, orders {venue.truthCoverage.orderState.status}
                        </span>
                        <span className="panel__hint">
                          refs {venue.comparisonCoverage.executionReferences.status}, direct pos compare {venue.comparisonCoverage.positionInventory.status}
                        </span>
                      </div>
                    </td>
                    <td>
                      <div className="stack stack--compact">
                        <StatusBadge label={venue.snapshotFreshness} tone={venue.snapshotFreshness === 'fresh' ? 'good' : 'warn'} />
                        <span className="panel__hint">{formatDateTime(venue.lastSnapshotAt)}</span>
                      </div>
                    </td>
                    <td>{venue.missingPrerequisites.join(', ') || 'None documented'}</td>
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
