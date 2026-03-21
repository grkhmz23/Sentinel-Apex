import './globals.css';

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
      <body>{children}</body>
    </html>
  );
}
