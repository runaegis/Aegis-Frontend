'use client';

import { useState, useCallback } from 'react';
import { Layers, ChevronDown, ChevronRight, Clock, GitBranch } from 'lucide-react';
import { api } from '@/lib/api';
import { useAutoRefresh } from '@/lib/hooks';
import { Session, SessionAction } from '@/lib/types';
import { formatRelativeTime, formatDuration } from '@/lib/utils';
import Topbar from '@/components/layout/Topbar';
import DecisionBadge from '@/components/ui/DecisionBadge';
import AgentAvatar from '@/components/ui/AgentAvatar';
import JsonViewer from '@/components/ui/JsonViewer';
import EmptyState from '@/components/ui/EmptyState';
import ErrorBanner from '@/components/ui/ErrorBanner';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import Link from 'next/link';

export default function SessionsPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedSession, setExpandedSession] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const data = await api.getSessions();
      setSessions(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load sessions');
    } finally {
      setLoading(false);
    }
  }, []);

  const { lastUpdated } = useAutoRefresh(fetchData, 30000);

  if (loading) {
    return (
      <div className="flex h-[calc(100vh-80px)] items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Topbar title="Sessions" subtitle="Agent working sessions" lastUpdated={lastUpdated} onRefresh={fetchData} />
      <div className="p-8">
        {error && (
          <div className="mb-6">
            <ErrorBanner message={error} onDismiss={() => setError(null)} onRetry={fetchData} />
          </div>
        )}

        {/* Stats Bar */}
        <div className="mb-6 flex items-center gap-4">
          <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2">
            <span className="text-2xl font-semibold text-foreground">{sessions.length}</span>
            <span className="text-sm text-muted-foreground">Total Sessions</span>
          </div>
        </div>

        {sessions.length === 0 ? (
          <div className="rounded-xl border border-border bg-card">
            <EmptyState
              icon={<Layers className="h-8 w-8" />}
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
                isExpanded={expandedSession === session.session_id}
                onToggle={() =>
                  setExpandedSession(expandedSession === session.session_id ? null : session.session_id)
                }
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function SessionCard({
  session,
  isExpanded,
  onToggle,
}: {
  session: Session;
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
        const data = await api.getSessionActions(session.session_id);
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
    <div className="overflow-hidden rounded-xl border border-border bg-card transition-all hover:border-border-hover">
      <button onClick={handleToggle} className="w-full px-6 py-5 text-left">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <AgentAvatar name={session.agent_name || ''} size="lg" />
            <div>
              <div className="flex items-center gap-3">
                <span className="text-base font-semibold text-foreground">{session.agent_name}</span>
                <code className="rounded bg-muted px-2 py-0.5 font-mono text-xs text-muted-foreground">
                  {session.session_id?.substring(0, 8)}...
                </code>
              </div>
              <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" />
                  {formatRelativeTime(session.started_at)}
                </span>
                <span>{session.action_count} action{Number(session.action_count) !== 1 ? 's' : ''}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted text-muted-foreground transition-colors group-hover:bg-muted">
              {isExpanded ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </div>
          </div>
        </div>

        {/* Decision Stats */}
        <div className="mt-4 flex items-center gap-2">
          {Number(session.allows) > 0 && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-success/30 bg-success-muted px-2.5 py-1 text-xs font-medium text-success">
              <span className="h-1.5 w-1.5 rounded-full bg-success" />
              {session.allows} allow
            </span>
          )}
          {Number(session.denies) > 0 && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-destructive/30 bg-destructive-muted px-2.5 py-1 text-xs font-medium text-destructive">
              <span className="h-1.5 w-1.5 rounded-full bg-destructive" />
              {session.denies} deny
            </span>
          )}
          {Number(session.rewrites) > 0 && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-warning/30 bg-warning-muted px-2.5 py-1 text-xs font-medium text-warning">
              <span className="h-1.5 w-1.5 rounded-full bg-warning" />
              {session.rewrites} rewrite
            </span>
          )}
          {Number(session.approvals) > 0 && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-info/30 bg-info-muted px-2.5 py-1 text-xs font-medium text-info">
              <span className="h-1.5 w-1.5 rounded-full bg-info" />
              {session.approvals} approval
            </span>
          )}
        </div>

        {/* Repos */}
        {repos.length > 0 && (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <GitBranch className="h-3.5 w-3.5 text-muted-foreground" />
            {repos.map((repo) => (
              <span
                key={repo}
                className="rounded-md bg-muted px-2 py-1 font-mono text-xs text-muted-foreground"
              >
                {repo}
              </span>
            ))}
          </div>
        )}
      </button>

      {isExpanded && (
        <div className="border-t border-border bg-muted/30 px-6 py-6 animate-fade-in">
          {loadingActions ? (
            <div className="flex justify-center py-8">
              <LoadingSpinner />
            </div>
          ) : actions && actions.length > 0 ? (
            <>
              {/* Timeline */}
              <div className="relative ml-4 border-l-2 border-border pl-6">
                {actions.map((action, i) => {
                  const dotColor =
                    action.decision === 'ALLOW'
                      ? 'bg-success'
                      : action.decision === 'DENY'
                        ? 'bg-destructive'
                        : action.decision === 'REWRITE'
                          ? 'bg-warning'
                          : action.decision?.toUpperCase().includes('APPROVAL')
                            ? 'bg-info'
                            : 'bg-muted-foreground';

                  return (
                    <div key={action.id} className={`relative pb-6 ${i === actions.length - 1 ? 'pb-0' : ''}`}>
                      <div
                        className={`absolute -left-[31px] top-1 h-3 w-3 rounded-full ring-4 ring-card ${dotColor}`}
                      />
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="text-sm text-foreground">{action.action_summary}</p>
                          <div className="mt-1.5 flex items-center gap-3">
                            <code className="rounded bg-muted px-2 py-0.5 font-mono text-xs text-muted-foreground">
                              {action.tool_name}
                            </code>
                            <span className="text-xs text-muted-foreground">{formatRelativeTime(action.timestamp)}</span>
                          </div>
                        </div>
                        <DecisionBadge decision={action.decision} size="sm" />
                      </div>
                      {action.arguments && Object.keys(action.arguments).length > 0 && (
                        <div className="mt-3">
                          <JsonViewer data={action.arguments} />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Footer */}
              <div className="mt-6 flex items-center justify-between border-t border-border pt-5">
                <span className="text-xs text-muted-foreground">
                  Duration: {formatDuration(session.started_at, session.last_action_at)}
                </span>
                <Link
                  href={`/dashboard?session=${session.session_id}`}
                  className="text-xs font-medium text-primary transition-colors hover:text-primary-hover hover:underline"
                >
                  View all runs in this session
                </Link>
              </div>
            </>
          ) : (
            <p className="py-4 text-center text-sm text-muted-foreground">No actions found for this session.</p>
          )}
        </div>
      )}
    </div>
  );
}
