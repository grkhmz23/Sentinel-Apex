'use client';

import * as NextNavigation from 'next/navigation';

export function useOptionalRefresh(): () => void {
  try {
    if (typeof NextNavigation.useRouter !== 'function') {
      return () => undefined;
    }

    const router = NextNavigation.useRouter();
    return () => router.refresh();
  } catch {
    return () => undefined;
  }
}

export function useOptionalPathname(): string {
  try {
    if (typeof NextNavigation.usePathname !== 'function') {
      return '/';
    }

    return NextNavigation.usePathname();
  } catch {
    return '/';
  }
}
