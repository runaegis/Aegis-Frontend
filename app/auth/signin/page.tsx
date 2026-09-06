import type { Metadata } from 'next';
import AuthPageClient from '@/components/auth/AuthPageClient';

export const metadata: Metadata = {
  title: 'Sign in',
  description: 'Sign in to Aegis to monitor and govern your AI agents.',
};

export default function SigninPage() {
  return <AuthPageClient mode="signin" />;
}

