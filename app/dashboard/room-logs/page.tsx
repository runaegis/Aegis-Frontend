'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import {
  Activity,
  ChevronRight,
  History,
  Search,
  Users,
} from 'lucide-react';

import { api, AuthError } from '@/lib/api';
import { useAutoRefresh, useUser } from '@/lib/hooks';
import { PaginatedResponse, RoomSessionAction, RoomSummary } from '@/lib/types';
import {
  extractPullRequestUrl,
  formatExecutionTimeMs,
  formatFullTimestamp,
  readBlastRadius,
} from '@/lib/utils';
import { DUR, EASE, fadeUp, fadeUpSm, staggerContainer } from '@/lib/motion';

import Topbar from '@/components/layout/Topbar';
import AgentAvatar from '@/components/ui/AgentAvatar';
import { Badge } from '@/components/ui/Badge';
import { BlastRadiusChip } from '@/components/ui/BlastRadiusChip';
import { Button } from '@/components/ui/Button';
import { CodeChip } from '@/components/ui/CodeChip';
import DecisionBadge, { decisionColor } from '@/components/ui/DecisionBadge';
import EmptyState from '@/components/ui/EmptyState';
import ErrorBanner from '@/components/ui/ErrorBanner';
import { Input } from '@/components/ui/Input';
import JsonViewer from '@/components/ui/JsonViewer';
import { RoomLogsSkeleton } from '@/components/ui/PageSkeletons';
import PaginatedLayout from '@/components/ui/PaginatedLayout';
import { PolicyChip } from '@/components/ui/PolicyChip';
import { PullRequestLink } from '@/components/ui/PullRequestLink';
import { RelativeTime } from '@/components/ui/RelativeTime';
import { Table, TBody, TD, TH, THead, TR, TRExpanded } from '@/components/ui/Table';
import { ToolLogo, getAgentToolId } from '@/components/ui/ToolLogo';

const PAGE_SIZE = 20;

const EMPTY_PAGE: PaginatedResponse<RoomSessionAction> = {
  items: [],
  total: 0,
  page: 1,
  page_size: PAGE_SIZE,
  pages: 0,
};

const getRoomId = (room: RoomSummary): string =>
  String(room.id || room.room_id || '');

export default function RoomLogsPage() {
  const { user, isLoading: userLoading } = useUser();
  const reduce = useReducedMotion();

  const [rooms, setRooms] = useState<RoomSummary[]>([]);
  const [roomsLoading, setRoomsLoading] = useState(true);
  const [roomFilter, setRoomFilter] = useState('');

  const [selectedRoomId, setSelectedRoomId] = useState<string>('');
  const [data, setData] = useState<PaginatedResponse<RoomSessionAction>>(EMPTY_PAGE);
  const [page, setPage] = useState(1);
  const [logsLoading, setLogsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  // ── Fetch the user's rooms (the picker source) ─────────────────────────
  const fetchRooms = useCallback(async () => {
    if (userLoading) return;
    if (!user) {
      setRooms([]);
      setRoomsLoading(false);
      return;
    }
    setRoomsLoading(true);
    try {
      const data = await api.getMyRooms();
      setRooms(data);
      setError(null);
      if (data.length > 0) {
        setSelectedRoomId((prev) => {
          const stillExists = data.some((r) => getRoomId(r) === prev);
          return stillExists && prev ? prev : getRoomId(data[0]);
        });
      } else {
        setSelectedRoomId('');
      }
    } catch (err) {
      if (err instanceof AuthError) return;
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setRoomsLoading(false);
    }
  }, [user, userLoading]);

  useEffect(() => {
    fetchRooms();
  }, [fetchRooms]);

  // Reset to page 1 whenever the user picks a different room — otherwise
  // we'd send `page=N` against a room that may only have a few entries.
  useEffect(() => {
    setPage(1);
    setExpandedRow(null);
  }, [selectedRoomId]);

  // ── Fetch the activity log for the selected room/page ──────────────────
  const fetchLogs = useCallback(async () => {
    if (!selectedRoomId) {
      setData(EMPTY_PAGE);
      return;
    }
    setLogsLoading(true);
    try {
      const result = await api.getSessionsByRoomId(selectedRoomId, page, PAGE_SIZE);
      setData(result);
      setError(null);
    } catch (err) {
      if (err instanceof AuthError) return;
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLogsLoading(false);
    }
  }, [selectedRoomId, page]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  // Auto-refresh the visible page every 30s, mirroring the runs page.
  const { lastUpdated } = useAutoRefresh(fetchLogs, 30000);

  const refresh = useCallback(async () => {
    await Promise.all([fetchRooms(), fetchLogs()]);
  }, [fetchRooms, fetchLogs]);

  const selectedRoom = useMemo(
    () => rooms.find((r) => getRoomId(r) === selectedRoomId) ?? null,
    [rooms, selectedRoomId],
  );

  const filteredRooms = useMemo(() => {
    const q = roomFilter.trim().toLowerCase();
    if (!q) return rooms;
    return rooms.filter((r) => {
      const id = getRoomId(r).toLowerCase();
      const name = (r.repo_name || '').toLowerCase();
      const owner = (r.owner_username || '').toLowerCase();
      return id.includes(q) || name.includes(q) || owner.includes(q);
    });
  }, [rooms, roomFilter]);

  if (userLoading || (roomsLoading && rooms.length === 0)) {
    return (
      <>
        <Topbar title="Room Logs" subtitle="Per-room audit trail" />
        <div className="mx-auto max-w-[1320px] px-4 py-6 sm:px-6 sm:py-7 lg:px-8 lg:py-8">
          <RoomLogsSkeleton />
        </div>
      </>
    );
  }

  return (
    <>
      <Topbar
        title="Room Logs"
        subtitle="Per-room audit trail"
        lastUpdated={lastUpdated}
        onRefresh={refresh}
      />
      <div className="mx-auto max-w-[1320px] px-4 py-6 sm:px-6 sm:py-7 lg:px-8 lg:py-8">
        {error && (
          <div className="mb-6">
            <ErrorBanner
              message={error}
              onDismiss={() => setError(null)}
              onRetry={refresh}
            />
          </div>
        )}

        {/* Eyebrow + page title */}
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
            Room activity
          </motion.p>
          <motion.h1
            variants={fadeUp}
            className="text-[26px] font-semibold leading-[1.1] tracking-[-0.03em] text-[var(--neutral-strong-950)]"
          >
            Pick a room to see what your team did
          </motion.h1>
          <motion.p
            variants={fadeUp}
            className="mt-2 text-[13.5px] text-[var(--neutral-sub-600)]"
          >
            Every agent action attributed to the team member that ran it ·
            auto-refresh every 30s.
          </motion.p>
        </motion.header>

        {rooms.length === 0 ? (
          <div className="overflow-hidden rounded-[12px] border border-[var(--stroke-soft-200)] bg-white shadow-[0_1px_2px_rgba(23,23,23,0.04)]">
            <EmptyState
              icon={<Users className="h-5 w-5" />}
              title="No rooms yet"
              description="Create or join a room from the Rooms page to start collecting per-team activity."
              action={
                <Link href="/dashboard/rooms">
                  <Button variant="primary">Go to Rooms</Button>
                </Link>
              }
            />
          </div>
        ) : (
          <motion.div
            className="grid grid-cols-1 gap-6 xl:grid-cols-[280px_minmax(0,1fr)]"
            initial={reduce ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: DUR.slow, ease: EASE.out, delay: 0.16 }}
          >
            {/* Room picker ─────────────────────────────────────────────── */}
            <aside className="self-start overflow-hidden rounded-[12px] border border-[var(--stroke-soft-200)] bg-white shadow-[0_1px_2px_rgba(23,23,23,0.04)] xl:sticky xl:top-[80px]">
              <div className="flex items-center justify-between gap-2 border-b border-[var(--stroke-soft-200)] px-4 py-3">
                <h2 className="text-[13px] font-semibold tracking-[-0.005em] text-[var(--neutral-strong-950)]">
                  Your rooms
                </h2>
                <span className="inline-flex h-[18px] items-center justify-center rounded-[5px] bg-[var(--neutral-weak-50)] px-[6px] text-[10.5px] font-bold tabular-nums text-[var(--neutral-sub-600)]">
                  {rooms.length.toLocaleString()}
                </span>
              </div>

              {rooms.length > 6 && (
                <div className="border-b border-[var(--stroke-soft-200)] p-3">
                  <Input
                    type="text"
                    placeholder="Filter rooms…"
                    value={roomFilter}
                    onChange={(e) => setRoomFilter(e.target.value)}
                    leadingIcon={<Search className="h-3.5 w-3.5" strokeWidth={2} />}
                  />
                </div>
              )}

              {filteredRooms.length === 0 ? (
                <p className="px-4 py-6 text-center text-[12px] text-[var(--neutral-soft-400)]">
                  No rooms match.
                </p>
              ) : (
                <ul className="max-h-[520px] divide-y divide-[var(--stroke-soft-200)] overflow-auto">
                  {filteredRooms.map((room) => {
                    const id = getRoomId(room);
                    const active = id === selectedRoomId;
                    return (
                      <li key={id}>
                        <button
                          type="button"
                          onClick={() => setSelectedRoomId(id)}
                          aria-current={active ? 'page' : undefined}
                          className={[
                            'flex w-full items-center gap-2.5 px-4 py-3 text-left transition-colors',
                            active
                              ? 'bg-[var(--primary-alpha-10)]'
                              : 'hover:bg-[var(--neutral-weak-50)]',
                          ].join(' ')}
                        >
                          <AgentAvatar
                            name={room.repo_name || id}
                            size="sm"
                          />
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
                            <p className="truncate text-[10.5px] text-[var(--neutral-soft-400)] [font-family:var(--font-geist-mono),ui-monospace,monospace]">
                              {id.substring(0, 8)}…
                            </p>
                          </div>
                          {room.role && (
                            <Badge tone="info" uppercase className="shrink-0">
                              {room.role}
                            </Badge>
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </aside>

            {/* Activity log ─────────────────────────────────────────────── */}
            <div className="space-y-4">
              <RoomHeader
                room={selectedRoom}
                roomId={selectedRoomId}
                total={data.total}
              />

              <div className="overflow-hidden rounded-[12px] border border-[var(--stroke-soft-200)] bg-white shadow-[0_1px_2px_rgba(23,23,23,0.04)]">
                {logsLoading && data.items.length === 0 ? (
                  <div className="p-10 text-center text-[12.5px] text-[var(--neutral-soft-400)]">
                    Loading activity…
                  </div>
                ) : data.items.length === 0 ? (
                  <EmptyState
                    icon={<History className="h-5 w-5" />}
                    title="No activity yet"
                    description="Once teammates run agents against this room, every action will show up here with the user that triggered it."
                  />
                ) : (
                  <PaginatedLayout
                    total={data.total}
                    page={data.page}
                    pages={data.pages}
                    page_size={data.page_size}
                    onPageChange={(next) => {
                      setPage(next);
                      setExpandedRow(null);
                    }}
                  >
                    <Table>
                      <THead>
                        <tr>
                          <TH>User</TH>
                          <TH>Tool</TH>
                          <TH>Branch</TH>
                          <TH>Policy</TH>
                          <TH>Blast radius</TH>
                          <TH>Decision</TH>
                          <TH className="text-right">Time</TH>
                          <TH aria-label="Expand" className="w-8" />
                        </tr>
                      </THead>
                      <TBody>
                        {data.items.map((action) => (
                          <RoomActionRow
                            key={action.id}
                            action={action}
                            isExpanded={expandedRow === action.id}
                            onToggle={() =>
                              setExpandedRow(
                                expandedRow === action.id ? null : action.id,
                              )
                            }
                          />
                        ))}
                      </TBody>
                    </Table>
                  </PaginatedLayout>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </>
  );
}

// ── Selected-room header card ─────────────────────────────────────────────

function RoomHeader({
  room,
  roomId,
  total,
}: {
  room: RoomSummary | null;
  roomId: string;
  total: number;
}) {
  if (!roomId) {
    return (
      <div className="rounded-[12px] border border-[var(--stroke-soft-200)] bg-white px-5 py-6 text-[12.5px] text-[var(--neutral-soft-400)] shadow-[0_1px_2px_rgba(23,23,23,0.04)]">
        Select a room from the list to view its activity.
      </div>
    );
  }
  return (
    <motion.div
      variants={fadeUpSm}
      initial="hidden"
      animate="show"
      className="overflow-hidden rounded-[12px] border border-[var(--stroke-soft-200)] bg-white shadow-[0_1px_2px_rgba(23,23,23,0.04)]"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 p-4">
        <div className="flex min-w-0 items-center gap-3">
          <AgentAvatar name={room?.repo_name || roomId} size="md" />
          <div className="min-w-0">
            <p className="truncate text-[15px] font-semibold tracking-[-0.01em] text-[var(--neutral-strong-950)]">
              {room?.repo_name || 'Room'}
            </p>
            <p className="mt-0.5 truncate text-[11.5px] text-[var(--neutral-soft-400)] [font-family:var(--font-geist-mono),ui-monospace,monospace]">
              {roomId}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 text-[11.5px] text-[var(--neutral-soft-400)]">
          <span className="inline-flex items-center gap-1.5">
            <Activity className="h-3.5 w-3.5" strokeWidth={2} />
            <span className="tabular-nums font-semibold text-[var(--neutral-strong-950)]">
              {total.toLocaleString()}
            </span>
            {total === 1 ? 'action' : 'actions'}
          </span>
          {room?.role && (
            <Badge tone="info" uppercase>
              {room.role}
            </Badge>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// ── A single row + its expanded inspector ─────────────────────────────────

function RoomActionRow({
  action,
  isExpanded,
  onToggle,
}: {
  action: RoomSessionAction;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const [stillExpanded, setStillExpanded] = useState(isExpanded);
  useEffect(() => {
    if (isExpanded) setStillExpanded(true);
  }, [isExpanded]);

  const userLabel = action.username?.trim() || 'Unknown user';
  const toolId = getAgentToolId(action.agent_name || '');
  const prUrl = extractPullRequestUrl({
    action_pointers: action.action_pointers,
    result: action.result,
    arguments: action.arguments,
  });

  return (
    <>
      <TR clickable isExpanded={stillExpanded} onClick={onToggle}>
        <TD>
          <div className="flex items-center gap-2.5">
            <span
              className="inline-block h-1.5 w-1.5 shrink-0 rounded-full"
              style={{ backgroundColor: decisionColor(action.decision) }}
              aria-hidden
            />
            <AgentAvatar name={userLabel} size="xs" />
            <div className="min-w-0">
              <p className="truncate text-[13px] font-semibold text-[var(--neutral-strong-950)]">
                {userLabel}
              </p>
              <p className="mt-0.5 flex items-center gap-1.5 text-[11px] text-[var(--neutral-soft-400)]">
                {toolId ? (
                  <span
                    className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-full bg-white ring-1 ring-[var(--stroke-soft-200)]"
                    aria-hidden
                  >
                    <ToolLogo id={toolId} size={9} />
                  </span>
                ) : null}
                <span className="truncate">{action.agent_name || '—'}</span>
              </p>
            </div>
          </div>
        </TD>
        <TD>
          <CodeChip>{action.tool_name}</CodeChip>
        </TD>
        <TD className="max-w-[200px]">
          {action.target_branch ? (
            <CodeChip className="max-w-full" title={action.target_branch}>
              <span className="block truncate">{action.target_branch}</span>
            </CodeChip>
          ) : (
            <span className="text-[var(--neutral-soft-400)]">—</span>
          )}
        </TD>
        <TD className="whitespace-nowrap">
          <PolicyChip policy={action.policy} showEmpty />
        </TD>
        <TD className="whitespace-nowrap">
          <BlastRadiusChip value={readBlastRadius(action)} showEmpty />
        </TD>
        <TD className="whitespace-nowrap">
          <div className="flex flex-col items-start gap-1">
            <DecisionBadge decision={action.decision} />
            {prUrl && <PullRequestLink url={prUrl} variant="chip" />}
          </div>
        </TD>
        <TD className="whitespace-nowrap text-right tabular-nums">
          <div className="flex flex-col items-end gap-1">
            <RelativeTime
              timestamp={action.timestamp}
              className="whitespace-nowrap text-[12px] text-[var(--neutral-soft-400)]"
            />
            {action.execution_time !== undefined &&
              action.execution_time !== null && (
                <CodeChip>{formatExecutionTimeMs(action.execution_time)}</CodeChip>
              )}
          </div>
        </TD>
        <TD className="w-8 text-right">
          <ChevronRight
            className={`ml-auto h-3.5 w-3.5 text-[var(--neutral-soft-400)] transition-transform duration-150 group-hover:translate-x-0.5 group-hover:text-[var(--neutral-strong-950)] ${
              isExpanded ? 'rotate-90' : ''
            }`}
            strokeWidth={2}
          />
        </TD>
      </TR>
      <AnimatePresence
        initial={false}
        onExitComplete={() => setStillExpanded(false)}
      >
        {isExpanded && (
          <TRExpanded key="expanded" colSpan={8}>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              <div>
                <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.05em] text-[var(--neutral-soft-400)]">
                  Full summary
                </p>
                <p className="text-[13px] text-[var(--neutral-strong-950)]">
                  {action.action_summary || '—'}
                </p>
                {Array.isArray(action.action_pointers) &&
                  action.action_pointers.length > 0 && (
                    <ul className="mt-3 space-y-1 text-[12px] text-[var(--neutral-sub-600)]">
                      {action.action_pointers.map((p, i) => (
                        <li key={i} className="flex gap-2">
                          <span
                            aria-hidden
                            className="mt-[5px] inline-block h-1 w-1 shrink-0 rounded-full bg-[var(--neutral-soft-400)]"
                          />
                          <span className="break-words">{p}</span>
                        </li>
                      ))}
                    </ul>
                  )}
              </div>
              <div className="grid grid-cols-2 gap-3 text-[12px] md:grid-cols-4">
                <Meta label="Repository" value={action.target_repo || '—'} />
                <Meta label="Sequence" value={`#${action.sequence_order}`} />
                <Meta
                  label="Session"
                  href={`/dashboard/sessions?id=${action.session_id}`}
                  value={`${action.session_id?.substring(0, 8) ?? ''}…`}
                  mono
                />
                <Meta
                  label="Timestamp"
                  value={formatFullTimestamp(action.timestamp)}
                />
                <Meta
                  label="Execution"
                  value={formatExecutionTimeMs(action.execution_time)}
                />
                <Meta label="User ID" value={action.user_id} mono />
              </div>
            </div>
            {action.arguments && Object.keys(action.arguments).length > 0 && (
              <div className="mt-4">
                <JsonViewer
                  data={action.arguments}
                  collapsed={false}
                  label="Arguments"
                />
              </div>
            )}
          </TRExpanded>
        )}
      </AnimatePresence>
    </>
  );
}

function Meta({
  label,
  value,
  href,
  mono,
}: {
  label: string;
  value: string;
  href?: string;
  mono?: boolean;
}) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] font-semibold uppercase tracking-[0.05em] text-[var(--neutral-soft-400)]">
        {label}
      </p>
      {href ? (
        <Link
          href={href}
          onClick={(e) => e.stopPropagation()}
          className={[
            'mt-0.5 block truncate text-[var(--primary-base)] hover:underline',
            mono
              ? '[font-family:var(--font-geist-mono),ui-monospace,monospace]'
              : '',
          ].join(' ')}
        >
          {value}
        </Link>
      ) : (
        <p
          className={[
            'mt-0.5 truncate text-[var(--neutral-strong-950)]',
            mono
              ? '[font-family:var(--font-geist-mono),ui-monospace,monospace]'
              : '',
          ].join(' ')}
          title={value}
        >
          {value}
        </p>
      )}
    </div>
  );
}
