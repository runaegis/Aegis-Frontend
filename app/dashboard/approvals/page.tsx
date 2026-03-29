'use client';

import { useState, useCallback } from 'react';
import { Bell, Clock, CheckCircle2, XCircle, AlertCircle } from 'lucide-react';
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
    <div className="min-h-screen">
      <Topbar title="Approvals" subtitle="Actions requiring human review" lastUpdated={lastUpdated} onRefresh={fetchData} />
      <div className="p-8">
        {error && (
          <div className="mb-6">
            <ErrorBanner message={error} onDismiss={() => setError(null)} onRetry={fetchData} />
          </div>
        )}

        {/* Stats */}
        <div className="mb-6 flex items-center gap-4">
          <div className="flex items-center gap-3 rounded-xl border border-warning/30 bg-warning-muted px-4 py-3">
            <AlertCircle className="h-5 w-5 text-warning" />
            <div>
              <span className="text-xl font-semibold text-foreground">{pendingApprovals.length}</span>
              <span className="ml-2 text-sm text-muted-foreground">pending approval{pendingApprovals.length !== 1 ? 's' : ''}</span>
            </div>
          </div>
        </div>

        {pendingApprovals.length === 0 ? (
          <div className="rounded-xl border border-border bg-card">
            <EmptyState
              icon={<Bell className="h-8 w-8" />}
              title="No pending approvals"
              description="Actions requiring human review will appear here."
            />
          </div>
        ) : (
          <div className="space-y-4">
            {pendingApprovals.map((approval) => (
              <div key={approval.id} className="overflow-hidden rounded-xl border border-border bg-card animate-fade-in">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-border bg-muted/30 px-6 py-4">
                  <div className="flex items-center gap-3">
                    <span className="inline-flex items-center gap-2 rounded-full border border-warning/30 bg-warning-muted px-3 py-1.5 text-xs font-semibold text-warning">
                      <span className="h-2 w-2 animate-pulse rounded-full bg-warning" />
                      Pending Review
                    </span>
                    <DecisionBadge decision={approval.decision} />
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Clock className="h-3.5 w-3.5" />
                    {formatRelativeTime(approval.timestamp)}
                  </div>
                </div>

                {/* Content */}
                <div className="p-6">
                  {/* Agent Info */}
                  <div className="flex items-center gap-3">
                    <AgentAvatar name={approval.agent_name || ''} size="md" />
                    <div>
                      <span className="text-sm font-semibold text-foreground">{approval.agent_name}</span>
                      <p className="text-xs text-muted-foreground">Requesting approval</p>
                    </div>
                  </div>

                  {/* Details Grid */}
                  <div className="mt-5 grid grid-cols-2 gap-4 rounded-xl border border-border bg-muted/30 p-5">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Tool</p>
                      <code className="mt-1 inline-block rounded bg-muted px-2 py-1 font-mono text-sm text-foreground">
                        {approval.tool_name}
                      </code>
                    </div>
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Repository</p>
                      <p className="mt-1 text-sm text-foreground">{approval.target_repo}</p>
                    </div>
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Branch</p>
                      <p className="mt-1 text-sm text-foreground">{approval.target_branch || '—'}</p>
                    </div>
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Summary</p>
                      <p className="mt-1 text-sm leading-relaxed text-foreground">{approval.action_summary}</p>
                    </div>
                  </div>

                  {/* Arguments */}
                  {approval.arguments && (
                    <div className="mt-5">
                      <JsonViewer data={approval.arguments} />
                    </div>
                  )}

                  {/* Actions */}
                  <div className="mt-6 flex items-center gap-3">
                    {confirmDialog?.id === approval.id ? (
                      <div className="flex items-center gap-3 rounded-xl border border-border bg-muted/50 px-5 py-3">
                        <span className="text-sm text-foreground">
                          {confirmDialog.type === 'approve' ? 'Approve this action?' : 'Reject this action?'}
                        </span>
                        <button
                          onClick={() => handleAction(approval.id)}
                          className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors ${
                            confirmDialog.type === 'approve' 
                              ? 'bg-success hover:bg-success/90' 
                              : 'bg-destructive hover:bg-destructive/90'
                          }`}
                        >
                          {confirmDialog.type === 'approve' ? (
                            <CheckCircle2 className="h-4 w-4" />
                          ) : (
                            <XCircle className="h-4 w-4" />
                          )}
                          Confirm
                        </button>
                        <button
                          onClick={() => setConfirmDialog(null)}
                          className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <>
                        <button
                          onClick={() => setConfirmDialog({ id: approval.id, type: 'approve' })}
                          className="flex items-center gap-2 rounded-lg bg-success px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-success/90"
                        >
                          <CheckCircle2 className="h-4 w-4" />
                          Approve
                        </button>
                        <button
                          onClick={() => setConfirmDialog({ id: approval.id, type: 'reject' })}
                          className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive-muted px-5 py-2.5 text-sm font-medium text-destructive transition-colors hover:bg-destructive/20"
                        >
                          <XCircle className="h-4 w-4" />
                          Reject
                        </button>
                        <div className="group relative">
                          <button
                            className="rounded-lg border border-border px-5 py-2.5 text-sm font-medium text-muted-foreground cursor-not-allowed"
                            disabled
                          >
                            Modify
                          </button>
                          <div className="absolute bottom-full left-1/2 mb-2 hidden -translate-x-1/2 rounded-lg border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground shadow-lg group-hover:block">
                            Coming soon
                          </div>
                        </div>
                      </>
                    )}
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
