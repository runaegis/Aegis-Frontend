'use client';

import { RefreshCw } from 'lucide-react';

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
    <header className="flex items-center justify-between border-b border-border px-6 py-4">
      <div>
        <h1 className="text-lg font-semibold text-foreground">{title}</h1>
        {subtitle && (
          <p className="text-sm text-muted-foreground">{subtitle}</p>
        )}
      </div>
      {onRefresh && (
        <div className="flex items-center gap-3">
          {lastUpdated && (
            <span className="text-xs text-muted-foreground">
              Updated {formatTime(lastUpdated)}
            </span>
          )}
          <button
            onClick={onRefresh}
            className="flex items-center gap-1.5 rounded-md border hover:cursor-pointer border-border px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </button>
        </div>
      )}
    </header>
  );
}
