'use client';

import { TrendingUp, TrendingDown } from 'lucide-react';

const variantStyles: Record<string, { text: string; bg: string; icon: string; border: string }> = {
  default: { 
    text: 'text-foreground', 
    bg: 'bg-muted/50', 
    icon: 'text-muted-foreground',
    border: 'border-border'
  },
  allow: { 
    text: 'text-success', 
    bg: 'bg-success-muted', 
    icon: 'text-success',
    border: 'border-success/20'
  },
  deny: { 
    text: 'text-destructive', 
    bg: 'bg-destructive-muted', 
    icon: 'text-destructive',
    border: 'border-destructive/20'
  },
  rewrite: { 
    text: 'text-warning', 
    bg: 'bg-warning-muted', 
    icon: 'text-warning',
    border: 'border-warning/20'
  },
  approval: { 
    text: 'text-info', 
    bg: 'bg-info-muted', 
    icon: 'text-info',
    border: 'border-info/20'
  },
};

interface MetricCardProps {
  label: string;
  value: number | string;
  variant?: 'default' | 'allow' | 'deny' | 'rewrite' | 'approval';
  trend?: number;
  icon?: React.ReactNode;
}

export default function MetricCard({ label, value, variant = 'default', trend, icon }: MetricCardProps) {
  const styles = variantStyles[variant];
  
  return (
    <div className={`card-shine group relative overflow-hidden rounded-xl border ${styles.border} bg-card p-5 transition-all hover:border-border-hover`}>
      {/* Subtle gradient overlay */}
      <div className={`absolute inset-0 ${styles.bg} opacity-30`} />
      
      <div className="relative">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {label}
          </p>
          {icon && (
            <div className={`${styles.icon}`}>
              {icon}
            </div>
          )}
        </div>
        
        <div className="mt-3 flex items-end justify-between">
          <p className={`text-3xl font-semibold tracking-tight ${styles.text}`}>
            {typeof value === 'number' ? value.toLocaleString() : value}
          </p>
          
          {trend !== undefined && (
            <div className={`flex items-center gap-1 text-xs font-medium ${
              trend >= 0 ? 'text-success' : 'text-destructive'
            }`}>
              {trend >= 0 ? (
                <TrendingUp className="h-3.5 w-3.5" />
              ) : (
                <TrendingDown className="h-3.5 w-3.5" />
              )}
              <span>{Math.abs(trend)}%</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
