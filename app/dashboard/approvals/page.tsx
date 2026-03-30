'use client';

import { useState, useCallback } from 'react';
import { Bell, Clock, Check, X } from 'lucide-react';
import { api } from '@/lib/api';
import { useAutoRefresh } from '@/lib/hooks';
import { SessionAction } from '@/lib/types';
import { formatRelativeTime } from '@/lib/utils';
import Topbar from '@/components/layout/Topbar';
import DecisionBadge from '@/components/ui/DecisionBadge';
import AgentAvatar from '@/components/ui/AgentAvatar';
import JsonViewer from '@/components/ui/JsonViewer';
import EmptyState from '@/components/ui/EmptyState';
import ErrorBanner from '@/components/ui/ErrorBanner';
import LoadingSpinner from '@/components/ui/LoadingSpinner';

export default function ApprovalsPage() {
  const [approvals, setApprovals] = useState<SessionAction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionedIds, setActionedIds] = useState<Set<string>>(new Set());

  const fetchData = useCallback(async () => {
    try {
      const data = await api.getApprovals();
      setApprovals(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load approvals');
    } finally {
      setLoading(false);
    }
  }, []);

  const { lastUpdated } = useAutoRefresh(fetchData, 30000);

  const handleAction = (id: string) => {
    setActionedIds((prev) => new Set(prev).add(id));
  };

  const pendingApprovals = approvals.filter((a) => !actionedIds.has(a.id));

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Topbar title="Approvals" subtitle="Actions requiring review" lastUpdated={lastUpdated} onRefresh={fetchData} />
      <div className="p-6">
        {error && (
          <div className="mb-4">
            <ErrorBanner message={error} onDismiss={() => setError(null)} onRetry={fetchData} />
          </div>
        )}

        {pendingApprovals.length > 0 && (
          <div className="mb-4 text-sm text-muted-foreground">
            {pendingApprovals.length} pending approval{pendingApprovals.length !== 1 ? 's' : ''}
          </div>
        )}

        {pendingApprovals.length === 0 ? (
          <div className="rounded-md border border-border bg-card">
            <EmptyState
              icon={<Bell className="h-6 w-6" />}
              title="No pending approvals"
              description="Actions requiring review will appear here."
            />
          </div>
        ) : (
          <div className="space-y-3">
            {pendingApprovals.map((approval) => (
              <div key={approval.id} className="rounded-md border border-border bg-card">
                <div className="flex items-center justify-between border-b border-border px-4 py-3">
                  <div className="flex items-center gap-3">
                    <AgentAvatar name={approval.agent_name || ''} size="sm" />
                    <div>
                      <span className="text-sm font-medium text-foreground">{approval.agent_name}</span>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {formatRelativeTime(approval.timestamp)}
                      </div>
                    </div>
                  </div>
                  <DecisionBadge decision={approval.decision} />
                </div>

                <div className="p-4">
                  <div className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
                    <div>
                      <p className="text-xs text-muted-foreground">Tool</p>
                      <code className="text-foreground">{approval.tool_name}</code>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Repository</p>
                      <p className="text-foreground">{approval.target_repo}</p>
                    </div>
                    <div className="col-span-2">
                      <p className="text-xs text-muted-foreground">Summary</p>
                      <p className="text-foreground">{approval.action_summary}</p>
                    </div>
                  </div>

                  {approval.arguments && (
                    <div className="mt-4">
                      <JsonViewer data={approval.arguments} />
                    </div>
                  )}

                  <div className="mt-4 flex items-center gap-2">
                    <button
                      onClick={() => handleAction(approval.id)}
                      className="flex items-center gap-1.5 rounded-md bg-success px-3 py-1.5 text-sm font-medium text-white hover:bg-success/90"
                    >
                      <Check className="h-4 w-4" />
                      Approve
                    </button>
                    <button
                      onClick={() => handleAction(approval.id)}
                      className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
                    >
                      <X className="h-4 w-4" />
                      Reject
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
