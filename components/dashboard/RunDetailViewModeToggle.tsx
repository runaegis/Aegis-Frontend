'use client';

import { cn } from '@/lib/utils';

export type RunDetailViewMode = 'details' | 'raw_json';

export function RunDetailViewModeToggle({
  mode,
  onModeChange,
  className,
}: {
  mode: RunDetailViewMode;
  onModeChange: (m: RunDetailViewMode) => void;
  className?: string;
}) {
  const tabBtn =
    'rounded-lg border px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide transition-colors';
  return (
    <div
      className={cn('flex flex-wrap gap-2', className)}
      onClick={(e) => e.stopPropagation()}
      role="tablist"
      aria-label="Run detail view"
    >
      <button
        type="button"
        role="tab"
        aria-selected={mode === 'details'}
        className={cn(
          tabBtn,
          mode === 'details'
            ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-200'
            : 'border-white/10 bg-zinc-900/50 text-zinc-500 hover:border-white/20 hover:text-zinc-300'
        )}
        onClick={() => onModeChange('details')}
      >
        Action details
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={mode === 'raw_json'}
        className={cn(
          tabBtn,
          mode === 'raw_json'
            ? 'border-violet-500/40 bg-violet-500/15 text-violet-200'
            : 'border-white/10 bg-zinc-900/50 text-zinc-500 hover:border-white/20 hover:text-zinc-300'
        )}
        onClick={() => onModeChange('raw_json')}
      >
        View raw JSON
      </button>
    </div>
  );
}
