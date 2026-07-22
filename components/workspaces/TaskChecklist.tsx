'use client';

import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Check, CircleDashed, Clock3, Plus, Trash2 } from 'lucide-react';
import type { WorkspacePointerStatus, WorkspaceTaskPointer } from '@/lib/api';
import { DUR, EASE } from '@/lib/motion';
import { cn } from '@/lib/utils';
import { RAIL_FOOTER } from './rail-footer';
import { PanelEmpty } from './PanelEmpty';

const NEXT_STATUS: Record<WorkspacePointerStatus, WorkspacePointerStatus> = {
  pending: 'review',
  review: 'done',
  done: 'pending',
};

/** Render order for the grouped board. */
const GROUPS: Array<{ key: WorkspacePointerStatus; label: string }> = [
  { key: 'pending', label: 'Pending' },
  { key: 'review', label: 'In review' },
  { key: 'done', label: 'Done' },
];

const STATUS_META: Record<
  WorkspacePointerStatus,
  { label: string; icon: typeof Check; className: string }
> = {
  pending: {
    label: 'Pending',
    icon: CircleDashed,
    className: 'text-[var(--neutral-soft-400)] hover:text-[var(--neutral-sub-600)]',
  },
  review: {
    label: 'In review',
    icon: Clock3,
    className: 'text-[var(--warning-dark)]',
  },
  done: {
    label: 'Done',
    icon: Check,
    className: 'text-[var(--success-dark)]',
  },
};

export function TaskChecklist({
  pointers,
  onCreate,
  onUpdate,
  onDelete,
  focusSignal = 0,
}: {
  pointers: WorkspaceTaskPointer[];
  onCreate: (title: string) => Promise<void>;
  onUpdate: (id: string, status: WorkspacePointerStatus) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  /** Bumped by the parent to focus the add field, e.g. from the `t` shortcut. */
  focusSignal?: number;
}) {
  const reduce = useReducedMotion();
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const addRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (focusSignal > 0) addRef.current?.focus();
  }, [focusSignal]);


  const add = async () => {
    const title = draft.trim();
    if (!title || busy) return;
    setBusy(true);
    try {
      await onCreate(title);
      setDraft('');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex h-full flex-col">
      {/* Rows, grouped by status so the room reads as a board.
          Progress lives in RoomSummary now: it describes the workspace,
          not this tab, so it should not disappear when you switch away. */}
      <div className="flex-1 overflow-y-auto py-1">
        {GROUPS.map((group) => {
          const rows = pointers.filter((p) => p.status === group.key);
          if (rows.length === 0) return null;
          return (
            <div key={group.key} className="mb-0.5">
              <div className="flex items-center gap-1.5 px-3 pb-0.5 pt-2">
                <span className="text-[10.5px] font-medium uppercase tracking-[0.05em] text-[var(--neutral-soft-400)]">
                  {group.label}
                </span>
                <span className="font-mono text-[10.5px] tabular-nums text-[var(--neutral-soft-400)]">
                  {rows.length}
                </span>
              </div>
              <div className="px-1.5">
                <AnimatePresence initial={false}>
                  {rows.map((p) => {
                    const meta = STATUS_META[p.status];
                    const Icon = meta.icon;
                    return (
              <motion.div
                key={p.id}
                layout={!reduce}
                initial={reduce ? false : { opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reduce ? { opacity: 0 } : { opacity: 0, x: -8 }}
                transition={{ duration: DUR.default, ease: EASE.out }}
                className="group flex items-start gap-2 rounded-lg px-2 py-1.5 transition-colors hover:bg-[var(--neutral-weak-50)]"
              >
                <button
                  type="button"
                  onClick={() => void onUpdate(p.id, NEXT_STATUS[p.status])}
                  aria-label={`Task ${p.title}, ${meta.label}. Change status.`}
                  title={`${meta.label}. Click to advance.`}
                  className={cn(
                    'mt-px flex size-[18px] shrink-0 items-center justify-center rounded-full border transition-colors',
                    p.status === 'done'
                      ? 'border-[var(--success)] bg-[rgba(31,193,107,0.16)]'
                      : p.status === 'review'
                        ? 'border-[var(--warning)] bg-[rgba(246,181,30,0.18)]'
                        : 'border-[var(--stroke-sub-300)] bg-transparent',
                    meta.className,
                  )}
                >
                  <Icon size={11} strokeWidth={2.6} />
                </button>

                <div className="min-w-0 flex-1">
                  <p
                    className={cn(
                      'text-[12.5px] leading-[1.5]',
                      p.status === 'done'
                        ? 'text-[var(--neutral-soft-400)] line-through'
                        : 'text-[var(--neutral-strong-950)]',
                    )}
                  >
                    {p.title}
                  </p>
                  {p.description && (
                    <p className="mt-0.5 text-[11.5px] leading-[1.45] text-[var(--neutral-sub-600)]">
                      {p.description}
                    </p>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => void onDelete(p.id)}
                  aria-label={`Delete task ${p.title}`}
                  className="mt-px rounded p-0.5 text-[var(--neutral-soft-400)] opacity-0 transition-all hover:text-[var(--error-dark)] focus-visible:opacity-100 group-hover:opacity-100"
                >
                  <Trash2 size={12} />
                </button>
              </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>
            </div>
          );
        })}

        {pointers.length === 0 && (
          <PanelEmpty
            icon={CircleDashed}
            title="No tasks yet"
            hint="Break the goal into steps the agents can pick up, or turn a message into a task."
          />
        )}
      </div>

      {/* Add. The field is bare by design, so the focus state is a quiet
          surface change rather than the global orange halo, which paints a
          hard 8px-radius box around an otherwise borderless input. */}
      <div className={RAIL_FOOTER}>
        <div
          data-input-shell
          className="flex w-full items-center gap-1.5 rounded-md px-1 transition-colors focus-within:bg-[var(--bg-surface-alt)]"
        >
          <Plus size={13} className="shrink-0 text-[var(--neutral-soft-400)]" />
          <input
            ref={addRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void add();
            }}
            placeholder="Add a task"
            // Chromeless, using the same belt-and-braces treatment as
            // components/ui/Input: globals.css puts a 1px border on every
            // bare input, and Chrome paints its own underline on top even
            // when that is cleared.
            className="w-full flex-1 !border-0 !bg-transparent py-1.5 text-[12.5px] text-[var(--neutral-strong-950)] placeholder:text-[var(--neutral-soft-400)] focus:outline-none focus:ring-0 focus-visible:shadow-none [appearance:none] [-webkit-appearance:none]"
            style={{ border: 'none', boxShadow: 'none', background: 'transparent' }}
          />
        </div>
      </div>
    </div>
  );
}
