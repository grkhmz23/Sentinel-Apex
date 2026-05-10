import { AppShell } from '../../src/components/app-shell';
import { DefinitionList } from '../../src/components/definition-list';
import { EmptyState } from '../../src/components/empty-state';
import { ErrorState } from '../../src/components/error-state';
import { MetricCard } from '../../src/components/metric-card';
import { Panel } from '../../src/components/panel';
import { StatusBadge } from '../../src/components/status-badge';
import { TableSurface } from '../../src/components/table-surface';
import { requireDashboardSession } from '../../src/lib/auth.server';
import { formatDateTime } from '../../src/lib/format';
import { loadPusdPageData } from '../../src/lib/runtime-api.server';

export const dynamic = 'force-dynamic';

function formatPusd(value: string | null | undefined): string {
  if (value === null || value === undefined) {
    return '0 PUSD';
  }
  const numeric = Number(value);
  return Number.isFinite(numeric)
    ? `${numeric.toLocaleString(undefined, { maximumFractionDigits: 6 })} PUSD`
    : `${value} PUSD`;
}

export default async function PusdPage(): Promise<JSX.Element> {
  const session = await requireDashboardSession('/pusd');
  const state = await loadPusdPageData();

  if (state.error !== null || state.data === null) {
    return (
      <AppShell session={session}>
        <ErrorState message={state.error ?? 'PUSD vault unavailable.'} title="PUSD vault unavailable" />
      </AppShell>
    );
  }

  const { vault, snapshots, intents, auditEvents } = state.data;
  const latestBalance = vault.balance;

  return (
    <AppShell session={session}>
      <div className="page">
        <header className="page__header page__header--hero">
          <div className="page__header-copy">
            <p className="eyebrow">Phase PUSD-1</p>
            <h1>Sentinel Apex Private PUSD Treasury Vault</h1>
            <p className="page__summary">
              PUSD-denominated vault accounting, read-only balance evidence, dry-run treasury strategy,
              and operator intent workflow. Live execution is disabled.
            </p>
            <div className="page__header-meta">
              <StatusBadge label="simulation/dry-run" tone="warn" />
              <StatusBadge label="live execution disabled" tone="bad" />
              <StatusBadge label={vault.runtimeMode} tone={vault.runtimeMode === 'dry-run' ? 'good' : 'warn'} />
            </div>
          </div>
        </header>

        <div className="metric-grid">
          <MetricCard
            detail={`Mint ${vault.baseAssetMint}`}
            label="PUSD balance"
            tone={latestBalance?.readStatus === 'ok' ? 'good' : 'warn'}
            value={formatPusd(latestBalance?.balanceAmount)}
          />
          <MetricCard
            detail={`Decimals ${vault.baseAssetDecimals}`}
            label="PUSD NAV"
            tone="accent"
            value={formatPusd(latestBalance?.navAmount)}
          />
          <MetricCard
            detail={latestBalance === null ? 'No snapshot captured yet.' : `Captured ${formatDateTime(latestBalance.capturedAt)}`}
            label="Balance reader"
            tone={latestBalance?.readStatus === 'ok' ? 'good' : 'warn'}
            value={<StatusBadge label={latestBalance?.readStatus ?? 'missing'} tone={latestBalance?.readStatus === 'ok' ? 'good' : 'warn'} />}
          />
          <MetricCard
            detail="No signing or sendTransaction path is enabled"
            label="Execution posture"
            tone="bad"
            value="Disabled"
          />
        </div>

        <div className="grid grid--metrics">
          <Panel subtitle="Configured vault base asset and read-only balance scope" title="Vault Configuration">
            <DefinitionList
              items={[
                { label: 'Base asset', value: vault.baseAsset },
                { label: 'PUSD mint', value: vault.baseAssetMint },
                { label: 'Decimals', value: String(vault.baseAssetDecimals) },
                { label: 'Vault owner', value: vault.vaultOwnerAddress ?? 'Not configured' },
                { label: 'Signing', value: vault.safety.signingEnabled ? 'Enabled' : 'Disabled' },
                { label: 'sendTransaction', value: vault.safety.sendTransactionEnabled ? 'Enabled' : 'Disabled' },
              ]}
            />
          </Panel>

          <Panel subtitle="Latest treasury state, denominated for PUSD accounting" title="Treasury State">
            {vault.latestTreasuryState === null ? (
              <EmptyState message="No PUSD treasury evaluation has been persisted yet." title="No treasury state" />
            ) : (
              <DefinitionList
                items={[
                  { label: 'Mode', value: <StatusBadge label={vault.latestTreasuryState.simulated ? 'simulation/dry-run' : 'live'} tone={vault.latestTreasuryState.simulated ? 'warn' : 'bad'} /> },
                  { label: 'Idle PUSD', value: formatPusd(vault.latestTreasuryState.reserveStatus.idleCapitalUsd) },
                  { label: 'Allocated PUSD', value: formatPusd(vault.latestTreasuryState.reserveStatus.allocatedCapitalUsd) },
                  { label: 'Reserve shortfall', value: formatPusd(vault.latestTreasuryState.reserveStatus.reserveShortfallUsd) },
                  { label: 'Actions', value: String(vault.latestTreasuryState.actionCount) },
                  { label: 'Updated', value: formatDateTime(vault.latestTreasuryState.updatedAt) },
                ]}
              />
            )}
          </Panel>
        </div>

        <div className="grid grid--two-column">
          <Panel subtitle="Operator-created PUSD deposit, withdrawal, and rebalance intents" title="Operator Intents">
            {intents.length === 0 ? (
              <EmptyState message="No PUSD operator intents are persisted yet." title="No intents" />
            ) : (
              <TableSurface caption="PUSD operator intents">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Type</th>
                      <th>Amount</th>
                      <th>Status</th>
                      <th>Requested By</th>
                      <th>Created</th>
                    </tr>
                  </thead>
                  <tbody>
                    {intents.map((intent) => (
                      <tr key={intent.intentId}>
                        <td>{intent.intentType}</td>
                        <td>{formatPusd(intent.amount)}</td>
                        <td><StatusBadge label={intent.status} tone="accent" /></td>
                        <td>{intent.requestedBy}</td>
                        <td>{formatDateTime(intent.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TableSurface>
            )}
          </Panel>

          <Panel subtitle="PUSD config, snapshot, operator intent, and runtime audit events" title="Audit Evidence">
            {auditEvents.length === 0 ? (
              <EmptyState message="No PUSD audit events are available yet." title="No audit evidence" />
            ) : (
              <div className="event-feed">
                {auditEvents.map((event) => (
                  <article className="event-feed__item" key={event.eventId}>
                    <div className="event-feed__row">
                      <div>
                        <p className="event-feed__title">{event.eventType}</p>
                        <p className="event-feed__detail">{event.actorType} {event.actorId} at {formatDateTime(event.occurredAt)}</p>
                      </div>
                      <StatusBadge label="recorded" tone="good" />
                    </div>
                  </article>
                ))}
              </div>
            )}
          </Panel>
        </div>

        <div className="grid">
          <Panel subtitle="Read-only PUSD token balance snapshots" title="Snapshots">
            {snapshots.length === 0 ? (
              <EmptyState message="No PUSD snapshots have been captured yet." title="No snapshots" />
            ) : (
              <TableSurface caption="PUSD vault snapshots">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Captured</th>
                      <th>Balance</th>
                      <th>NAV</th>
                      <th>Risk</th>
                      <th>Read Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {snapshots.map((snapshot) => (
                      <tr key={snapshot.snapshotId}>
                        <td>{formatDateTime(snapshot.capturedAt)}</td>
                        <td>{formatPusd(snapshot.balanceAmount)}</td>
                        <td>{formatPusd(snapshot.navAmount)}</td>
                        <td>{snapshot.riskStatus}</td>
                        <td><StatusBadge label={snapshot.readStatus} tone={snapshot.readStatus === 'ok' ? 'good' : 'warn'} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TableSurface>
            )}
          </Panel>
        </div>
      </div>
    </AppShell>
  );
}
