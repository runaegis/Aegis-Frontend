'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion, useReducedMotion } from 'motion/react';
import { CheckCircle2, MessageSquareText, Plus, Users2, Boxes } from 'lucide-react';
import { api, type WorkspaceSummary, type WorkspaceAgent } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import EmptyState from '@/components/ui/EmptyState';
import ErrorBanner from '@/components/ui/ErrorBanner';
import { RelativeTime } from '@/components/ui/RelativeTime';
import { Skeleton } from '@/components/ui/Skeleton';
import { DUR, EASE } from '@/lib/motion';
import { cn } from '@/lib/utils';
import { AgentGlyph, AgentHueProvider } from './agent-visuals';
import { CreateWorkspaceDialog } from './CreateWorkspaceDialog';
import { SampleDataChip } from './WorkspaceDemoGate';

type RosterMap = Record<string, WorkspaceAgent[]>;

export function WorkspacesList() {
  const router = useRouter();
  const reduce = useReducedMotion();
  const [workspaces, setWorkspaces] = useState<WorkspaceSummary[] | null>(null);
  const [rosters, setRosters] = useState<RosterMap>({});
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const list = await api.getWorkspaces();
      setWorkspaces(list);
      // Fetch rosters so cards can show who is actually in each room.
      const entries = await Promise.all(
        list.map(async (w) => {
          try {
            const detail = await api.getWorkspace(w.id);
            return [w.id, detail.agents.filter((a) => a.status === 'active')] as const;
          } catch {
            return [w.id, [] as WorkspaceAgent[]] as const;
          }
        }),
      );
      setRosters(Object.fromEntries(entries));
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
      {/* Header */}
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

      {/* Loading */}
      {!workspaces && (
        <div className="overflow-hidden rounded-xl border border-[var(--stroke-soft-200)] bg-[var(--bg-surface)] shadow-[0_1px_2px_rgba(23,23,23,0.04),0_8px_24px_-12px_rgba(23,23,23,0.12)]">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="flex items-center gap-3 border-b border-[var(--stroke-soft-200)] px-3 py-2.5 last:border-b-0"
            >
              <Skeleton className="size-5 w-[58px] rounded-[5px]" />
              <Skeleton className="h-3.5 w-40" />
              <Skeleton className="hidden h-3 flex-1 sm:block" />
              <Skeleton className="h-3 w-24" />
            </div>
          ))}
        </div>
      )}

      {/* Empty */}
      {workspaces && workspaces.length === 0 && !error && (
        <div className="rounded-xl border border-[var(--stroke-soft-200)] bg-[var(--bg-surface)] py-6 shadow-[0_1px_2px_rgba(23,23,23,0.04),0_8px_24px_-12px_rgba(23,23,23,0.12)]">
          <EmptyState
            icon={<Boxes size={20} />}
            title="No workspaces yet"
            description="Create a room, invite your agents, and give them a goal to work on together."
            action={
              <Button variant="primary" size="md" leadingIcon={<Plus size={14} />} onClick={() => setCreating(true)}>
                New workspace
              </Button>
            }
          />
        </div>
      )}

      {/* Rows. Raised surface: the page canvas is tinted, so the list needs
          its own white card and a soft shadow to read as the primary object
          rather than dissolving into the background. */}
      {workspaces && workspaces.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-[var(--stroke-soft-200)] bg-[var(--bg-surface)] shadow-[0_1px_2px_rgba(23,23,23,0.04),0_8px_24px_-12px_rgba(23,23,23,0.12)]">
          <div className="flex items-center gap-3 border-b border-[var(--stroke-soft-200)] px-3 py-1.5">
            <span className="text-[11px] font-medium uppercase tracking-[0.04em] text-[var(--neutral-soft-400)]">
              Workspace
            </span>
            <span className="ml-auto hidden font-mono text-[10.5px] uppercase tracking-[0.04em] text-[var(--neutral-soft-400)] sm:block">
              tasks · agents · messages
            </span>
          </div>
          {workspaces.map((w, index) => (
            <motion.div
              key={w.id}
              initial={reduce ? false : { opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: DUR.default, ease: EASE.out, delay: reduce ? 0 : index * 0.025 }}
              className="border-b border-[var(--stroke-soft-200)] last:border-b-0"
            >
              <WorkspaceRow workspace={w} agents={rosters[w.id] ?? []} />
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

/**
 * Dense row, in the spirit of a Linear issue list: one line of identity,
 * one line of context, and quiet right-aligned metrics. Hover is a tonal
 * shift rather than a shadow lift, so the list stays flat and scannable.
 */
function WorkspaceRow({
  workspace,
  agents,
}: {
  workspace: WorkspaceSummary;
  agents: WorkspaceAgent[];
}) {
  const shown = agents.slice(0, 3);
  const overflow = agents.length - shown.length;

  return (
    <Link
      href={`/workspaces/${workspace.id}`}
      className={cn(
        'group flex items-center gap-3 px-3 py-2.5 transition-colors',
        'hover:bg-[var(--neutral-weak-50)]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[rgba(250,115,25,0.35)]',
      )}
    >
      {/* Roster stack. Same provider as the room, so an agent keeps its
          colour between this list and the conversation. */}
      <AgentHueProvider handles={agents.map((a) => a.handle)}>
      <div className="flex w-[58px] shrink-0 items-center">
        {shown.length > 0 ? (
          <>
            {shown.map((a, i) => (
              <span
                key={a.id}
                className="rounded-[5px] ring-2 ring-[var(--white-0)] group-hover:ring-[var(--neutral-weak-50)]"
                style={{ marginLeft: i === 0 ? 0 : -5, zIndex: shown.length - i }}
                title={`@${a.handle}`}
              >
                <AgentGlyph handle={a.handle} roleLabel={a.role_label} size="sm" />
              </span>
            ))}
            {overflow > 0 && (
              <span className="ml-1 font-mono text-[10.5px] text-[var(--neutral-soft-400)]">
                +{overflow}
              </span>
            )}
          </>
        ) : (
          <span className="size-5 rounded-[5px] border border-dashed border-[var(--stroke-sub-300)]" />
        )}
      </div>
      </AgentHueProvider>

      {/* Identity + context */}
      <div className="flex min-w-0 flex-1 items-baseline gap-2.5">
        <span className="shrink-0 truncate text-[13.5px] font-medium tracking-[-0.011em] text-[var(--neutral-strong-950)]">
          {workspace.title}
        </span>
        <span className="hidden min-w-0 truncate text-[12px] leading-[1.5] text-[var(--neutral-soft-400)] sm:block">
          {workspace.task ?? 'No goal set'}
        </span>
      </div>

      {/* Metrics */}
      <div className="flex shrink-0 items-center gap-3.5 font-mono text-[11px] tabular-nums text-[var(--neutral-soft-400)]">
        <span className="inline-flex items-center gap-1" title="Tasks">
          <CheckCircle2 size={11.5} />
          {workspace.pointer_count ?? 0}
        </span>
        <span className="inline-flex items-center gap-1" title="Agents">
          <Users2 size={11.5} />
          {workspace.agent_count}
        </span>
        <span className="inline-flex items-center gap-1" title="Messages">
          <MessageSquareText size={11.5} />
          {workspace.message_count}
        </span>
        <span className="hidden w-[72px] text-right md:block">
          <RelativeTime timestamp={workspace.created_at} />
        </span>
      </div>
    </Link>
  );
}
