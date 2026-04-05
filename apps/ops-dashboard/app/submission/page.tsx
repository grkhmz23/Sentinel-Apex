import type {
  SubmissionCheckStatus,
  SubmissionEvidenceRecordView,
  SubmissionReadinessStatus,
} from '@sentinel-apex/runtime';

import { AppShell } from '../../src/components/app-shell';
import { DefinitionList } from '../../src/components/definition-list';
import { ErrorState } from '../../src/components/error-state';
import { Panel } from '../../src/components/panel';
import { StatusBadge } from '../../src/components/status-badge';
import { requireDashboardSession } from '../../src/lib/auth.server';
import { formatDateTime } from '../../src/lib/format';
import { loadSubmissionPageData } from '../../src/lib/runtime-api.server';

export const dynamic = 'force-dynamic';

function submissionReadinessTone(
  status: SubmissionReadinessStatus,
): 'good' | 'warn' | 'bad' {
  switch (status) {
    case 'ready':
      return 'good';
    case 'partial':
      return 'warn';
    default:
      return 'bad';
  }
}

function submissionCheckTone(
  status: SubmissionCheckStatus,
): 'good' | 'warn' | 'bad' {
  switch (status) {
    case 'pass':
      return 'good';
    case 'warning':
      return 'warn';
    default:
      return 'bad';
  }
}

function formatTrack(track: string): string {
  return track === 'drift_side_track' ? 'Drift Side Track' : 'Build-A-Bear Main Track';
}

function formatAddressScope(scope: string): string {
  switch (scope) {
    case 'wallet':
      return 'Wallet only';
    case 'vault':
      return 'Vault only';
    case 'both':
      return 'Wallet + vault';
    default:
      return 'Unconfigured';
  }
}

function formatEvidenceType(type: SubmissionEvidenceRecordView['evidenceType']): string {
  switch (type) {
    case 'on_chain_transaction':
      return 'On-chain transaction';
    case 'performance_snapshot':
      return 'Performance snapshot';
    case 'cex_trade_history':
      return 'CEX trade history';
    case 'cex_read_only_api':
      return 'CEX read-only API';
    default:
      return 'Document';
  }
}

export default async function SubmissionPage(): Promise<JSX.Element> {
  const session = await requireDashboardSession('/submission');
  const state = await loadSubmissionPageData();

  if (state.error !== null || state.data === null) {
    return (
      <AppShell session={session}>
        <ErrorState message={state.error ?? 'Submission dossier unavailable.'} title="Submission unavailable" />
      </AppShell>
    );
  }

  const { dossier, evidence, exportBundle } = state.data;

  return (
    <AppShell session={session}>
      <div className="page">
        <header className="page__header">
          <div>
            <p className="eyebrow">Hackathon</p>
            <h1>Submission Dossier</h1>
          </div>
        </header>

        <div className="grid grid--two-column">
          <Panel
            subtitle="Canonical track, build window, address scope, and latest verifiable execution evidence"
            title="Submission Profile"
          >
            <DefinitionList
              items={[
                { label: 'Track', value: formatTrack(dossier.track) },
                {
                  label: 'Readiness',
                  value: (
                    <StatusBadge
                      label={dossier.readiness.status}
                      tone={submissionReadinessTone(dossier.readiness.status)}
                    />
                  ),
                },
                { label: 'Strategy', value: dossier.strategyName },
                { label: 'Vault', value: dossier.vaultName },
                { label: 'Base asset', value: dossier.baseAsset },
                { label: 'Build window start', value: formatDateTime(dossier.buildWindowStart) },
                { label: 'Build window end', value: formatDateTime(dossier.buildWindowEnd) },
                { label: 'Cluster', value: dossier.cluster },
                { label: 'Address scope', value: formatAddressScope(dossier.addressScope) },
                {
                  label: 'Wallet address',
                  value: dossier.walletAddress === null ? 'Not configured' : dossier.walletAddress,
                },
                {
                  label: 'Vault address',
                  value: dossier.vaultAddress === null ? 'Not configured' : dossier.vaultAddress,
                },
                {
                  label: 'Latest execution reference',
                  value: dossier.latestExecutionReference ?? 'Not recorded',
                },
                {
                  label: 'Latest execution at',
                  value: formatDateTime(dossier.latestExecutionAt),
                },
                {
                  label: 'Real executions in window',
                  value: String(dossier.realExecutionCountInWindow),
                },
                {
                  label: 'Simulated executions in window',
                  value: String(dossier.simulatedExecutionCountInWindow),
                },
                {
                  label: 'Realized APY',
                  value: dossier.realizedApyPct === null ? 'Unavailable' : `${dossier.realizedApyPct}%`,
                },
                {
                  label: 'CEX execution',
                  value: dossier.cexExecutionUsed ? 'Yes' : 'No',
                },
              ]}
            />
            <p className="panel__hint">{dossier.readiness.summary}</p>
            <div className="stack stack--compact">
              {dossier.walletVerificationUrl === null ? null : (
                <a href={dossier.walletVerificationUrl} rel="noreferrer" target="_blank">Open wallet in Solscan</a>
              )}
              {dossier.vaultVerificationUrl === null ? null : (
                <a href={dossier.vaultVerificationUrl} rel="noreferrer" target="_blank">Open vault in Solscan</a>
              )}
              {dossier.latestExecutionReferenceUrl === null ? null : (
                <a href={dossier.latestExecutionReferenceUrl} rel="noreferrer" target="_blank">Open latest transaction in Solscan</a>
              )}
            </div>
          </Panel>

          <Panel
            subtitle="Each requirement is checked against persisted strategy, vault, and execution evidence"
            title="Readiness Checks"
          >
            <div className="stack">
              {dossier.readiness.checks.map((check) => (
                <p
                  className={check.status === 'pass' ? 'feedback feedback--success' : 'feedback feedback--warning'}
                  key={check.key}
                >
                  <StatusBadge label={check.status} tone={submissionCheckTone(check.status)} /> {check.summary}
                </p>
              ))}
              {dossier.readiness.blockedReasons.length === 0 ? null : (
                <p className="feedback feedback--error">
                  Blocked reasons: {dossier.readiness.blockedReasons.join(', ')}
                </p>
              )}
            </div>
          </Panel>
        </div>

        <div className="grid grid--two-column">
          <Panel
            subtitle="These are the scopes the repo can actually support and prove today"
            title="Supported Scope"
          >
            <div className="stack">
              {dossier.supportedScope.map((item) => (
                <p className="feedback feedback--success" key={item}>{item}</p>
              ))}
            </div>
          </Panel>

          <Panel
            subtitle="These boundaries still block a truthful Main Track submission"
            title="Blocked Scope"
          >
            <div className="stack">
              {dossier.blockedScope.map((item) => (
                <p className="feedback feedback--warning" key={item}>{item}</p>
              ))}
              {dossier.notes === null ? null : <p className="panel__hint">{dossier.notes}</p>}
            </div>
          </Panel>
        </div>

        <div className="grid grid--two-column">
          <Panel
            subtitle="Explicit artifacts recorded for hackathon review and verification"
            title="Verification Evidence"
          >
            <div className="stack">
              {evidence.length === 0 ? (
                <p className="feedback feedback--warning">
                  No explicit verification artifacts have been recorded yet.
                </p>
              ) : (
                evidence.map((item) => (
                  <div className="stack stack--compact" key={item.evidenceId}>
                    <p className="feedback feedback--success">
                      <StatusBadge
                        label={item.status}
                        tone={item.status === 'rejected' ? 'bad' : 'good'}
                      /> {formatEvidenceType(item.evidenceType)}: {item.label}
                    </p>
                    {item.summary === null ? null : <p>{item.summary}</p>}
                    <p className="panel__hint">
                      Captured: {formatDateTime(item.capturedAt)} | In build window:{' '}
                      {item.withinBuildWindow ? 'yes' : 'no'}
                    </p>
                    {item.url === null ? null : (
                      <a href={item.url} rel="noreferrer" target="_blank">
                        Open evidence link
                      </a>
                    )}
                  </div>
                ))
              )}
            </div>
          </Panel>

          <Panel
            subtitle="Judge-facing checklist derived from dossier state and explicit evidence attachments"
            title="Export Bundle"
          >
            <p className="panel__hint">{exportBundle.judgeSummary}</p>
            <div className="stack">
              {exportBundle.artifactChecklist.map((item) => (
                <p
                  className={item.status === 'pass' ? 'feedback feedback--success' : 'feedback feedback--warning'}
                  key={item.key}
                >
                  <StatusBadge label={item.status} tone={submissionCheckTone(item.status)} />{' '}
                  {item.label}: {item.summary}
                </p>
              ))}
              {exportBundle.verificationLinks.map((link) => (
                <a href={link} key={link} rel="noreferrer" target="_blank">
                  {link}
                </a>
              ))}
            </div>
          </Panel>
        </div>
      </div>
    </AppShell>
  );
}
