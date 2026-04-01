import Link from 'next/link';

import { OperatorProvider } from './operator-context';
import { OperatorSettings } from './operator-settings';

import type { DashboardSession } from '../lib/operator-session';

const navigation = [
  { href: '/', label: 'Overview' },
  { href: '/allocator', label: 'Allocator' },
  { href: '/allocator/escalations', label: 'Escalations' },
  { href: '/carry', label: 'Carry' },
  { href: '/mismatches', label: 'Mismatches' },
  { href: '/reconciliation', label: 'Reconciliation' },
  { href: '/treasury', label: 'Treasury' },
  { href: '/venues', label: 'Venues' },
  { href: '/operations', label: 'Operations' },
];

export function AppShell(
  { children, session }: { children: React.ReactNode; session: DashboardSession },
): JSX.Element {
  return (
    <OperatorProvider session={session}>
      <div className="app-shell">
        <aside className="sidebar">
          <div className="sidebar__brand">
            <p className="eyebrow">Sentinel Apex</p>
            <h1>Ops Dashboard</h1>
          </div>
          <nav className="sidebar__nav" aria-label="Primary">
            {navigation.map((item) => (
              <Link className="sidebar__link" href={item.href} key={item.href}>
                {item.label}
              </Link>
            ))}
          </nav>
          <OperatorSettings />
        </aside>
        <main className="content">
          {children}
        </main>
      </div>
    </OperatorProvider>
  );
}
