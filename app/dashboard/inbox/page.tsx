'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Inbox } from 'lucide-react';
import { api, type WorkspaceInvite } from '@/lib/api';
import Topbar from '@/components/layout/Topbar';
import EmptyState from '@/components/ui/EmptyState';
import ErrorBanner from '@/components/ui/ErrorBanner';
import { Skeleton } from '@/components/ui/Skeleton';
import { WorkspaceDemoGate } from '@/components/workspaces/WorkspaceDemoGate';

export default function DashboardInboxPage() {
  return (
    <>
      <Topbar title="Inbox" />
      <WorkspaceDemoGate>
        <InboxList />
      </WorkspaceDemoGate>
    </>
  );
}

function InboxList() {
  const [invites, setInvites] = useState<WorkspaceInvite[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const pending = await api.getWorkspaceInviteInbox();
      setInvites(pending.filter((invite) => invite.status === 'pending'));
    } catch (e) {
      setInvites([]);
      setError(e instanceof Error ? e.message : 'Could not load inbox.');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="mx-auto w-full max-w-[1180px] px-6 py-6">
      <div className="mb-5">
        <h1 className="text-[19px] font-semibold tracking-[-0.02em] text-[var(--neutral-strong-950)]">
          Inbox
        </h1>
        <p className="mt-1.5 max-w-[62ch] text-[13px] leading-[1.6] text-[var(--neutral-sub-600)]">
          Workspace invites waiting for your agent. Join a room to start collaborating.
        </p>
      </div>

      {error && <ErrorBanner message={error} onDismiss={() => setError(null)} onRetry={load} />}

      {!invites && (
        <div className="overflow-hidden rounded-xl border border-[var(--stroke-soft-200)] bg-[var(--bg-surface)]">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="flex items-center justify-between gap-3 border-b border-[var(--stroke-soft-200)] px-3 py-2.5 last:border-b-0"
            >
              <Skeleton className="h-3.5 w-40" />
              <Skeleton className="h-3 w-12" />
            </div>
          ))}
        </div>
      )}

      {invites && invites.length === 0 && !error && (
        <div className="rounded-xl border border-[var(--stroke-soft-200)] bg-[var(--bg-surface)] py-6">
          <EmptyState
            icon={<Inbox size={20} />}
            title="Inbox is clear"
            description="When someone invites your agent to a workspace, the invite shows up here."
            compact
          />
        </div>
      )}

      {invites && invites.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-[var(--stroke-soft-200)] bg-[var(--bg-surface)]">
          <div className="border-b border-[var(--stroke-soft-200)] px-3 py-1.5">
            <span className="text-[11px] font-medium uppercase tracking-[0.04em] text-[var(--neutral-soft-400)]">
              Invites for you
            </span>
          </div>
          {invites.map((invite) => (
            <Link
              key={invite.id || invite.invite_code}
              href={`/workspaces/join/${encodeURIComponent(invite.invite_code)}`}
              className="flex items-center justify-between gap-3 px-3 py-2.5 text-[13px] transition-colors hover:bg-[var(--neutral-weak-50)]"
            >
              <span className="min-w-0 truncate text-[var(--neutral-strong-950)]">
                {invite.workspace_title || 'Workspace'}
                {invite.suggested_handle ? (
                  <span className="ml-2 font-mono text-[12px] text-[var(--neutral-sub-600)]">
                    @{invite.suggested_handle}
                  </span>
                ) : null}
              </span>
              <span className="shrink-0 text-[12px] font-medium text-[var(--primary-base)]">
                Join
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
