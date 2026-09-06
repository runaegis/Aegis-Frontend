import type { Metadata } from 'next';
import AuthPageClient from '@/components/auth/AuthPageClient';

export const metadata: Metadata = {
  title: 'Create account',
  description: 'Create your Aegis account and start governing agent activity.',
};

export default function SignupPage() {
  return <AuthPageClient mode="signup" />;
}

