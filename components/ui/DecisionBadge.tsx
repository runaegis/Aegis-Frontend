'use client';

import { normalizeDecision } from '@/lib/utils';
import { Badge, type BadgeTone } from './Badge';

type DecisionStyle = { tone: BadgeTone; label: string };

const STYLES: Record<string, DecisionStyle> = {
  ALLOW:            { tone: 'success', label: 'ALLOW' },
  DENY:             { tone: 'error',   label: 'DENY' },
  REWRITE:          { tone: 'feature', label: 'REWRITE' },
  REQUIRE_APPROVAL: { tone: 'warning', label: 'APPROVAL' },
  PENDING:          { tone: 'warning', label: 'PENDING' },
  APPROVED:         { tone: 'success', label: 'APPROVED' },
  REJECTED:         { tone: 'error',   label: 'DENIED' },
  DENIED:           { tone: 'error',   label: 'DENIED' },
  ERROR:            { tone: 'neutral', label: 'ERROR' },
};

function resolve(decision: string): DecisionStyle {
  const canonical = normalizeDecision(decision);
  if (canonical !== 'UNKNOWN' && STYLES[canonical]) return STYLES[canonical];
  return { tone: 'neutral', label: canonical };
}

interface DecisionBadgeProps {
  decision: string;
  /** kept for back-compat with existing call sites; size is fixed per spec. */
  size?: 'sm' | 'default';
  className?: string;
}

export default function DecisionBadge({ decision, className }: DecisionBadgeProps) {
  const style = resolve(decision);
  return (
    <Badge tone={style.tone} uppercase className={className}>
      {style.label}
    </Badge>
  );
}

/** Map a decision string to one of the Card accent severity tones. */
export function decisionAccent(decision: string):
  | 'success'
  | 'error'
  | 'warning'
  | 'feature'
  | 'neutral' {
  switch (normalizeDecision(decision)) {
    case 'ALLOW':
      return 'success';
    case 'DENY':
      return 'error';
    case 'REWRITE':
      return 'feature';
    case 'REQUIRE_APPROVAL':
      return 'warning';
    default:
      return 'neutral';
  }
}

/** Map a decision string to its semantic color CSS variable. */
export function decisionColor(decision: string): string {
  switch (normalizeDecision(decision)) {
    case 'ALLOW':
      return 'var(--success)';
    case 'DENY':
      return 'var(--error)';
    case 'REWRITE':
      return 'var(--feature)';
    case 'REQUIRE_APPROVAL':
      return 'var(--warning)';
    default:
      return 'var(--neutral-soft-400)';
  }
}
