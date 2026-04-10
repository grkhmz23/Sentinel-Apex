'use client';

import Link from 'next/link';

import { useOptionalPathname } from '../lib/navigation-hooks';

interface NavigationItem {
  href: string;
  label: string;
  shortCode: string;
  matches?: string[];
}

interface NavigationSection {
  title: string;
  summary: string;
  items: NavigationItem[];
}

const navigation: NavigationSection[] = [
  {
    title: 'Control Plane',
    summary: 'Runtime, allocator, and proposal flow',
    items: [
      { href: '/', label: 'Overview', shortCode: 'OV' },
      { href: '/submission', label: 'Submission', shortCode: 'SB' },
      {
        href: '/allocator',
        label: 'Allocator',
        shortCode: 'AL',
        matches: ['/allocator/decisions', '/allocator/rebalance-bundles', '/allocator/rebalance-proposals'],
      },
      { href: '/allocator/escalations', label: 'Escalations', shortCode: 'ES' },
    ],
  },
  {
    title: 'Sleeves & Truth',
    summary: 'Capital deployment and venue posture',
    items: [
      { href: '/carry', label: 'Carry', shortCode: 'CY', matches: ['/carry/actions', '/carry/executions'] },
      { href: '/treasury', label: 'Treasury', shortCode: 'TR', matches: ['/treasury/actions', '/treasury/executions', '/treasury/venues'] },
      { href: '/venues', label: 'Venues', shortCode: 'VN' },
    ],
  },
  {
    title: 'Verification & Recovery',
    summary: 'Reconciliation, imports, and incidents',
    items: [
      { href: '/cex-import', label: 'CEX Import', shortCode: 'CX' },
      { href: '/mismatches', label: 'Mismatches', shortCode: 'MM' },
      { href: '/reconciliation', label: 'Reconciliation', shortCode: 'RC' },
      { href: '/operations', label: 'Operations', shortCode: 'OP' },
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
          <div className="sidebar__section-heading">
            <div>
              <p className="sidebar__section-title">{section.title}</p>
              <p className="sidebar__section-summary">{section.summary}</p>
            </div>
            <span className="sidebar__section-count">{section.items.length}</span>
          </div>
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
                  <span className="sidebar__link-indicator" aria-hidden="true">{item.shortCode}</span>
                  <span className="sidebar__link-copy">
                    <span className="sidebar__link-label">{item.label}</span>
                    <span className="sidebar__link-meta">{active ? 'Current surface' : 'Open module'}</span>
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}
