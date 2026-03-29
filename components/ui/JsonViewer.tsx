'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight, Copy, Check, Code2 } from 'lucide-react';

interface JsonViewerProps {
  data: unknown;
  collapsed?: boolean;
}

export default function JsonViewer({ data, collapsed = true }: JsonViewerProps) {
  const [isCollapsed, setIsCollapsed] = useState(collapsed);
  const [copied, setCopied] = useState(false);

  const jsonStr = typeof data === 'string' ? data : JSON.stringify(data, null, 2);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(jsonStr);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-muted/30">
      <div className="flex items-center justify-between border-b border-border bg-muted/50 px-4 py-2.5">
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="flex items-center gap-2 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <Code2 className="h-3.5 w-3.5" />
          {isCollapsed ? (
            <>
              <span>Show details</span>
              <ChevronRight className="h-3.5 w-3.5" />
            </>
          ) : (
            <>
              <span>Hide details</span>
              <ChevronDown className="h-3.5 w-3.5" />
            </>
          )}
        </button>
        <button
          onClick={handleCopy}
          className={`flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium transition-all ${
            copied 
              ? 'bg-success/20 text-success' 
              : 'text-muted-foreground hover:bg-muted hover:text-foreground'
          }`}
        >
          {copied ? (
            <>
              <Check className="h-3.5 w-3.5" />
              <span>Copied!</span>
            </>
          ) : (
            <>
              <Copy className="h-3.5 w-3.5" />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>
      {!isCollapsed && (
        <pre className="max-h-80 overflow-auto p-4 font-mono text-xs leading-relaxed text-foreground">
          {jsonStr}
        </pre>
      )}
    </div>
  );
}
