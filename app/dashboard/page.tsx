'use client';

import { useState } from 'react';
import { Activity, GitBranch, Search, ChevronDown, ChevronRight, Sparkles } from 'lucide-react';
import { useUser } from '@/lib/hooks';
import { useDashboardData } from '@/lib/dashboardDataContext';
import { SessionAction } from '@/lib/types';
import {
  cn,
  formatRelativeTime,
  formatFullTimestamp,
  formatExecutionTimeMs,
  formatMcpAegisToolDisplayName,
  getToolChipStyle,
  getToolAccentHue,
} from '@/lib/utils';
import Topbar from '@/components/layout/Topbar';
import MetricCard from '@/components/ui/MetricCard';
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

export default function DashboardPage() {
  const { user, isLoading: userLoading } = useUser();
  const {
    sessionActions: runs,
    runsLoading,
    runsLoadingMore,
    runsError,
    dismissRunsError,
    hasMoreRuns,
    loadMoreRuns,
    refreshRuns,
    metrics,
    metricsPartial,
    lastUpdated,
  } = useDashboardData();
  const [search, setSearch] = useState('');
  const [decisionFilter, setDecisionFilter] = useState('all');
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  const filteredRuns = runs.filter((run) => {
    const q = search.toLowerCase();
    const pointerMatch =
      !!search &&
      (run.action_pointers ?? []).some((p) =>
        typeof p === 'string' ? p.toLowerCase().includes(q) : false
      );
    const matchesSearch =
      !search ||
      run.agent_name?.toLowerCase().includes(q) ||
      run.tool_name?.toLowerCase().includes(q) ||
      formatMcpAegisToolDisplayName(run.tool_name || '').toLowerCase().includes(q) ||
      run.target_repo?.toLowerCase().includes(q) ||
      run.action_summary?.toLowerCase().includes(q) ||
      pointerMatch;

    const matchesDecision =
      decisionFilter === 'all' ||
      (decisionFilter === 'approval'
        ? run.decision?.toUpperCase().includes('APPROVAL')
        : run.decision?.toUpperCase() === decisionFilter.toUpperCase());

    return matchesSearch && matchesDecision;
  });

  if (userLoading || (runsLoading && runs.length === 0)) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_120%_80%_at_50%_-20%,rgba(52,211,153,0.14),transparent_50%),radial-gradient(ellipse_90%_60%_at_100%_0%,rgba(139,92,246,0.12),transparent_45%),radial-gradient(ellipse_70%_50%_at_0%_100%,rgba(56,189,248,0.08),transparent_40%)]"
        aria-hidden
      />
      <div className="relative">
        <Topbar
          title="Runs"
          subtitle="Real-time agent activity"
          lastUpdated={lastUpdated}
          onRefresh={refreshRuns}
        />

        <div className="p-6">
        {runsError && (
          <div className="mb-4">
            <ErrorBanner
              message={runsError}
              onDismiss={dismissRunsError}
              onRetry={refreshRuns}
            />
          </div>
        )}

        {/* Metrics */}
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <MetricCard
            label="Total Runs"
            value={metrics.total}
            className="border-white/10 bg-gradient-to-br from-zinc-800/35 to-card shadow-lg shadow-violet-500/5 ring-1 ring-inset ring-white/[0.04]"
          />
          <MetricCard
            label="Allowed"
            value={metrics.allows}
            variant="allow"
            className="border-emerald-500/30 bg-gradient-to-br from-emerald-500/15 to-card shadow-lg shadow-emerald-500/10 ring-1 ring-inset ring-emerald-400/10"
          />
          <MetricCard
            label="Denied"
            value={metrics.denies}
            variant="deny"
            className="border-red-500/30 bg-gradient-to-br from-red-500/12 to-card shadow-lg shadow-red-500/10 ring-1 ring-inset ring-red-400/10"
          />
          <MetricCard
            label="Rewritten"
            value={metrics.rewrites}
            variant="rewrite"
            className="border-amber-500/35 bg-gradient-to-br from-amber-500/14 to-card shadow-lg shadow-amber-500/10 ring-1 ring-inset ring-amber-400/10"
          />
          <MetricCard
            label="Approvals"
            value={metrics.approvals}
            variant="approval"
            className="border-sky-500/25 bg-gradient-to-br from-sky-500/12 to-card shadow-lg shadow-sky-500/10 ring-1 ring-inset ring-sky-400/10"
          />
        </div>

        {metricsPartial && (
          <p className="mb-4 text-xs text-zinc-500">
            Allow / deny / rewrite / approval counts reflect loaded actions only (
            {runs.length.toLocaleString()} of {metrics.total.toLocaleString()}).
            Use &quot;Load more&quot; below for additional rows.
          </p>
        )}

        {runs.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-card/70 shadow-xl shadow-black/40 ring-1 ring-white/5 backdrop-blur-sm">
            <EmptyState
              icon={<Activity className="h-6 w-6" />}
              title="No agent actions yet"
              description="Connect your agent to start monitoring actions."
              action={
                <Link
                  href="/onboarding"
                  className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-emerald-500 to-teal-500 px-3 py-1.5 text-sm font-medium text-zinc-950 shadow-lg shadow-emerald-500/25 hover:from-emerald-400 hover:to-teal-400"
                >
                  Set up agent
                </Link>
              }
            />
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-white/10 bg-card/80 shadow-2xl shadow-black/50 ring-1 ring-inset ring-white/[0.06] backdrop-blur-sm">
            {/* Filters */}
            <div className="flex flex-wrap items-center gap-3 border-b border-white/10 bg-gradient-to-r from-violet-500/[0.07] via-transparent to-emerald-500/[0.07] px-4 py-3.5">
              <div className="relative flex min-w-[12rem] flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-violet-300/70" />
                <input
                  type="text"
                  placeholder="Search runs, tools, repos..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full rounded-lg border border-white/10 bg-zinc-950/50 py-2 pl-9 pr-3 text-sm text-foreground placeholder:text-zinc-500 focus:border-emerald-500/40 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                />
              </div>
              <select
                value={decisionFilter}
                onChange={(e) => setDecisionFilter(e.target.value)}
                className="rounded-lg border border-white/10 bg-zinc-950/50 px-3 py-2 text-sm text-foreground focus:border-violet-500/40 focus:outline-none focus:ring-2 focus:ring-violet-500/20"
              >
                <option value="all">All decisions</option>
                <option value="ALLOW">Allow</option>
                <option value="DENY">Deny</option>
                <option value="REWRITE">Rewrite</option>
                <option value="approval">Approval</option>
              </select>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full table-fixed text-sm">
                <thead>
                  <tr className="border-b border-white/10 bg-zinc-900/70 text-left text-xs font-semibold uppercase tracking-wide text-zinc-400">
                    <th className="min-w-[300px] px-4 py-3 font-medium" style={{ width: '32%' }}>
                      Agent
                    </th>
                    <th className="w-[12%] px-4 py-3 font-medium">Tool</th>
                    <th className="min-w-0 px-4 py-3 font-medium" style={{ width: '11%' }}>
                      Repository
                    </th>
                    <th className="min-w-0 px-4 py-3 font-medium" style={{ width: '24%' }}>
                      Branch
                    </th>
                    <th className="w-[10%] px-4 py-3 font-medium">Decision</th>
                    <th className="w-[11%] px-4 py-3 font-medium">Time</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRuns.map((run) => (
                    <RunRow
                      key={run.id}
                      run={run}
                      isExpanded={expandedRow === run.id}
                      onToggle={() => setExpandedRow(expandedRow === run.id ? null : run.id)}
                    />
                  ))}
                </tbody>
              </table>
            </div>

            {filteredRuns.length === 0 && search && (
              <div className="border-t border-white/5 py-12 text-center text-sm text-zinc-500">
                No runs match your search.
              </div>
            )}

            {hasMoreRuns && (
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 px-4 py-3">
                <p className="text-xs text-zinc-500">
                  Showing{' '}
                  <span className="font-medium text-zinc-300">{runs.length.toLocaleString()}</span>{' '}
                  of{' '}
                  <span className="font-medium text-zinc-300">
                    {metrics.total.toLocaleString()}
                  </span>{' '}
                  actions loaded.
                </p>
                <button
                  type="button"
                  disabled={runsLoadingMore}
                  onClick={() => void loadMoreRuns()}
                  className="rounded-lg border border-white/15 bg-zinc-950/50 px-3 py-1.5 text-sm text-zinc-200 hover:cursor-pointer hover:bg-white/[0.06] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {runsLoadingMore ? 'Loading…' : 'Load more'}
                </button>
              </div>
            )}
          </div>
        )}
        </div>
      </div>
    </div>
  );
}

function RunRow({
  run,
  isExpanded,
  onToggle,
}: {
  run: SessionAction;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const [detailMode, setDetailMode] = useState<'details' | 'raw_json'>('details');
  const toolDisplay = formatMcpAegisToolDisplayName(run.tool_name || '');
  const toolChipStyle = getToolChipStyle(run.tool_name || '');
  const toolHue: number | null = getToolAccentHue(run.tool_name || '');
  return (
    <>
      <tr
        onClick={onToggle}
        className={cn(
          'cursor-pointer border-b border-white/[0.06] border-l-[4px] transition-colors duration-200',
          decisionStripeClass(run.decision, 'vibrant'),
          'hover:bg-gradient-to-r hover:from-white/[0.04] hover:to-transparent',
          isExpanded && 'bg-white/[0.03]'
        )}
      >
        <td className="min-w-[300px] px-4 py-3 align-top">
          <div className="flex items-start gap-2.5">
            <span className="shrink-0 rounded-full ring-1 ring-zinc-700/80 ring-offset-2 ring-offset-zinc-950">
              <AgentAvatar name={run.agent_name || ''} size="sm" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium leading-tight text-zinc-100">{run.agent_name}</p>
              {run.action_summary ? (
                <p className="mt-1 whitespace-normal break-words text-[0.75rem] leading-snug text-zinc-500">
                  {run.action_summary}
                </p>
              ) : null}
            </div>
          </div>
        </td>
        <td className="min-w-0 px-4 py-3">
          <code
            className="inline-flex max-w-[min(18rem,calc(100vw-12rem))] items-center truncate rounded-md border-0 px-2 py-1 font-mono text-[11px] leading-snug shadow-none outline-none ring-0"
            style={toolChipStyle}
            title={run.tool_name || undefined}
          >
            {toolDisplay}
          </code>
        </td>
        <td className="min-w-0 px-4 py-3 align-top">
          <span className="flex min-h-[1.25rem] min-w-0 items-start gap-1.5 text-sm text-zinc-400">
            <GitBranch className="mt-0.5 h-3.5 w-3.5 shrink-0 text-zinc-600" aria-hidden />
            {run.target_repo ? (
              <span className="min-w-0 truncate">{run.target_repo}</span>
            ) : (
              <span className="text-xs text-zinc-600 italic">No repo</span>
            )}
          </span>
        </td>
        <td className="min-w-0 px-4 py-3 align-top">
          {run.target_branch ? (
            <code className="block w-full min-w-0 whitespace-normal break-all rounded-md bg-zinc-800/60 px-2 py-0.5 font-mono text-[11px] leading-snug text-zinc-400">
              {run.target_branch}
            </code>
          ) : (
            <span className="text-sm text-zinc-600">—</span>
          )}
        </td>
        <td className="px-4 py-3">
          <DecisionBadge decision={run.decision} size="sm" />
        </td>
        <td className="px-4 py-3">
          <div className="flex items-center gap-2 text-zinc-400">
            <span className="text-xs text-zinc-500">{formatRelativeTime(run.timestamp)}</span>
            {run.execution_time !== undefined && run.execution_time !== null && (
              <span className="rounded-md bg-zinc-800/55 px-1.5 py-0.5 text-[10px] font-medium font-mono text-zinc-500">
                {formatExecutionTimeMs(run.execution_time)}
              </span>
            )}
            {isExpanded ? (
              <ChevronDown className="h-3.5 w-3.5 text-zinc-500" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5 text-zinc-500" />
            )}
          </div>
        </td>
      </tr>
      {isExpanded && (
        <tr>
          <td
            colSpan={6}
            className="border-b border-white/[0.06] bg-zinc-950/45 px-4 py-5"
            onClick={(e) => e.stopPropagation()}
          >
            <RunDetailViewModeToggle mode={detailMode} onModeChange={setDetailMode} className="mb-4" />
            {detailMode === 'raw_json' ? (
              <div className="space-y-2">
                <p className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">
                  Canonical action fields (agent, tool, arguments, result, repo, branch)
                </p>
                <CanonicalJsonViewer value={toSessionActionRawJsonView(run)} />
              </div>
            ) : (
              <div className="space-y-5">
                <div className="relative rounded-xl bg-zinc-900/55 p-4">
                  <div className="absolute right-3 top-3 text-zinc-600">
                    <Sparkles className="h-5 w-5" aria-hidden />
                  </div>
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                    Summary
                  </p>
                  <p className="whitespace-normal break-words pr-8 text-base font-medium leading-snug text-zinc-50 md:text-lg">
                    {run.action_summary}
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
                  <div className="rounded-lg bg-zinc-900/45 px-3 py-2.5">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                      Sequence
                    </p>
                    <p className="mt-1 font-mono text-sm text-zinc-100">#{run.sequence_order}</p>
                  </div>
                  <div className="rounded-lg bg-zinc-900/45 px-3 py-2.5">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                      Timestamp
                    </p>
                    <p className="mt-1 text-zinc-200">{formatFullTimestamp(run.timestamp)}</p>
                  </div>
                  <div className="col-span-2 rounded-lg bg-zinc-900/45 px-3 py-2.5 sm:col-span-1">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                      Execution
                    </p>
                    <p className="mt-1 text-zinc-200">{formatExecutionTimeMs(run.execution_time)}</p>
                  </div>
                </div>
                {(run.action_pointers?.length ||
                  (run.arguments && Object.keys(run.arguments).length > 0)) && (
                  <div className="rounded-xl bg-zinc-900/40 p-4">
                    <p className="mb-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                      {toolHue != null ? (
                        <span
                          className="inline-block h-1 w-7 rounded-full"
                          style={{
                            backgroundColor: `hsla(${toolHue}, 38%, 46%, 0.55)`,
                          }}
                        />
                      ) : (
                        <span className="inline-block h-1 w-7 rounded-full bg-zinc-600/70" />
                      )}
                      Details
                    </p>
                    <ActionPointersDetail
                      pointers={run.action_pointers}
                      argumentsFallback={run.arguments as Record<string, unknown>}
                      accentHue={toolHue}
                    />
                  </div>
                )}
              </div>
            )}
          </td>
        </tr>
      )}
    </>
  );
}