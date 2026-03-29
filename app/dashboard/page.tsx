'use client';

import { useState, useEffect, useCallback } from 'react';
import { Activity, Search, ChevronDown, ChevronRight } from 'lucide-react';
import { api } from '@/lib/api';
import { useUser, useAutoRefresh } from '@/lib/hooks';
import { SessionAction, Metrics } from '@/lib/types';
import { formatRelativeTime, formatFullTimestamp, truncate } from '@/lib/utils';
import Topbar from '@/components/layout/Topbar';
import MetricCard from '@/components/ui/MetricCard';
import DecisionBadge from '@/components/ui/DecisionBadge';
import AgentAvatar from '@/components/ui/AgentAvatar';
import JsonViewer from '@/components/ui/JsonViewer';
import EmptyState from '@/components/ui/EmptyState';
import ErrorBanner from '@/components/ui/ErrorBanner';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import Link from 'next/link';

export default function DashboardPage() {
  const { user } = useUser();
  const [runs, setRuns] = useState<SessionAction[]>([]);
  const [metrics, setMetrics] = useState<Metrics>({ total: 0, allows: 0, denies: 0, rewrites: 0, approvals: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [decisionFilter, setDecisionFilter] = useState('all');
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const [runsData, metricsData] = await Promise.all([
        api.getRuns(user?.username),
        api.getMetrics(),
      ]);
      setRuns(runsData);
      setMetrics(metricsData);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not connect to api.runaegis.co. Check your connection.');
    } finally {
      setLoading(false);
    }
  }, [user?.username]);

  const { lastUpdated } = useAutoRefresh(fetchData, 30000);

  const filteredRuns = runs.filter((run) => {
    const matchesSearch =
      !search ||
      run.agent_name?.toLowerCase().includes(search.toLowerCase()) ||
      run.tool_name?.toLowerCase().includes(search.toLowerCase()) ||
      run.target_repo?.toLowerCase().includes(search.toLowerCase()) ||
      run.action_summary?.toLowerCase().includes(search.toLowerCase());

    const matchesDecision =
      decisionFilter === 'all' ||
      (decisionFilter === 'approval'
        ? run.decision?.toUpperCase().includes('APPROVAL')
        : run.decision?.toUpperCase() === decisionFilter.toUpperCase());

    return matchesSearch && matchesDecision;
  });

  if (loading) {
    return (
      <div className="flex h-[calc(100vh-80px)] items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div>
      <Topbar
        title="Runs"
        subtitle="Real-time agent action feed"
        lastUpdated={lastUpdated}
        onRefresh={fetchData}
      />

      <div className="p-8">
        {error && (
          <div className="mb-6">
            <ErrorBanner message={error} onDismiss={() => setError(null)} onRetry={fetchData} />
          </div>
        )}

        <div className="mb-8 grid grid-cols-5 gap-4">
          <MetricCard label="Total Runs" value={metrics.total} />
          <MetricCard label="Allow" value={metrics.allows} variant="allow" />
          <MetricCard label="Deny" value={metrics.denies} variant="deny" />
          <MetricCard label="Rewrite" value={metrics.rewrites} variant="rewrite" />
          <MetricCard label="Approval" value={metrics.approvals} variant="approval" />
        </div>

        {runs.length === 0 ? (
          <div className="rounded-xl border border-zinc-200 bg-white">
            <EmptyState
              icon={<Activity className="h-12 w-12" />}
              title="No agent actions yet"
              description="Once you connect your agent, actions will appear here in real time."
              action={
                <Link
                  href="/onboarding"
                  className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-600"
                >
                  Set up agent
                </Link>
              }
            />
          </div>
        ) : (
          <div className="rounded-xl border border-zinc-200 bg-white">
            <div className="flex items-center gap-3 border-b border-zinc-100 px-5 py-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                <input
                  type="text"
                  placeholder="Search agent, tool, repo, or summary..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full rounded-lg border border-zinc-200 py-2 pl-10 pr-3 text-sm focus:border-transparent focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>
              <select
                value={decisionFilter}
                onChange={(e) => setDecisionFilter(e.target.value)}
                className="rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-700 focus:border-transparent focus:ring-2 focus:ring-blue-500 focus:outline-none"
              >
                <option value="all">All decisions</option>
                <option value="ALLOW">Allow</option>
                <option value="DENY">Deny</option>
                <option value="REWRITE">Rewrite</option>
                <option value="approval">Approval</option>
              </select>
            </div>

            <table className="w-full">
              <thead>
                <tr className="border-b border-zinc-100 text-left">
                  <th className="px-5 py-3 text-xs font-medium uppercase tracking-wider text-zinc-400">Agent</th>
                  <th className="px-5 py-3 text-xs font-medium uppercase tracking-wider text-zinc-400">Tool</th>
                  <th className="px-5 py-3 text-xs font-medium uppercase tracking-wider text-zinc-400">Summary</th>
                  <th className="px-5 py-3 text-xs font-medium uppercase tracking-wider text-zinc-400">Repository</th>
                  <th className="px-5 py-3 text-xs font-medium uppercase tracking-wider text-zinc-400">Branch</th>
                  <th className="px-5 py-3 text-xs font-medium uppercase tracking-wider text-zinc-400">Decision</th>
                  <th className="px-5 py-3 text-xs font-medium uppercase tracking-wider text-zinc-400">Result</th>
                  <th className="px-5 py-3 text-xs font-medium uppercase tracking-wider text-zinc-400">Time</th>
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
            {filteredRuns.length === 0 && search && (
              <div className="py-12 text-center text-sm text-zinc-500">No runs match your search.</div>
            )}
          </div>
        )}
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
  const resultBadge = run.result?.toUpperCase().includes('ERROR')
    ? 'bg-[#F4F4F5] text-[#71717A] border-[#E4E4E7]'
    : 'bg-[#F0FDF4] text-[#15803D] border-[#86EFAC]';

  return (
    <>
      <tr
        onClick={onToggle}
        className="cursor-pointer border-b border-zinc-50 transition-colors hover:bg-zinc-50"
      >
        <td className="px-5 py-3">
          <div className="flex items-center gap-2">
            <AgentAvatar name={run.agent_name || ''} size="sm" />
            <span className="max-w-[120px] truncate text-sm font-medium text-zinc-900">
              {run.agent_name}
            </span>
          </div>
        </td>
        <td className="px-5 py-3">
          <code className="font-mono text-xs text-zinc-600">{run.tool_name}</code>
        </td>
        <td className="px-5 py-3">
          <span className="text-sm text-zinc-600" title={run.action_summary}>
            {truncate(run.action_summary, 50)}
          </span>
        </td>
        <td className="px-5 py-3 text-sm text-zinc-600">{run.target_repo}</td>
        <td className="px-5 py-3">
          {run.target_branch && (
            <code className="rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-xs text-zinc-600">
              {run.target_branch}
            </code>
          )}
        </td>
        <td className="px-5 py-3">
          <DecisionBadge decision={run.decision} />
        </td>
        <td className="px-5 py-3">
          <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${resultBadge}`}>
            {run.result?.toUpperCase().includes('ERROR') ? 'Error' : 'Success'}
          </span>
        </td>
        <td className="px-5 py-3">
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-zinc-400">{formatRelativeTime(run.timestamp)}</span>
            {isExpanded ? (
              <ChevronDown className="h-3.5 w-3.5 text-zinc-400" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5 text-zinc-400" />
            )}
          </div>
        </td>
      </tr>
      {isExpanded && (
        <tr>
          <td colSpan={8} className="border-b border-zinc-100 bg-zinc-50/50 px-8 py-4">
            <div className="grid grid-cols-2 gap-6">
              <div>
                <p className="mb-1 text-xs font-medium uppercase tracking-wider text-zinc-400">Full Summary</p>
                <p className="text-sm text-zinc-700">{run.action_summary}</p>
              </div>
              <div className="space-y-2">
                <div className="flex gap-6">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wider text-zinc-400">Sequence</p>
                    <p className="font-mono text-sm text-zinc-700">#{run.sequence_order}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wider text-zinc-400">Session</p>
                    <Link
                      href={`/dashboard/sessions?id=${run.session_id}`}
                      className="font-mono text-sm text-blue-600 hover:underline"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {run.session_id?.substring(0, 8)}...
                    </Link>
                  </div>
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wider text-zinc-400">Timestamp</p>
                    <p className="text-sm text-zinc-700">{formatFullTimestamp(run.timestamp)}</p>
                  </div>
                </div>
              </div>
            </div>
            {run.arguments && (
              <div className="mt-4">
                <p className="mb-2 text-xs font-medium uppercase tracking-wider text-zinc-400">Arguments</p>
                <JsonViewer data={run.arguments} collapsed={false} />
              </div>
            )}
          </td>
        </tr>
      )}
    </>
  );
}
