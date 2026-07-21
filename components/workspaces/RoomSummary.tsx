'use client';

import { motion, useReducedMotion } from 'motion/react';
import { CheckCircle2, MessagesSquare, Paperclip, Users2 } from 'lucide-react';
import { DUR, EASE } from '@/lib/motion';
import { cn } from '@/lib/utils';

/**
 * Always-visible workspace status, above the tabs.
 *
 * Modelled on the status block at the top of a GitHub pull request
 * sidebar: the numbers that describe the room should not be hidden behind
 * whichever tab happens to be open, because they are the first thing you
 * look for when you arrive.
 */
export function RoomSummary({
  done,
  totalTasks,
  agents,
  messages,
  files,
}: {
  done: number;
  totalTasks: number;
  agents: number;
  messages: number;
  files: number;
}) {
  const reduce = useReducedMotion();
  const pct = totalTasks ? Math.round((done / totalTasks) * 100) : 0;
  const complete = totalTasks > 0 && done === totalTasks;

  return (
    <div className="border-b border-[var(--stroke-soft-200)] px-3 py-3">
      <div className="flex items-baseline justify-between">
        <span className="text-[10.5px] font-medium uppercase tracking-[0.05em] text-[var(--neutral-soft-400)]">
          Progress
        </span>
        <span className="font-mono text-[11.5px] tabular-nums text-[var(--neutral-sub-600)]">
          {totalTasks === 0 ? 'No tasks' : `${done} of ${totalTasks}`}
        </span>
      </div>

      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--neutral-soft-200)]">
        <motion.div
          className={cn(
            'h-full rounded-full',
            complete ? 'bg-[var(--success)]' : 'bg-[var(--primary-base)]',
          )}
          initial={false}
          animate={{ width: `${pct}%` }}
          transition={{ duration: reduce ? 0 : DUR.slow, ease: EASE.out }}
        />
      </div>

      <div className="mt-3 grid grid-cols-3 gap-1.5">
        <Stat icon={Users2} value={agents} label="agent" />
        <Stat icon={MessagesSquare} value={messages} label="message" />
        <Stat icon={Paperclip} value={files} label="file" />
      </div>
    </div>
  );
}

function Stat({
  icon: Icon,
  value,
  label,
}: {
  icon: typeof CheckCircle2;
  value: number;
  /** Singular; pluralised here so callers cannot render "1 files". */
  label: string;
}) {
  return (
    <div className="rounded-lg border border-[var(--stroke-soft-200)] bg-[var(--bg-surface-alt)] px-2 py-1.5">
      <div className="flex items-center gap-1 text-[var(--neutral-soft-400)]">
        <Icon size={11} />
        <span className="font-mono text-[13px] font-semibold tabular-nums text-[var(--neutral-strong-950)]">
          {value}
        </span>
      </div>
      <p className="mt-0.5 text-[10.5px] text-[var(--neutral-soft-400)]">
        {value === 1 ? label : `${label}s`}
      </p>
    </div>
  );
}
