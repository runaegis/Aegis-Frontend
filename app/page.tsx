'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { api } from '@/lib/api';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    const checkAuth = async () => {
      try {
        // Backend + cookies are now the source of truth
        const user = await api.getUserDetails();

        // Onboarding completed
        if (user?.onboarding_step >= 5) {
          router.replace('/dashboard');
          return;
        }

        // Logged in but onboarding incomplete
        router.replace('/onboarding');

      } catch {
        // No valid session
        router.replace('/auth');
      }
    };

    checkAuth();
  }, [router]);

  return (
    <div className="flex h-screen items-center justify-center">
      <LoadingSpinner size="lg" />
    </div>
  );
}