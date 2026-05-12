'use client';

import { useState, useCallback, useEffect } from 'react';
import { Layers, ChevronDown, ChevronRight, Clock, GitBranch } from 'lucide-react';
import { api } from '@/lib/api';
import { useAutoRefresh, useUser } from '@/lib/hooks';
import { Session, SessionAction } from '@/lib/types';
import {
  cn,
  formatRelativeTime,
  formatDuration,
  formatExecutionTimeMs,
  formatMcpAegisToolDisplayName,
  getToolChipStyle,
  getToolAccentHue,
} from '@/lib/utils';
import Topbar from '@/components/layout/Topbar';
import DecisionBadge from '@/components/ui/DecisionBadge';
import AgentAvatar from '@/components/ui/AgentAvatar';
import EmptyState from '@/components/ui/EmptyState';
import ErrorBanner from '@/components/ui/ErrorBanner';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import Link from 'next/link';
import { ActionPointersDetail, decisionStripeClass } from '@/components/dashboard/ActionPointers';
import { RunDetailViewModeToggle } from '@/components/dashboard/RunDetailViewModeToggle';
import { CanonicalJsonViewer } from '@/components/ui/CanonicalJsonViewer';
import { toSessionActionRawJsonView } from '@/lib/canonicalSessionAction';

export default function SessionsPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedSession, setExpandedSession] = useState<string | null>(null);
  const { user, isLoading: userLoading } = useUser();

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
    if (user?.id) {
      fetchData();
    } else if (!userLoading) {
      setSessions([]);
      setLoading(false);
    }
  }, [user?.id, userLoading, fetchData]);

  const { lastUpdated } = useAutoRefresh(fetchData, 30000);

  if (userLoading || loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_120%_80%_at_50%_-20%,rgba(52,211,153,0.12),transparent_50%),radial-gradient(ellipse_90%_60%_at_100%_0%,rgba(139,92,246,0.1),transparent_45%),radial-gradient(ellipse_70%_50%_at_0%_100%,rgba(56,189,248,0.06),transparent_40%)]"
        aria-hidden
      />
      <div className="relative">
        <Topbar
          title="Sessions"
          subtitle="Agent working sessions"
          lastUpdated={lastUpdated}
          onRefresh={fetchData}
        />
        <div className="p-6">
          {error && (
            <div className="mb-4">
              <ErrorBanner message={error} onDismiss={() => setError(null)} onRetry={fetchData} />
            </div>
          )}

          {sessions.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-card/70 shadow-xl shadow-black/30 ring-1 ring-white/5 backdrop-blur-sm">
              <EmptyState
                icon={<Layers className="h-6 w-6" />}
                title="No sessions yet"
                description="Sessions will appear here once your agent starts working."
              />
            </div>
          ) : (
            <div className="space-y-3">
              {sessions.map((session) => (
                <SessionCard
                  key={session.session_id}
                  session={session}
                  userId={user?.id}
                  isExpanded={expandedSession === session.session_id}
                  onToggle={() =>
                    setExpandedSession(
                      expandedSession === session.session_id ? null : session.session_id
                    )
                  }
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SessionSummaryStats({ session }: { session: Session }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {Number(session.allows) > 0 && (
        <span className="rounded-md bg-emerald-950/50 px-2 py-0.5 text-[10px] font-medium text-emerald-400/85">
          {session.allows} allow
        </span>
      )}
      {Number(session.denies) > 0 && (
        <span className="rounded-md bg-red-950/45 px-2 py-0.5 text-[10px] font-medium text-red-400/80">
          {session.denies} deny
        </span>
      )}
      {Number(session.rewrites) > 0 && (
        <span className="rounded-md bg-amber-950/40 px-2 py-0.5 text-[10px] font-medium text-amber-400/85">
          {session.rewrites} rewrite
        </span>
      )}
    </div>
  );
}

function SessionCard({
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

  return (
    <div className=" overflow-hidden rounded-2xl border border-white/10 bg-card/80 shadow-lg shadow-black/25 ring-1 ring-inset ring-white/[0.04] backdrop-blur-sm">
      <button
        type="button"
        onClick={handleToggle}
        className="w-full px-4 py-3.5 text-left transition-colors hover:bg-white/[0.03] cursor-pointer"
      >
        <div className="hover:cursor-pointer flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <span className="shrink-0 rounded-full ring-1 ring-zinc-700/80 ring-offset-2 ring-offset-zinc-950">
              <AgentAvatar name={session.agent_name || ''} size="sm" />
            </span>
            <div className="min-w-0">
              <span className="block truncate text-sm font-medium text-zinc-100">{session.agent_name}</span>
              <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-500">
                <span className="inline-flex items-center gap-1">
                  <Clock className="h-3 w-3 shrink-0" />
                  Last activity {formatRelativeTime(session.last_action_at)}
                </span>
                <span>{session.action_count} actions</span>
                {repos.length > 0 && (
                  <span className="truncate text-zinc-400">{repos.join(' · ')}</span>
                )}
              </div>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <SessionSummaryStats session={session} />
            {isExpanded ? (
              <ChevronDown className="h-4 w-4 text-zinc-500" />
            ) : (
              <ChevronRight className="h-4 w-4 text-zinc-500" />
            )}
          </div>
        </div>
      </button>

      {isExpanded && (
        <div className="border-t border-white/[0.08] bg-zinc-950/35 px-4 py-4">
          {loadingActions ? (
            <div className="flex justify-center py-6">
              <LoadingSpinner />
            </div>
          ) : actions && actions.length > 0 ? (
            <>
              <div className="space-y-3">
                {actions.map((action) => (
                  <SessionActionCard key={action.id} action={action} />
                ))}
              </div>
              <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-500">
                <span>Duration: {formatDuration(session.started_at, session.last_action_at)}</span>
                <Link
                  href="/dashboard"
                  className="font-medium text-zinc-400 transition-colors hover:text-zinc-200"
                >
                  Open runs
                </Link>
              </div>
            </>
          ) : (
            <p className="py-4 text-center text-sm text-zinc-500">No actions found.</p>
          )}
        </div>
      )}
    </div>
  );
}

function SessionActionCard({ action }: { action: SessionAction }) {
  const [detailMode, setDetailMode] = useState<'details' | 'raw_json'>('details');
  const toolDisplay = formatMcpAegisToolDisplayName(action.tool_name || '');
  const chipStyle = getToolChipStyle(action.tool_name || '');
  const toolHue = getToolAccentHue(action.tool_name || '');
  const hasPointers = (action.action_pointers?.length ?? 0) > 0;
  const hasArgs = action.arguments && Object.keys(action.arguments).length > 0;

  return (
    <div
      className={cn(
        'rounded-lg border border-white/[0.06] border-l-[3px] bg-zinc-900/40 p-3 ',
        decisionStripeClass(action.decision)
      )}
    >
      <RunDetailViewModeToggle mode={detailMode} onModeChange={setDetailMode} className="mb-3" />
      {detailMode === 'raw_json' ? (
        <div className="space-y-2" onClick={(e) => e.stopPropagation()}>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
            Canonical action fields (agent, tool, arguments, result, repo, branch)
          </p>
          <CanonicalJsonViewer value={toSessionActionRawJsonView(action)} />
        </div>
      ) : (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
          <div className="min-w-0 flex-1 space-y-2">
            <p className="text-sm font-medium leading-snug text-zinc-100">{action.action_summary}</p>
            <div className="flex flex-wrap items-center gap-2">
              <code
                className="inline-flex max-w-full truncate rounded-md border-0 px-2 py-0.5 font-mono text-[11px] shadow-none outline-none ring-0"
                style={chipStyle}
                title={action.tool_name || undefined}
              >
                {toolDisplay}
              </code>
              <span className="text-xs text-zinc-500">{formatRelativeTime(action.timestamp)}</span>
              {action.execution_time !== undefined && action.execution_time !== null && (
                <span className="rounded-md bg-zinc-800/55 px-1.5 py-0.5 text-[10px] font-medium font-mono text-zinc-500">
                  {formatExecutionTimeMs(action.execution_time)}
                </span>
              )}
              {action.target_repo && (
                <span className="inline-flex max-w-[12rem] items-center gap-1 truncate text-xs text-zinc-500">
                  <GitBranch className="h-3 w-3 shrink-0 text-zinc-600" aria-hidden />
                  {action.target_repo}
                </span>
              )}
            </div>
            {(hasPointers || hasArgs) && (
              <div className="rounded-lg bg-zinc-950/50 p-3">
                <p className="mb-2 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                  {toolHue != null ? (
                    <span
                      className="inline-block h-1 w-6 rounded-full"
                      style={{
                        backgroundColor: `hsla(${toolHue}, 38%, 46%, 0.55)`,
                      }}
                    />
                  ) : (
                    <span className="inline-block h-1 w-6 rounded-full bg-zinc-600/70" />
                  )}
                  Details
                </p>
                <ActionPointersDetail
                  pointers={action.action_pointers}
                  argumentsFallback={action.arguments as Record<string, unknown>}
                  accentHue={toolHue}
                />
              </div>
            )}
          </div>
          <div className="shrink-0 sm:pt-0.5">
            <DecisionBadge decision={action.decision} size="sm" />
          </div>
        </div>
      )}
    </div>
  );
}
