'use client';

import { useMemo, useState, useCallback } from 'react';
import { ChevronDown, ChevronRight, Copy, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface CanonicalJsonViewerProps {
  value: unknown;
  className?: string;
  /** Max height for scrollable tree */
  maxHeightClass?: string;
}

function JsonPrimitive({ value }: { value: unknown }) {
  if (value === null) return <span className="text-zinc-500">null</span>;
  if (typeof value === 'boolean')
    return <span className="text-amber-400/95">{value ? 'true' : 'false'}</span>;
  if (typeof value === 'number') return <span className="text-sky-400/95">{String(value)}</span>;
  if (typeof value === 'string') {
    const shown = JSON.stringify(value);
    return <span className="break-all text-emerald-300/90">{shown}</span>;
  }
  if (typeof value === 'undefined') return <span className="text-zinc-600">undefined</span>;
  return <span className="text-zinc-400">{String(value)}</span>;
}

function JsonTreeEntry({
  keyName,
  value,
  isLast,
}: {
  keyName: string;
  value: unknown;
  isLast: boolean;
}) {
  return (
    <div className="group font-mono text-[0.7rem] leading-relaxed sm:text-xs">
      <span className="text-violet-300/95">&quot;{keyName}&quot;</span>
      <span className="text-zinc-600">: </span>
      <JsonTreeNode value={value} />
      {!isLast && <span className="text-zinc-600">,</span>}
    </div>
  );
}

function JsonTreeNode({ value }: { value: unknown }) {
  const [open, setOpen] = useState(true);

  if (value === null || typeof value !== 'object') {
    return <JsonPrimitive value={value} />;
  }

  if (Array.isArray(value)) {
    if (value.length === 0) return <span className="text-zinc-500">[]</span>;
    return (
      <span className="inline-flex flex-wrap items-start gap-x-1 align-top">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setOpen((o) => !o);
          }}
          className="-ml-0.5 inline-flex shrink-0 rounded p-0.5 text-zinc-500 hover:bg-white/10 hover:text-zinc-300 cursor-pointer"
          aria-expanded={open}
          aria-label={open ? 'Collapse array' : 'Expand array'}
        >
          {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
        </button>
        <span className="text-zinc-500">[</span>
        {open ? (
          <span className="ml-3 block w-full border-l border-white/[0.08] pl-2">
            {value.map((item, i) => (
              <div key={i}>
                <JsonTreeNode value={item} />
                {i < value.length - 1 && <span className="text-zinc-600">,</span>}
              </div>
            ))}
          </span>
        ) : (
          <span className="text-zinc-500 italic">
            {' '}
            … {value.length} item{value.length === 1 ? '' : 's'}{' '}
          </span>
        )}
        <span className="text-zinc-500">]</span>
      </span>
    );
  }

  const entries = Object.entries(value as Record<string, unknown>);
  if (entries.length === 0) return <span className="text-zinc-500">{'{}'}</span>;

  return (
    <span className="inline-flex flex-wrap items-start gap-x-1 align-top">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((o) => !o);
        }}
        className="-ml-0.5 inline-flex shrink-0 rounded p-0.5 text-zinc-500 hover:bg-white/10 hover:text-zinc-300 cursor-pointer"
        aria-expanded={open}
        aria-label={open ? 'Collapse object' : 'Expand object'}
      >
        {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
      </button>
      <span className="text-zinc-500">{'{'}</span>
      {open ? (
        <span className="ml-3 block w-full border-l border-white/[0.08] pl-2">
          {entries.map(([k, v], i) => (
            <JsonTreeEntry key={k} keyName={k} value={v} isLast={i === entries.length - 1} />
          ))}
        </span>
      ) : (
        <span className="text-zinc-500 italic">
          {' '}
          … {entries.length} keys{' '}
        </span>
      )}
      <span className="text-zinc-500">{'}'}</span>
    </span>
  );
}

/** Read-only JSON as a collapsible tree + copy (pretty-printed string). */
export function CanonicalJsonViewer({
  value,
  className,
  maxHeightClass = 'max-h-[min(70vh,28rem)]',
}: CanonicalJsonViewerProps) {
  const [copied, setCopied] = useState(false);

  const jsonStr = useMemo(() => {
    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return String(value);
    }
  }, [value]);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(jsonStr);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard may be unavailable
    }
  }, [jsonStr]);

  return (
    <div
      className={cn(
        'rounded-lg border border-white/10 bg-zinc-950/80 ring-1 ring-white/[0.04]',
        className
      )}
      data-readonly-json
    >
      <div className="flex flex-wrap items-center justify-end gap-2 border-b border-white/10 px-3 py-2">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            handleCopy();
          }}
          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] text-zinc-400 transition-colors hover:bg-white/10 hover:text-zinc-200 cursor-pointer"
        >
          {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? 'Copied' : 'Copy JSON'}
        </button>
      </div>

      <div
        className={cn('overflow-auto p-3 text-left', maxHeightClass)}
        onClick={(e) => e.stopPropagation()}
      >
        <JsonTreeNode value={value} />
      </div>
    </div>
  );
}
