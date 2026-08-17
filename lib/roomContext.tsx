'use client';

/**
 * RoomContext — shared room data across the room sub-tabs.
 *
 * The [id]/layout.tsx fetches room details + current-user role + member
 * list once on mount; each child tab page (overview / tools / members
 * / connect / settings) consumes them via `useRoom()` without
 * refetching. Members are shared at the layout level because both
 * Overview (shows count) and Members (shows full list) need them — and
 * the array is small.
 *
 * Why a context instead of refetching per page:
 *   • Snappy tab navigation. Without the context, every tab click
 *     would refetch room details + member list — adds 100-300ms of
 *     latency to a navigation that should feel instant.
 *   • Single source of truth for role. The user's role is derived
 *     from membership data; if each page recomputed it independently,
 *     they could disagree during in-flight updates.
 *   • Optimistic updates. When a tab mutates the room (e.g. Tools
 *     page saves new policies), the context refresh becomes a
 *     single trigger that all tabs observe.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { api } from '@/lib/api';
import { useUser } from '@/lib/hooks';
import type { RoomDetails, RoomMember } from '@/lib/types';
import { getRoomRoleLabel } from '@/lib/utils';

interface RoomContextValue {
  roomId: string;
  room: RoomDetails | null;
  members: RoomMember[];
  /** Human-readable role label for the current user in this room. */
  role: string;
  /** Numeric authority source for room RBAC. Lower rank means more authority. */
  roleRank: number | null;
  loading: boolean;
  error: string | null;
  /** Manually re-fetch room + members. Use after a successful
   *  mutation (rename, role change, etc.) to refresh the shared
   *  state for every tab. */
  refresh: () => Promise<void>;
}

const RoomContext = createContext<RoomContextValue | null>(null);

export function RoomProvider({
  roomId,
  children,
}: {
  roomId: string;
  children: ReactNode;
}) {
  const { user } = useUser();
  const [room, setRoom] = useState<RoomDetails | null>(null);
  const [members, setMembers] = useState<RoomMember[]>([]);
  const [membershipRole, setMembershipRole] = useState<string | null>(null);
  const [membershipRoleRank, setMembershipRoleRank] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!roomId) return;
    setLoading(true);
    try {
      const [roomData, memberData, membershipData] = await Promise.all([
        api.getRoomDetails(roomId),
        api.getRoomMembers(roomId),
        api.getMyRoomMembership(roomId).catch(() => null),
      ]);
      setRoom(roomData);
      setMembers(memberData);
      setMembershipRole(membershipData?.role ?? null);
      setMembershipRoleRank(membershipData?.role_rank ?? null);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load room');
    } finally {
      setLoading(false);
    }
  }, [roomId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const me = useMemo(
    () =>
      members.find(
        (member) =>
          member.user_id === user?.id || member.username === user?.username,
      ) ?? null,
    [members, user?.id, user?.username],
  );

  const roleRank = useMemo(() => {
    if (typeof membershipRoleRank === 'number') return membershipRoleRank;
    if (typeof me?.role_rank === 'number') return me.role_rank;
    if (typeof room?.role_rank === 'number') return room.role_rank;
    return null;
  }, [membershipRoleRank, me?.role_rank, room?.role_rank]);

  const role = useMemo(
    () =>
      getRoomRoleLabel(
        membershipRole ?? me?.role ?? room?.role ?? null,
        roleRank,
      ),
    [membershipRole, me?.role, room?.role, roleRank],
  );

  const value = useMemo<RoomContextValue>(
    () => ({ roomId, room, members, role, roleRank, loading, error, refresh }),
    [roomId, room, members, role, roleRank, loading, error, refresh],
  );

  return <RoomContext.Provider value={value}>{children}</RoomContext.Provider>;
}

export function useRoom(): RoomContextValue {
  const ctx = useContext(RoomContext);
  if (!ctx) {
    throw new Error('useRoom must be called inside a RoomProvider');
  }
  return ctx;
}
