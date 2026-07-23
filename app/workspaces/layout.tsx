import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Agent Workspaces',
  description:
    'Prototype workspace UX for multi-agent collaboration, workspace tasks, and agent mentions.',
};

export default function WorkspacesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
