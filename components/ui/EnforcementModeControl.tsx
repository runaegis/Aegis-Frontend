'use client';

/**
 * EnforcementModeControl — the observe → warn → enforce ramp for a Room.
 *
 * The onboarding path made physical: a new customer runs in Observe
 * (nothing is ever blocked), reviews the Shadow Report, then walks the ramp
 * to Warn and finally Enforce. Rendered as three segments so the progression
 * is legible at a glance — you can see where you are and where you're going.
 *
 * Colour discipline (matches the dashboard system): the active segment gets a
 * tinted wash + a coloured status dot; everything else stays neutral. Observe
 * is intentionally the calm/blue state (safe, watching), Warn is amber,
 * Enforce is the committed brand-orange "it's on" state.
 */

import { Eye, TriangleAlert, ShieldCheck, Check, type LucideIcon } from 'lucide-react';
import type { EnforcementMode } from '@/lib/types';
import { cn } from '@/lib/utils';

interface ModeDef {
  key: EnforcementMode;
  label: string;
  icon: LucideIcon;
  blurb: string;
}

// Selection is a single, consistent neutral treatment across all three modes
// (matches the dashboard's colour discipline — colour is reserved for decision
// chips, not chrome). The mode's meaning lives in the icon, label, and copy;
// the risk order is carried by left-to-right progression, not by colour.
const MODES: ModeDef[] = [
  {
    key: 'observe',
    label: 'Observe',
    icon: Eye,
    blurb: 'Watches and records every action. Nothing is ever blocked.',
  },
  {
    key: 'warn',
    label: 'Warn',
    icon: TriangleAlert,
    blurb: 'Surfaces would-be decisions to the agent, without stopping it.',
  },
  {
    key: 'enforce',
    label: 'Enforce',
    icon: ShieldCheck,
    blurb: 'Applies decisions for real: block, rewrite, and pause for approval.',
  },
];

interface EnforcementModeControlProps {
  mode: EnforcementMode;
  onChange: (next: EnforcementMode) => void;
  /** Disable interaction while a mode change is in flight. */
  busy?: boolean;
  className?: string;
}

export function EnforcementModeControl({
  mode,
  onChange,
  busy = false,
  className,
}: EnforcementModeControlProps) {
  return (
    <div
      role="radiogroup"
      aria-label="Enforcement mode"
      className={cn('grid grid-cols-1 gap-2 sm:grid-cols-3', className)}
    >
      {MODES.map((m) => {
        const active = m.key === mode;
        const Icon = m.icon;
        return (
          <button
            key={m.key}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={busy}
            onClick={() => !active && onChange(m.key)}
            className={cn(
              'group relative flex flex-col items-start gap-1.5 rounded-[11px] border bg-[var(--white-0)] p-3.5 text-left',
              'transition-[background,border-color,box-shadow] duration-200 ease-[cubic-bezier(0.2,0.8,0.2,1)]',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary-base)]/40',
              busy && 'pointer-events-none opacity-70',
              active
                ? 'border-transparent shadow-[0_1px_2px_rgba(23,23,23,0.05)]'
                : 'border-[var(--stroke-soft-200)] hover:border-[var(--stroke-sub-300,var(--stroke-soft-200))] hover:bg-[var(--neutral-weak-50)]',
            )}
            style={active ? { boxShadow: 'inset 0 0 0 1.5px var(--neutral-strong-950)' } : undefined}
          >
            <div className="flex w-full items-center justify-between">
              <span
                className="inline-flex h-7 w-7 items-center justify-center rounded-[8px]"
                style={{
                  background: active ? 'var(--neutral-strong-950)' : 'var(--neutral-weak-50)',
                  color: active ? 'var(--white-0)' : 'var(--neutral-soft-400)',
                }}
              >
                <Icon className="h-4 w-4" strokeWidth={2} aria-hidden />
              </span>
              {active && (
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.06em] text-[var(--neutral-strong-950)]">
                  <Check className="h-3 w-3" strokeWidth={2.5} aria-hidden />
                  Current
                </span>
              )}
            </div>
            <span
              className={cn(
                'text-[13px] font-semibold tracking-[-0.005em]',
                active ? 'text-[var(--neutral-strong-950)]' : 'text-[var(--neutral-strong-950)]',
              )}
            >
              {m.label}
            </span>
            <span className="text-[11.5px] leading-[1.45] text-[var(--neutral-sub-600)]">
              {m.blurb}
            </span>
          </button>
        );
      })}
    </div>
  );
}
