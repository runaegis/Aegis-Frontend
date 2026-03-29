'use client';

import { useState, useCallback } from 'react';
import { Activity, Search, ChevronDown, ChevronRight, Filter } from 'lucide-react';
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
    <div className="min-h-screen">
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

        {/* Metrics Grid */}
        <div className="mb-8 grid grid-cols-5 gap-4">
          <MetricCard label="Total Runs" value={metrics.total} />
          <MetricCard label="Allowed" value={metrics.allows} variant="allow" />
          <MetricCard label="Denied" value={metrics.denies} variant="deny" />
          <MetricCard label="Rewritten" value={metrics.rewrites} variant="rewrite" />
          <MetricCard label="Approvals" value={metrics.approvals} variant="approval" />
        </div>

        {runs.length === 0 ? (
          <div className="rounded-xl border border-border bg-card">
            <EmptyState
              icon={<Activity className="h-8 w-8" />}
              title="No agent actions yet"
              description="Once you connect your agent, actions will appear here in real time."
              action={
                <Link
                  href="/onboarding"
                  className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary-hover"
                >
                  Set up agent
                </Link>
              }
            />
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-border bg-card">
            {/* Search and Filter Bar */}
            <div className="flex items-center gap-3 border-b border-border px-5 py-4">
              <div className="relative flex-1">
                <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search agent, tool, repo, or summary..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full rounded-lg border border-border bg-muted/50 py-2.5 pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:bg-card focus:ring-2 focus:ring-primary/20 focus:outline-none"
                />
              </div>
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <select
                  value={decisionFilter}
                  onChange={(e) => setDecisionFilter(e.target.value)}
                  className="rounded-lg border border-border bg-muted/50 px-3 py-2.5 text-sm text-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none"
                >
                  <option value="all">All decisions</option>
                  <option value="ALLOW">Allow</option>
                  <option value="DENY">Deny</option>
                  <option value="REWRITE">Rewrite</option>
                  <option value="approval">Approval</option>
                </select>
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Agent</th>
                    <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Tool</th>
                    <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Summary</th>
                    <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Repository</th>
                    <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Branch</th>
                    <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Decision</th>
                    <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Result</th>
                    <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
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
              <div className="py-16 text-center">
                <p className="text-sm text-muted-foreground">No runs match your search.</p>
              </div>
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
  const isError = run.result?.toUpperCase().includes('ERROR');

  return (
    <>
      <tr
        onClick={onToggle}
        className="group cursor-pointer transition-colors hover:bg-muted/50"
      >
        <td className="px-5 py-4">
          <div className="flex items-center gap-3">
            <AgentAvatar name={run.agent_name || ''} size="sm" />
            <span className="max-w-[120px] truncate text-sm font-medium text-foreground">
              {run.agent_name}
            </span>
          </div>
        </td>
        <td className="px-5 py-4">
          <code className="rounded bg-muted px-2 py-1 font-mono text-xs text-muted-foreground">
            {run.tool_name}
          </code>
        </td>
        <td className="px-5 py-4">
          <span className="text-sm text-muted-foreground" title={run.action_summary}>
            {truncate(run.action_summary, 50)}
          </span>
        </td>
        <td className="px-5 py-4">
          <span className="text-sm text-muted-foreground">{run.target_repo}</span>
        </td>
        <td className="px-5 py-4">
          {run.target_branch && (
            <code className="rounded bg-muted px-2 py-1 font-mono text-xs text-muted-foreground">
              {run.target_branch}
            </code>
          )}
        </td>
        <td className="px-5 py-4">
          <DecisionBadge decision={run.decision} size="sm" />
        </td>
        <td className="px-5 py-4">
          <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${
            isError 
              ? 'border-border bg-muted text-muted-foreground' 
              : 'border-success/30 bg-success-muted text-success'
          }`}>
            <span className={`h-1.5 w-1.5 rounded-full ${isError ? 'bg-muted-foreground' : 'bg-success'}`} />
            {isError ? 'Error' : 'Success'}
          </span>
        </td>
        <td className="px-5 py-4">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">{formatRelativeTime(run.timestamp)}</span>
            <div className="flex h-5 w-5 items-center justify-center rounded text-muted-foreground transition-colors group-hover:bg-muted group-hover:text-foreground">
              {isExpanded ? (
                <ChevronDown className="h-3.5 w-3.5" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5" />
              )}
            </div>
          </div>
        </td>
      </tr>
      {isExpanded && (
        <tr>
          <td colSpan={8} className="border-b border-border bg-muted/30 px-8 py-6">
            <div className="grid grid-cols-2 gap-8 animate-fade-in">
              <div>
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Full Summary</p>
                <p className="text-sm leading-relaxed text-foreground">{run.action_summary}</p>
              </div>
              <div className="grid grid-cols-3 gap-6">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Sequence</p>
                  <p className="mt-1 font-mono text-sm text-foreground">#{run.sequence_order}</p>
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Session</p>
                  <Link
                    href={`/dashboard/sessions?id=${run.session_id}`}
                    className="mt-1 inline-block font-mono text-sm text-primary hover:underline"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {run.session_id?.substring(0, 8)}...
                  </Link>
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Timestamp</p>
                  <p className="mt-1 text-sm text-foreground">{formatFullTimestamp(run.timestamp)}</p>
                </div>
              </div>
            </div>
            {run.arguments && (
              <div className="mt-6">
                <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Arguments</p>
                <JsonViewer data={run.arguments} collapsed={false} />
              </div>
            )}
          </td>
        </tr>
      )}
    </>
  );
}
