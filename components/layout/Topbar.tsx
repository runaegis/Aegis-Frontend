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
    <header className="flex items-center justify-between border-b border-zinc-200 bg-white px-8 py-5">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-zinc-900">{title}</h1>
        {subtitle && <p className="mt-0.5 text-sm text-zinc-500">{subtitle}</p>}
      </div>
      {onRefresh && (
        <div className="flex items-center gap-3">
          {lastUpdated && (
            <span className="text-xs text-zinc-400">Updated {formatTime(lastUpdated)}</span>
          )}
          <button
            onClick={onRefresh}
            className="rounded-lg border border-zinc-200 p-2 text-zinc-500 transition-colors hover:bg-zinc-50 hover:text-zinc-700"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      )}
    </header>
  );
}
