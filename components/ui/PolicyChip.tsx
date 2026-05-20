'use client';

import { ShieldAlert, ShieldCheck } from 'lucide-react';
import { Badge } from './Badge';
import { formatPolicy } from '@/lib/utils';

interface PolicyChipProps {
  policy?: string | null;
  className?: string;
  /** When true and the policy is missing/unknown, render an em-dash placeholder. */
  showEmpty?: boolean;
}

/**
 * Compact pill for the per-action policy verdict.
 *
 *   pass     → green check shield
 *   enforced → amber alert shield
 *   unknown  → neutral fallback (or em-dash via `showEmpty`)
 */
export function PolicyChip({ policy, className, showEmpty = false }: PolicyChipProps) {
  const { status, label, tone } = formatPolicy(policy);

  if (status === 'unknown' && !policy) {
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

  const Icon = status === 'pass' ? ShieldCheck : ShieldAlert;

  return (
    <Badge
      tone={tone}
      uppercase
      leadingIcon={<Icon className="h-3 w-3" strokeWidth={2.25} aria-hidden />}
      className={className}
      title={`Policy: ${label}`}
    >
      {label}
    </Badge>
  );
}
