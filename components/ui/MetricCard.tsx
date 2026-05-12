'use client';

import { cn } from '@/lib/utils';

interface MetricCardProps {
  label: string;
  value: number | string;
  variant?: 'default' | 'allow' | 'deny' | 'rewrite' | 'approval';
  className?: string;
}

const variantColors: Record<string, string> = {
  default: 'text-foreground',
  allow: 'text-success',
  deny: 'text-destructive',
  rewrite: 'text-amber-500',
  approval: 'text-foreground/70',
};

export default function MetricCard({ label, value, variant = 'default', className }: MetricCardProps) {
  return (
    <div className={cn('rounded-md border border-border bg-card p-4', className)}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`mt-1 text-2xl font-semibold tabular-nums ${variantColors[variant]}`}>
        {typeof value === 'number' ? value.toLocaleString() : value}
      </p>
    </div>
  );
}
