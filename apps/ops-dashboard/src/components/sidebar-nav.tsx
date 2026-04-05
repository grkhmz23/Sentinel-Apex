'use client';

import Link from 'next/link';

import { useOptionalPathname } from '../lib/navigation-hooks';

interface NavigationItem {
  href: string;
  label: string;
  matches?: string[];
}

interface NavigationSection {
  title: string;
  items: NavigationItem[];
}

const navigation: NavigationSection[] = [
  {
    title: 'Control Plane',
    items: [
      { href: '/', label: 'Overview' },
      { href: '/submission', label: 'Submission' },
      {
        href: '/allocator',
        label: 'Allocator',
        matches: ['/allocator/decisions', '/allocator/rebalance-bundles', '/allocator/rebalance-proposals'],
      },
      { href: '/allocator/escalations', label: 'Escalations' },
    ],
  },
  {
    title: 'Sleeves & Truth',
    items: [
      { href: '/carry', label: 'Carry', matches: ['/carry/actions', '/carry/executions'] },
      { href: '/treasury', label: 'Treasury', matches: ['/treasury/actions', '/treasury/executions', '/treasury/venues'] },
      { href: '/venues', label: 'Venues' },
    ],
  },
  {
    title: 'Verification & Recovery',
    items: [
      { href: '/cex-import', label: 'CEX Import' },
      { href: '/mismatches', label: 'Mismatches' },
      { href: '/reconciliation', label: 'Reconciliation' },
      { href: '/operations', label: 'Operations' },
    ],
  },
];

function isActive(pathname: string, item: NavigationItem): boolean {
  if (item.href === '/') {
    return pathname === '/';
  }

  if (pathname === item.href || pathname.startsWith(`${item.href}/`)) {
    return true;
  }

  return (item.matches ?? []).some((match) => pathname === match || pathname.startsWith(`${match}/`));
}

export function SidebarNav(): JSX.Element {
  const pathname = useOptionalPathname();

  return (
    <nav className="sidebar__nav" aria-label="Primary">
      {navigation.map((section) => (
        <div className="sidebar__section" key={section.title}>
          <p className="sidebar__section-title">{section.title}</p>
          <div className="sidebar__section-items">
            {section.items.map((item) => {
              const active = isActive(pathname, item);

              return (
                <Link
                  aria-current={active ? 'page' : undefined}
                  className={`sidebar__link${active ? ' sidebar__link--active' : ''}`}
                  href={item.href}
                  key={item.href}
                >
                  <span className="sidebar__link-indicator" aria-hidden="true" />
                  <span className="sidebar__link-label">{item.label}</span>
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}
