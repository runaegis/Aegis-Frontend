'use client';

import { useState, useCallback, useEffect } from 'react';
import { FileText, Download, ChevronLeft, ChevronRight, Calendar } from 'lucide-react';
import { api } from '@/lib/api';
import { useUser } from '@/lib/hooks';
import { SessionAction } from '@/lib/types';
import { formatFullTimestamp, truncate } from '@/lib/utils';
import Topbar from '@/components/layout/Topbar';
import DecisionBadge from '@/components/ui/DecisionBadge';
import AgentAvatar from '@/components/ui/AgentAvatar';
import JsonViewer from '@/components/ui/JsonViewer';
import EmptyState from '@/components/ui/EmptyState';
import ErrorBanner from '@/components/ui/ErrorBanner';
import LoadingSpinner from '@/components/ui/LoadingSpinner';

export default function AuditPage() {
  const { user } = useUser();
  const [events, setEvents] = useState<SessionAction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const pageSize = 50;

  const today = new Date();
  const weekAgo = new Date(today);
  weekAgo.setDate(weekAgo.getDate() - 7);
  const [startDate, setStartDate] = useState(weekAgo.toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(today.toISOString().split('T')[0]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.getAuditTrail(pageSize, page * pageSize);
      setEvents(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load audit trail');
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const exportJson = async () => {
    try {
      const allEvents = await api.getAuditTrailByDateRange(
        `${startDate}T00:00:00Z`,
        `${endDate}T23:59:59Z`
      );
      const exportData = {
        exported_at: new Date().toISOString(),
        exported_by: user?.username || 'unknown',
        total_records: allEvents.length,
        events: allEvents,
      };
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `aegis-audit-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setError('Failed to export audit trail');
    }
  };

  return (
    <div className="min-h-screen">
      <Topbar title="Audit Trail" subtitle="Full immutable event log" />
      <div className="p-8">
        {error && (
          <div className="mb-6">
            <ErrorBanner message={error} onDismiss={() => setError(null)} onRetry={fetchData} />
          </div>
        )}

        {/* Filter & Export Bar */}
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="border-0 bg-transparent text-sm text-foreground focus:outline-none focus:ring-0"
              />
            </div>
            <span className="text-sm text-muted-foreground">to</span>
            <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="border-0 bg-transparent text-sm text-foreground focus:outline-none focus:ring-0"
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={exportJson}
              className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary-hover"
            >
              <Download className="h-4 w-4" />
              Export JSON
            </button>
            <div className="group relative">
              <button
                className="flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2.5 text-sm font-medium text-muted-foreground cursor-not-allowed"
                disabled
              >
                <Download className="h-4 w-4" />
                Export PDF
              </button>
              <div className="absolute bottom-full left-1/2 mb-2 hidden -translate-x-1/2 whitespace-nowrap rounded-lg border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground shadow-lg group-hover:block">
                Coming soon
              </div>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <LoadingSpinner size="lg" />
          </div>
        ) : events.length === 0 ? (
          <div className="rounded-xl border border-border bg-card">
            <EmptyState
              icon={<FileText className="h-8 w-8" />}
              title="No audit events"
              description="Agent actions will be logged here for compliance and review."
            />
          </div>
        ) : (
          <>
            <div className="overflow-hidden rounded-xl border border-border bg-card">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border bg-muted/30">
                      <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Timestamp</th>
                      <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Agent</th>
                      <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Tool</th>
                      <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Summary</th>
                      <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Repository</th>
                      <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Decision</th>
                      <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Result</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {events.map((event) => (
                      <AuditRow
                        key={event.id}
                        event={event}
                        isExpanded={expandedRow === event.id}
                        onToggle={() => setExpandedRow(expandedRow === event.id ? null : event.id)}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Pagination */}
            <div className="mt-6 flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                Page {page + 1} ({events.length} records)
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage(Math.max(0, page - 1))}
                  disabled={page === 0}
                  className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setPage(page + 1)}
                  disabled={events.length < pageSize}
                  className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function AuditRow({
  event,
  isExpanded,
  onToggle,
}: {
  event: SessionAction;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const isError = event.result?.toUpperCase().includes('ERROR');

  return (
    <>
      <tr
        onClick={onToggle}
        className="group cursor-pointer transition-colors hover:bg-muted/50"
      >
        <td className="whitespace-nowrap px-5 py-4 text-xs text-muted-foreground">
          {formatFullTimestamp(event.timestamp)}
        </td>
        <td className="px-5 py-4">
          <div className="flex items-center gap-2">
            <AgentAvatar name={event.agent_name || ''} size="sm" />
            <span className="max-w-[100px] truncate text-sm font-medium text-foreground">{event.agent_name}</span>
          </div>
        </td>
        <td className="px-5 py-4">
          <code className="rounded bg-muted px-2 py-1 font-mono text-xs text-muted-foreground">
            {event.tool_name}
          </code>
        </td>
        <td className="px-5 py-4 text-sm text-muted-foreground" title={event.action_summary}>
          {truncate(event.action_summary, 40)}
        </td>
        <td className="px-5 py-4 text-sm text-muted-foreground">{event.target_repo}</td>
        <td className="px-5 py-4">
          <DecisionBadge decision={event.decision} size="sm" />
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
      </tr>
      {isExpanded && (
        <tr>
          <td colSpan={7} className="border-b border-border bg-muted/30 px-8 py-6 animate-fade-in">
            <div className="mb-4">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Full Summary</p>
              <p className="mt-2 text-sm leading-relaxed text-foreground">{event.action_summary}</p>
            </div>
            {event.arguments && (
              <div>
                <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Arguments</p>
                <JsonViewer data={event.arguments} collapsed={false} />
              </div>
            )}
          </td>
        </tr>
      )}
    </>
  );
}
