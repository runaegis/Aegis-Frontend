'use client';

import { useState, useCallback, useEffect } from 'react';
import { FileText, Download, ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react';
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
  const { user, isLoading: userLoading } = useUser();
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
    if (!user?.id) {
      if (!userLoading) {
        setEvents([]);
        setLoading(false);
      }
      return;
    }

    setLoading(true);
    try {
      const data = await api.getAuditTrail(user.id, pageSize, page * pageSize);
      setEvents(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load audit trail');
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, user?.id, userLoading]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const exportJson = async () => {
    if (!user?.id) {
      setError('No authenticated user found for export');
      return;
    }

    try {
      const allEvents = await api.getAuditTrailByDateRange(
        user.id,
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
      <Topbar title="Audit Trail" subtitle="Immutable event log" />
      <div className="p-6">
        {error && (
          <div className="mb-4">
            <ErrorBanner message={error} onDismiss={() => setError(null)} onRetry={fetchData} />
          </div>
        )}

        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm">
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="rounded-md border border-border bg-muted px-2 py-1 text-foreground"
            />
            <span className="text-muted-foreground">to</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="rounded-md border border-border bg-muted px-2 py-1 text-foreground"
            />
          </div>
          <button
            onClick={exportJson}
            disabled={!user?.id || userLoading}
            className="flex items-center gap-1.5 rounded-md bg-foreground px-3 py-1.5 text-sm font-medium text-background hover:bg-foreground/90"
          >
            <Download className="h-4 w-4" />
            Export JSON
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <LoadingSpinner size="lg" />
          </div>
        ) : events.length === 0 ? (
          <div className="rounded-md border border-border bg-card">
            <EmptyState
              icon={<FileText className="h-6 w-6" />}
              title="No audit events"
              description="Agent actions will be logged here."
            />
          </div>
        ) : (
          <>
            <div className="overflow-x-auto rounded-md border border-border bg-card">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/50 text-left text-xs text-muted-foreground">
                    <th className="px-4 py-2 font-medium">Timestamp</th>
                    <th className="px-4 py-2 font-medium">Agent</th>
                    <th className="px-4 py-2 font-medium">Tool</th>
                    <th className="px-4 py-2 font-medium">Summary</th>
                    <th className="px-4 py-2 font-medium">Repository</th>
                    <th className="px-4 py-2 font-medium">Decision</th>
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

            <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
              <span>Page {page + 1}</span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPage(Math.max(0, page - 1))}
                  disabled={page === 0}
                  className="rounded-md border border-border p-1.5 hover:bg-muted disabled:opacity-40"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setPage(page + 1)}
                  disabled={events.length < pageSize}
                  className="rounded-md border border-border p-1.5 hover:bg-muted disabled:opacity-40"
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

function AuditRow({ event, isExpanded, onToggle }: { event: SessionAction; isExpanded: boolean; onToggle: () => void }) {
  return (
    <>
      <tr onClick={onToggle} className="cursor-pointer border-b border-border hover:bg-muted/30">
        <td className="whitespace-nowrap px-4 py-3 text-xs text-muted-foreground">{formatFullTimestamp(event.timestamp)}</td>
        <td className="px-4 py-3">
          <div className="flex items-center gap-2">
            <AgentAvatar name={event.agent_name || ''} size="sm" />
            <span className="font-medium text-foreground">{event.agent_name}</span>
          </div>
        </td>
        <td className="px-4 py-3">
          <code className="text-xs text-muted-foreground">{event.tool_name}</code>
        </td>
        <td className="px-4 py-3 text-muted-foreground">{truncate(event.action_summary, 30)}</td>
        <td className="px-4 py-3 text-muted-foreground">{event.target_repo}</td>
        <td className="px-4 py-3">
          <div className="flex items-center gap-2">
            <DecisionBadge decision={event.decision} size="sm" />
            <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
          </div>
        </td>
      </tr>
      {isExpanded && (
        <tr>
          <td colSpan={6} className="border-b border-border bg-muted/30 px-4 py-4">
            <p className="mb-2 text-xs text-muted-foreground">Full Summary</p>
            <p className="text-sm text-foreground">{event.action_summary}</p>
            {event.arguments && (
              <div className="mt-3">
                <JsonViewer data={event.arguments} collapsed={false} />
              </div>
            )}
          </td>
        </tr>
      )}
    </>
  );
}
