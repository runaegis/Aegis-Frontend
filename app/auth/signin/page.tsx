import type { Metadata } from 'next';
import AuthPageClient from '@/components/auth/AuthPageClient';

export const metadata: Metadata = {
  title: 'Sign in',
  description: 'Sign in to Aegis to monitor and govern your AI agents.',
};

function readSingleParam(
  value: string | string[] | undefined,
): string | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

export default async function SigninPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  const params = await searchParams;
  return <AuthPageClient mode="signin" nextParam={readSingleParam(params.next)} />;
}
