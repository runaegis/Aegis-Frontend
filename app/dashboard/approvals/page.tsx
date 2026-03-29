'use client';

import { useState, useCallback } from 'react';
import { Bell, Clock } from 'lucide-react';
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
  const [confirmDialog, setConfirmDialog] = useState<{
    id: string;
    type: 'approve' | 'reject';
  } | null>(null);

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

  // TODO(jenil): needs POST /approvals endpoint to actually approve/reject actions
  const handleAction = (id: string) => {
    setActionedIds((prev) => new Set(prev).add(id));
    setConfirmDialog(null);
  };

  const pendingApprovals = approvals.filter((a) => !actionedIds.has(a.id));

  if (loading) {
    return (
      <div className="flex h-[calc(100vh-80px)] items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div>
      <Topbar title="Approvals" subtitle="Actions requiring human review" lastUpdated={lastUpdated} onRefresh={fetchData} />
      <div className="p-8">
        {error && (
          <div className="mb-6">
            <ErrorBanner message={error} onDismiss={() => setError(null)} onRetry={fetchData} />
          </div>
        )}

        <div className="mb-6 flex items-center gap-2">
          <span className="rounded-full bg-zinc-100 px-3 py-1 text-sm font-medium text-zinc-600">
            {pendingApprovals.length} pending
          </span>
        </div>

        {pendingApprovals.length === 0 ? (
          <div className="rounded-xl border border-zinc-200 bg-white">
            <EmptyState
              icon={<Bell className="h-12 w-12" />}
              title="No pending approvals"
              description="Actions requiring human review will appear here."
            />
          </div>
        ) : (
          <div className="space-y-4">
            {pendingApprovals.map((approval) => (
              <div key={approval.id} className="rounded-xl border border-zinc-200 bg-white p-6">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700">
                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-500" />
                      Pending
                    </span>
                    <DecisionBadge decision={approval.decision} />
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-zinc-400">
                    <Clock className="h-3.5 w-3.5" />
                    {formatRelativeTime(approval.timestamp)}
                  </div>
                </div>

                <div className="mt-4 flex items-center gap-2">
                  <AgentAvatar name={approval.agent_name || ''} size="sm" />
                  <span className="text-sm font-medium text-zinc-900">{approval.agent_name}</span>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-4 rounded-lg bg-zinc-50 p-4">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wider text-zinc-400">Tool</p>
                    <code className="mt-1 font-mono text-sm text-zinc-700">{approval.tool_name}</code>
                  </div>
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wider text-zinc-400">Repository</p>
                    <p className="mt-1 text-sm text-zinc-700">{approval.target_repo}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wider text-zinc-400">Branch</p>
                    <p className="mt-1 text-sm text-zinc-700">{approval.target_branch || '—'}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wider text-zinc-400">Summary</p>
                    <p className="mt-1 text-sm text-zinc-700">{approval.action_summary}</p>
                  </div>
                </div>

                {approval.arguments && (
                  <div className="mt-4">
                    <JsonViewer data={approval.arguments} />
                  </div>
                )}

                <div className="mt-5 flex items-center gap-3">
                  {confirmDialog?.id === approval.id ? (
                    <div className="flex items-center gap-3 rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-2">
                      <span className="text-sm text-zinc-600">
                        {confirmDialog.type === 'approve' ? 'Approve this action?' : 'Reject this action?'}
                      </span>
                      <button
                        onClick={() => handleAction(approval.id)}
                        className={`rounded-lg px-3 py-1 text-sm font-medium text-white ${
                          confirmDialog.type === 'approve' ? 'bg-green-600' : 'bg-red-600'
                        }`}
                      >
                        Confirm
                      </button>
                      <button
                        onClick={() => setConfirmDialog(null)}
                        className="rounded-lg border border-zinc-200 px-3 py-1 text-sm font-medium text-zinc-600"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <>
                      <button
                        onClick={() => setConfirmDialog({ id: approval.id, type: 'approve' })}
                        className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-green-700"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => setConfirmDialog({ id: approval.id, type: 'reject' })}
                        className="rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-50"
                      >
                        Reject
                      </button>
                      <div className="group relative">
                        <button
                          className="rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-400 cursor-not-allowed"
                          disabled
                        >
                          Modify
                        </button>
                        <div className="absolute bottom-full left-1/2 mb-2 hidden -translate-x-1/2 rounded-md bg-zinc-800 px-2 py-1 text-xs text-white group-hover:block">
                          Coming soon
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
