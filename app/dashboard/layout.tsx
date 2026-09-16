'use client';

import { useEffect, useState } from 'react';
import { api, AuthError } from '@/lib/api';
import { useRouter } from 'next/navigation';
import { useUser } from '@/lib/hooks';
import Layout from '@/components/layout/Layout';
import { AppShellSkeleton } from '@/components/ui/PageSkeletons';
import { CommandPalette } from '@/components/ui/CommandPalette';
import { DemoWelcomeModal } from '@/components/ui/DemoWelcomeModal';
import { ProductTour } from '@/components/tour/ProductTour';
import { installPreviewApi } from '@/lib/preview-data';
import { installWorkspacePreviewApi } from '@/lib/workspace-preview';
import { DashboardDataProvider } from '@/lib/dashboardDataContext';

// Agentation widget is mounted once at the root layout
// (app/layout.tsx) via AgentationGate so it works on every route —
// auth, onboarding, dashboard, email previews. Don't double-mount it
// here; that was the previous bug.

// Demo mode — production-safe "sample workspace" layer.
//
// Replaces the old dev-only `aegis_preview` escape hatch. Demo is a
// real product feature: new users get a welcome modal asking whether
// to start with sample data or their empty workspace, and can switch
// between the two via the WorkspaceSwitcher in the sidebar at any
// time. Prospects can also visit /dashboard?demo=1 without auth to
// tour the product before signing up.
//
// State machine:
//   localStorage.aegis_demo === null     → no choice yet; show welcome
//                                          modal in DashboardLayout
//   localStorage.aegis_demo === 'true'   → ON  (in demo workspace)
//   localStorage.aegis_demo === 'false'  → OFF (in real workspace)
//
// The `?demo=1` query param force-enables and persists 'true'.
// The `?real=1` query param force-disables and persists 'false'.
// The legacy `?preview=1` + `aegis_preview` are kept as dev-only aliases
// so existing screenshots / bookmarks don't break — they map onto the
// same mock layer.
function isDemoMode(): boolean {
  if (typeof window === 'undefined') return false;
  const params = new URLSearchParams(window.location.search);
  if (params.get('real') === '1') {
    localStorage.setItem('aegis_demo', 'false');
    return false;
  }
  if (params.get('demo') === '1') {
    localStorage.setItem('aegis_demo', 'true');
    return true;
  }
  // ?preview=1 — legacy dev alias kept for backwards compat with
  // older screenshots/bookmarks. Dev-only.
  if (process.env.NODE_ENV !== 'production' && params.get('preview') === '1') {
    localStorage.setItem('aegis_demo', 'true');
    return true;
  }
  return localStorage.getItem('aegis_demo') === 'true';
}

/** True when the user has never made a choice — used by the
 *  DashboardLayout to decide whether to show the welcome modal. */
function isFirstVisit(): boolean {
  if (typeof window === 'undefined') return false;
  // If they came in via ?demo=1 we treat that as an implicit choice
  // (intentional URL), so don't gate them with a modal.
  const params = new URLSearchParams(window.location.search);
  if (params.get('real') === '1') return false;
  if (params.get('demo') === '1') return false;
  return localStorage.getItem('aegis_demo') === null;
}

const DEMO_USER = {
  id: 'demo-user',
  name: 'Demo',
  username: 'demo',
  email: 'demo@runaegis.co',
  onboarding_status: true,
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, setUser } = useUser();
  const [isReady, setIsReady] = useState(false);
  // Welcome-modal state. Determined once on mount (isFirstVisit reads
  // localStorage which is stable across renders). We deliberately
  // don't recompute on every render — the modal stays open until the
  // user picks, then closes for the rest of the session.
  const [showWelcome, setShowWelcome] = useState(false);

  // ⚠️ Run this synchronously during render (before children mount) so the
  // page's first fetchData() call already sees the patched api methods.
  // Idempotent — installPreviewApi guards itself. Same mock layer
  // powers both the legacy dev `aegis_preview` flag and the new
  // production-safe `aegis_demo` flag.
  if (typeof window !== 'undefined' && isDemoMode()) {
    installPreviewApi();
    installWorkspacePreviewApi();
  }

  // Mark the document root with demo state — the WorkspaceSwitcher
  // and any other demo-aware component reads this. Cleanup on unmount
  // restores defaults for /auth + /onboarding.
  // Also gates the welcome modal: shows when the user has never made
  // a choice (localStorage.aegis_demo === null).
  useEffect(() => {
    if (isDemoMode()) {
      document.documentElement.dataset.demo = 'true';
    } else {
      delete document.documentElement.dataset.demo;
    }
    if (isFirstVisit()) {
      setShowWelcome(true);
    }
    return () => {
      delete document.documentElement.dataset.demo;
    };
  }, []);

  useEffect(() => {
    // Demo mode — skip auth entirely (lets prospects tour the dashboard
    // pre-signup) and inject a fake user record so user-scoped hooks
    // have something to bind to.
    if (isDemoMode()) {
      // if (!user?.id) setUser(DEMO_USER);
      setIsReady(true);
      return;
    }

    const verifyAndLoad = async () => {
      try {
        const userResponse = await api.getUserDetails();
        console.log('User details loaded:', userResponse);
        if (userResponse) {
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
  }, [router, setUser]);

  if (!isReady) {
    return <AppShellSkeleton />;
  }

  // Welcome-modal handlers. Both write the persistence flag + drive
  // the next state. "Demo" requires a reload because installPreviewApi
  // monkey-patches the api singleton — only a fresh page load swaps
  // mocks in cleanly. "Empty" just dismisses since we don't install
  // any mocks.
  const handlePickDemo = () => {
    try {
      localStorage.setItem('aegis_demo', 'true');
    } catch {
      // ignore
    }
    window.location.reload();
  };
  const handlePickEmpty = () => {
    try {
      localStorage.setItem('aegis_demo', 'false');
    } catch {
      // ignore
    }
    setShowWelcome(false);
  };

  return (
    <DashboardDataProvider>
      <Layout>{children}</Layout>
      {/* First-visit welcome — only renders when localStorage.aegis_demo
          is null. After the user picks, the flag is persisted and the
          modal never reappears in this browser. The WorkspaceSwitcher
          in the sidebar then becomes the way to flip between modes. */}
      <DemoWelcomeModal
        open={showWelcome}
        onPickDemo={handlePickDemo}
        onPickEmpty={handlePickEmpty}
      />
      {/* ⌘K command palette — global keyboard handler inside, mounts
          once at the dashboard layout level so it's available on every
          route under /dashboard. */}
      <CommandPalette />
      <ProductTour welcomeOpen={showWelcome} />
    </DashboardDataProvider>
  );
}
