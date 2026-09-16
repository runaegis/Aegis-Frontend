'use client';

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import type { WorkspaceAgent, WorkspaceSummary } from '@/lib/api';
import type { RecentWorkspace } from '@/lib/recentWorkspaces';
import { cn } from '@/lib/utils';
import { AgentGlyph, AgentHueProvider } from './agent-visuals';

export type SiblingMeta = {
  agents: WorkspaceAgent[];
  done: number;
  total: number;
};

/**
 * Room switcher.
 *
 * Recent names sit at the top for one-click return. The full list below
 * still has agents + progress so you can scan every room.
 */
export function RoomSidebar({
  workspaces,
  meta,
  currentId,
  recents = [],
}: {
  workspaces: WorkspaceSummary[];
  meta: Record<string, SiblingMeta>;
  currentId: string;
  recents?: RecentWorkspace[];
}) {
  return (
    <>
      <div className="border-b border-[var(--stroke-soft-200)] px-3 py-3">
        <Link
          href="/dashboard/workspaces"
          className="inline-flex items-center gap-1.5 rounded-md px-1.5 py-1 text-[12.5px] font-medium text-[var(--neutral-sub-600)] transition-colors hover:bg-[var(--neutral-weak-50)] hover:text-[var(--neutral-strong-950)]"
        >
          <ArrowLeft size={14} />
          All workspaces
        </Link>
      </div>

      <nav className="flex-1 overflow-y-auto p-1.5">
        {recents.length > 0 && (
          <div className="mb-1.5">
            <div className="flex items-center gap-1.5 px-2 pb-1 pt-1.5">
              <span className="text-[10.5px] font-medium uppercase tracking-[0.05em] text-[var(--neutral-soft-400)]">
                Recent
              </span>
            </div>
            {recents.map((row) => (
              <Link
                key={row.id}
                href={`/workspaces/${row.id}`}
                aria-current={row.id === currentId ? 'page' : undefined}
                className={cn(
                  'relative block truncate rounded-md px-2.5 py-1.5 text-[12.5px] leading-[1.4]',
                  row.id === currentId
                    ? 'bg-[var(--bg-surface-alt)] font-semibold text-[var(--neutral-strong-950)]'
                    : 'font-medium text-[var(--neutral-sub-600)] hover:bg-[var(--neutral-weak-50)] hover:text-[var(--neutral-strong-950)]',
                )}
                title={row.title}
              >
                {row.title}
              </Link>
            ))}
          </div>
        )}

        <div className="flex items-center gap-1.5 px-2 pb-1 pt-1.5">
          <span className="text-[10.5px] font-medium uppercase tracking-[0.05em] text-[var(--neutral-soft-400)]">
            Workspaces
          </span>
          <span className="font-mono text-[10.5px] tabular-nums text-[var(--neutral-soft-400)]">
            {workspaces.length}
          </span>
        </div>

        {workspaces.map((s) => (
          <Row key={s.id} summary={s} meta={meta[s.id]} current={s.id === currentId} />
        ))}
      </nav>
    </>
  );
}

function Row({
  summary,
  meta,
  current,
}: {
  summary: WorkspaceSummary;
  meta?: SiblingMeta;
  current: boolean;
}) {
  const agents = (meta?.agents ?? []).filter((a) => a.status === 'active');
  const shown = agents.slice(0, 3);
  const overflow = agents.length - shown.length;
  const total = meta?.total ?? summary.pointer_count ?? 0;
  const done = meta?.done ?? 0;
  const pct = total ? Math.round((done / total) * 100) : 0;
  const complete = total > 0 && done === total;

  return (
    <Link
      href={`/workspaces/${summary.id}`}
      aria-current={current ? 'page' : undefined}
      className={cn(
        'group relative block rounded-lg py-2 pl-3 pr-2.5 transition-colors',
        current
          ? 'bg-[var(--bg-surface-alt)]'
          : 'hover:bg-[var(--neutral-weak-50)]',
      )}
    >
      {/* Active marker: a rule, matching how the stream marks a message
          addressed to you, rather than a second tinted surface. */}
      {current && (
        <span
          aria-hidden="true"
          className="absolute inset-y-1.5 left-0 w-[2px] rounded-full bg-[var(--primary-base)]"
        />
      )}

      <span
        className={cn(
          'block truncate text-[12.5px] leading-[1.4]',
          current
            ? 'font-semibold text-[var(--neutral-strong-950)]'
            : 'font-medium text-[var(--neutral-strong-950)]',
        )}
      >
        {summary.title}
      </span>

      <div className="mt-1.5 flex items-center gap-2">
        <AgentHueProvider handles={(meta?.agents ?? []).map((a) => a.handle)}>
          <span className="flex items-center">
            {shown.length > 0 ? (
              <>
                {shown.map((a, i) => (
                  <span
                    key={a.id}
                    className={cn(
                      'overflow-hidden rounded-[6px] ring-2',
                      current ? 'ring-[var(--bg-surface-alt)]' : 'ring-[var(--white-0)] group-hover:ring-[var(--neutral-weak-50)]',
                    )}
                    style={{ marginLeft: i === 0 ? 0 : -5, zIndex: shown.length - i }}
                    title={`@${a.handle}`}
                  >
                    <AgentGlyph handle={a.handle} roleLabel={a.role_label} size="sm" />
                  </span>
                ))}
                {overflow > 0 && (
                  <span className="ml-1 font-mono text-[10px] text-[var(--neutral-soft-400)]">
                    +{overflow}
                  </span>
                )}
              </>
            ) : (
              <span className="font-mono text-[10px] text-[var(--neutral-soft-400)]">
                no agents
              </span>
            )}
          </span>
        </AgentHueProvider>

        {/* Progress, so you can see which room needs attention */}
        {total > 0 && (
          <span className="ml-auto flex shrink-0 items-center gap-1.5" title={`${done} of ${total} tasks done`}>
            <span className="h-1 w-7 overflow-hidden rounded-full bg-[var(--neutral-soft-200)]">
              <span
                className={cn(
                  'block h-full rounded-full transition-[width] duration-500',
                  complete ? 'bg-[var(--success)]' : 'bg-[var(--primary-base)]',
                )}
                style={{ width: `${pct}%` }}
              />
            </span>
            <span className="font-mono text-[10px] tabular-nums text-[var(--neutral-soft-400)]">
              {done}/{total}
            </span>
          </span>
        )}
      </div>
    </Link>
  );
}
