'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import {
  Copy,
  DoorOpen,
  Link2,
  Plus,
  Users,
} from 'lucide-react';
import Topbar from '@/components/layout/Topbar';
import ErrorBanner from '@/components/ui/ErrorBanner';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import EmptyState from '@/components/ui/EmptyState';
import { Button } from '@/components/ui/Button';
import { Input, Select } from '@/components/ui/Input';
import { CodeChip } from '@/components/ui/CodeChip';
import AgentAvatar from '@/components/ui/AgentAvatar';
import { Badge } from '@/components/ui/Badge';
import { useToast } from '@/components/ui/Toast';
import { api } from '@/lib/api';
import { useAutoRefresh, useUser } from '@/lib/hooks';
import { RoomSummary, RoomDetails, RoomInvite, RoomMember } from '@/lib/types'; 
import { formatRelativeTime } from '@/lib/utils';
import { DUR, EASE, fadeUp, fadeUpSm, staggerContainer } from '@/lib/motion';

const getRoomId = (room: RoomSummary | RoomDetails): string =>
  String(room.id || room.room_id || '');

const getInviteCode = (invite: RoomInvite): string =>
  String(invite.invite_code || invite.code || invite.id || '');

const TOOL_GROUPS: Record<string, string[]> = {
  Repository: [
    'create_or_update_file',
    'get_file_contents',
    'list_repository_files',
    'push_files',
    'search_repositories',
    'get_repository',
  ],
  'Issues & PR': [
    'create_issue',
    'get_issue',
    'issue_read:get_comments',
    'issue_read:get_sub_issues',
    'list_issues',
    'create_pull_request',
    'get_pull_request',
    'pull_request_read:get_comments',
    'pull_request_read:get_review_comments',
    'pull_request_read:get_reviews',
  ],
  Search: ['search_code', 'search_issues'],
  Git: ['get_latest_commit', 'list_branches', 'create_branch'],
};

const ROLE_LEVELS: Record<string, number> = {
  DEVELOPER: 1,
  ADMIN: 2,
  OWNER: 3,
};

export default function RoomsPage() {
  const { user, isLoading: userLoading } = useUser();
  const reduce = useReducedMotion();
  const toast = useToast();
  const [rooms, setRooms] = useState<RoomSummary[]>([]);
  const [selectedRoomId, setSelectedRoomId] = useState<string>('');
  const [selectedRoom, setSelectedRoom] = useState<RoomDetails | null>(null);
  const [members, setMembers] = useState<RoomMember[]>([]);
  const [invites, setInvites] = useState<RoomInvite[]>([]);

  const [newRepoName, setNewRepoName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [inviteMaxUses, setInviteMaxUses] = useState('');
  const [inviteExpiresAt, setInviteExpiresAt] = useState('');

  const [loading, setLoading] = useState(true);
  const [submittingCreate, setSubmittingCreate] = useState(false);
  const [submittingJoin, setSubmittingJoin] = useState(false);
  const [submittingInvite, setSubmittingInvite] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Success feedback flows through the global toast viewport — no more
  // inline "success" state. Errors still surface in the inline banner
  // because some failures need persistent visibility on this page.
  const [tools, setTools] = useState<Record<string, boolean>>({});
  const [integrationConfig, setIntegrationConfig] = useState<any>(null);
  const [role, setRole] = useState<string>('DEVELOPER');
  const [viewingRole, setViewingRole] = useState<string>('DEVELOPER');

  const visibleRoles = useMemo(() => {
    if (role === 'OWNER') {
      return ['OWNER', 'ADMIN', 'DEVELOPER'];
    }

    if (role === 'ADMIN') {
      return ['ADMIN', 'DEVELOPER'];
    }

    return ['DEVELOPER'];
  }, [role]);

  const canEditViewedRole = useMemo(() => {
    return ROLE_LEVELS[role] >= ROLE_LEVELS[viewingRole];
  }, [role, viewingRole]);

  const canCreateInvites = useMemo(() => {
    return role === 'OWNER' || role === 'ADMIN';
  }, [role]);


  const fetchRooms = useCallback(async () => {
    if (userLoading) return;

    if (!user) {
      setRooms([]);
      setSelectedRoomId('');
      setSelectedRoom(null);
      setMembers([]);
      setInvites([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = await api.getMyRooms();
      setRooms(data);
      if (data.length === 0) {
        setSelectedRoomId('');
        setSelectedRoom(null);
        setMembers([]);
        setInvites([]);
      } else {
        const hasSelected = data.some((room) => getRoomId(room) === selectedRoomId);
        if (!selectedRoomId || !hasSelected) {
          setSelectedRoomId(getRoomId(data[0]));
        }
      }
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [ userLoading, user, selectedRoomId ]);

  
  useEffect(() => {
    fetchRooms();
  }, [fetchRooms]);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (!selectedRoomId) {
        setIntegrationConfig(null);
        setSelectedRoom(null);
        setMembers([]);
        setInvites([]);
        return;
      }

      try {
        const [roomData, memberData, inviteData, integrationData] =
          await Promise.all([
            api.getRoomDetails(selectedRoomId),
            api.getRoomMembers(selectedRoomId),
            api.getRoomInvites(selectedRoomId),
            api.getRoomIntegrationConfig(selectedRoomId),
          ]);

        if (cancelled) return;

        setIntegrationConfig(integrationData);

        const currentMember = memberData.find(
          (m) => m.username === user?.username
        );

        const currentRole = currentMember?.role || 'DEVELOPER';

        setRole(currentRole);

        setSelectedRoom(roomData);
        setMembers(memberData);
        setInvites(inviteData);
        setError(null);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err));
        }
      }
    };

    run();

    return () => {
      cancelled = true;
    };
  }, [selectedRoomId, user?.username]);

  useEffect(() => {
  setError(null);
  setTools({});
}, [selectedRoomId]);

  useEffect(() => {
    if (!selectedRoomId || !role) return;

    setViewingRole(role);
  }, [selectedRoomId]);

useEffect(() => {
  if (!selectedRoomId || !viewingRole) {
    setTools({});
    return;
  }

  let cancelled = false;

  api.getRoomTools(selectedRoomId, viewingRole)
    .then((toolsData) => {
      if (!cancelled) {
        setTools(toolsData || {});
      }
    })
    .catch((err) => {
      console.error('[RoomsPage] Failed to load tools:', err);
    });

  return () => {
    cancelled = true;
  };
}, [selectedRoomId, viewingRole]);


  const { lastUpdated } = useAutoRefresh(fetchRooms, 30000);

  const selectedRoomLabel = useMemo(() => {
    if (!selectedRoom) return selectedRoomId || 'Room';
    return selectedRoom.repo_name || getRoomId(selectedRoom);
  }, [selectedRoom, selectedRoomId]);

  const roomIntegrationUrl = integrationConfig?.url || '';

  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRepoId.trim()) return;
    setSubmittingCreate(true);
        try {
      const created = await api.createRoom(newRepoId.trim());
      setNewRepoId('');
      toast.success('Room created');
      await fetchRooms();
      const roomId = getRoomId(created);
      if (roomId) setSelectedRoomId(roomId);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmittingCreate(false);
    }
  };

  const handleJoinRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinCode.trim()) return;
    setSubmittingJoin(true);
        try {
      await api.joinRoom(joinCode.trim());
      setJoinCode('');
      toast.success('Joined room');
      await fetchRooms();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmittingJoin(false);
    }
  };

  const handleCreateInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRoomId) return;
    setSubmittingInvite(true);
        try {
      const payload: { max_uses?: number; expires_at?: string } = {};
      if (inviteMaxUses.trim()) payload.max_uses = Number(inviteMaxUses);
      if (inviteExpiresAt.trim())
        payload.expires_at = new Date(inviteExpiresAt).toISOString();
      await api.createRoomInvite(selectedRoomId, payload);
      const inviteData = await api.getRoomInvites(selectedRoomId);
      setInvites(inviteData);
      setInviteMaxUses('');
      setInviteExpiresAt('');
      toast.success('Invite created');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmittingInvite(false);
    }
  };

  const toggleTool = (tool: string, value: boolean) => {
    const previousTools = tools;
    const updated = { ...tools, [tool]: value };

    setTools(updated);

    api.updateRoomTools(selectedRoomId, viewingRole, updated)
      .then(() => {
        toast.success(`${tool} ${value ? 'allowed' : 'denied'}`);
      })
      .catch((err) => {
        setTools(previousTools);
        setError(err instanceof Error ? err.message : String(err));
      });
  };

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${label} copied`);
    } catch {
      setError(`Could not copy ${label.toLowerCase()}`);
    }
  };

  if (userLoading || loading) {
    return (
      <>
        <Topbar title="Rooms" subtitle="Team workspaces for agents" />
        <div className="flex h-[60vh] items-center justify-center">
          <LoadingSpinner size="lg" />
        </div>
      </>
    );
  }

  return (
    <>
      <Topbar
        title="Rooms"
        subtitle="Team workspaces for agents"
        lastUpdated={lastUpdated}
        onRefresh={fetchRooms}
      />
      <div className="mx-auto max-w-[1320px] px-4 py-6 sm:px-6 sm:py-7 lg:px-8 lg:py-8">
        {error && (
          <div className="mb-4">
            <ErrorBanner
              message={error}
              onDismiss={() => setError(null)}
              onRetry={fetchRooms}
            />
          </div>
        )}
        {/* Success feedback is now rendered by the global toast viewport. */}

        <motion.header
          className="mb-6"
          variants={staggerContainer(0.05, 0.04)}
          initial={reduce ? false : 'hidden'}
          animate="show"
        >
          <motion.p
            variants={fadeUp}
            className="mb-2 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-[var(--neutral-soft-400)]"
          >
            Rooms
          </motion.p>
          <motion.h1
            variants={fadeUp}
            className="text-[26px] font-semibold leading-[1.1] tracking-[-0.03em] text-[var(--neutral-strong-950)]"
          >
            Team workspaces for agents
          </motion.h1>
          <motion.p
            variants={fadeUp}
            className="mt-2 text-[13.5px] text-[var(--neutral-sub-600)]"
          >
            Create a room per repo, invite teammates, define what each role can do.
          </motion.p>
        </motion.header>

        {/* Create + Join */}
        <motion.div
          className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-2"
          initial={reduce ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: DUR.slow, ease: EASE.out, delay: 0.16 }}
        >
          <form
            onSubmit={handleCreateRoom}
            className="overflow-hidden rounded-[12px] border border-[var(--stroke-soft-200)] bg-white shadow-[0_1px_2px_rgba(23,23,23,0.04)]"
          >
            <div className="flex items-center gap-2 border-b border-[var(--stroke-soft-200)] p-4">
              <Plus
                className="h-4 w-4 shrink-0"
                style={{ color: 'var(--primary-base)' }}
                strokeWidth={2}
              />
              <h2 className="text-[14px] font-semibold tracking-[-0.01em] text-[var(--neutral-strong-950)]">
                Create room
              </h2>
            </div>
            <div className="space-y-3 p-5">
              <Field label="Repository Name">
                <Input
                  value={newRepoId}
                  onChange={(e) => setNewRepoId(e.target.value)}
                  placeholder="repo_name"
                />
              </Field>
              <div className="flex justify-end">
                <Button
                  type="submit"
                  variant="primary"
                  disabled={submittingCreate || !newRepoId.trim()}
                >
                  {submittingCreate ? 'Creating…' : 'Create room'}
                </Button>
              </div>
            </div>
          </form>

          <form
            onSubmit={handleJoinRoom}
            className="overflow-hidden rounded-[12px] border border-[var(--stroke-soft-200)] bg-white shadow-[0_1px_2px_rgba(23,23,23,0.04)]"
          >
            <div className="flex items-center gap-2 border-b border-[var(--stroke-soft-200)] p-4">
              <DoorOpen
                className="h-4 w-4 shrink-0"
                style={{ color: 'var(--primary-base)' }}
                strokeWidth={2}
              />
              <h2 className="text-[14px] font-semibold tracking-[-0.01em] text-[var(--neutral-strong-950)]">
                Join room
              </h2>
            </div>
            <div className="space-y-3 p-5">
              <Field label="Invite code">
                <Input
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value)}
                  placeholder="Paste invite code"
                />
              </Field>
              <div className="flex justify-end">
                <Button
                  type="submit"
                  variant="secondary"
                  disabled={submittingJoin || !joinCode.trim()}
                >
                  {submittingJoin ? 'Joining…' : 'Join room'}
                </Button>
              </div>
            </div>
          </form>
        </motion.div>

        {rooms.length === 0 ? (
          <div className="overflow-hidden rounded-[12px] border border-[var(--stroke-soft-200)] bg-white shadow-[0_1px_2px_rgba(23,23,23,0.04)]">
            <EmptyState
              icon={<Users className="h-5 w-5" />}
              title="No rooms yet"
              description="Create your first room or join one with an invite code."
            />
          </div>
        ) : (
          <motion.div
            className="grid grid-cols-1 gap-6 xl:grid-cols-[280px_minmax(0,1fr)]"
            initial={reduce ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: DUR.slow, ease: EASE.out, delay: 0.24 }}
          >
            {/* Room picker */}
            <aside className="overflow-hidden rounded-[12px] border border-[var(--stroke-soft-200)] bg-white shadow-[0_1px_2px_rgba(23,23,23,0.04)]">
              <div className="flex items-center justify-between p-4">
                <h2 className="text-[14px] font-semibold tracking-[-0.01em] text-[var(--neutral-strong-950)]">
                  Your rooms
                </h2>
                <span className="inline-flex h-[18px] items-center justify-center rounded-[5px] bg-[var(--neutral-weak-50)] px-[6px] text-[10.5px] font-bold tabular-nums text-[var(--neutral-sub-600)]">
                  {rooms.length.toLocaleString()}
                </span>
              </div>
              <ul className="divide-y divide-[var(--stroke-soft-200)] border-t border-[var(--stroke-soft-200)]">
                {rooms.map((room) => {
                  const id = getRoomId(room);
                  const active = id === selectedRoomId;
                  return (
                    <li key={id}>
                      <button
                        onClick={() => setSelectedRoomId(id)}
                        className={[
                          'flex w-full items-center gap-2.5 px-4 py-3 text-left transition-colors',
                          active
                            ? 'bg-[var(--primary-alpha-10)]'
                            : 'hover:bg-[var(--neutral-weak-50)]',
                        ].join(' ')}
                      >
                        <div className="min-w-0 flex-1">
                          <p
                            className="truncate text-[13px] font-medium"
                            style={{
                              color: active
                                ? 'var(--primary-base)'
                                : 'var(--neutral-strong-950)',
                            }}
                          >
                            {room.repo_name || id}
                          </p>
                          <p className="truncate text-[10.5px] text-[var(--neutral-soft-400)]">
                            {id}
                          </p>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </aside>

            {/* Selected room */}
            <div className="space-y-6">
              {/* Room header + integration URL + invite generation */}
              <div className="overflow-hidden rounded-[12px] border border-[var(--stroke-soft-200)] bg-white shadow-[0_1px_2px_rgba(23,23,23,0.04)]">
                <div className="flex items-start justify-between gap-3 border-b border-[var(--stroke-soft-200)] p-4">
                  <div>
                    <h2 className="text-[14px] font-semibold tracking-[-0.01em] text-[var(--neutral-strong-950)]">
                      {selectedRoomLabel}
                    </h2>
                    <p className="mt-0.5 text-[11.5px] text-[var(--neutral-soft-400)]">
                      Room ID: {selectedRoomId}
                    </p>
                  </div>
                  <Badge tone="primary" uppercase>
                    {role}
                  </Badge>
                </div>

                <div className="p-5 space-y-5">
                  <div>
                    <p className="mb-1.5 text-[10.5px] font-semibold uppercase tracking-[0.07em] text-[var(--neutral-soft-400)]">
                      Integration URL
                    </p>
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <input
                        value={roomIntegrationUrl}
                        readOnly
                        className="h-9 flex-1 rounded-[8px] border border-[var(--stroke-sub-300)] bg-[var(--neutral-weak-50)] px-3 text-[11.5px] text-[var(--neutral-strong-950)]"
                      />
                      <Button
                        variant="secondary"
                        onClick={() =>
                          copyToClipboard(roomIntegrationUrl, 'Integration URL')
                        }
                        disabled={!roomIntegrationUrl}
                        leadingIcon={<Copy className="h-3.5 w-3.5" strokeWidth={2} />}
                      >
                        Copy
                      </Button>
                    </div>
                  </div>
                
                {canCreateInvites ? (
                  <form
                    onSubmit={handleCreateInvite}
                    className="grid grid-cols-1 gap-3 sm:grid-cols-3"
                  >
                    <Field label="Max uses">
                      <Input
                        type="number"
                        min={1}
                        value={inviteMaxUses}
                        onChange={(e) => setInviteMaxUses(e.target.value)}
                        placeholder="Optional"
                      />
                    </Field>
                    <Field label="Expires at">
                      <input
                        type="datetime-local"
                        value={inviteExpiresAt}
                        onChange={(e) => setInviteExpiresAt(e.target.value)}
                        className="h-8 w-full rounded-[8px] border border-[var(--stroke-sub-300)] bg-white px-3 text-[12.5px] text-[var(--neutral-strong-950)] focus:border-[var(--primary-base)] focus:outline-none focus:ring-[3px] focus:ring-[var(--primary-alpha-16)]"
                      />
                    </Field>
                    <div className="flex items-end">
                      <Button
                        type="submit"
                        variant="primary"
                        disabled={submittingInvite || !selectedRoomId}
                        fullWidth
                      >
                        {submittingInvite ? 'Generating…' : 'Generate invite'}
                      </Button>
                    </div>
                  </form> 
                ) : ( 
                  <div className="rounded-[10px] border border-[var(--stroke-soft-200)] bg-[var(--neutral-weak-50)] p-4 text-sm text-[var(--neutral-soft-400)]">
                    Only admins and owners can generate invite links.
                  </div>
                )}
                </div>
              </div>

              {/* Tool policies matrix */}
              <div className="overflow-hidden rounded-[12px] border border-[var(--stroke-soft-200)] bg-white shadow-[0_1px_2px_rgba(23,23,23,0.04)]">
                <div className="flex items-center justify-between border-b border-[var(--stroke-soft-200)] p-4">
                  <h3 className="text-[14px] font-semibold tracking-[-0.01em] text-[var(--neutral-strong-950)]">
                    Tool policies
                  </h3>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] uppercase tracking-[0.07em] text-[var(--neutral-soft-400)]">
                      View role
                    </span>
                    <Select
                      value={viewingRole}
                      onChange={(e) => setViewingRole(e.target.value)}
                    >
                      {visibleRoles.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </Select>
                  </div>
                </div>
                <div className="space-y-5 p-5">
                  {Object.entries(TOOL_GROUPS).map(([group, toolList]) => (
                    <div key={group}>
                      <h4 className="mb-2 text-[10.5px] font-semibold uppercase tracking-[0.07em] text-[var(--neutral-soft-400)]">
                        {group}
                      </h4>
                      <div className="overflow-hidden rounded-[10px] border border-[var(--stroke-soft-200)]">
                        <ul className="divide-y divide-[var(--stroke-soft-200)]">
                          {toolList.map((tool) => {
                            const isAllowed = tools[tool] === true;
                            const isDenied =
                              tools[tool] === false || tools[tool] === undefined;
                            return (
                              <li
                                key={tool}
                                className="flex items-center justify-between gap-3 px-4 py-2.5"
                              >
                                <span className="text-[11.5px] text-[var(--neutral-strong-950)]">
                                  {tool}
                                </span>
                                <div className="flex items-center gap-2">
                                  {!canEditViewedRole && (
                                    <span className="text-[10px] uppercase tracking-[0.07em] text-[var(--neutral-soft-400)]">
                                      Read only
                                    </span>
                                  )}
                                  <button
                                   type='button'
                                    disabled={!canEditViewedRole}
                                    onClick={() => toggleTool(tool, true)}
                                    className={[
                                      'inline-flex h-6 items-center rounded-[6px] px-2 text-[11px] font-semibold',
                                      isAllowed
                                        ? 'hover:brightness-110'
                                        : 'hover:bg-[var(--neutral-weak-50)]',
                                    ].join(' ')}
                                    style={
                                      isAllowed
                                        ? {
                                            backgroundColor: 'var(--success)',
                                            color: '#fff',
                                          }
                                        : {
                                            border: '1px solid var(--stroke-sub-300)',
                                            color: 'var(--neutral-sub-600)',
                                            backgroundColor: '#fff',
                                          }
                                    }
                                  >
                                    Allow
                                  </button>
                                  <button
                                  type = 'button'
                                   disabled={!canEditViewedRole}
                                    onClick={() => toggleTool(tool, false)}
                                    className={[
                                      'inline-flex h-6 items-center rounded-[6px] px-2 text-[11px] font-semibold',
                                      isDenied
                                        ? 'hover:brightness-110'
                                        : 'hover:bg-[var(--neutral-weak-50)]',
                                    ].join(' ')}
                                    style={
                                      isDenied
                                        ? {
                                            backgroundColor: 'var(--error)',
                                            color: '#fff',
                                          }
                                        : {
                                            border: '1px solid var(--stroke-sub-300)',
                                            color: 'var(--neutral-sub-600)',
                                            backgroundColor: '#fff',
                                          }
                                    }
                                  >
                                    Deny
                                  </button>
                                </div>
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Members + Invites */}
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <div className="overflow-hidden rounded-[12px] border border-[var(--stroke-soft-200)] bg-white shadow-[0_1px_2px_rgba(23,23,23,0.04)]">
                  <div className="flex items-center justify-between border-b border-[var(--stroke-soft-200)] p-4">
                    <div className="flex items-center gap-2">
                      <Users
                        className="h-4 w-4"
                        style={{ color: 'var(--primary-base)' }}
                        strokeWidth={2}
                      />
                      <h3 className="text-[14px] font-semibold tracking-[-0.01em] text-[var(--neutral-strong-950)]">
                        Members
                      </h3>
                      <span className="inline-flex h-[18px] items-center justify-center rounded-[5px] bg-[var(--neutral-weak-50)] px-[6px] text-[10.5px] font-bold tabular-nums text-[var(--neutral-sub-600)]">
                        {members.length.toLocaleString()}
                      </span>
                    </div>
                  </div>
                  {members.length === 0 ? (
                    <p className="p-6 text-[12.5px] text-[var(--neutral-soft-400)]">
                      No members yet.
                    </p>
                  ) : (
                    <motion.ul
                      className="divide-y divide-[var(--stroke-soft-200)]"
                      variants={staggerContainer(0.03, 0)}
                      initial={reduce ? false : 'hidden'}
                      animate="show"
                    >
                      {members.map((member, idx) => (
                        <motion.li
                          key={`${member.user_id}-${idx}`}
                          variants={fadeUpSm}
                          className="flex items-center gap-3 px-4 py-3"
                        >
                          <AgentAvatar
                            name={member.username || member.user_id}
                            size="sm"
                          />
                          <div className="min-w-0 flex-1">
                            <p className="text-[13px] font-medium text-[var(--neutral-strong-950)]">
                              {member.username || member.user_id}
                            </p>
                            <p className="text-[10.5px] text-[var(--neutral-soft-400)]">
                              {member.user_id}
                            </p>
                          </div>
                          <Badge tone="info" uppercase>
                            {member.role || 'member'}
                          </Badge>
                          {member.joined_at && (
                            <span className="hidden text-[11px] text-[var(--neutral-soft-400)] sm:inline">
                              {formatRelativeTime(member.joined_at)}
                            </span>
                          )}
                        </motion.li>
                      ))}
                    </motion.ul>
                  )}
                </div>

                <div className="overflow-hidden rounded-[12px] border border-[var(--stroke-soft-200)] bg-white shadow-[0_1px_2px_rgba(23,23,23,0.04)]">
                  <div className="flex items-center justify-between border-b border-[var(--stroke-soft-200)] p-4">
                    <div className="flex items-center gap-2">
                      <Link2
                        className="h-4 w-4"
                        style={{ color: 'var(--primary-base)' }}
                        strokeWidth={2}
                      />
                      <h3 className="text-[14px] font-semibold tracking-[-0.01em] text-[var(--neutral-strong-950)]">
                        Invites
                      </h3>
                      <span className="inline-flex h-[18px] items-center justify-center rounded-[5px] bg-[var(--neutral-weak-50)] px-[6px] text-[10.5px] font-bold tabular-nums text-[var(--neutral-sub-600)]">
                        {invites.length.toLocaleString()}
                      </span>
                    </div>
                  </div>
                  {invites.length === 0 ? (
                    <p className="p-6 text-[12.5px] text-[var(--neutral-soft-400)]">
                      No invites created yet.
                    </p>
                  ) : (
                    <motion.ul
                      className="divide-y divide-[var(--stroke-soft-200)]"
                      variants={staggerContainer(0.03, 0)}
                      initial={reduce ? false : 'hidden'}
                      animate="show"
                    >
                      {invites.map((invite, idx) => {
                        const code = getInviteCode(invite);
                        return (
                          <motion.li
                            key={`${code}-${idx}`}
                            variants={fadeUpSm}
                            className="flex items-start justify-between gap-3 px-4 py-3"
                          >
                            <div className="min-w-0 flex-1">
                              <CodeChip>{code}</CodeChip>
                              <p className="mt-1.5 text-[11.5px] text-[var(--neutral-soft-400)]">
                                <span>
                                  {invite.used_count || 0}
                                </span>
                                {typeof invite.max_uses === 'number' && (
                                  <>
                                    {' / '}
                                    <span>
                                      {invite.max_uses}
                                    </span>
                                  </>
                                )}{' '}
                                uses
                                {invite.expires_at && (
                                  <>
                                    {' · expires '}
                                    <span>
                                      {new Date(invite.expires_at).toLocaleString()}
                                    </span>
                                  </>
                                )}
                              </p>
                            </div>
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => copyToClipboard(code, 'Invite code')}
                              leadingIcon={
                                <Copy className="h-3 w-3" strokeWidth={2} />
                              }
                            >
                              Copy
                            </Button>
                          </motion.li>
                        );
                      })}
                    </motion.ul>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-[12px] font-medium text-[var(--neutral-sub-600)]">
        {label}
      </label>
      {children}
    </div>
  );
}
