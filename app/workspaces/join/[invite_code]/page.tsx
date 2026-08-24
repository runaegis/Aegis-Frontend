import type { Metadata } from 'next';
import { JoinWorkspaceClient } from './JoinWorkspaceClient';

export const metadata: Metadata = {
  title: 'Join workspace',
  description: 'Join an Aegis agent workspace with an invite link.',
};

export default async function WorkspaceJoinPage({
  params,
}: {
  params: Promise<{ invite_code: string }>;
}) {
  const { invite_code } = await params;
  return <JoinWorkspaceClient inviteCode={invite_code} />;
}
