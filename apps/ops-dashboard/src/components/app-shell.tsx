import Link from 'next/link';

import { OperatorProvider } from './operator-context';
import { OperatorSettings } from './operator-settings';

const navigation = [
  { href: '/', label: 'Overview' },
  { href: '/mismatches', label: 'Mismatches' },
  { href: '/reconciliation', label: 'Reconciliation' },
  { href: '/operations', label: 'Operations' },
];

export function AppShell(
  { children, defaultActorId }: { children: React.ReactNode; defaultActorId: string },
): JSX.Element {
  return (
    <OperatorProvider defaultActorId={defaultActorId}>
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
