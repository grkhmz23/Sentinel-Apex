import './globals.css';

import { AppShell } from '../src/components/app-shell';
import { getDefaultActor } from '../src/lib/env.server';

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Sentinel Apex Ops Dashboard',
  description: 'Internal runtime operations dashboard',
};

export default function RootLayout(
  { children }: { children: React.ReactNode },
): JSX.Element {
  return (
    <html lang="en">
      <body>
        <AppShell defaultActorId={getDefaultActor()}>
          {children}
        </AppShell>
      </body>
    </html>
  );
}
