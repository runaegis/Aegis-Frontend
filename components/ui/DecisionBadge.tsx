'use client';

const styles: Record<string, { bg: string; text: string; label: string }> = {
  ALLOW: { bg: 'bg-emerald-950/55', text: 'text-emerald-400/85', label: 'Allow' },
  DENY: { bg: 'bg-red-950/50', text: 'text-red-400/80', label: 'Deny' },
  REWRITE: { bg: 'bg-amber-950/40', text: 'text-amber-400/85', label: 'Rewrite' },
  REQUIRE_APPROVAL: {
    bg: 'bg-amber-950/40',
    text: 'text-amber-300/80',
    label: 'Approval',
  },
  ALLOW_ERROR: { bg: 'bg-zinc-800/40', text: 'text-zinc-400', label: 'Error' },
  PENDING: { bg: 'bg-amber-950/35', text: 'text-amber-400/75', label: 'Pending' },
  APPROVED: { bg: 'bg-emerald-950/50', text: 'text-emerald-400/80', label: 'Approved' },
  REJECTED: { bg: 'bg-red-950/45', text: 'text-red-400/78', label: 'Rejected' },
};

function getStyle(decision: string) {
  const upper = decision?.toUpperCase() || '';
  if (styles[upper]) return styles[upper];
  if (upper.includes('APPROVAL')) return styles.REQUIRE_APPROVAL;
  if (upper.includes('ERROR')) return styles.ALLOW_ERROR;
  return { bg: 'bg-zinc-800/35', text: 'text-zinc-400', label: decision || 'Unknown' };
}

interface DecisionBadgeProps {
  decision: string;
  size?: 'sm' | 'default';
}

export default function DecisionBadge({ decision, size = 'default' }: DecisionBadgeProps) {
  const style = getStyle(decision);
  const sizeClass = size === 'sm' ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-0.5 text-xs';

  return (
    <span className={`inline-block rounded font-medium ${style.bg} ${style.text} ${sizeClass}`}>
      {style.label}
    </span>
  );
}
