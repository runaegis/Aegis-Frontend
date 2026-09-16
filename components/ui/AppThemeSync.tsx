'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { applyPersistedAppTheme } from '@/components/ui/ThemeToggle';

/**
 * Keeps `data-theme` aligned with `aegis_theme` across dashboard and
 * workspace routes. The dashboard layout used to strip the attribute on
 * unmount, which forced the room back to light on client navigations.
 */
export function AppThemeSync() {
  const pathname = usePathname() ?? '';

  useEffect(() => {
    applyPersistedAppTheme(pathname);
  }, [pathname]);

  return null;
}
