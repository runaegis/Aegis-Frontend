'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Check, CircleDashed, Clock3, MoreHorizontal, Plus } from 'lucide-react';
import type { WorkspaceAgent, WorkspacePointerStatus, WorkspaceTaskPointer } from '@/lib/api';
import { DUR, EASE } from '@/lib/motion';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { RelativeTime } from '@/components/ui/RelativeTime';
import { AgentGlyph } from './agent-visuals';
import { PanelEmpty } from './PanelEmpty';

const STATUSES: WorkspacePointerStatus[] = ['pending', 'review', 'done'];

const STATUS_META: Record<
  WorkspacePointerStatus,
  { label: string; tone: 'neutral' | 'warning' | 'success'; icon: typeof Check }
> = {
  pending: { label: 'Pending', tone: 'neutral', icon: CircleDashed },
  review: { label: 'In review', tone: 'warning', icon: Clock3 },
  done: { label: 'Done', tone: 'success', icon: Check },
};

export function TaskChecklist({
  pointers,
  agents,
  onCreate,
  onUpdate,
  onDelete,
  focusSignal = 0,
}: {
  pointers: WorkspaceTaskPointer[];
  agents: WorkspaceAgent[];
  onCreate: (title: string) => Promise<void>;
  onUpdate: (
    id: string,
    payload: { status?: WorkspacePointerStatus; assignee_member_id?: string | null },
  ) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  /** Bumped by the parent to focus the add field, e.g. from the `t` shortcut. */
  focusSignal?: number;
}) {
  const reduce = useReducedMotion();
  const [draft, setDraft] = useState('');
  const [composing, setComposing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [menuId, setMenuId] = useState<string | null>(null);
  const addRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const byId = useMemo(() => new Map(agents.map((a) => [a.id, a])), [agents]);
  const activeAgents = useMemo(() => agents.filter((a) => a.status === 'active'), [agents]);

  const rows = useMemo(
    () =>
      pointers.slice().sort((a, b) => {
        const time = b.created_at.localeCompare(a.created_at);
        return time !== 0 ? time : b.sort_order - a.sort_order;
      }),
    [pointers],
  );

  useEffect(() => {
    if (focusSignal > 0) {
      setComposing(true);
      requestAnimationFrame(() => addRef.current?.focus());
    }
  }, [focusSignal]);

  useEffect(() => {
    if (!menuId) return;
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuId(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuId(null);
    };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuId]);

  const add = async () => {
    const title = draft.trim();
    if (!title || busy) return;
    setBusy(true);
    try {
      await onCreate(title);
      setDraft('');
      setComposing(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--stroke-soft-200)] px-4 py-3">
        <div className="min-w-0">
          <div className="flex items-baseline gap-2">
            <h2 className="text-[14px] font-semibold tracking-[-0.01em] text-[var(--neutral-strong-950)]">
              Tasks
            </h2>
            <span className="text-[12px] text-[var(--neutral-soft-400)]">{rows.length}</span>
            <span className="text-[11.5px] text-[var(--neutral-soft-400)]">Newest first</span>
          </div>
          <p className="mt-1 max-w-[52ch] text-[12px] leading-[1.5] text-[var(--neutral-sub-600)]">
            A pointer is a note, not a state machine. Status stays pending, in review, or done —
            the check mark is only a label.
          </p>
        </div>
        <Button
          variant="primary"
          size="sm"
          leadingIcon={<Plus size={13} />}
          onClick={() => {
            setComposing(true);
            requestAnimationFrame(() => addRef.current?.focus());
          }}
        >
          New task pointer
        </Button>
      </div>

      {composing && (
        <div className="border-b border-[var(--stroke-soft-200)] px-4 py-2.5">
          <input
            ref={addRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void add();
              if (e.key === 'Escape') {
                setComposing(false);
                setDraft('');
              }
            }}
            placeholder="Title this pointer"
            disabled={busy}
            className="w-full rounded-md border border-[var(--stroke-soft-200)] bg-[var(--bg-surface)] px-2.5 py-1.5 text-[13px] text-[var(--neutral-strong-950)] placeholder:text-[var(--neutral-soft-400)] focus:border-[var(--primary-base)] focus:outline-none focus:ring-2 focus:ring-[var(--primary-alpha-16)]"
          />
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        {rows.length === 0 && !composing && (
          <PanelEmpty
            icon={CircleDashed}
            title="No tasks yet"
            hint="Break the goal into pointers the agents can pick up."
          />
        )}

        <AnimatePresence initial={false}>
          {rows.map((p) => {
            const meta = STATUS_META[p.status];
            const Icon = meta.icon;
            const author = p.created_by_member_id ? byId.get(p.created_by_member_id) : undefined;
            const assignee =
              p.assignee_member_id ? byId.get(p.assignee_member_id) : undefined;
            const assigneeHandle = assignee?.handle ?? p.assignee_handle ?? null;

            return (
              <motion.div
                key={p.id}
                layout={!reduce}
                initial={reduce ? false : { opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reduce ? { opacity: 0 } : { opacity: 0, x: -8 }}
                transition={{ duration: DUR.default, ease: EASE.out }}
                className="group flex items-start gap-3 border-b border-[var(--stroke-soft-200)] px-4 py-3"
              >
                <span
                  aria-hidden
                  className={cn(
                    'mt-0.5 flex size-[18px] shrink-0 items-center justify-center rounded-full border',
                    p.status === 'done'
                      ? 'border-[var(--success)] bg-[rgba(31,193,107,0.16)] text-[var(--success-dark)]'
                      : p.status === 'review'
                        ? 'border-[var(--warning)] bg-[rgba(246,181,30,0.18)] text-[var(--warning-dark)]'
                        : 'border-[var(--stroke-sub-300)] text-[var(--neutral-soft-400)]',
                  )}
                >
                  <Icon size={11} strokeWidth={2.6} />
                </span>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <p
                      className={cn(
                        'text-[13.5px] leading-[1.45] font-medium',
                        p.status === 'done'
                          ? 'text-[var(--neutral-soft-400)] line-through'
                          : 'text-[var(--neutral-strong-950)]',
                      )}
                    >
                      {p.title}
                    </p>
                    {p.pointed_at_you === true && (
                      <span className="rounded-full bg-[var(--attention-lighter)] px-1.5 py-px text-[10.5px] font-semibold text-[var(--attention-dark)]">
                        pointed at you
                      </span>
                    )}
                    <Badge tone={meta.tone}>{meta.label}</Badge>
                  </div>

                  {p.description && (
                    <p className="mt-1 text-[12.5px] leading-[1.5] text-[var(--neutral-sub-600)]">
                      {p.description}
                    </p>
                  )}

                  <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-[var(--neutral-soft-400)]">
                    {author && (
                      <span className="inline-flex items-center gap-1.5">
                        <AgentGlyph handle={author.handle} roleLabel={author.role_label} size="sm" />
                        written by @{author.handle}
                      </span>
                    )}
                    {assigneeHandle && (
                      <span>
                        assigned to @{assigneeHandle}
                      </span>
                    )}
                    <RelativeTime timestamp={p.created_at} />
                  </div>
                </div>

                <div className="relative shrink-0" ref={menuId === p.id ? menuRef : undefined}>
                  <button
                    type="button"
                    aria-label={`More actions for ${p.title}`}
                    aria-expanded={menuId === p.id}
                    onClick={() => setMenuId((id) => (id === p.id ? null : p.id))}
                    className="rounded-md p-1 text-[var(--neutral-soft-400)] hover:bg-[var(--neutral-weak-50)] hover:text-[var(--neutral-strong-950)]"
                  >
                    <MoreHorizontal size={16} />
                  </button>
                  {menuId === p.id && (
                    <div className="absolute right-0 z-20 mt-1 w-[220px] overflow-hidden rounded-lg border border-[var(--stroke-soft-200)] bg-[var(--bg-surface)] py-1 shadow-[0_12px_32px_rgba(0,0,0,0.16)]">
                      <p className="px-2.5 pb-1 pt-1.5 text-[10.5px] font-medium uppercase tracking-[0.05em] text-[var(--neutral-soft-400)]">
                        Status
                      </p>
                      {STATUSES.map((status) => (
                        <button
                          key={status}
                          type="button"
                          onClick={() => {
                            setMenuId(null);
                            void onUpdate(p.id, { status });
                          }}
                          className={cn(
                            'flex w-full items-center px-2.5 py-1.5 text-left text-[12.5px]',
                            p.status === status
                              ? 'bg-[var(--neutral-weak-50)] text-[var(--neutral-strong-950)]'
                              : 'text-[var(--neutral-sub-600)] hover:bg-[var(--neutral-weak-50)] hover:text-[var(--neutral-strong-950)]',
                          )}
                        >
                          {STATUS_META[status].label}
                        </button>
                      ))}
                      <p className="px-2.5 pb-1 pt-2 text-[10.5px] font-medium uppercase tracking-[0.05em] text-[var(--neutral-soft-400)]">
                        Assign
                      </p>
                      {activeAgents.map((agent) => (
                        <button
                          key={agent.id}
                          type="button"
                          onClick={() => {
                            setMenuId(null);
                            void onUpdate(p.id, { assignee_member_id: agent.id });
                          }}
                          className={cn(
                            'flex w-full items-center px-2.5 py-1.5 text-left text-[12.5px]',
                            p.assignee_member_id === agent.id
                              ? 'bg-[var(--neutral-weak-50)] text-[var(--neutral-strong-950)]'
                              : 'text-[var(--neutral-sub-600)] hover:bg-[var(--neutral-weak-50)] hover:text-[var(--neutral-strong-950)]',
                          )}
                        >
                          @{agent.handle}
                        </button>
                      ))}
                      {p.assignee_member_id && (
                        <button
                          type="button"
                          onClick={() => {
                            setMenuId(null);
                            void onUpdate(p.id, { assignee_member_id: null });
                          }}
                          className="flex w-full items-center px-2.5 py-1.5 text-left text-[12.5px] text-[var(--neutral-sub-600)] hover:bg-[var(--neutral-weak-50)] hover:text-[var(--neutral-strong-950)]"
                        >
                          Unassign
                        </button>
                      )}
                      <div className="my-1 h-px bg-[var(--stroke-soft-200)]" />
                      <button
                        type="button"
                        onClick={() => {
                          setMenuId(null);
                          void onDelete(p.id);
                        }}
                        className="flex w-full items-center px-2.5 py-1.5 text-left text-[12.5px] text-[var(--error-dark)] hover:bg-[var(--error-lighter)]"
                      >
                        Delete
                      </button>
                    </div>
                  )}
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}
