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
  const latestSdkEvidence = sdkEvidence[0] ?? null;
  const recentSdkEvidence = sdkEvidence.slice(0, 5);

  return (
    <AppShell session={session}>
      <div className="page">
        <header className="page__header page__header--hero">
          <div className="page__header-copy">
            <p className="eyebrow">Phase Encrypt-2B</p>
            <h1>Sentinel Apex Private PUSD Treasury Vault — PUSD + Encrypt Pre-Alpha</h1>
            <p className="page__summary">
              Encrypt pre-alpha SDK demo — non-sensitive inputs only. PUSD remains the vault asset,
              and this page proves a controlled SDK touchpoint without production privacy claims.
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
            detail={`Cluster ${status.cluster}; endpoint ${status.grpcEndpointHost ?? 'not configured'}`}
            label="SDK mode"
            tone={status.enabled ? 'warn' : 'neutral'}
            value={status.sdkMode}
          />
          <MetricCard
            detail={`Program ${status.programId ?? 'not configured'}`}
            label="SDK configured"
            tone={status.sdkConfigured ? 'warn' : 'neutral'}
            value={status.sdkConfigured ? 'yes' : 'no'}
          />
          <MetricCard
            detail="No production confidentiality guarantees in pre-alpha"
            label="productionPrivacyReady"
            tone="bad"
            value={String(status.productionPrivacyReady)}
          />
          <MetricCard
            detail="No signing or sendTransaction for PUSD movement"
            label="realEncryption"
            tone="bad"
            value={String(status.realEncryption)}
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
            <div className="stack">
              <section>
                <h2>SDK Demo Result</h2>
                {latestSdkEvidence === null ? (
                  <EmptyState message="No SDK demo result is available." title="No result" />
                ) : (
                  <DefinitionList
                    items={[
                      { label: 'Status', value: <StatusBadge label={latestSdkEvidence.success ? 'success' : 'failed'} tone={latestSdkEvidence.success ? 'good' : 'bad'} /> },
                      { label: 'Ciphertext identifiers', value: latestSdkEvidence.ciphertextIdentifiers.length === 0 ? 'none' : latestSdkEvidence.ciphertextIdentifiers.join(', ') },
                      { label: 'Strategy commitment', value: latestSdkEvidence.strategyCommitment },
                      { label: 'Timestamp', value: formatDateTime(latestSdkEvidence.requestedAt) },
                      { label: 'Sanitized error', value: latestSdkEvidence.errorMessage ?? 'none' },
                    ]}
                  />
                )}
              </section>
            <TableSurface caption="Encrypt SDK pre-alpha demo evidence">
              <table className="table">
                <thead>
                  <tr>
                    <th>SDK mode</th>
                    <th>Status</th>
                    <th>Created at</th>
                    <th>Ciphertext identifiers</th>
                    <th>Strategy commitment</th>
                    <th>Sanitized error</th>
                  </tr>
                </thead>
                <tbody>
                  {recentSdkEvidence.map((event) => (
                    <tr key={`${event.strategyId}-${event.requestedAt}`}>
                      <td>{event.sdkMode}</td>
                      <td>
                        <StatusBadge label={event.success ? 'success' : 'failed'} tone={event.success ? 'good' : 'bad'} />
                      </td>
                      <td>{formatDateTime(event.requestedAt)}</td>
                      <td>{event.ciphertextIdentifiers.length === 0 ? 'none' : event.ciphertextIdentifiers.join(', ')}</td>
                      <td>{event.strategyCommitment}</td>
                      <td>{event.errorMessage ?? 'none'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableSurface>
            </div>
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
