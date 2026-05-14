'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import {
  ChevronDown,
  ChevronRight,
  Clock,
  GitBranch,
  Hash,
  Layers,
  Timer,
} from 'lucide-react';
import { api } from '@/lib/api';
import { useAutoRefresh, useUser } from '@/lib/hooks';
import { Session, SessionAction } from '@/lib/types';
import {
  formatDuration,
  formatExecutionTimeMs,
  formatRelativeTime,
} from '@/lib/utils';
import Topbar from '@/components/layout/Topbar';
import AgentAvatar from '@/components/ui/AgentAvatar';
import DecisionBadge from '@/components/ui/DecisionBadge';
import EmptyState from '@/components/ui/EmptyState';
import ErrorBanner from '@/components/ui/ErrorBanner';
import JsonViewer from '@/components/ui/JsonViewer';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { CodeChip } from '@/components/ui/CodeChip';
import { DUR, EASE, fadeUp, fadeUpSm, staggerContainer } from '@/lib/motion';

export default function SessionsPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedSession, setExpandedSession] = useState<string | null>(null);
  const { user, isLoading: userLoading } = useUser();
  const reduce = useReducedMotion();

  const fetchData = useCallback(async () => {
    if (!user?.id) {
      if (!userLoading) {
        setSessions([]);
        setLoading(false);
      }
      return;
    }
    setLoading(true);
    try {
      const data = await api.getSessions(user?.id);
      setSessions(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load sessions');
    } finally {
      setLoading(false);
    }
  }, [user?.id, userLoading]);

  useEffect(() => {
    if (user?.id) fetchData();
    else if (!userLoading) {
      setSessions([]);
      setLoading(false);
    }
  }, [user?.id, userLoading, fetchData]);

  const { lastUpdated } = useAutoRefresh(fetchData, 30000);

  if (userLoading || loading) {
    return (
      <>
        <Topbar title="Sessions" subtitle="Agent working sessions" />
        <div className="flex h-[60vh] items-center justify-center">
          <LoadingSpinner size="lg" />
        </div>
      </>
    );
  }

  return (
    <>
      <Topbar
        title="Sessions"
        subtitle="Agent working sessions"
        lastUpdated={lastUpdated}
        onRefresh={fetchData}
      />
      <div className="mx-auto max-w-[1320px] px-4 py-6 sm:px-6 sm:py-7 lg:px-8 lg:py-8">
        {error && (
          <div className="mb-6">
            <ErrorBanner
              message={error}
              onDismiss={() => setError(null)}
              onRetry={fetchData}
            />
          </div>
        )}

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
            Agent sessions
          </motion.p>
          <motion.h1
            variants={fadeUp}
            className="text-[26px] font-semibold leading-[1.1] tracking-[-0.03em] text-[var(--neutral-strong-950)]"
          >
            Every working session, grouped
          </motion.h1>
          <motion.p
            variants={fadeUp}
            className="mt-2 text-[13.5px] text-[var(--neutral-sub-600)]"
          >
            <span className="font-semibold text-[var(--neutral-strong-950)]">
              {sessions.length.toLocaleString()}
            </span>{' '}
            {sessions.length === 1 ? 'session' : 'sessions'} · click any row to inspect its actions.
          </motion.p>
        </motion.header>

        {sessions.length === 0 ? (
          <div className="overflow-hidden rounded-[12px] border border-[var(--stroke-soft-200)] bg-white shadow-[0_1px_2px_rgba(23,23,23,0.04)]">
            <EmptyState
              icon={<Layers className="h-5 w-5" />}
              title="No sessions yet"
              description="Sessions will appear here once your agent starts working."
            />
          </div>
        ) : (
          <motion.div
            className="overflow-hidden rounded-[12px] border border-[var(--stroke-soft-200)] bg-white shadow-[0_1px_2px_rgba(23,23,23,0.04)]"
            initial={reduce ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: DUR.slow, ease: EASE.out, delay: 0.16 }}
          >
            <motion.ul
              className="divide-y divide-[var(--stroke-soft-200)]"
              variants={staggerContainer(0.03, 0.24)}
              initial={reduce ? false : 'hidden'}
              animate="show"
            >
              {sessions.map((session) => (
                <SessionRow
                  key={session.session_id}
                  session={session}
                  userId={user?.id}
                  isExpanded={expandedSession === session.session_id}
                  onToggle={() =>
                    setExpandedSession(
                      expandedSession === session.session_id ? null : session.session_id,
                    )
                  }
                />
              ))}
            </motion.ul>
          </motion.div>
        )}
      </div>
    </>
  );
}

function SessionRow({
  session,
  userId,
  isExpanded,
  onToggle,
}: {
  session: Session;
  userId?: string;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const [actions, setActions] = useState<SessionAction[] | null>(null);
  const [loadingActions, setLoadingActions] = useState(false);

  const handleToggle = async () => {
    onToggle();
    if (!isExpanded && !actions) {
      setLoadingActions(true);
      try {
        const data = await api.getSessionActions(session.session_id, userId);
        setActions(data);
      } catch {
        setActions([]);
      } finally {
        setLoadingActions(false);
      }
    }
  };

  const repos = Array.isArray(session.repos) ? session.repos.filter(Boolean) : [];
  const totalDecisions =
    Number(session.allows) +
    Number(session.rewrites) +
    Number(session.approvals) +
    Number(session.denies);

  // Delayed visual-expanded state — keeps the trigger button's gradient
  // styling on screen until the panel's exit animation completes, so the
  // trigger doesn't "snap" back to white while the panel is still
  // collapsing below it.
  const [stillExpanded, setStillExpanded] = useState(isExpanded);
  useEffect(() => {
    if (isExpanded) setStillExpanded(true);
  }, [isExpanded]);

  return (
    <motion.li variants={fadeUpSm} className="bg-white">
      <button
        onClick={handleToggle}
        className={
          stillExpanded
            ? // Top half of the continuous orange → white wash. End-stop
              // (/45) matches the panel's start-stop below so the gradient
              // reads as one smooth fade across the whole expanded block.
              'flex w-full items-center gap-3 bg-gradient-to-b from-[var(--primary-lighter)]/55 to-[var(--primary-lighter)]/45 px-4 py-[14px] text-left transition-colors sm:gap-4 sm:px-6'
            : // Default: subtle hover-orange when contracted (matches Table TR).
              'flex w-full items-center gap-3 px-4 py-[14px] text-left transition-colors hover:bg-[var(--primary-lighter)]/60 sm:gap-4 sm:px-6'
        }
      >
        <AgentAvatar name={session.agent_name || ''} size="sm" />

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2.5">
            <span className="truncate text-[13.5px] font-semibold tracking-[-0.005em] text-[var(--neutral-strong-950)]">
              {session.agent_name || 'Unknown'}
            </span>
            {/* Session-id chip — hidden on tiny screens to save space */}
            <span className="hidden sm:inline-flex">
              <CodeChip>{session.session_id?.substring(0, 8)}…</CodeChip>
            </span>
          </div>
          <div className="mt-[3px] flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] text-[var(--neutral-soft-400)]">
            <span className="inline-flex items-center gap-1">
              <Clock className="h-3 w-3" strokeWidth={2} />
              {formatRelativeTime(session.started_at)}
            </span>
            <span className="text-[var(--stroke-sub-300)]">·</span>
            <span className="inline-flex items-center gap-1">
              <Layers className="h-3 w-3" strokeWidth={2} />
              <span className="font-semibold text-[var(--neutral-sub-600)]">
                {Number(session.action_count).toLocaleString()}
              </span>{' '}
              {Number(session.action_count) === 1 ? 'action' : 'actions'}
            </span>
            {repos.length > 0 && (
              <>
                <span className="hidden text-[var(--stroke-sub-300)] sm:inline">·</span>
                <span className="hidden items-center gap-1 sm:inline-flex">
                  <GitBranch className="h-3 w-3" strokeWidth={2} />
                  <span className="truncate max-w-[260px]">{repos.join(', ')}</span>
                </span>
              </>
            )}
          </div>
        </div>

        {/* Decision distribution — hidden below md; on mobile the pills
            push other content and are redundant with the expanded panel. */}
        <div className="hidden w-[220px] shrink-0 justify-end md:flex">
          {totalDecisions > 0 ? (
            <div className="flex items-center gap-1.5">
              <DecisionStat value={Number(session.allows)} color="var(--success)" label="allow" />
              <DecisionStat value={Number(session.rewrites)} color="var(--feature)" label="rewrite" />
              <DecisionStat value={Number(session.approvals)} color="var(--warning)" label="approve" />
              <DecisionStat value={Number(session.denies)} color="var(--error)" label="deny" />
            </div>
          ) : (
            <span className="text-[11.5px] text-[var(--neutral-soft-400)]">—</span>
          )}
        </div>

        <ChevronDown
          className={`h-4 w-4 shrink-0 text-[var(--neutral-soft-400)] transition-transform duration-200 ${
            isExpanded ? 'rotate-0' : '-rotate-90'
          }`}
          strokeWidth={2}
        />
      </button>

      <AnimatePresence
        initial={false}
        onExitComplete={() => setStillExpanded(false)}
      >
      {isExpanded && (
        <motion.div
          key="expanded"
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.24, ease: [0.2, 0.8, 0.2, 1] }}
          style={{ overflow: 'hidden', willChange: 'height' }}
          // Bottom half of the continuous orange → white wash. Start-stop
          // (/45) matches the trigger's end-stop above so the gradient
          // hands off seamlessly into the panel.
          className="bg-gradient-to-b from-[var(--primary-lighter)]/45 to-white"
        >
        <div className="px-4 pb-5 pt-1 sm:px-6">
          {/* Inner surface — pure white card so it reads as a true nested panel */}
          <div className="overflow-hidden rounded-[10px] border border-[var(--stroke-soft-200)] bg-white shadow-[0_1px_2px_rgba(23,23,23,0.04)]">
            {/* Header strip with session meta */}
            <div className="flex items-center justify-between border-b border-[var(--stroke-soft-200)] bg-[var(--neutral-weak-50)] px-4 py-2.5">
              <div className="flex items-center gap-2 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[var(--neutral-soft-400)]">
                <Hash className="h-3 w-3" strokeWidth={2.25} />
                <span>Action timeline</span>
                {actions && (
                  <span className="text-[var(--neutral-sub-600)]">
                    · {actions.length}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5 text-[11px] text-[var(--neutral-soft-400)]">
                <Timer className="h-3 w-3" strokeWidth={2} />
                <span className="tabular-nums">
                  {formatDuration(session.started_at, session.last_action_at)}
                </span>
              </div>
            </div>

            {loadingActions ? (
              <div className="flex justify-center py-8">
                <LoadingSpinner />
              </div>
            ) : actions && actions.length > 0 ? (
              <ol className="px-4 py-3">
                {actions.map((action, idx) => (
                  <li
                    key={action.id}
                    className="relative flex gap-3 pb-3 last:pb-0"
                  >
                    {/* Timeline gutter: dot + line share the same column;
                        the line passes through BEHIND the dot so the dot
                        sits visually on the rail with the line tucking
                        under both sides. */}
                    <div className="relative flex w-[14px] shrink-0 justify-center pt-[8px]">
                      {idx < actions.length - 1 && (
                        <span
                          aria-hidden
                          className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-[var(--stroke-soft-200)]"
                        />
                      )}
                      <span
                        aria-hidden
                        className="relative z-10 inline-block h-[9px] w-[9px] rounded-full bg-[var(--neutral-soft-400)] ring-2 ring-white"
                      />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="rounded-[8px] border border-[var(--stroke-soft-200)] bg-white p-3 transition-colors hover:border-[var(--stroke-sub-300)]">
                        {/* Summary row */}
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                              <span className="text-[10.5px] font-semibold tabular-nums text-[var(--neutral-soft-400)]">
                                {String(idx + 1).padStart(2, '0')}
                              </span>
                              <CodeChip>{action.tool_name}</CodeChip>
                              {action.execution_time !== undefined &&
                                action.execution_time !== null && (
                                  <span className="inline-flex items-center gap-1 text-[11px] text-[var(--neutral-soft-400)]">
                                    <Timer className="h-3 w-3" strokeWidth={2} />
                                    <span className="tabular-nums">
                                      {formatExecutionTimeMs(action.execution_time)}
                                    </span>
                                  </span>
                                )}
                              <span className="text-[var(--stroke-sub-300)] text-[11px]">·</span>
                              <span className="text-[11px] text-[var(--neutral-soft-400)]">
                                {formatRelativeTime(action.timestamp)}
                              </span>
                            </div>
                            <p className="mt-1.5 text-[13px] leading-[1.45] text-[var(--neutral-strong-950)]">
                              {action.action_summary}
                            </p>
                          </div>
                          <DecisionBadge decision={action.decision} />
                        </div>

                        {/* Arguments — full-width below the summary row so the
                            JSON panel has equal breathing room left & right. */}
                        {action.arguments &&
                          Object.keys(action.arguments).length > 0 && (
                            <div className="mt-2.5">
                              <JsonViewer
                                data={action.arguments}
                                collapsed={false}
                                label="Arguments"
                              />
                            </div>
                          )}
                      </div>
                    </div>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="py-8 text-center text-[12.5px] text-[var(--neutral-soft-400)]">
                No actions found.
              </p>
            )}

            {actions && actions.length > 0 && (
              <div className="flex items-center justify-end gap-2 border-t border-[var(--stroke-soft-200)] bg-[var(--neutral-weak-50)] px-4 py-2.5">
                <Link
                  href={`/dashboard/runs?session=${session.session_id}`}
                  className="inline-flex items-center gap-1 text-[12px] font-medium text-[var(--neutral-sub-600)] hover:text-[var(--primary-base)]"
                >
                  View all runs
                  <ChevronRight className="h-3.5 w-3.5" strokeWidth={2} />
                </Link>
              </div>
            )}
          </div>
        </div>
        </motion.div>
      )}
      </AnimatePresence>
    </motion.li>
  );
}

function DecisionStat({
  value,
  color,
  label,
}: {
  value: number;
  color: string;
  label: string;
}) {
  if (!value) return null;
  return (
    <span
      title={`${value} ${label}${value === 1 ? '' : 's'}`}
      className="inline-flex h-[22px] items-center gap-1.5 rounded-[6px] border border-[var(--stroke-soft-200)] bg-white px-2 text-[11.5px] font-semibold tabular-nums"
      style={{ color }}
    >
      <span
        aria-hidden
        className="inline-block h-[6px] w-[6px] rounded-full"
        style={{ backgroundColor: color }}
      />
      {value.toLocaleString()}
    </span>
  );
}
