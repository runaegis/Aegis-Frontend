'use client';

import { useState, useCallback, useEffect } from 'react';
import { FileText, Download, ChevronLeft, ChevronRight } from 'lucide-react';
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
    <div>
      <Topbar title="Audit Trail" subtitle="Full immutable event log" />
      <div className="p-8">
        {error && (
          <div className="mb-6">
            <ErrorBanner message={error} onDismiss={() => setError(null)} onRetry={fetchData} />
          </div>
        )}

        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="rounded-lg border border-zinc-200 px-3 py-2 text-sm focus:border-transparent focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
            <span className="text-sm text-zinc-400">to</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="rounded-lg border border-zinc-200 px-3 py-2 text-sm focus:border-transparent focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={exportJson}
              className="flex items-center gap-2 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-600"
            >
              <Download className="h-4 w-4" />
              Export JSON
            </button>
            {/* TODO(jenil): implement PDF export */}
            <div className="group relative">
              <button
                className="flex items-center gap-2 rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-400 cursor-not-allowed"
                disabled
              >
                <Download className="h-4 w-4" />
                Export PDF
              </button>
              <div className="absolute bottom-full left-1/2 mb-2 hidden -translate-x-1/2 whitespace-nowrap rounded-md bg-zinc-800 px-2 py-1 text-xs text-white group-hover:block">
                Coming soon
              </div>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <LoadingSpinner size="lg" />
          </div>
        ) : events.length === 0 ? (
          <div className="rounded-xl border border-zinc-200 bg-white">
            <EmptyState
              icon={<FileText className="h-12 w-12" />}
              title="No audit events"
              description="Agent actions will be logged here for compliance and review."
            />
          </div>
        ) : (
          <>
            <div className="rounded-xl border border-zinc-200 bg-white">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-zinc-100 text-left">
                    <th className="px-5 py-3 text-xs font-medium uppercase tracking-wider text-zinc-400">Timestamp</th>
                    <th className="px-5 py-3 text-xs font-medium uppercase tracking-wider text-zinc-400">Agent</th>
                    <th className="px-5 py-3 text-xs font-medium uppercase tracking-wider text-zinc-400">Tool</th>
                    <th className="px-5 py-3 text-xs font-medium uppercase tracking-wider text-zinc-400">Summary</th>
                    <th className="px-5 py-3 text-xs font-medium uppercase tracking-wider text-zinc-400">Repository</th>
                    <th className="px-5 py-3 text-xs font-medium uppercase tracking-wider text-zinc-400">Decision</th>
                    <th className="px-5 py-3 text-xs font-medium uppercase tracking-wider text-zinc-400">Result</th>
                  </tr>
                </thead>
                <tbody>
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

            <div className="mt-4 flex items-center justify-between">
              <span className="text-sm text-zinc-500">
                Page {page + 1} ({events.length} records)
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage(Math.max(0, page - 1))}
                  disabled={page === 0}
                  className="rounded-lg border border-zinc-200 p-2 text-zinc-500 transition-colors hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setPage(page + 1)}
                  disabled={events.length < pageSize}
                  className="rounded-lg border border-zinc-200 p-2 text-zinc-500 transition-colors hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-40"
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
  const resultBadge = event.result?.toUpperCase().includes('ERROR')
    ? 'bg-[#F4F4F5] text-[#71717A] border-[#E4E4E7]'
    : 'bg-[#F0FDF4] text-[#15803D] border-[#86EFAC]';

  return (
    <>
      <tr
        onClick={onToggle}
        className="cursor-pointer border-b border-zinc-50 transition-colors hover:bg-zinc-50"
      >
        <td className="px-5 py-3 text-xs text-zinc-600 whitespace-nowrap">
          {formatFullTimestamp(event.timestamp)}
        </td>
        <td className="px-5 py-3">
          <div className="flex items-center gap-2">
            <AgentAvatar name={event.agent_name || ''} size="sm" />
            <span className="max-w-[100px] truncate text-sm text-zinc-900">{event.agent_name}</span>
          </div>
        </td>
        <td className="px-5 py-3">
          <code className="font-mono text-xs text-zinc-600">{event.tool_name}</code>
        </td>
        <td className="px-5 py-3 text-sm text-zinc-600" title={event.action_summary}>
          {truncate(event.action_summary, 40)}
        </td>
        <td className="px-5 py-3 text-sm text-zinc-600">{event.target_repo}</td>
        <td className="px-5 py-3">
          <DecisionBadge decision={event.decision} />
        </td>
        <td className="px-5 py-3">
          <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${resultBadge}`}>
            {event.result?.toUpperCase().includes('ERROR') ? 'Error' : 'Success'}
          </span>
        </td>
      </tr>
      {isExpanded && (
        <tr>
          <td colSpan={7} className="border-b border-zinc-100 bg-zinc-50/50 px-8 py-4">
            <div className="mb-3">
              <p className="text-xs font-medium uppercase tracking-wider text-zinc-400">Full Summary</p>
              <p className="mt-1 text-sm text-zinc-700">{event.action_summary}</p>
            </div>
            {event.arguments && (
              <div>
                <p className="mb-2 text-xs font-medium uppercase tracking-wider text-zinc-400">Arguments</p>
                <JsonViewer data={event.arguments} collapsed={false} />
              </div>
            )}
          </td>
        </tr>
      )}
    </>
  );
}
