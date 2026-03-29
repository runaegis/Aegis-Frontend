'use client';

const variantColors: Record<string, string> = {
  default: 'text-zinc-900',
  allow: 'text-[#15803D]',
  deny: 'text-[#B91C1C]',
  rewrite: 'text-[#854D0E]',
  approval: 'text-[#6D28D9]',
};

interface MetricCardProps {
  label: string;
  value: number | string;
  variant?: 'default' | 'allow' | 'deny' | 'rewrite' | 'approval';
}

export default function MetricCard({ label, value, variant = 'default' }: MetricCardProps) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-5">
      <p className="text-xs font-medium uppercase tracking-wider text-zinc-400">{label}</p>
      <p className={`mt-2 text-3xl font-semibold tracking-tight ${variantColors[variant]}`}>
        {typeof value === 'number' ? value.toLocaleString() : value}
      </p>
    </div>
  );
}
