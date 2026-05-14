'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useRouter } from 'next/navigation';
import { useUser } from '@/lib/hooks';
import Layout from '@/components/layout/Layout';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { installPreviewApi } from '@/lib/preview-data';

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

  useEffect(() => {
    // Preview mode — skip auth and inject a fake user.
    if (isPreviewMode()) {
      if (!user?.id) setUser(PREVIEW_USER);
      setIsReady(true);
      return;
    }

    const verifyAndLoad = async () => {
      const authToken = localStorage.getItem('access_token');
      if (!authToken){
        router.push("/auth");
        return;
      }
      try {
        const [userResponse, stepResponse] = await Promise.all([
          !user?.id ? api.getUserDetails(authToken) : Promise.resolve(user),
          api.getOnboardingStep(authToken)
        ]);

        if (!user?.id) {
          setUser(userResponse);
        }
        const realStep = stepResponse.onboarding_step;

        if (realStep < 6) {
          router.replace('/onboarding');
        } else {
          setIsReady(true);
        }
      } catch (error) {
        console.error("Failed to verify dashboard access:", error);
      }
    };

    verifyAndLoad();
  }, [router, setUser, user?.id]);

  if (!isReady) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return <Layout>{children}</Layout>;
}