import './globals.css';

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: {
    default: 'Sentinel Apex Ops Dashboard',
    template: '%s | Sentinel Apex',
  },
  description: 'Sentinel Apex protocol operations dashboard for allocator, carry, treasury, venue truth, and runtime integrity.',
  icons: {
    icon: [{ url: '/favicon.png', type: 'image/png' }],
    shortcut: '/favicon.png',
    apple: '/favicon.png',
  },
  themeColor: '#02040a',
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
