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
        // Validate session first
        await api.getUserDetails();

        // Then fetch onboarding progress
        const onboarding = await api.getOnboardingStep();

        if (onboarding.onboarding_step >= 5) {
          router.replace('/dashboard');
          return;
        }

        router.replace('/onboarding');

      } catch {
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