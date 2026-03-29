'use client';

const badgeStyles: Record<string, { bg: string; border: string; text: string; dot: string; label: string }> = {
  ALLOW: { 
    bg: 'bg-success-muted', 
    border: 'border-success/30', 
    text: 'text-success', 
    dot: 'bg-success',
    label: 'Allow' 
  },
  DENY: { 
    bg: 'bg-destructive-muted', 
    border: 'border-destructive/30', 
    text: 'text-destructive', 
    dot: 'bg-destructive',
    label: 'Deny' 
  },
  REWRITE: { 
    bg: 'bg-warning-muted', 
    border: 'border-warning/30', 
    text: 'text-warning', 
    dot: 'bg-warning',
    label: 'Rewrite' 
  },
  REQUIRE_APPROVAL: { 
    bg: 'bg-info-muted', 
    border: 'border-info/30', 
    text: 'text-info', 
    dot: 'bg-info',
    label: 'Approval' 
  },
  ALLOW_ERROR: { 
    bg: 'bg-muted', 
    border: 'border-border', 
    text: 'text-muted-foreground', 
    dot: 'bg-muted-foreground',
    label: 'Error' 
  },
};

function getStyle(decision: string) {
  const upper = decision?.toUpperCase() || '';
  if (badgeStyles[upper]) return badgeStyles[upper];
  if (upper.includes('APPROVAL')) return badgeStyles.REQUIRE_APPROVAL;
  if (upper.includes('ERROR')) return badgeStyles.ALLOW_ERROR;
  return { 
    bg: 'bg-muted', 
    border: 'border-border', 
    text: 'text-muted-foreground', 
    dot: 'bg-muted-foreground',
    label: decision || 'Unknown' 
  };
}

interface DecisionBadgeProps {
  decision: string;
  size?: 'sm' | 'default';
}

export default function DecisionBadge({ decision, size = 'default' }: DecisionBadgeProps) {
  const style = getStyle(decision);

  const sizeClasses = size === 'sm' 
    ? 'px-2 py-0.5 text-[10px]' 
    : 'px-2.5 py-1 text-xs';

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border font-medium ${style.bg} ${style.border} ${style.text} ${sizeClasses}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${style.dot} animate-pulse-dot`} />
      {style.label}
    </span>
  );
}
