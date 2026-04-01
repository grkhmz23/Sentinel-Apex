import Link from 'next/link';

import { AppShell } from '../../../src/components/app-shell';
import { DefinitionList } from '../../../src/components/definition-list';
import { EmptyState } from '../../../src/components/empty-state';
import { ErrorState } from '../../../src/components/error-state';
import { Panel } from '../../../src/components/panel';
import { StatusBadge } from '../../../src/components/status-badge';
import { requireDashboardSession } from '../../../src/lib/auth.server';
import { formatDateTime } from '../../../src/lib/format';
import { loadVenueDetailPageData } from '../../../src/lib/runtime-api.server';

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

function formatCoverage(status: string, reason: string | null): string {
  return reason === null ? status : `${status} - ${reason}`;
}

export default async function VenueDetailPage(
  { params }: { params: { venueId: string } },
): Promise<JSX.Element> {
  const session = await requireDashboardSession(`/venues/${params.venueId}`);
  const state = await loadVenueDetailPageData(params.venueId);

  if (state.error !== null || state.data === null) {
    return (
      <AppShell session={session}>
        <ErrorState message={state.error ?? 'Venue detail unavailable.'} title="Venue detail unavailable" />
      </AppShell>
    );
  }

  const { venue, snapshots } = state.data.detail;
  const latestSnapshot = snapshots[0] ?? null;
  const accountState = latestSnapshot?.accountState ?? null;
  const balanceState = latestSnapshot?.balanceState ?? null;
  const exposureState = latestSnapshot?.exposureState ?? null;
  const derivativeAccountState = latestSnapshot?.derivativeAccountState ?? null;
  const derivativePositionState = latestSnapshot?.derivativePositionState ?? null;
  const derivativeHealthState = latestSnapshot?.derivativeHealthState ?? null;
  const orderState = latestSnapshot?.orderState ?? null;
  const executionReferenceState = latestSnapshot?.executionReferenceState ?? null;

  return (
    <AppShell session={session}>
      <div className="page">
        <header className="page__header">
          <div>
            <p className="eyebrow">Venue Detail</p>
            <h1>{venue.venueName}</h1>
            <p className="panel__hint">{venue.venueId}</p>
          </div>
          <div className="button-row">
            <StatusBadge label={venue.truthMode} tone={toneForTruthMode(venue.truthMode)} />
            <StatusBadge label={venue.truthProfile} tone={toneForTruthProfile(venue.truthProfile)} />
            <StatusBadge label={venue.healthState} tone={toneForHealthState(venue.healthState)} />
          </div>
        </header>

        <div className="inline-links">
          <Link href="/venues">Back to venues</Link>
        </div>

        <div className="grid grid--two-column">
          <Panel subtitle="Connector maturity and live-readiness truth" title="Capability Overview">
            <DefinitionList
              items={[
                { label: 'Connector type', value: venue.connectorType },
                { label: 'Sleeves', value: venue.sleeveApplicability.join(', ') },
                { label: 'Truth mode', value: <StatusBadge label={venue.truthMode} tone={toneForTruthMode(venue.truthMode)} /> },
                { label: 'Truth profile', value: <StatusBadge label={venue.truthProfile} tone={toneForTruthProfile(venue.truthProfile)} /> },
                { label: 'Read-only support', value: venue.readOnlySupport ? 'Yes' : 'No' },
                { label: 'Execution support', value: venue.executionSupport ? 'Yes' : 'No' },
                { label: 'Approved for live', value: venue.approvedForLiveUse ? 'Yes' : 'No' },
                { label: 'Onboarding state', value: venue.onboardingState },
                { label: 'Missing prerequisites', value: venue.missingPrerequisites.join(', ') || 'None documented' },
                { label: 'Auth/config requirements', value: venue.authRequirementsSummary.join(', ') || 'None documented' },
              ]}
            />
          </Panel>

          <Panel subtitle="Latest ingested venue-native truth and freshness" title="Snapshot State">
            <DefinitionList
              items={[
                { label: 'Health state', value: <StatusBadge label={venue.healthState} tone={toneForHealthState(venue.healthState)} /> },
                { label: 'Latest snapshot type', value: venue.latestSnapshotType },
                { label: 'Latest snapshot summary', value: venue.latestSnapshotSummary },
                { label: 'Latest error', value: venue.latestErrorMessage ?? 'None recorded' },
                { label: 'Snapshot completeness', value: venue.snapshotCompleteness },
                { label: 'Snapshot freshness', value: venue.snapshotFreshness },
                { label: 'Last snapshot', value: formatDateTime(venue.lastSnapshotAt) },
                { label: 'Last successful snapshot', value: formatDateTime(venue.lastSuccessfulSnapshotAt) },
                { label: 'Observed scope', value: venue.sourceMetadata.observedScope.join(', ') || 'None recorded' },
                { label: 'Degraded reason', value: venue.degradedReason ?? 'None recorded' },
              ]}
            />
          </Panel>
        </div>

        <div className="grid grid--two-column">
          <Panel subtitle="Which deeper truth domains are available, partial, or unsupported" title="Truth Coverage">
            <DefinitionList
              items={[
                { label: 'Source', value: `${venue.sourceMetadata.sourceKind} (${venue.sourceMetadata.sourceName})` },
                { label: 'Observed scope', value: venue.sourceMetadata.observedScope.join(', ') || 'None recorded' },
                { label: 'Account state', value: formatCoverage(venue.truthCoverage.accountState.status, venue.truthCoverage.accountState.reason) },
                { label: 'Balance state', value: formatCoverage(venue.truthCoverage.balanceState.status, venue.truthCoverage.balanceState.reason) },
                { label: 'Capacity state', value: formatCoverage(venue.truthCoverage.capacityState.status, venue.truthCoverage.capacityState.reason) },
                { label: 'Exposure-like state', value: formatCoverage(venue.truthCoverage.exposureState.status, venue.truthCoverage.exposureState.reason) },
                { label: 'Derivative account state', value: formatCoverage(venue.truthCoverage.derivativeAccountState.status, venue.truthCoverage.derivativeAccountState.reason) },
                { label: 'Derivative positions', value: formatCoverage(venue.truthCoverage.derivativePositionState.status, venue.truthCoverage.derivativePositionState.reason) },
                { label: 'Derivative health', value: formatCoverage(venue.truthCoverage.derivativeHealthState.status, venue.truthCoverage.derivativeHealthState.reason) },
                { label: 'Order/reference state', value: formatCoverage(venue.truthCoverage.orderState.status, venue.truthCoverage.orderState.reason) },
                { label: 'Execution references', value: formatCoverage(venue.truthCoverage.executionReferences.status, venue.truthCoverage.executionReferences.reason) },
              ]}
            />
          </Panel>

          <Panel subtitle="Latest account-identity truth when the connector can supply it" title="Account State">
            <DefinitionList
              items={[
                { label: 'Tracked account', value: accountState?.accountAddress ?? 'Unsupported or not configured' },
                { label: 'Account label', value: accountState?.accountLabel ?? 'None recorded' },
                { label: 'Account exists', value: accountState?.accountExists === null || accountState?.accountExists === undefined ? 'Unknown' : accountState.accountExists ? 'Yes' : 'No' },
                { label: 'Owner program', value: accountState?.ownerProgram ?? 'None recorded' },
                { label: 'Executable', value: accountState?.executable === null || accountState?.executable === undefined ? 'Unknown' : accountState.executable ? 'Yes' : 'No' },
                { label: 'Lamports', value: accountState?.lamports ?? 'None recorded' },
                { label: 'Native balance', value: accountState?.nativeBalanceDisplay ?? 'None recorded' },
                { label: 'Observed slot', value: accountState?.observedSlot ?? 'None recorded' },
              ]}
            />
          </Panel>
        </div>

        <div className="grid grid--two-column">
          <Panel subtitle="Latest typed balance snapshot captured for this venue" title="Balance State">
            {balanceState === null ? (
              <EmptyState message="This connector does not currently expose typed balance state." title="No balance state" />
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th>Asset</th>
                    <th>Type</th>
                    <th>Amount</th>
                    <th>Account</th>
                    <th>Slot</th>
                  </tr>
                </thead>
                <tbody>
                  {balanceState.balances.map((balance) => (
                    <tr key={`${balance.assetKey}:${balance.accountAddress ?? 'native'}`}>
                      <td>{balance.assetSymbol ?? balance.assetKey}</td>
                      <td>{balance.assetType}</td>
                      <td>{balance.amountDisplay}</td>
                      <td>{balance.accountAddress ?? 'Primary account'}</td>
                      <td>{balance.observedSlot ?? 'None'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Panel>

          <Panel subtitle="Latest derivative-account metadata captured without claiming venue-native decode" title="Derivative Account State">
            <DefinitionList
              items={[
                { label: 'Coverage', value: formatCoverage(venue.truthCoverage.derivativeAccountState.status, venue.truthCoverage.derivativeAccountState.reason) },
                { label: 'Venue', value: derivativeAccountState?.venue ?? 'None recorded' },
                { label: 'Account model', value: derivativeAccountState?.accountModel ?? 'No derivative account metadata' },
                { label: 'Decoded venue account', value: derivativeAccountState?.decoded ? 'Yes' : 'No' },
                { label: 'Authority', value: derivativeAccountState?.authorityAddress ?? 'Unsupported' },
                { label: 'Subaccount id', value: derivativeAccountState?.subaccountId === null || derivativeAccountState?.subaccountId === undefined ? 'Unsupported' : String(derivativeAccountState.subaccountId) },
                { label: 'Raw discriminator', value: derivativeAccountState?.rawDiscriminatorHex ?? 'None recorded' },
                { label: 'Notes', value: derivativeAccountState?.notes.join('; ') || 'None recorded' },
              ]}
            />
          </Panel>
        </div>

        <div className="grid grid--two-column">
          <Panel subtitle="Explicit venue-native derivative positions and health remain unsupported until a real decoder exists" title="Derivative Positions And Health">
            <DefinitionList
              items={[
                { label: 'Position coverage', value: formatCoverage(venue.truthCoverage.derivativePositionState.status, venue.truthCoverage.derivativePositionState.reason) },
                { label: 'Position rows', value: String(derivativePositionState?.positions.length ?? 0) },
                { label: 'Position methodology', value: derivativePositionState?.methodology ?? 'Unsupported' },
                { label: 'Position notes', value: derivativePositionState?.notes.join('; ') || 'None recorded' },
                { label: 'Health coverage', value: formatCoverage(venue.truthCoverage.derivativeHealthState.status, venue.truthCoverage.derivativeHealthState.reason) },
                { label: 'Health status', value: derivativeHealthState?.healthStatus ?? 'Unsupported' },
                { label: 'Margin ratio', value: derivativeHealthState?.marginRatio ?? 'Unsupported' },
                { label: 'Free collateral', value: derivativeHealthState?.freeCollateralUsd ?? 'Unsupported' },
                { label: 'Health methodology', value: derivativeHealthState?.methodology ?? 'Unsupported' },
              ]}
            />
          </Panel>

          <Panel subtitle="Reference-only order context and recent on-chain signatures when available" title="Order And References">
            <DefinitionList
              items={[
                { label: 'Exposure methodology', value: exposureState?.methodology ?? 'Unsupported' },
                { label: 'Exposure rows', value: String(exposureState?.exposures.length ?? 0) },
                { label: 'Order coverage', value: formatCoverage(venue.truthCoverage.orderState.status, venue.truthCoverage.orderState.reason) },
                { label: 'Order reference mode', value: orderState?.referenceMode ?? 'none' },
                { label: 'Order methodology', value: orderState?.methodology ?? 'Unsupported' },
                { label: 'Order/reference rows', value: String(orderState?.openOrders.length ?? 0) },
                { label: 'Order notes', value: orderState?.notes.join('; ') || 'None recorded' },
                { label: 'Execution refs coverage', value: formatCoverage(venue.truthCoverage.executionReferences.status, venue.truthCoverage.executionReferences.reason) },
                { label: 'Recent references', value: String(executionReferenceState?.references.length ?? 0) },
                { label: 'Lookback limit', value: String(executionReferenceState?.referenceLookbackLimit ?? 0) },
              ]}
            />
            {orderState !== null && orderState.openOrders.length > 0 ? (
              <table className="table">
                <thead>
                  <tr>
                    <th>Reference</th>
                    <th>Status</th>
                    <th>Placed at</th>
                    <th>Slot</th>
                  </tr>
                </thead>
                <tbody>
                  {orderState.openOrders.slice(0, 5).map((order) => (
                    <tr key={order.reference ?? `${order.placedAt ?? 'unknown'}:${order.slot ?? 'unknown'}`}>
                      <td>{order.reference ?? order.venueOrderId ?? 'Unknown reference'}</td>
                      <td>{order.status}</td>
                      <td>{formatDateTime(order.placedAt)}</td>
                      <td>{order.slot ?? 'None'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : executionReferenceState !== null && executionReferenceState.references.length > 0 ? (
                <table className="table">
                  <thead>
                    <tr>
                      <th>Reference</th>
                      <th>Status</th>
                      <th>Block time</th>
                      <th>Slot</th>
                    </tr>
                  </thead>
                  <tbody>
                    {executionReferenceState.references.slice(0, 5).map((reference) => (
                      <tr key={reference.reference}>
                        <td>{reference.reference}</td>
                        <td>{reference.confirmationStatus ?? (reference.errored ? 'errored' : 'unknown')}</td>
                        <td>{formatDateTime(reference.blockTime)}</td>
                        <td>{reference.slot ?? 'None'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : null}
          </Panel>
        </div>

        <Panel subtitle="Persisted snapshot history for this connector" title="Snapshot History">
          {snapshots.length === 0 ? (
            <EmptyState message="No snapshots are available for this venue yet." title="No snapshots" />
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Captured</th>
                  <th>Type</th>
                  <th>Completeness</th>
                  <th>Health</th>
                  <th>Summary</th>
                  <th>Error</th>
                </tr>
              </thead>
              <tbody>
                {snapshots.map((snapshot) => (
                  <tr key={snapshot.id}>
                    <td>{formatDateTime(snapshot.capturedAt)}</td>
                    <td>{snapshot.snapshotType}</td>
                    <td>{snapshot.snapshotCompleteness}</td>
                    <td><StatusBadge label={snapshot.healthState} tone={toneForHealthState(snapshot.healthState)} /></td>
                    <td>{snapshot.snapshotSummary}</td>
                    <td>{snapshot.errorMessage ?? 'None'}</td>
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
