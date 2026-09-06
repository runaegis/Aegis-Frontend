'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion, useReducedMotion } from 'motion/react';
import { Boxes, Inbox, Plus } from 'lucide-react';
import { api, type WorkspaceSummary } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import EmptyState from '@/components/ui/EmptyState';
import ErrorBanner from '@/components/ui/ErrorBanner';
import { RelativeTime } from '@/components/ui/RelativeTime';
import { Skeleton } from '@/components/ui/Skeleton';
import { DUR, EASE } from '@/lib/motion';
import { cn, formatCompactNumber, parseApiUtcTimestamp } from '@/lib/utils';
import { CreateWorkspaceDialog } from './CreateWorkspaceDialog';
import { SampleDataChip } from './WorkspaceDemoGate';

export function WorkspacesList() {
  const router = useRouter();
  const reduce = useReducedMotion();
  const [workspaces, setWorkspaces] = useState<WorkspaceSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const list = await api.getWorkspaces();
      setWorkspaces(list);
    } catch (e) {
      setWorkspaces([]);
      setError(e instanceof Error ? e.message : 'Could not load workspaces.');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const total = workspaces?.length ?? 0;

  return (
    <div className="mx-auto w-full max-w-[1180px] px-6 py-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <h1 className="text-[19px] font-semibold tracking-[-0.02em] text-[var(--neutral-strong-950)]">
            Agent Workspaces
          </h1>
          {workspaces && (
            <span className="rounded-md bg-[var(--neutral-weak-50)] px-1.5 py-0.5 font-mono text-[12px] text-[var(--neutral-sub-600)]">
              {total}
            </span>
          )}
          <SampleDataChip />
        </div>
        <Button
          variant="primary"
          size="lg"
          leadingIcon={<Plus size={14} />}
          onClick={() => setCreating(true)}
        >
          New workspace
        </Button>
      </div>

      <p className="mb-6 max-w-[62ch] text-[13px] leading-[1.6] text-[var(--neutral-sub-600)]">
        A workspace is a shared room where several agents coordinate on one goal. Every message,
        mention, and file passes through Aegis, so you can watch the work and keep the audit trail.
      </p>

      {error && <ErrorBanner message={error} onDismiss={() => setError(null)} onRetry={load} />}

      {!workspaces && (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="rounded-xl border border-[var(--stroke-soft-200)] bg-[var(--bg-surface)] p-4"
            >
              <div className="flex items-center gap-3">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-3 w-24" />
                <Skeleton className="ml-auto h-7 w-14 rounded-[8px]" />
              </div>
              <div className="mt-4 grid grid-cols-5 gap-2">
                {Array.from({ length: 5 }).map((_, j) => (
                  <Skeleton key={j} className="h-10 rounded-md" />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {workspaces && workspaces.length === 0 && !error && (
        <div className="rounded-xl border border-[var(--stroke-soft-200)] bg-[var(--bg-surface)] py-6 shadow-[0_1px_2px_rgba(23,23,23,0.04),0_8px_24px_-12px_rgba(23,23,23,0.12)]">
          <EmptyState
            icon={<Boxes size={20} />}
            title="No workspaces yet"
            description="Create a room, invite another user's agent with a link, and give them a goal to work on together."
            action={
              <Button variant="primary" size="md" leadingIcon={<Plus size={14} />} onClick={() => setCreating(true)}>
                New workspace
              </Button>
            }
          />
        </div>
      )}

      {workspaces && workspaces.length > 0 && (
        <div className="flex flex-col gap-3">
          {workspaces.map((w, index) => (
            <motion.div
              key={w.id}
              initial={reduce ? false : { opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: DUR.default, ease: EASE.out, delay: reduce ? 0 : index * 0.03 }}
            >
              <WorkspaceCard workspace={w} />
            </motion.div>
          ))}
        </div>
      )}

      <CreateWorkspaceDialog
        open={creating}
        onOpenChange={setCreating}
        onCreated={(detail) => router.push(`/workspaces/${detail.workspace.id}`)}
      />
    </div>
  );
}

type CardBorderStatus = 'failed' | 'attention' | 'default';

function workspaceBorderStatus(workspace: WorkspaceSummary): CardBorderStatus {
  // Red takes priority. failed_run_count is optional until backend ships it;
  // never invent a count, and never render a failed-run chip.
  if ((workspace.failed_run_count ?? 0) > 0) return 'failed';
  if ((workspace.unread_mention_count ?? 0) > 0) return 'attention';
  return 'default';
}

function workspaceBorderColor(status: CardBorderStatus): string {
  if (status === 'failed') return 'var(--error)';
  if (status === 'attention') return 'var(--attention)';
  return 'var(--stroke-sub-300)';
}

function hasRecordedActivity(workspace: WorkspaceSummary): boolean {
  if ((workspace.message_count ?? 0) > 0 || (workspace.run_count ?? 0) > 0) return true;
  if (!workspace.last_activity_at) return false;
  return workspace.last_activity_at !== workspace.created_at;
}

function isUnusedWorkspace(workspace: WorkspaceSummary): boolean {
  return (
    workspace.agent_count === 0 &&
    workspace.message_count === 0 &&
    (workspace.pointer_count ?? 0) === 0 &&
    (workspace.run_count ?? 0) === 0 &&
    (workspace.total_tokens ?? 0) === 0
  );
}

function CreatedDate({ timestamp }: { timestamp: string }) {
  const parsed = parseApiUtcTimestamp(timestamp);
  const isValid = !Number.isNaN(parsed.getTime());
  const dateLabel = isValid
    ? parsed.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
    : null;
  return (
    <span title={isValid ? parsed.toLocaleString() : undefined}>
      {dateLabel ? `Created ${dateLabel}` : 'Created'}
    </span>
  );
}

function WorkspaceCard({ workspace }: { workspace: WorkspaceSummary }) {
  const unread = workspace.unread_mention_count ?? 0;
  const unused = isUnusedWorkspace(workspace);
  const active = hasRecordedActivity(workspace);
  const borderStatus = workspaceBorderStatus(workspace);
  const stats = [
    { label: 'Agents', value: workspace.agent_count },
    { label: 'Messages', value: workspace.message_count },
    { label: 'Task pointers', value: workspace.pointer_count ?? 0 },
    { label: 'Runs', value: workspace.run_count ?? 0 },
    { label: 'Tokens', value: workspace.total_tokens ?? 0 },
  ];

  return (
    <Link
      href={`/workspaces/${workspace.id}`}
      className={cn(
        'group relative block overflow-hidden rounded-xl border border-[var(--stroke-soft-200)] bg-[var(--bg-surface)] p-4 pl-5',
        unused
          ? 'shadow-none'
          : 'shadow-[0_1px_2px_rgba(23,23,23,0.04),0_8px_24px_-12px_rgba(23,23,23,0.12)]',
        'transition-colors hover:bg-[var(--neutral-weak-50)]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--primary-alpha-16)]',
      )}
    >
      <span
        aria-hidden
        className={cn('absolute inset-y-0 left-0 w-[3px]', unused && 'opacity-50')}
        style={{ backgroundColor: workspaceBorderColor(borderStatus) }}
      />

      <div className={cn('flex items-start gap-3', unused && 'opacity-70')}>
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <span
              className={cn(
                'truncate text-[14.5px] font-semibold tracking-[-0.015em]',
                unused
                  ? 'text-[var(--neutral-sub-600)]'
                  : 'text-[var(--neutral-strong-950)]',
              )}
            >
              {workspace.title}
            </span>
            {unused && (
              <span className="rounded-full border border-[var(--stroke-soft-200)] bg-[var(--neutral-weak-50)] px-1.5 py-0.5 text-[10.5px] font-medium uppercase tracking-[0.04em] text-[var(--neutral-soft-400)]">
                Unused
              </span>
            )}
            {unread > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-[var(--attention-lighter)] px-1.5 py-0.5 text-[10.5px] font-semibold tabular-nums text-[var(--attention-dark)]">
                <Inbox size={10} strokeWidth={2.5} />
                {unread}
              </span>
            )}
            <span className="text-[12px] text-[var(--neutral-soft-400)]">
              {active && workspace.last_activity_at ? (
                <RelativeTime timestamp={workspace.last_activity_at} />
              ) : (
                <CreatedDate timestamp={workspace.created_at} />
              )}
            </span>
          </div>
        </div>
        <span
          className={cn(
            'inline-flex h-7 shrink-0 items-center rounded-[8px] border border-[var(--stroke-sub-300)] bg-[var(--bg-surface)] px-2.5 text-[12px] font-medium text-[var(--neutral-sub-600)]',
            'shadow-[0_1px_2px_rgba(23,23,23,0.04)]',
            'group-hover:border-[var(--primary-base)] group-hover:text-[var(--primary-base)]',
          )}
        >
          Open
        </span>
      </div>

      <div
        className={cn(
          'mt-3 grid grid-cols-2 gap-3 border-t border-[var(--stroke-soft-200)] pt-3 sm:grid-cols-5 sm:gap-2',
          unused && 'opacity-55',
        )}
      >
        {stats.map((stat) => (
          <div key={stat.label} className="min-w-0">
            <div className="text-[18px] font-semibold leading-none tracking-[-0.03em] tabular-nums text-[var(--neutral-strong-950)]">
              {formatCompactNumber(stat.value)}
            </div>
            <div className="mt-1 truncate text-[10.5px] font-medium uppercase tracking-[0.04em] text-[var(--neutral-soft-400)]">
              {stat.label}
            </div>
          </div>
        ))}
      </div>
    </Link>
  );
}
