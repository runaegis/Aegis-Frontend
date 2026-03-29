'use client';

const styles: Record<string, { bg: string; text: string; label: string }> = {
  ALLOW: { bg: 'bg-success/10', text: 'text-success', label: 'Allow' },
  DENY: { bg: 'bg-destructive/10', text: 'text-destructive', label: 'Deny' },
  REWRITE: { bg: 'bg-amber-500/10', text: 'text-amber-500', label: 'Rewrite' },
  REQUIRE_APPROVAL: { bg: 'bg-primary/10', text: 'text-primary', label: 'Approval' },
  ALLOW_ERROR: { bg: 'bg-muted', text: 'text-muted-foreground', label: 'Error' },
};

function getStyle(decision: string) {
  const upper = decision?.toUpperCase() || '';
  if (styles[upper]) return styles[upper];
  if (upper.includes('APPROVAL')) return styles.REQUIRE_APPROVAL;
  if (upper.includes('ERROR')) return styles.ALLOW_ERROR;
  return { bg: 'bg-muted', text: 'text-muted-foreground', label: decision || 'Unknown' };
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
