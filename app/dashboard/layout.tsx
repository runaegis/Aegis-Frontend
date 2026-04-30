'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUser, useOnboardingStep } from '@/lib/hooks';
import Layout from '@/components/layout/Layout';
import LoadingSpinner from '@/components/ui/LoadingSpinner';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { isOnboarded, isLoading } = useUser();
  const { step, setStep } = useOnboardingStep();
  useEffect(() => {
    if (step > 6) {
      router.replace('/onboarding');
    }
  }, [isLoading, isOnboarded, router]);

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!isOnboarded) return null;

  return <Layout>{children}</Layout>;
}
