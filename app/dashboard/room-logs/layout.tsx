import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Room Logs',
  description:
    'Per-room audit log. See every agent action scoped to a room, attributed to the team member that triggered it.',
};

export default function RoomLogsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
