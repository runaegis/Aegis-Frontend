'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { AuthError, api } from '@/lib/api';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    const bootstrap = async () => {
      try {
        const user = await api.getUserDetails();
        const onboardingStatus =
          typeof user.onboarding_status === 'boolean'
            ? user.onboarding_status
            : (await api.getOnboardingStatus()).onboarding_status;

        router.replace(onboardingStatus ? '/dashboard' : '/onboarding');

      } catch (err) {
        if (err instanceof AuthError) {
          router.replace('/auth');
          return;
        }
        console.error(
          'BOOTSTRAP ERROR:',
          err
        );
        router.replace('/auth');
      }
    };

    bootstrap();
  }, [router]);

  return (
    <div className="flex h-screen items-center justify-center">
      <LoadingSpinner size="lg" />
    </div>
  );
}
