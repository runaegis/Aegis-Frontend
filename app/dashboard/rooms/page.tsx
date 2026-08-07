'use client';

/**
 * Rooms index — the rooms list page.
 *
 * Re-architected from the prior 878-line single-page god-component
 * into a focused index page. Each row in the list links to the
 * room's dedicated sub-page tree (Overview / Tools / Members /
 * Connect / Settings), where the heavy lifting happens.
 *
 * The page does three things:
 *   1. Lists every room the user is a member of, with quick-scan
 *      metadata (repo, role, last activity).
 *   2. Surfaces a primary "Create room" CTA pointed at the most
 *      common new-user path.
 *   3. Offers a secondary "Join with code" affordance for users
 *      arriving via an invite.
 *
 * Empty state teaches the mental model — what a room IS, what to
 * do next — rather than just saying "no rooms yet."
 *
 * Create + Join still live inline on this page (collapsed forms
 * that expand on click). The previous design surfaced both forms
 * at full size on every visit, which read as overwhelming. Here
 * the page leads with a clear primary CTA and reveals the form on
 * demand.
 */

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion, useReducedMotion } from 'motion/react';
import {
  ChevronRight,
  DoorOpen,
  Plus,
  Shield,
  Users,
} from 'lucide-react';
import { api } from '@/lib/api';
import { useAutoRefresh, useUser } from '@/lib/hooks';
import type { RoomSummary } from '@/lib/types';
import Topbar from '@/components/layout/Topbar';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import EmptyState from '@/components/ui/EmptyState';
import ErrorBanner from '@/components/ui/ErrorBanner';
import { GenerativeAvatar } from '@/components/ui/GenerativeAvatar';
import { Input } from '@/components/ui/Input';
import { RelativeTime } from '@/components/ui/RelativeTime';
import { RoomsSkeleton } from '@/components/ui/PageSkeletons';
import { useToast } from '@/components/ui/Toast';
import {
  cn,
  getRoomCreatedAt,
  getRoomDisplayName,
  getRoomRoleLabel,
  getRoomRoleBadgeTone,
  getRoomSlug,
} from '@/lib/utils';
import { fadeUp, fadeUpSm, staggerContainer } from '@/lib/motion';

const getRoomId = (room: RoomSummary): string =>
  String(room.id || room.room_id || '');

function getRoomTypeLabel(roomType?: string | null): string {
  return roomType === 'personal' ? 'Personal' : 'Shared';
}

export default function RoomsIndexPage() {
  const { user, isLoading: userLoading } = useUser();
  const router = useRouter();
  const toast = useToast();
  const reduce = useReducedMotion();

  const [rooms, setRooms] = useState<RoomSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Inline-expanding forms — collapsed by default so the page reads
  // calm. The Create form expands on the primary CTA click; the
  // Join form on the secondary "join with code" link.
  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [submittingCreate, setSubmittingCreate] = useState(false);
  const [submittingJoin, setSubmittingJoin] = useState(false);
  const [roomName, setRoomName] = useState('');
  const [roomDescription, setRoomDescription] = useState('');
  const [roomType, setRoomType] = useState<'shared' | 'personal'>('shared');

  const fetchRooms = useCallback(async () => {
    if (userLoading) return;
    if (!user) {
      setRooms([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = await api.getMyRooms();
      setRooms(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [user, userLoading]);

  useEffect(() => {
    void fetchRooms();
  }, [fetchRooms]);

  const { lastUpdated } = useAutoRefresh(fetchRooms, 30000);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roomName.trim()) return;
    setSubmittingCreate(true);
    try {
      const created = await api.createRoom({
        name: roomName.trim(),
        description: roomDescription.trim() || undefined,
        room_type: roomType,
      });
      const id = getRoomId(created);
      toast.success('Room created', {
        description: 'Configure connectors, tools, and membership to get started.',
      });
      setRoomName('');
      setRoomDescription('');
      setRoomType('shared');
      setShowCreate(false);
      // Land on Overview, not Connect. Two paths arrive here:
      //   • Individual IC (bottoms-up) — wants to wire up their own
      //     agent. They'll see the setup checklist and click Connect.
      //   • Tech Lead (top-down) — wants to set policy + invite team
      //     BEFORE letting anyone connect. They need the checklist
      //     to remember Tools and Members exist.
      // Overview + a 3-step "Set up this room" checklist serves both.
      if (id) router.push(`/dashboard/rooms/${id}`);
      else await fetchRooms();
    } catch (err) {
      toast.error('Could not create room', {
        description: err instanceof Error ? err.message : 'Try again.',
      });
    } finally {
      setSubmittingCreate(false);
    }
  };

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinCode.trim()) return;
    setSubmittingJoin(true);
    try {
      await api.joinRoom(joinCode.trim());
      toast.success('Joined room', {
        description: 'You can now collaborate in this room.',
      });
      setJoinCode('');
      setShowJoin(false);
      await fetchRooms();
    } catch (err) {
      toast.error('Could not join room', {
        description: err instanceof Error ? err.message : 'Check the invite code.',
      });
    } finally {
      setSubmittingJoin(false);
    }
  };

  // Loading shell.
  if (userLoading || (loading && rooms.length === 0)) {
    return (
      <>
        <Topbar title="Rooms" subtitle="Governed agent spaces" />
        <div className="mx-auto max-w-[1320px] 2xl:max-w-[1480px] px-4 py-6 sm:px-6 sm:py-7 lg:px-8 lg:py-8">
          <RoomsSkeleton />
        </div>
      </>
    );
  }

  return (
    <>
      <Topbar
        title="Rooms"
        subtitle="Governed agent spaces"
        lastUpdated={lastUpdated}
        onRefresh={fetchRooms}
      />
      <div className="mx-auto max-w-[1320px] 2xl:max-w-[1480px] px-4 py-6 sm:px-6 sm:py-7 lg:px-8 lg:py-8">
        {error && (
          <div className="mb-6">
            <ErrorBanner message={error} onDismiss={() => setError(null)} onRetry={fetchRooms} />
          </div>
        )}

        <motion.div
          variants={staggerContainer(0.05)}
          initial={reduce ? false : 'hidden'}
          animate="show"
          className="space-y-6"
        >
          {/* Page header — sets the mental model in one line. */}
          <motion.header variants={fadeUp}>
            <p className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-[var(--neutral-soft-400)]">
              Governance
            </p>
            <h1 className="mt-2 text-[26px] font-semibold leading-[1.1] tracking-[-0.03em] text-[var(--neutral-strong-950)]">
              Rooms
            </h1>
            <p className="mt-2 max-w-[640px] text-[13.5px] leading-[1.55] text-[var(--neutral-sub-600)]">
              Create connector-neutral spaces for agent governance. Add members,
              configure tools, and connect workflows without requiring a linked repo first.
            </p>
          </motion.header>

          {/* Primary + secondary CTAs. Only show when there are
              rooms (the empty state has its own CTA stack). */}
          {rooms.length > 0 && (
            <motion.div variants={fadeUp} className="flex flex-wrap items-center gap-2">
              <Button
                variant="primary"
                onClick={() => {
                  setShowCreate((v) => !v);
                  setShowJoin(false);
                }}
                leadingIcon={<Plus className="h-3.5 w-3.5" strokeWidth={2.25} />}
              >
                New room
              </Button>
              <Button
                variant="secondary"
                onClick={() => {
                  setShowJoin((v) => !v);
                  setShowCreate(false);
                }}
              >
                Join with code
              </Button>
              <span className="ml-1 text-[11.5px] text-[var(--neutral-soft-400)]">
                {rooms.length.toLocaleString()}{' '}
                {rooms.length === 1 ? 'room' : 'rooms'}
              </span>
            </motion.div>
          )}

          {/* Inline Create form — rooms are now generic, so the
              creation step starts from room identity, not a GitHub
              repository binding. Repo-scoped configuration can be
              added later inside the room. */}
          {showCreate && (
            <motion.form
              onSubmit={handleCreate}
              variants={fadeUp}
              className="rounded-[12px] border border-[var(--stroke-soft-200)] bg-white p-4 shadow-[0_1px_2px_rgba(23,23,23,0.04)]"
            >
              <div>
                <p className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[var(--neutral-soft-400)]">
                  Create a room
                </p>
                <p className="mt-1 text-[12px] text-[var(--neutral-sub-600)]">
                  Start with a room name. You can connect repos and other shared resources after the room exists.
                </p>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <label className="block sm:col-span-2">
                  <span className="mb-1.5 block text-[11.5px] font-medium text-[var(--neutral-sub-600)]">
                    Room name
                  </span>
                  <Input
                    value={roomName}
                    onChange={(e) => setRoomName(e.target.value)}
                    placeholder="Platform engineering"
                    autoFocus
                  />
                </label>
                <label className="block sm:col-span-2">
                  <span className="mb-1.5 block text-[11.5px] font-medium text-[var(--neutral-sub-600)]">
                    Description
                  </span>
                  <Input
                    value={roomDescription}
                    onChange={(e) => setRoomDescription(e.target.value)}
                    placeholder="Optional context for this room"
                  />
                </label>
                <div className="sm:col-span-2">
                  <span className="mb-1.5 block text-[11.5px] font-medium text-[var(--neutral-sub-600)]">
                    Room type
                  </span>
                  <div className="inline-flex rounded-[10px] border border-[var(--stroke-soft-200)] bg-[var(--white-0)] p-1">
                    {(['shared', 'personal'] as const).map((option) => {
                      const active = roomType === option;
                      return (
                        <button
                          key={option}
                          type="button"
                          onClick={() => setRoomType(option)}
                          className={cn(
                            active
                              ? 'h-8 rounded-[8px] bg-[var(--information-lighter)] px-3 text-[12px] font-medium text-[var(--info-dark)]'
                              : 'h-8 rounded-[8px] px-3 text-[12px] font-medium text-[var(--neutral-sub-600)] transition-colors hover:bg-[var(--neutral-weak-50)] hover:text-[var(--neutral-strong-950)]',
                          )}
                        >
                          {getRoomTypeLabel(option)}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="rounded-[10px] border border-[var(--stroke-soft-200)] bg-[var(--neutral-weak-50)] px-3.5 py-3 sm:col-span-2">
                  <p className="text-[11.5px] text-[var(--neutral-sub-600)]">
                    GitHub is optional now. Create the room first, then configure connectors, tools, and any shared repo context inside the room.
                  </p>
                </div>
              </div>

              {/* Footer — actions live here so the user always sees
                  them without scrolling. The left side echoes the
                  room identity so the user confirms before create. */}
              <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-[var(--stroke-soft-200)] pt-3">
                <p className="min-w-0 truncate text-[11.5px] text-[var(--neutral-soft-400)]">
                  {roomName.trim() ? (
                    <>
                      Creating{' '}
                      <span className="text-[var(--neutral-strong-950)]">
                        {roomName.trim()}
                      </span>
                    </>
                  ) : (
                    'Enter a room name to continue.'
                  )}
                </p>
                <div className="flex gap-1.5">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => {
                      setShowCreate(false);
                      setRoomName('');
                      setRoomDescription('');
                      setRoomType('shared');
                    }}
                    disabled={submittingCreate}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    variant="primary"
                    disabled={submittingCreate || !roomName.trim()}
                  >
                    {submittingCreate ? 'Creating…' : 'Create room'}
                  </Button>
                </div>
              </div>
            </motion.form>
          )}

          {/* Inline Join form */}
          {showJoin && (
            <motion.form
              onSubmit={handleJoin}
              variants={fadeUp}
              className="rounded-[12px] border border-[var(--stroke-soft-200)] bg-white p-4 shadow-[0_1px_2px_rgba(23,23,23,0.04)]"
            >
              <p className="mb-1 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[var(--neutral-soft-400)]">
                Join a room
              </p>
              <p className="mb-3 text-[12px] text-[var(--neutral-sub-600)]">
                Paste the invite code a teammate shared with you.
              </p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
                <Input
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value)}
                  placeholder="aeg-..."
                  autoFocus
                />
                {/* size="lg" (h-9) so the Cancel + Join-room buttons
                    share their height with the Input above (also h-9).
                    Default Button md is h-8, which left a 4px height
                    delta and made the row read as "buttons too short
                    for the input." */}
                <div className="flex gap-1.5">
                  <Button
                    type="button"
                    size="lg"
                    variant="secondary"
                    onClick={() => {
                      setShowJoin(false);
                      setJoinCode('');
                    }}
                    disabled={submittingJoin}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    size="lg"
                    variant="primary"
                    disabled={submittingJoin || !joinCode.trim()}
                  >
                    {submittingJoin ? 'Joining…' : 'Join room'}
                  </Button>
                </div>
              </div>
            </motion.form>
          )}

          {/* Rooms list or empty state */}
          {rooms.length === 0 ? (
            <motion.div
              variants={fadeUp}
              className="overflow-hidden rounded-[12px] border border-[var(--stroke-soft-200)] bg-white p-2 shadow-[0_1px_2px_rgba(23,23,23,0.04)]"
            >
              <EmptyState
                icon={<DoorOpen className="h-5 w-5" />}
                title="Set up your first room"
                description="Rooms group members, connectors, and policies for governed agent work. Create one first, then wire in the systems that room needs."
                action={
                  <div className="flex flex-wrap items-center justify-center gap-2">
                    <Button
                      variant="primary"
                      onClick={() => {
                        setShowCreate(true);
                        setShowJoin(false);
                      }}
                      leadingIcon={
                        <Plus className="h-3.5 w-3.5" strokeWidth={2.25} />
                      }
                    >
                      Create a room
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={() => {
                        setShowJoin(true);
                        setShowCreate(false);
                      }}
                    >
                      Got an invite? Join with code
                    </Button>
                  </div>
                }
              />
              {/* Three-feature reassurance strip — teaches what a
                  room actually unlocks. Appears below the empty
                  state so the description doesn't get long. */}
              <div className="grid grid-cols-1 gap-3 border-t border-[var(--stroke-soft-200)] p-5 sm:grid-cols-3">
                <FeatureNote
                  icon={<Shield className="h-3.5 w-3.5" strokeWidth={2} />}
                  title="Tool policies"
                  body="Allow or deny each MCP tool per role. Roles inherit a hierarchy: OWNER > ADMIN > DEVELOPER."
                />
                <FeatureNote
                  icon={<Users className="h-3.5 w-3.5" strokeWidth={2} />}
                  title="Team membership"
                  body="Invite teammates with role-scoped invite codes that expire and limit uses."
                />
                <FeatureNote
                  icon={<Plus className="h-3.5 w-3.5" strokeWidth={2} />}
                  title="MCP endpoint"
                  body="Every room ships with an MCP URL. Point Cursor or Claude Code at it to enforce the room policy."
                />
              </div>
            </motion.div>
          ) : (
            <motion.ul
              variants={staggerContainer(0.03, 0.04)}
              initial={reduce ? false : 'hidden'}
              animate="show"
              className="overflow-hidden rounded-[12px] border border-[var(--stroke-soft-200)] bg-white shadow-[0_1px_2px_rgba(23,23,23,0.04)]"
            >
              {rooms.map((room) => {
                const id = getRoomId(room);
                const displayName = getRoomDisplayName(room);
                const slug = getRoomSlug(displayName, id);
                const createdAt = getRoomCreatedAt(room);
                const linkedRepo =
                  room.repo_name && room.repo_name !== displayName ? room.repo_name : null;
                const description = room.description?.trim() || null;
                return (
                  <motion.li
                    key={id}
                    variants={fadeUpSm}
                    className="group border-b border-[var(--stroke-soft-200)] last:border-b-0"
                  >
                    <Link
                      href={`/dashboard/rooms/${id}`}
                      /* primary-lighter/50 hover matches the shared
                         <Table> TR pattern. Was --neutral-weak-50,
                         which read as "did anything change?" against
                         the white card. */
                      className="flex items-center gap-4 px-5 py-4 transition-colors hover:bg-[var(--primary-lighter)]/50"
                    >
                      {/* Generative avatar — deterministic from the
                          room name, so users learn to recognize each
                          room by its color signature. Falls back to
                          the room id if the backend has not returned
                          the human label yet. */}
                      <GenerativeAvatar
                        seed={displayName || id}
                        variant="user"
                        size={40}
                        radius={10}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[14px] font-semibold tracking-[-0.005em] text-[var(--neutral-strong-950)]">
                          {displayName}
                        </p>
                        {description ? (
                          <p className="mt-0.5 truncate text-[11.5px] text-[var(--neutral-sub-600)]">
                            {description}
                          </p>
                        ) : null}
                        <p className="mt-0.5 truncate text-[11.5px] text-[var(--neutral-soft-400)]">
                          <span className="text-[var(--neutral-sub-600)]">
                            {slug}
                          </span>
                          {linkedRepo && (
                            <>
                              {' · repo '}
                              <span className="font-mono text-[var(--neutral-sub-600)]">
                                {linkedRepo}
                              </span>
                            </>
                          )}
                          {createdAt && (
                            <>
                              {' · created '}
                              <RelativeTime
                                timestamp={createdAt}
                                className="inline"
                              />
                            </>
                          )}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        {room.room_type ? (
                          <Badge tone="neutral" uppercase className="text-[10.5px]">
                            {getRoomTypeLabel(room.room_type)}
                          </Badge>
                        ) : null}
                        {(room.role || typeof room.role_rank === 'number') && (
                          <Badge
                            tone={getRoomRoleBadgeTone(room.role, room.role_rank)}
                            uppercase
                            className="text-[10.5px]"
                          >
                            {getRoomRoleLabel(room.role, room.role_rank)}
                          </Badge>
                        )}
                      </div>
                      <ChevronRight
                        className="h-4 w-4 shrink-0 text-[var(--neutral-soft-400)] transition-transform group-hover:translate-x-0.5 group-hover:text-[var(--neutral-strong-950)]"
                        strokeWidth={2}
                        aria-hidden
                      />
                    </Link>
                  </motion.li>
                );
              })}
            </motion.ul>
          )}
        </motion.div>
      </div>
    </>
  );
}

// ─── Feature note (empty-state reassurance strip) ───────────────────
function FeatureNote({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-[6px] bg-[var(--neutral-weak-50)] text-[var(--neutral-sub-600)]">
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-[12px] font-semibold tracking-[-0.005em] text-[var(--neutral-strong-950)]">
          {title}
        </p>
        <p className="mt-0.5 text-[11px] leading-[1.45] text-[var(--neutral-soft-400)]">
          {body}
        </p>
      </div>
    </div>
  );
}
