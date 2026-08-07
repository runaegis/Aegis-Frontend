'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { motion, useReducedMotion } from 'motion/react';
import { DUR, EASE, fadeUp, fadeUpSm, staggerContainer } from '@/lib/motion';
import {
  ArrowUpRight,
  Bell,
  CheckCircle2,
  ChevronRight,
  Clock,
  Gauge,
  History,
  Inbox,
  Shield,
  Sparkles,
  Pencil,
  XCircle,
  type LucideIcon,
} from 'lucide-react';
import { api } from '@/lib/api';
import { useAutoRefresh, useUser } from '@/lib/hooks';
import {
  formatDashboardDateRangeLabel,
  getActionDateFilters,
  matchesActionDateFilters,
} from '@/lib/dashboardDateRange';
import { useDashboardData } from '@/lib/dashboardDataContext';
import { MCPApproval, RoomSummary, SessionAction } from '@/lib/types';
import {
  formatExecutionTimeMs,
  normalizeApprovalStatus,
  truncate,
} from '@/lib/utils';
import Topbar from '@/components/layout/Topbar';
import { AgentMark } from '@/components/ui/AgentMark';
import DecisionBadge, { decisionColor } from '@/components/ui/DecisionBadge';
import EmptyState from '@/components/ui/EmptyState';
import ErrorBanner from '@/components/ui/ErrorBanner';
import { DashboardHomeSkeleton } from '@/components/ui/PageSkeletons';
import { RelativeTime } from '@/components/ui/RelativeTime';
import { Button } from '@/components/ui/Button';
import { CodeChip } from '@/components/ui/CodeChip';
import { ConnectorMark } from '@/components/ui/ConnectorMark';
import { connectorForAction, connectorForTool, deriveTarget, formatRunTargetLabel } from '@/lib/runConnector';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import GithubPatStatus from '@/components/ui/GithubPatStatus';
import { useToast } from '@/components/ui/Toast';

function greeting(now: Date): string {
  const h = now.getHours();
  if (h < 5) return 'Good evening';
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function approvalBucket(
  approval: Pick<MCPApproval, 'status' | 'approved_at'>,
): 'pending' | 'approved' | 'rejected' {
  const normalized = normalizeApprovalStatus(approval.status, approval.approved_at);
  if (normalized === 'pending') return 'pending';
  if (normalized === 'rejected') return 'rejected';
  return 'approved';
}

export default function DashboardHomePage() {
  const { user, isLoading: userLoading } = useUser();
  const {
    dateRange,
    setDateRange,
    sessionActions,
    metrics,
    runsLoading,
    runsError,
    dismissRunsError,
    refreshRuns,
    lastUpdated,
  } = useDashboardData();
  const toast = useToast();
  const reduce = useReducedMotion();
  const dateFilters = useMemo(() => getActionDateFilters(dateRange), [dateRange]);
  const rangeLabel = useMemo(
    () => formatDashboardDateRangeLabel(dateRange, 'All time'),
    [dateRange],
  );
  const [approvals, setApprovals] = useState<MCPApproval[]>([]);
  const [rooms, setRooms] = useState<RoomSummary[]>([]);
  const [auxLoading, setAuxLoading] = useState(true);
  const [auxError, setAuxError] = useState<string | null>(null);
  const [actioningIds, setActioningIds] = useState<Set<string>>(new Set());
  // Pending Deny confirmation — null when no dialog is open. Same
  // pattern as /dashboard/approvals: gate the destructive path,
  // let Approve fire-and-forget.
  const [pendingDeny, setPendingDeny] = useState<MCPApproval | null>(null);

  const fetchAuxiliaryData = useCallback(async (options?: { soft?: boolean }) => {
    if (!user) return;
    if (!options?.soft) setAuxLoading(true);
    try {
      const [approvalsData, roomsData] = await Promise.all([
        api.getMcpApprovals().catch(() => []),
        api.getMyRooms().catch(() => []),
      ]);
      setApprovals(
        approvalsData.filter((approval) =>
          matchesActionDateFilters(approval.created_at, dateFilters),
        ),
      );
      setRooms(roomsData);
      setAuxError(null);
    } catch (err) {
      setAuxError(err instanceof Error ? err.message : 'Could not connect to backend');
    } finally {
      if (!options?.soft) setAuxLoading(false);
    }
  }, [user, dateFilters]);

  useEffect(() => {
    if (user?.id) {
      void fetchAuxiliaryData();
    } else if (!userLoading) {
      setAuxLoading(false);
    }
  }, [user?.id, userLoading, fetchAuxiliaryData]);

  useAutoRefresh(() => {
    void fetchAuxiliaryData({ soft: true });
  }, 60000);

  const handleRefresh = useCallback(async () => {
    await Promise.all([
      refreshRuns(),
      fetchAuxiliaryData(),
    ]);
  }, [refreshRuns, fetchAuxiliaryData]);

  // ── Derived metrics ────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const pendingApprovals = approvals.filter(
      (a) => approvalBucket(a) === 'pending',
    ).length;

    return {
      sessionsInRange: new Set(
        sessionActions.map((r) => r.session_id).filter(Boolean),
      ).size,
      pendingApprovals,
      governedRooms: rooms.length,
      blockedInRange: metrics.denies,
      rewritesInRange: metrics.rewrites,
    };
  }, [sessionActions, approvals, rooms.length, metrics.denies, metrics.rewrites]);

  const pendingItems = useMemo(
    () =>
      approvals
        .filter((a) => approvalBucket(a) === 'pending')
        .slice(0, 5),
    [approvals],
  );

  const recentRuns = useMemo(() => sessionActions.slice(0, 8), [sessionActions]);
  const username = user?.username || 'there';

  // Decision distribution percentages
  const distribution = useMemo(() => {
    const total =
      metrics.allows + metrics.denies + metrics.rewrites + metrics.approvals;
    const safe = total === 0 ? 1 : total;
    return [
      // `color` stays saturated for the distribution bar (needs to read
      // clearly at a glance. Keep the legend dot identical so the
      // visual mapping is one-to-one.
      { key: 'allow',    label: 'Allow',    value: metrics.allows,    pct: (metrics.allows / safe) * 100,    color: 'var(--success)',     dot: 'var(--success)' },
      { key: 'rewrite',  label: 'Rewrite',  value: metrics.rewrites,  pct: (metrics.rewrites / safe) * 100,  color: 'var(--feature)',     dot: 'var(--feature)' },
      { key: 'approval', label: 'Approval', value: metrics.approvals, pct: (metrics.approvals / safe) * 100, color: 'var(--warning)',     dot: 'var(--warning)' },
      { key: 'deny',     label: 'Deny',     value: metrics.denies,    pct: (metrics.denies / safe) * 100,    color: 'var(--error)',       dot: 'var(--error)' },
    ];
  }, [metrics]);

  // ── Action handlers ────────────────────────────────────────────────────────
  const handleApproval = async (id: string, reject: boolean) => {
    setActioningIds((prev) => new Set(prev).add(id));
    try {
      await api.executeMcpApproval(id, reject);
      await handleRefresh();
      // Match the /approvals page toast pattern exactly so a reviewer
      // gets identical feedback regardless of which surface they
      // acted on. Approve = success, deny = warning (denial blocks).
      if (reject) {
        toast.warning('Request denied', {
          description: 'The agent will receive the rejection.',
        });
      } else {
        toast.success('Request approved', {
          description: 'The agent can proceed with the action.',
        });
      }
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : 'Failed to update approval';
      setAuxError(msg);
      toast.error('Approval failed', { description: msg });
    } finally {
      setActioningIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  if (userLoading || runsLoading || auxLoading) {
    return (
      <>
        <Topbar
          title="Dashboard"
          subtitle="Overview"
          showDateRange
          dateRangeValue={dateRange}
          onDateRangeChange={setDateRange}
        />
        {/* Same content container as the loaded state (mx-auto +
            max-w-[1320px] 2xl:max-w-[1480px] + horizontal/vertical padding) so the
            skeleton's gray blocks respect the page gutters instead
            of going edge-to-edge — matches every other dashboard
            page's loading layout. */}
        <div className="mx-auto max-w-[1320px] 2xl:max-w-[1480px] px-4 py-6 sm:px-6 sm:py-7 lg:px-8 lg:py-8">
          <DashboardHomeSkeleton />
        </div>
      </>
    );
  }

  return (
    <>
      <Topbar
        title="Dashboard"
        subtitle="Overview"
        lastUpdated={lastUpdated}
        onRefresh={handleRefresh}
        unreadCount={stats.pendingApprovals}
        showDateRange
        dateRangeValue={dateRange}
        onDateRangeChange={setDateRange}
      />

      <div className="mx-auto max-w-[1320px] 2xl:max-w-[1480px] px-4 py-6 sm:px-6 sm:py-7 lg:px-8 lg:py-8">
        {(runsError || auxError) && (
          <div className="mb-6">
            <ErrorBanner
              message={runsError || auxError || 'Could not connect to backend'}
              onDismiss={() => {
                if (runsError) dismissRunsError();
                if (auxError) setAuxError(null);
              }}
              onRetry={handleRefresh}
            />
          </div>
        )}

        {/* ─── Greeting block ────────────────────────────────────────── */}
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
            Overview · {rangeLabel}
          </motion.p>
          <motion.h1
            variants={fadeUp}
            className="text-[28px] font-semibold leading-[1.1] tracking-[-0.03em] text-[var(--neutral-strong-950)]"
          >
            {greeting(new Date())}, {username}
          </motion.h1>
          <motion.p
            variants={fadeUp}
            className="mt-3 max-w-[640px] text-[13.5px] leading-[1.55] text-[var(--neutral-sub-600)]"
          >
            You have{' '}
            <ColoredCount value={stats.pendingApprovals} color="var(--primary-base)" />{' '}
            {stats.pendingApprovals === 1 ? 'approval' : 'approvals'} in this range,{' '}
            <ColoredCount value={stats.blockedInRange} color="var(--error)" />{' '}
            blocked {stats.blockedInRange === 1 ? 'run' : 'runs'}, and{' '}
            <ColoredCount value={stats.sessionsInRange} color="var(--success)" />{' '}
            {stats.sessionsInRange === 1 ? 'session' : 'sessions'} across{' '}
            <ColoredCount value={stats.governedRooms} color="var(--feature)" />{' '}
            {stats.governedRooms === 1 ? 'room' : 'rooms'}.
          </motion.p>
        </motion.header>

        {/* GitHub PAT alert, only when invalid or missing. */}
        <GithubPatStatus className="mb-6" />

        {/* ─── Hero — Decision distribution ─────────────────────────── */}
        <motion.section
          className="relative mb-6 overflow-hidden rounded-[12px] border border-[var(--stroke-soft-200)] bg-white shadow-[0_1px_2px_rgba(23,23,23,0.04)]"
          initial={reduce ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: DUR.slow, ease: EASE.out, delay: 0.18 }}
        >
          {/* Subtle inset orange-tinted gradient — 4px inset on all four
              sides so it reads as a soft "inner panel" wash rather than
              a hard fill. Fades to fully transparent before mid-card so
              most of the surface stays clean white. */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-1 rounded-[8px]"
            style={{
              background:
                'linear-gradient(180deg, rgba(250, 115, 25, 0.07) 0%, rgba(250, 115, 25, 0.03) 28%, rgba(255, 255, 255, 0) 60%)',
            }}
          />
          <div className="relative flex flex-wrap items-end justify-between gap-3 px-6 pt-6">
            <div>
              <div className="mb-2 flex items-center gap-2">
                <SectionIcon icon={Gauge} />
                <p className="text-[10.5px] font-semibold uppercase tracking-[0.1em] text-[var(--neutral-soft-400)]">
                  Decision overview
                </p>
              </div>
              <div className="flex items-baseline gap-2.5">
                <span className="text-[30px] font-semibold leading-none tracking-[-0.04em] tabular-nums text-[var(--neutral-strong-950)] sm:text-[38px]">
                  {metrics.total.toLocaleString()}
                </span>
                <span className="text-[13px] text-[var(--neutral-sub-600)]">
                  total decisions evaluated
                </span>
              </div>
            </div>
            <Link
              href="/dashboard/runs"
              className="group inline-flex items-center gap-1 text-[12.5px] font-medium text-[var(--neutral-sub-600)] transition-colors hover:text-[var(--primary-base)]"
            >
              View all runs
              <ArrowUpRight
                className="h-3.5 w-3.5 transition-transform group-hover:-translate-y-px group-hover:translate-x-px"
                strokeWidth={2}
              />
            </Link>
          </div>

          {/* Distribution bar */}
          <div className="relative px-6 pt-6">
            <div className="flex h-[10px] w-full items-stretch gap-[2px] overflow-hidden">
              {distribution.map((seg, i) =>
                seg.pct > 0 ? (
                  <motion.span
                    key={seg.key}
                    className="block rounded-[3px]"
                    style={{ backgroundColor: seg.color }}
                    initial={reduce ? { width: `${seg.pct}%` } : { width: 0 }}
                    animate={{ width: `${seg.pct}%` }}
                    transition={{
                      duration: DUR.bar,
                      ease: EASE.out,
                      delay: 0.4 + i * 0.08,
                    }}
                    title={`${seg.label}: ${seg.value}`}
                  />
                ) : null,
              )}
              {metrics.total === 0 && (
                <span
                  className="block flex-1 rounded-[3px]"
                  style={{ backgroundColor: 'var(--neutral-soft-200)' }}
                />
              )}
            </div>
          </div>

          {/* Legend — 4 cells separated by vertical dividers */}
          <motion.div
            className="relative mt-5 grid grid-cols-2 sm:grid-cols-4 divide-y divide-[var(--stroke-soft-200)] sm:divide-x sm:divide-y-0 border-t border-[var(--stroke-soft-200)]"
            variants={staggerContainer(0.04, 0.5)}
            initial={reduce ? false : 'hidden'}
            animate="show"
          >
            {distribution.map((seg) => (
              <motion.div key={seg.key} variants={fadeUpSm} className="px-6 py-4">
                <div className="flex items-center gap-2">
                  <span
                    className="h-[7px] w-[7px] rounded-full ring-1 ring-inset"
                    style={{
                      backgroundColor: seg.dot,
                      // Faint ring of the saturated hue at low alpha — gives
                      // the pastel dot a subtle outline so it doesn't look
                      // washed-out on the white card.
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      ['--tw-ring-color' as any]: `color-mix(in srgb, ${seg.color} 24%, transparent)`,
                    }}
                    aria-hidden
                  />
                  <span className="text-[10.5px] font-semibold uppercase tracking-[0.06em] text-[var(--neutral-soft-400)]">
                    {seg.label}
                  </span>
                </div>
                <div className="mt-1.5 flex items-baseline gap-2">
                  <span className="text-[22px] font-semibold leading-none tracking-[-0.03em] tabular-nums text-[var(--neutral-strong-950)]">
                    {seg.value.toLocaleString()}
                  </span>
                  <span className="text-[12px] text-[var(--neutral-soft-400)] tabular-nums">
                    {metrics.total === 0 ? '0%' : `${Math.round(seg.pct)}%`}
                  </span>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </motion.section>

        {/*
        ─── 6-cell stat strip ─────────────────────────────────────
        Commented out per request.
        <motion.section
          className="mb-6 overflow-hidden rounded-[12px] border border-[var(--stroke-soft-200)] bg-white shadow-[0_1px_2px_rgba(23,23,23,0.04)]"
          initial={reduce ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: DUR.slow, ease: EASE.out, delay: 0.28 }}
        >
          <motion.div
            className="grid grid-cols-2 divide-y divide-[var(--stroke-soft-200)] sm:grid-cols-3 sm:divide-y-0 lg:grid-cols-6 lg:divide-x lg:divide-y-0"
            variants={staggerContainer(0.04, 0.4)}
            initial={reduce ? false : 'hidden'}
            animate="show"
          >
            <StatCell
              label="Sessions in range"
              value={stats.sessionsInRange}
              color={stats.sessionsInRange > 0 ? 'var(--success)' : undefined}
            />
            <StatCell label="Runs in range" value={metrics.total} />
            <StatCell
              label="Pending approvals"
              value={stats.pendingApprovals}
              color={stats.pendingApprovals > 0 ? 'var(--primary-base)' : undefined}
            />
            <StatCell label="Governed rooms" value={stats.governedRooms} />
            <StatCell
              label="Blocked in range"
              value={stats.blockedInRange}
              color={stats.blockedInRange > 0 ? 'var(--error)' : undefined}
            />
            <StatCell
              label="Rewrites in range"
              value={stats.rewritesInRange}
              color={stats.rewritesInRange > 0 ? 'var(--feature)' : undefined}
            />
          </motion.div>
        </motion.section>
        */}

        {/* ─── Two-column: activity feed + pending approvals ───────────────
             items-start so each column is its natural height (no stretch
             leaving empty space below the shorter one), and the left
             column is sticky-top so it stays visible if approvals scrolls
             much taller than activity. */}
        <motion.div
          className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_380px]"
          initial={reduce ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: DUR.slow, ease: EASE.out, delay: 0.42 }}
        >
          {/* Recent activity */}
          <section className="overflow-hidden rounded-[12px] border border-[var(--stroke-soft-200)] bg-white shadow-[0_1px_2px_rgba(23,23,23,0.04)] lg:sticky lg:top-[72px]">
            <div className="flex items-center justify-between p-4">
              <div className="flex items-center gap-2">
                <SectionIcon icon={History} />
                <h2 className="text-[14px] font-semibold tracking-[-0.01em] text-[var(--neutral-strong-950)]">
                  Recent activity
                </h2>
                <span className="inline-flex h-[18px] items-center justify-center rounded-[5px] bg-[var(--neutral-weak-50)] px-[6px] text-[10.5px] font-bold tabular-nums text-[var(--neutral-sub-600)]">
                  {sessionActions.length.toLocaleString()}
                </span>
              </div>
              <Link
                href="/dashboard/runs"
                className="group inline-flex items-center gap-1 text-[12.5px] font-medium text-[var(--neutral-sub-600)] transition-colors hover:text-[var(--primary-base)]"
              >
                View all
                <ArrowUpRight
                  className="h-3 w-3 transition-transform group-hover:-translate-y-px group-hover:translate-x-px"
                  strokeWidth={2}
                />
              </Link>
            </div>

            {recentRuns.length === 0 ? (
              <div className="border-t border-[var(--stroke-soft-200)]">
                <EmptyState
                  icon={<Shield className="h-5 w-5" />}
                  title="No agent activity yet"
                  description="Create a Room, then wire up your agent from its Connect tab."
                  action={
                    <Link href="/dashboard/rooms">
                      <Button variant="primary">Go to Rooms</Button>
                    </Link>
                  }
                  compact
                />
              </div>
            ) : (
              <motion.ul
                className="divide-y divide-[var(--stroke-soft-200)] border-t border-[var(--stroke-soft-200)]"
                variants={staggerContainer(0.03, 0.55)}
                initial={reduce ? false : 'hidden'}
                animate="show"
              >
                {recentRuns.map((run) => (
                  <ActivityRow key={run.id} run={run} />
                ))}
              </motion.ul>
            )}
          </section>

          {/* Pending approvals */}
          <section className="overflow-hidden rounded-[12px] border border-[var(--stroke-soft-200)] bg-white shadow-[0_1px_2px_rgba(23,23,23,0.04)]">
            <div className="flex items-center justify-between p-4">
              <div className="flex items-center gap-2">
                <SectionIcon icon={Inbox} />
                <h2 className="text-[14px] font-semibold tracking-[-0.01em] text-[var(--neutral-strong-950)]">
                  Pending approvals
                </h2>
                {stats.pendingApprovals > 0 && (
                  <span
                    className="inline-flex h-[18px] items-center justify-center rounded-[5px] px-[6px] text-[10.5px] font-bold text-white tabular-nums"
                    style={{ backgroundColor: 'var(--primary-base)' }}
                  >
                    {stats.pendingApprovals.toLocaleString()}
                  </span>
                )}
              </div>
              <Link
                href="/dashboard/approvals"
                className="group inline-flex items-center gap-1 text-[12.5px] font-medium text-[var(--neutral-sub-600)] transition-colors hover:text-[var(--primary-base)]"
              >
                All
                <ArrowUpRight
                  className="h-3 w-3 transition-transform group-hover:-translate-y-px group-hover:translate-x-px"
                  strokeWidth={2}
                />
              </Link>
            </div>

            {pendingItems.length === 0 ? (
              <div className="border-t border-[var(--stroke-soft-200)]">
                <EmptyState
                  icon={<Bell className="h-5 w-5" />}
                  title="All clear"
                  description="No approvals waiting for review."
                  compact
                />
              </div>
            ) : (
              <motion.ul
                className="divide-y divide-[var(--stroke-soft-200)] border-t border-[var(--stroke-soft-200)]"
                variants={staggerContainer(0.04, 0.55)}
                initial={reduce ? false : 'hidden'}
                animate="show"
              >
                {pendingItems.map((approval) => (
                  <ApprovalRow
                    key={approval.id}
                    approval={approval}
                    isActioning={actioningIds.has(approval.id)}
                    onAction={(id, reject) => {
                      if (reject) {
                        const target = pendingItems.find((a) => a.id === id);
                        if (target) setPendingDeny(target);
                      } else {
                        handleApproval(id, false);
                      }
                    }}
                  />
                ))}
              </motion.ul>
            )}
          </section>
        </motion.div>
      </div>
      {/* Deny confirmation. Same shape as /dashboard/approvals so
          the destructive interaction feels consistent across both
          surfaces where pending approvals can be acted on. */}
      <ConfirmDialog
        open={pendingDeny !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDeny(null);
        }}
        variant="danger"
        title="Deny this action?"
        description={
          pendingDeny ? (
            <>
              {(() => {
                const denyTarget = formatRunTargetLabel(
                  deriveTarget(pendingDeny),
                  'the selected target',
                );
                return (
                  <>
                    The agent will be blocked from running{' '}
                    <span className="font-mono text-[12.5px] text-[var(--neutral-strong-950)]">
                      {pendingDeny.tool_name}
                    </span>{' '}
                    on{' '}
                    <span className="font-mono text-[12.5px] text-[var(--neutral-strong-950)]">
                      {denyTarget}
                    </span>
                    . The denial appears in the audit log and can&apos;t be undone.
                  </>
                );
              })()}
            </>
          ) : null
        }
        confirmLabel="Deny request"
        loading={pendingDeny ? actioningIds.has(pendingDeny.id) : false}
        onConfirm={async () => {
          if (!pendingDeny) return;
          const id = pendingDeny.id;
          setPendingDeny(null);
          await handleApproval(id, true);
        }}
      />
    </>
  );
}

// ── Coloured inline value ────────────────────────────────────────────────────
function ColoredCount({ value, color }: { value: number; color: string }) {
  return (
    <span
      className="font-semibold tabular-nums"
      style={{ color }}
    >
      {value.toLocaleString()}
    </span>
  );
}

// ── Decision icon ────────────────────────────────────────────────────────────
function DecisionIcon({ decision }: { decision: string }) {
  const upper = (decision ?? '').toUpperCase();
  const color = decisionColor(decision);

  let Icon = CheckCircle2;
  if (upper === 'DENY' || upper === 'REJECTED' || upper === 'DENIED') Icon = XCircle;
  // REWRITE icon: Pencil = universal "edited/modified" — instantly
  // recognizable at 14px. Iteration history: Wand2 (felt AI-magic),
  // Replace (barely readable at this size per user). Pencil sticks.
  else if (upper === 'REWRITE') Icon = Pencil;
  else if (upper.includes('APPROVAL') || upper === 'PENDING') Icon = Sparkles;

  return (
    <Icon
      className="h-3.5 w-3.5 shrink-0"
      style={{ color }}
      strokeWidth={2}
      aria-hidden
    />
  );
}

// ── Activity row ─────────────────────────────────────────────────────────────
function ActivityRow({ run }: { run: SessionAction }) {
  return (
    <motion.li variants={fadeUpSm}>
      <Link
        href="/dashboard/runs"
        className="flex items-center gap-3 px-6 py-3.5 transition-colors hover:bg-[var(--primary-lighter)]/60"
      >
        <DecisionIcon decision={run.decision} />
        <AgentMark name={run.agent_name || ''} size="xs" />
        <span className="shrink-0 text-[13px] font-medium text-[var(--neutral-strong-950)]">
          {run.agent_name || 'Unknown'}
        </span>
        <span className="hidden items-center gap-1.5 sm:inline-flex">
          <ConnectorMark
            id={connectorForTool(run.tool_name)}
            size="xs"
            className="cursor-default"
          />
          <CodeChip>{run.tool_name}</CodeChip>
        </span>
        <span className="min-w-0 flex-1 truncate text-[12.5px] text-[var(--neutral-sub-600)]">
          {truncate(run.action_summary, 60)}
        </span>
        {run.execution_time != null && (
          <span className="hidden text-[11px] text-[var(--neutral-soft-400)] tabular-nums md:inline">
            {formatExecutionTimeMs(run.execution_time)}
          </span>
        )}
        <RelativeTime
          timestamp={run.timestamp}
          className="hidden text-[11px] text-[var(--neutral-soft-400)] tabular-nums lg:inline"
        />
        <DecisionBadge decision={run.decision} />
        <ChevronRight
          className="h-3.5 w-3.5 shrink-0 text-[var(--neutral-soft-400)]"
          strokeWidth={2}
        />
      </Link>
    </motion.li>
  );
}

// ── Approval row ─────────────────────────────────────────────────────────────
function ApprovalRow({
  approval,
  isActioning,
  onAction,
}: {
  approval: MCPApproval;
  isActioning: boolean;
  onAction: (id: string, reject: boolean) => void;
}) {
  const agentName =
    typeof approval.context?.user === 'string' ? approval.context.user : 'Agent';
  const summary =
    typeof approval.action_summary === 'string'
      ? approval.action_summary
      : `Requested tool: ${approval.tool_name}`;
  const target = deriveTarget(approval);

  return (
    <motion.li
      variants={fadeUpSm}
      className="group px-6 py-4 transition-colors hover:bg-[var(--primary-lighter)]/60"
    >
      <div className="flex items-center gap-2">
        {/* Inline status dot — sits between the start of the row and the
            avatar so it has proper breathing room from the card edge. */}
        <span
          className="aegis-live-dot inline-block h-1.5 w-1.5 shrink-0 rounded-full"
          style={{ backgroundColor: 'var(--primary-base)', color: 'var(--primary-base)' }}
          aria-hidden
        />
        <AgentMark name={agentName} size="xs" />
        <span className="truncate text-[12.5px] font-semibold text-[var(--neutral-strong-950)]">
          {agentName}
        </span>
        <span className="ml-auto inline-flex items-center gap-1 text-[11px] text-[var(--neutral-soft-400)]">
          <Clock className="h-3 w-3" strokeWidth={2} />
          <RelativeTime timestamp={approval.created_at} />
        </span>
      </div>

      <p
        className="mt-2 line-clamp-2 text-[12.5px] font-medium leading-[1.5] tracking-[-0.01em] text-[var(--neutral-strong-950)]"
        title={summary}
      >
        {summary}
      </p>

      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
        <ConnectorMark
          id={connectorForAction(approval)}
          size="xs"
          className="cursor-default"
        />
        <CodeChip>{approval.tool_name}</CodeChip>
        {target.primary && <CodeChip>{target.primary}</CodeChip>}
        {target.secondary && <CodeChip>{target.secondary}</CodeChip>}
      </div>

      <div className="mt-3 flex items-center justify-end gap-1.5">
        <Button
          size="sm"
          variant="secondary"
          disabled={isActioning}
          onClick={() => onAction(approval.id, true)}
        >
          Deny
        </Button>
        <Button
          size="sm"
          variant="primary"
          disabled={isActioning}
          onClick={() => onAction(approval.id, false)}
        >
          Approve
        </Button>
      </div>
    </motion.li>
  );
}

/**
 * Bare 24×24 Lucide icon next to the card title in brand orange. No box —
 * the icon acts as a typographic anchor that signals the section's identity.
 */
function SectionIcon({ icon: Icon }: { icon: LucideIcon }) {
  return (
    <Icon
      className="h-4 w-4 shrink-0"
      style={{ color: 'var(--primary-base)' }}
      strokeWidth={2}
      aria-hidden
    />
  );
}
