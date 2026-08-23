import type { Metadata } from 'next';
import { ShareRedeemClient } from './ShareRedeemClient';

export const metadata: Metadata = {
  title: 'Shared memory',
  description: 'Add a shared Aegis memory to your account.',
};

export default async function MemorySharePage({
  params,
}: {
  params: Promise<{ share_code: string }>;
}) {
  const { share_code } = await params;
  return <ShareRedeemClient shareCode={share_code} />;
}
