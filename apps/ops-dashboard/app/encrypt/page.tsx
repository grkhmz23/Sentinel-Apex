import { AppShell } from '../../src/components/app-shell';
import { DefinitionList } from '../../src/components/definition-list';
import { EmptyState } from '../../src/components/empty-state';
import { EncryptSdkDemoActions } from '../../src/components/encrypt-sdk-demo-actions';
import { ErrorState } from '../../src/components/error-state';
import { MetricCard } from '../../src/components/metric-card';
import { Panel } from '../../src/components/panel';
import { StatusBadge } from '../../src/components/status-badge';
import { TableSurface } from '../../src/components/table-surface';
import { requireDashboardSession } from '../../src/lib/auth.server';
import { formatDateTime } from '../../src/lib/format';
import { loadEncryptPageData } from '../../src/lib/runtime-api.server';

export const dynamic = 'force-dynamic';

export default async function EncryptPage(): Promise<JSX.Element> {
  const session = await requireDashboardSession('/encrypt');
  const state = await loadEncryptPageData();

  if (state.error !== null || state.data === null) {
    return (
      <AppShell session={session}>
        <ErrorState message={state.error ?? 'Encrypt pre-alpha unavailable.'} title="Encrypt unavailable" />
      </AppShell>
    );
  }

  const { status, strategyState, auditEvents, sdkEvidence } = state.data;
  const ciphertextRefs = strategyState?.ciphertextRefs ?? {};

  return (
    <AppShell session={session}>
      <div className="page">
        <header className="page__header page__header--hero">
          <div className="page__header-copy">
            <p className="eyebrow">Phase Encrypt-2A</p>
            <h1>Sentinel Apex Private PUSD Treasury Vault — PUSD + Encrypt Pre-Alpha</h1>
            <p className="page__summary">
              PUSD remains the vault asset. Encrypt is wired as a pre-alpha confidential strategy-state
              layer with ciphertext references and commitments. Production privacy is not ready.
            </p>
            <div className="page__header-meta">
              <StatusBadge label={status.enabled ? 'Encrypt enabled' : 'Encrypt disabled'} tone={status.enabled ? 'warn' : 'neutral'} />
              <StatusBadge label="pre-alpha" tone="warn" />
              <StatusBadge label="productionPrivacyReady=false" tone="bad" />
            </div>
          </div>
        </header>

        <div className="metric-grid">
          <MetricCard
            detail={`Cluster ${status.cluster}`}
            label="Encrypt posture"
            tone={status.enabled ? 'warn' : 'neutral'}
            value={status.enabled ? 'Enabled' : 'Disabled'}
          />
          <MetricCard
            detail="No production confidentiality guarantees in pre-alpha"
            label="Production privacy"
            tone="bad"
            value="Not ready"
          />
          <MetricCard
            detail={strategyState === null ? 'No strategy commitment yet' : strategyState.strategyCommitment}
            label="Strategy commitment"
            tone="accent"
            value={strategyState === null ? 'Missing' : 'Present'}
          />
          <MetricCard
            detail="No signing or sendTransaction for PUSD movement"
            label="Execution posture"
            tone="bad"
            value="Disabled"
          />
        </div>

        <div className="grid grid--metrics">
          <Panel subtitle="Current Encrypt SDK posture exposed to operators" title="Pre-Alpha Capabilities">
            <DefinitionList
              items={[
                { label: 'preAlphaMode', value: String(status.preAlphaMode) },
                { label: 'productionPrivacyReady', value: String(status.productionPrivacyReady) },
                { label: 'realEncryption', value: String(status.realEncryption) },
                { label: 'SDK mode', value: status.sdkMode },
                { label: 'SDK available', value: String(status.sdkAvailable) },
                { label: 'SDK configured', value: String(status.sdkConfigured) },
                { label: 'gRPC endpoint host', value: status.grpcEndpointHost ?? 'not configured' },
                { label: 'program id', value: status.programId ?? 'not configured' },
                { label: 'ciphertext accounts', value: String(status.capabilities.supportsCiphertextAccounts) },
                { label: 'graph execution', value: String(status.capabilities.supportsGraphExecution) },
                { label: 'threshold decrypt', value: String(status.capabilities.supportsThresholdDecrypt) },
              ]}
            />
          </Panel>

          <Panel subtitle="Public facts retained for auditability" title="Public Strategy State">
            {strategyState === null ? (
              <EmptyState message="Run a PUSD cycle with Encrypt enabled to create pre-alpha strategy state." title="No Encrypt state" />
            ) : (
              <DefinitionList
                items={[
                  { label: 'Strategy id', value: strategyState.strategyId },
                  { label: 'Vault asset', value: strategyState.vaultAssetSymbol },
                  { label: 'PUSD mint', value: strategyState.vaultAssetMint },
                  { label: 'Ciphertext status', value: <StatusBadge label={strategyState.ciphertextStatus} tone="accent" /> },
                  { label: 'Risk status', value: strategyState.publicRiskStatus },
                  { label: 'Updated', value: formatDateTime(strategyState.updatedAt) },
                ]}
              />
            )}
          </Panel>
        </div>

        <Panel subtitle="Real SDK touchpoint using fixed, non-sensitive demo values only" title="Encrypt SDK Pre-Alpha Demo">
          <div className="grid grid--two-column">
            <DefinitionList
              items={[
                { label: 'SDK mode', value: status.sdkMode },
                { label: 'Configured', value: status.sdkConfigured ? 'yes' : 'no' },
                { label: 'Available', value: status.sdkAvailable ? 'yes' : 'no' },
                { label: 'productionPrivacyReady', value: String(status.productionPrivacyReady) },
                { label: 'realEncryption', value: String(status.realEncryption) },
                { label: 'Warning', value: 'Demo inputs only. Do not use real treasury values. Pre-alpha SDK path proves integration, not production privacy.' },
              ]}
            />
            <div className="stack">
              <EncryptSdkDemoActions />
              <p className="muted">
                Operator API: POST /api/v1/encrypt/sdk-demo/create-input. The endpoint uses a fixed
                demo input builder and rejects arbitrary plaintext strategy payloads.
              </p>
            </div>
          </div>
          {sdkEvidence.length === 0 ? (
            <EmptyState message="No Encrypt SDK pre-alpha demo evidence is persisted yet." title="No SDK demo evidence" />
          ) : (
            <TableSurface caption="Encrypt SDK pre-alpha demo evidence">
              <table className="table">
                <thead>
                  <tr>
                    <th>Status</th>
                    <th>Ciphertext identifiers</th>
                    <th>Timestamp</th>
                    <th>Evidence</th>
                  </tr>
                </thead>
                <tbody>
                  {sdkEvidence.map((event) => (
                    <tr key={`${event.strategyId}-${event.requestedAt}`}>
                      <td>
                        <StatusBadge label={event.success ? 'success' : 'failed'} tone={event.success ? 'good' : 'bad'} />
                      </td>
                      <td>{event.ciphertextIdentifiers.length === 0 ? 'none' : event.ciphertextIdentifiers.join(', ')}</td>
                      <td>{formatDateTime(event.requestedAt)}</td>
                      <td>{event.errorMessage ?? 'SDK demo input created'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableSurface>
          )}
        </Panel>

        <div className="grid grid--two-column">
          <Panel subtitle="Private-by-design strategy fields are represented only by pre-alpha references" title="Public / Private Split">
            <DefinitionList
              items={[
                { label: 'Public', value: 'strategy id, vault asset, commitment, ciphertext refs, status, risk status, audit evidence' },
                { label: 'Private by design', value: 'balance bucket, allocation weights, risk thresholds, rebalance threshold, pending amount, simulated exposure, movement limits' },
                { label: 'Demo warning', value: 'pre-alpha demo plaintext — not production privacy' },
              ]}
            />
          </Panel>

          <Panel subtitle="Ciphertext identifiers produced by the pre-alpha adapter" title="Ciphertext References">
            {Object.keys(ciphertextRefs).length === 0 ? (
              <EmptyState message="No ciphertext references are persisted yet." title="No ciphertext refs" />
            ) : (
              <TableSurface caption="Encrypt pre-alpha ciphertext references">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Field</th>
                      <th>Reference</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(ciphertextRefs).map(([field, ref]) => (
                      <tr key={field}>
                        <td>{field}</td>
                        <td>{String(ref)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TableSurface>
            )}
          </Panel>
        </div>

        <Panel subtitle="Encrypt strategy-state audit evidence and reveal requests" title="Audit Evidence">
          {auditEvents.length === 0 ? (
            <EmptyState message="No Encrypt pre-alpha audit events are persisted yet." title="No audit evidence" />
          ) : (
            <div className="event-feed">
              {auditEvents.map((event) => (
                <article className="event-feed__item" key={event.eventId}>
                  <div className="event-feed__row">
                    <div>
                      <p className="event-feed__title">{event.eventType}</p>
                      <p className="event-feed__detail">{event.actorId} at {formatDateTime(event.occurredAt)}</p>
                    </div>
                    <StatusBadge label="recorded" tone="good" />
                  </div>
                </article>
              ))}
            </div>
          )}
        </Panel>
      </div>
    </AppShell>
  );
}
