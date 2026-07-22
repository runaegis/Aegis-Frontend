'use client';

import type { LucideIcon } from 'lucide-react';

/**
 * Shared empty state for the rail panels.
 *
 * One component so Tasks, Agents, and Files read as the same product
 * rather than three people's idea of an empty state. Each says what the
 * thing is for, not just that it is missing.
 */
export function PanelEmpty({
  icon: Icon,
  title,
  hint,
}: {
  icon: LucideIcon;
  title: string;
  hint: string;
}) {
  return (
    <div className="px-4 py-8 text-center">
      <span className="mx-auto mb-2.5 flex size-8 items-center justify-center rounded-lg border border-[var(--stroke-soft-200)] bg-[var(--bg-surface-alt)] text-[var(--neutral-soft-400)]">
        <Icon size={14} />
      </span>
      <p className="text-[12.5px] font-medium text-[var(--neutral-strong-950)]">{title}</p>
      <p className="mt-1 text-[11.5px] leading-[1.55] text-[var(--neutral-soft-400)]">{hint}</p>
    </div>
  );
}
