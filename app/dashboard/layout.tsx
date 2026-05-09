'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useRouter } from 'next/navigation';
import { useUser } from '@/lib/hooks';
import Layout from '@/components/layout/Layout';
import LoadingSpinner from '@/components/ui/LoadingSpinner';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, setUser } = useUser();
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const verifyAndLoad = async () => {
      try {
        const [userResponse] = await Promise.all([
          !user?.id ? api.getUserDetails() : Promise.resolve(user)
        ]);

        if (!user?.id) {
          setUser(userResponse);
        }
      } catch (error) {
        console.error("Failed to verify dashboard access:", error);
        router.push("/auth");
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