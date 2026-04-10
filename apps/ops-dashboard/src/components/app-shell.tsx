import Image from 'next/image';
import Link from 'next/link';

import { DeploymentTruthBanner } from './deployment-truth-banner';
import { OperatorProvider } from './operator-context';
import { OperatorSettings } from './operator-settings';
import { SidebarNav } from './sidebar-nav';

import type { DashboardSession } from '../lib/operator-session';

export function AppShell(
  { children, session }: { children: React.ReactNode; session: DashboardSession },
): JSX.Element {
  return (
    <OperatorProvider session={session}>
      <div className="app-shell">
        <aside className="sidebar">
          <div className="sidebar__top">
            <Link className="sidebar__brand" href="/">
              <div className="sidebar__brand-chip-row">
                <span className="sidebar__brand-chip">Operator Console</span>
                <span className="sidebar__brand-chip sidebar__brand-chip--muted">{session.operator.role}</span>
              </div>
              <div className="sidebar__brand-logo-wrap">
                <Image
                  alt="Sentinel Apex"
                  className="sidebar__brand-logo"
                  height={56}
                  priority
                  src="/logo.png"
                  width={208}
                />
              </div>
              <div className="sidebar__brand-copy">
                <p className="eyebrow">Render + Vercel Split</p>
                <h1>Protocol Ops Console</h1>
                <p className="sidebar__brand-note">
                  Luxury control surface for runtime truth, allocator posture, and evidence-backed operator decisions.
                </p>
              </div>
            </Link>

            <div className="sidebar__telemetry">
              <div className="sidebar__telemetry-dot" aria-hidden="true" />
              <div>
                <p className="panel__label">System telemetry</p>
                <p className="sidebar__telemetry-title">Frontend connected</p>
                <p className="panel__hint">UI never runs execution loops or venue subscribers.</p>
              </div>
            </div>
          </div>

          <div className="sidebar__body">
            <SidebarNav />
          </div>

          <div className="sidebar__footer">
            <OperatorSettings />
          </div>
        </aside>
        <main className="content">
          <div className="content__frame">
            <header className="shell-topbar">
              <div className="shell-topbar__copy">
                <p className="eyebrow">Server-Side Execution Integrity</p>
                <h2>Execution truth stays server-side.</h2>
                <p className="shell-topbar__summary">
                  Frontend mutations proxy to the backend API. Long-running runtime control, reconciliation,
                  and venue-native Drift evidence ingestion stay in Render services only.
                </p>
              </div>
              <div className="shell-topbar__meta">
                <div className="shell-topbar__stat">
                  <span className="shell-topbar__stat-label">Operator</span>
                  <strong>{session.operator.displayName}</strong>
                  <span className="shell-topbar__stat-detail">{session.operator.email}</span>
                </div>
                <div className="shell-topbar__stat">
                  <span className="shell-topbar__stat-label">Session</span>
                  <strong>{session.operator.active ? 'Active' : 'Inactive'}</strong>
                  <span className="shell-topbar__stat-detail">Expires {session.expiresAt}</span>
                </div>
              </div>
            </header>
            <DeploymentTruthBanner compact />
            {children}
          </div>
        </main>
      </div>
    </OperatorProvider>
  );
}
