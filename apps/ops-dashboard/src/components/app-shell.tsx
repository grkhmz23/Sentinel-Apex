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
                <p className="eyebrow">Vercel Dashboard</p>
                <h1>Protocol Ops Console</h1>
                <p className="sidebar__brand-note">
                  Read-through control surface for Render-backed runtime truth and Drift devnet evidence.
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
                <p className="eyebrow">Sentinel Apex</p>
                <h2>Execution truth stays server-side.</h2>
                <p className="shell-topbar__summary">
                  Frontend mutations proxy to the backend API. Long-running runtime control, reconciliation,
                  and venue-native Drift evidence ingestion stay in Render services only.
                </p>
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
