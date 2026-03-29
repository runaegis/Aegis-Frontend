'use client';

import { AlertTriangle, X, RefreshCw } from 'lucide-react';

interface ErrorBannerProps {
  message: string;
  onDismiss: () => void;
  onRetry?: () => void;
}

export default function ErrorBanner({ message, onDismiss, onRetry }: ErrorBannerProps) {
  return (
    <div className="flex items-center gap-4 rounded-xl border border-destructive/30 bg-destructive-muted px-5 py-4 animate-fade-in">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-destructive/20">
        <AlertTriangle className="h-4 w-4 text-destructive" />
      </div>
      <p className="flex-1 text-sm text-foreground">{message}</p>
      <div className="flex items-center gap-2">
        {onRetry && (
          <button
            onClick={onRetry}
            className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-1.5 text-xs font-medium text-destructive transition-colors hover:bg-destructive/20"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Retry
          </button>
        )}
        <button 
          onClick={onDismiss} 
          className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
