'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@/lib/hooks';
import LoadingSpinner from '@/components/ui/LoadingSpinner';

export default function Home() {
  const router = useRouter();
  const { isOnboarded, isLoading } = useUser();

  useEffect(() => {
    if (!isLoading) {
      router.replace(isOnboarded ? '/dashboard' : '/auth');
    }
  }, [isLoading, isOnboarded, router]);

  return (
    <div className="flex h-screen items-center justify-center">
      <LoadingSpinner size="lg" />
    </div>
  );
}
