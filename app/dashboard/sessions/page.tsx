'use client';

import { useState, useCallback } from 'react';
import { Layers, ChevronDown, ChevronRight } from 'lucide-react';
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
    <div>
      <Topbar title="Sessions" subtitle="Agent working sessions" lastUpdated={lastUpdated} onRefresh={fetchData} />
      <div className="p-8">
        {error && (
          <div className="mb-6">
            <ErrorBanner message={error} onDismiss={() => setError(null)} onRetry={fetchData} />
          </div>
        )}
        {sessions.length === 0 ? (
          <div className="rounded-xl border border-zinc-200 bg-white">
            <EmptyState
              icon={<Layers className="h-12 w-12" />}
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
    <div className="rounded-xl border border-zinc-200 bg-white transition-shadow hover:shadow-sm">
      <button onClick={handleToggle} className="w-full px-6 py-4 text-left">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AgentAvatar name={session.agent_name || ''} />
            <div>
              <span className="text-sm font-medium text-zinc-900">{session.agent_name}</span>
              <span className="ml-2 font-mono text-xs text-zinc-400">
                {session.session_id?.substring(0, 8)}...
              </span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-zinc-400">
              {session.action_count} action{Number(session.action_count) !== 1 ? 's' : ''}
            </span>
            <span className="text-xs text-zinc-400">{formatRelativeTime(session.started_at)}</span>
            {isExpanded ? (
              <ChevronDown className="h-4 w-4 text-zinc-400" />
            ) : (
              <ChevronRight className="h-4 w-4 text-zinc-400" />
            )}
          </div>
        </div>

        <div className="mt-3 flex items-center gap-2">
          {Number(session.allows) > 0 && (
            <span className="rounded-full bg-[#F0FDF4] px-2 py-0.5 text-xs font-medium text-[#15803D]">
              {session.allows} allow
            </span>
          )}
          {Number(session.denies) > 0 && (
            <span className="rounded-full bg-[#FEF2F2] px-2 py-0.5 text-xs font-medium text-[#B91C1C]">
              {session.denies} deny
            </span>
          )}
          {Number(session.rewrites) > 0 && (
            <span className="rounded-full bg-[#FEFCE8] px-2 py-0.5 text-xs font-medium text-[#854D0E]">
              {session.rewrites} rewrite
            </span>
          )}
          {Number(session.approvals) > 0 && (
            <span className="rounded-full bg-[#F5F3FF] px-2 py-0.5 text-xs font-medium text-[#6D28D9]">
              {session.approvals} approval
            </span>
          )}
        </div>

        {repos.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {repos.map((repo) => (
              <span
                key={repo}
                className="rounded-md bg-zinc-100 px-2 py-0.5 font-mono text-xs text-zinc-600"
              >
                {repo}
              </span>
            ))}
          </div>
        )}
      </button>

      {isExpanded && (
        <div className="border-t border-zinc-100 px-6 py-5">
          {loadingActions ? (
            <div className="flex justify-center py-8">
              <LoadingSpinner />
            </div>
          ) : actions && actions.length > 0 ? (
            <>
              <div className="relative ml-4 border-l-2 border-zinc-200 pl-6">
                {actions.map((action, i) => {
                  const dotColor =
                    action.decision === 'ALLOW'
                      ? 'bg-[#15803D]'
                      : action.decision === 'DENY'
                        ? 'bg-[#B91C1C]'
                        : action.decision === 'REWRITE'
                          ? 'bg-[#854D0E]'
                          : action.decision?.toUpperCase().includes('APPROVAL')
                            ? 'bg-[#6D28D9]'
                            : 'bg-zinc-400';

                  return (
                    <div key={action.id} className={`relative pb-6 ${i === actions.length - 1 ? 'pb-0' : ''}`}>
                      <div
                        className={`absolute -left-[31px] top-1 h-3 w-3 rounded-full border-2 border-white ${dotColor}`}
                      />
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="text-sm text-zinc-800">{action.action_summary}</p>
                          <div className="mt-1 flex items-center gap-2">
                            <code className="font-mono text-xs text-zinc-400">{action.tool_name}</code>
                            <span className="text-xs text-zinc-300">|</span>
                            <span className="text-xs text-zinc-400">{formatRelativeTime(action.timestamp)}</span>
                          </div>
                        </div>
                        <DecisionBadge decision={action.decision} />
                      </div>
                      {action.arguments && Object.keys(action.arguments).length > 0 && (
                        <div className="mt-2">
                          <JsonViewer data={action.arguments} />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="mt-5 flex items-center justify-between border-t border-zinc-100 pt-4">
                <span className="text-xs text-zinc-400">
                  Duration: {formatDuration(session.started_at, session.last_action_at)}
                </span>
                <Link
                  href={`/dashboard?session=${session.session_id}`}
                  className="text-xs font-medium text-blue-600 hover:underline"
                >
                  View all runs in this session
                </Link>
              </div>
            </>
          ) : (
            <p className="py-4 text-center text-sm text-zinc-500">No actions found for this session.</p>
          )}
        </div>
      )}
    </div>
  );
}
