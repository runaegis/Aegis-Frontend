'use client';

const badgeStyles: Record<string, { bg: string; border: string; text: string; label: string }> = {
  ALLOW: { bg: 'bg-[#F0FDF4]', border: 'border-[#86EFAC]', text: 'text-[#15803D]', label: 'Allow' },
  DENY: { bg: 'bg-[#FEF2F2]', border: 'border-[#FCA5A5]', text: 'text-[#B91C1C]', label: 'Deny' },
  REWRITE: { bg: 'bg-[#FEFCE8]', border: 'border-[#FDE047]', text: 'text-[#854D0E]', label: 'Rewrite' },
  REQUIRE_APPROVAL: { bg: 'bg-[#F5F3FF]', border: 'border-[#C4B5FD]', text: 'text-[#6D28D9]', label: 'Approval' },
  ALLOW_ERROR: { bg: 'bg-[#F4F4F5]', border: 'border-[#E4E4E7]', text: 'text-[#71717A]', label: 'Error' },
};

function getStyle(decision: string) {
  const upper = decision?.toUpperCase() || '';
  if (badgeStyles[upper]) return badgeStyles[upper];
  if (upper.includes('APPROVAL')) return badgeStyles.REQUIRE_APPROVAL;
  if (upper.includes('ERROR')) return badgeStyles.ALLOW_ERROR;
  return { bg: 'bg-[#F4F4F5]', border: 'border-[#E4E4E7]', text: 'text-[#71717A]', label: decision || 'Unknown' };
}

const dotColors: Record<string, string> = {
  ALLOW: 'bg-[#15803D]',
  DENY: 'bg-[#B91C1C]',
  REWRITE: 'bg-[#854D0E]',
  REQUIRE_APPROVAL: 'bg-[#6D28D9]',
  ALLOW_ERROR: 'bg-[#71717A]',
};

function getDotColor(decision: string) {
  const upper = decision?.toUpperCase() || '';
  if (dotColors[upper]) return dotColors[upper];
  if (upper.includes('APPROVAL')) return dotColors.REQUIRE_APPROVAL;
  if (upper.includes('ERROR')) return dotColors.ALLOW_ERROR;
  return 'bg-[#71717A]';
}

export default function DecisionBadge({ decision }: { decision: string }) {
  const style = getStyle(decision);
  const dot = getDotColor(decision);

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${style.bg} ${style.border} ${style.text}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
      {style.label}
    </span>
  );
}
