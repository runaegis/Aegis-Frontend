'use client';

import { useEffect, useState } from 'react';
import { api, AuthError } from '@/lib/api';
import { useRouter } from 'next/navigation';
import { useUser } from '@/lib/hooks';
import Layout from '@/components/layout/Layout';
import { AppShellSkeleton } from '@/components/ui/PageSkeletons';
import { CommandPalette } from '@/components/ui/CommandPalette';
import { installPreviewApi } from '@/lib/preview-data';
import { DashboardDataProvider } from '@/lib/dashboardDataContext';

// ⚠️ DEV-ONLY preview escape hatch.
//
// Activated via `?preview=1` query string OR a one-time localStorage flag
// (`aegis_preview = '1'`). When active, the dashboard renders against fake
// user state and mock API responses (see lib/preview-data.ts) without
// hitting the real auth backend. Useful for visual QA before the backend
// is wired up.
//
// HARD-GATED to development: in any production build this function always
// returns false, so mock data can never leak into a deployed environment.
function isPreviewMode(): boolean {
  if (typeof window === 'undefined') return false;
  // Production guard — preview mode is design-tool-only, never ships.
  if (process.env.NODE_ENV === 'production') return false;
  const params = new URLSearchParams(window.location.search);
  if (params.get('preview') === '1') {
    // Persist so client-side navigation between dashboard pages keeps preview on.
    localStorage.setItem('aegis_preview', '1');
    return true;
  }
  return localStorage.getItem('aegis_preview') === '1';
}

const PREVIEW_USER = {
  id: 'preview-user',
  username: 'preview',
  email: 'preview@runaegis.com',
  github_user_id: 0,
};

// Theme handling — reads from `?theme=` query string OR persisted
// localStorage flag (`aegis_theme`). When set to 'dark', the dashboard
// layout applies `data-theme="dark"` on the document root, which
// triggers the token-override block in globals.css.
//
// Scoping: this is set/cleared inside the dashboard layout, so /auth
// and /onboarding pages never receive `data-theme` — they always
// render in light mode by design.
//
// FOUC prevention: an inline <script> in app/layout.tsx reads the same
// localStorage flag at first paint and applies `data-theme` before
// React hydrates, so dark mode persists across reloads with no flash.
type ThemeFlag = 'dark' | null;

function readThemeFlag(): ThemeFlag {
  if (typeof window === 'undefined') return null;
  const params = new URLSearchParams(window.location.search);
  const fromQuery = params.get('theme');
  if (fromQuery === 'dark') {
    localStorage.setItem('aegis_theme', 'dark');
    return 'dark';
  }
  if (fromQuery === 'light') {
    localStorage.removeItem('aegis_theme');
    return null;
  }
  return localStorage.getItem('aegis_theme') === 'dark' ? 'dark' : null;
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, setUser } = useUser();
  const [isReady, setIsReady] = useState(false);

  // ⚠️ Run this synchronously during render (before children mount) so the
  // page's first fetchData() call already sees the patched api methods.
  // Idempotent — installPreviewApi guards itself.
  if (typeof window !== 'undefined' && isPreviewMode()) {
    installPreviewApi();
  }

  // Apply dark theme on mount when flag is set; clean up on unmount so
  // navigating away from /dashboard restores the default light theme.
  useEffect(() => {
    const theme = readThemeFlag();
    if (theme) {
      document.documentElement.dataset.theme = theme;
    } else {
      delete document.documentElement.dataset.theme;
    }
    return () => {
      delete document.documentElement.dataset.theme;
    };
  }, []);

  useEffect(() => {
    // Preview mode — skip auth and inject a fake user.
    if (isPreviewMode()) {
      if (!user?.id) setUser(PREVIEW_USER);
      setIsReady(true);
      return;
    }

    const verifyAndLoad = async () => {
      try {
        const userResponse = !user?.id
          ? await api.getUserDetails()
          : user;

        if (!user?.id && userResponse) {
          setUser(userResponse);
        }
        setIsReady(true);
      } catch (error) {
        if (error instanceof AuthError) {
          router.replace('/auth');
          return;
        }

        console.error(error);
        router.replace('/auth');
      }
    };

    verifyAndLoad();
  }, [router, setUser, user?.id]);

  if (!isReady) {
    return <AppShellSkeleton />;
  }

  return (
    <DashboardDataProvider>
      <Layout>{children}</Layout>
      {/* ⌘K command palette — global keyboard handler inside, mounts
          once at the dashboard layout level so it's available on every
          route under /dashboard. */}
      <CommandPalette />
    </DashboardDataProvider>
  );
}