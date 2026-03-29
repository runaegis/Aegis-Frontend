'use client';

import { RefreshCw, Clock } from 'lucide-react';

interface TopbarProps {
  title: string;
  subtitle?: string;
  lastUpdated?: Date;
  onRefresh?: () => void;
}

export default function Topbar({ title, subtitle, lastUpdated, onRefresh }: TopbarProps) {
  const formatTime = (d: Date) => {
    const sec = Math.floor((Date.now() - d.getTime()) / 1000);
    if (sec < 5) return 'just now';
    if (sec < 60) return `${sec}s ago`;
    return `${Math.floor(sec / 60)}m ago`;
  };

  return (
    <header className="sticky top-0 z-20 flex items-center justify-between border-b border-border bg-background/80 px-8 py-5 backdrop-blur-xl">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-foreground">{title}</h1>
        {subtitle && (
          <p className="mt-0.5 text-sm text-muted-foreground">{subtitle}</p>
        )}
      </div>
      {onRefresh && (
        <div className="flex items-center gap-4">
          {lastUpdated && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Clock className="h-3.5 w-3.5" />
              <span>Updated {formatTime(lastUpdated)}</span>
            </div>
          )}
          <button
            onClick={onRefresh}
            className="group flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-muted-foreground transition-all hover:border-border-hover hover:bg-muted hover:text-foreground"
          >
            <RefreshCw className="h-4 w-4 transition-transform group-hover:rotate-180" />
            <span>Refresh</span>
          </button>
        </div>
      )}
    </header>
  );
}
