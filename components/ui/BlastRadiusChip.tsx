'use client';

import { Badge } from './Badge';
import { formatBlastRadius } from '@/lib/utils';

interface BlastRadiusChipProps {
  /** Free-form severity from the backend — typically Low / Medium / High / Critical. */
  value?: string | null;
  className?: string;
  /** When true and the value is missing, render an em-dash placeholder. */
  showEmpty?: boolean;
}

/**
 * Color-coded severity pill for `blast_redius`.
 *
 *   low      → green
 *   medium   → amber
 *   high     → orange (primary)
 *   critical → red
 *   unknown  → neutral (or em-dash via `showEmpty`)
 */
export function BlastRadiusChip({ value, className, showEmpty = false }: BlastRadiusChipProps) {
  const { level, label, tone } = formatBlastRadius(value);

  if (level === 'unknown' && !value) {
    if (showEmpty) {
      return (
        <span
          className="text-[12px] text-[var(--neutral-soft-400)]"
          aria-hidden
        >
          —
        </span>
      );
    }
    return null;
  }

  return (
    <Badge
      tone={tone}
      uppercase
      leadingDot
      className={className}
      title={`Blast radius: ${label}`}
    >
      {label}
    </Badge>
  );
}
