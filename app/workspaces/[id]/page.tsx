import { WorkspaceDemoGate } from '@/components/workspaces/WorkspaceDemoGate';
import { WorkspaceRoom } from '@/components/workspaces/WorkspaceRoom';

/**
 * Full-bleed workspace room.
 *
 * Next 16 removed synchronous access to `params`, so this stays a server
 * component that awaits them and hands the id to the client room.
 */
export default async function WorkspaceRoomPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <WorkspaceDemoGate>
      <WorkspaceRoom workspaceId={id} />
    </WorkspaceDemoGate>
  );
}
