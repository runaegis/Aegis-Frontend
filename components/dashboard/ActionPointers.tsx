'use client';

import JsonViewer from '@/components/ui/JsonViewer';

/** Left stripe color by decision. Use `vibrant` on Runs for bright accent borders. */
export function decisionStripeClass(decision: string, tone: 'muted' | 'vibrant' = 'muted'): string {
  const u = decision?.toUpperCase() || '';
  if (tone === 'vibrant') {
    if (u === 'ALLOW') return 'border-l-emerald-400';
    if (u === 'DENY') return 'border-l-rose-500';
    if (u === 'REWRITE') return 'border-l-amber-400';
    if (u.includes('APPROVAL')) return 'border-l-sky-400';
    return 'border-l-violet-400';
  }
  if (u === 'ALLOW') return 'border-l-emerald-700/40';
  if (u === 'DENY') return 'border-l-red-900/40';
  if (u === 'REWRITE') return 'border-l-amber-700/35';
  if (u.includes('APPROVAL')) return 'border-l-amber-600/35';
  return 'border-l-zinc-600/35';
}

export function ActionPointersDetail({
  pointers,
  argumentsFallback,
  accentHue,
}: {
  pointers?: string[];
  argumentsFallback?: Record<string, unknown>;
  accentHue?: number | null;
}) {
  const list = pointers?.filter((x) => typeof x === 'string' && x.trim().length > 0) ?? [];
  if (list.length > 0) {
    return (
      <ul className="space-y-2 text-sm leading-relaxed text-zinc-300">
        {list.map((line, i) => {
          const dotStyle =
            accentHue != null
              ? {
                  backgroundColor: `hsl(${accentHue}, 30%, 52%)`,
                  opacity: i > 0 ? 0.92 : 1,
                }
              : { backgroundColor: 'rgb(82 82 91)' };
          return (
            <li key={i} className="flex gap-2.5">
              <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full" style={dotStyle} aria-hidden />
              <span>{line}</span>
            </li>
          );
        })}
      </ul>
    );
  }
  if (argumentsFallback && Object.keys(argumentsFallback).length > 0) {
    return <JsonViewer data={argumentsFallback} collapsed={false} />;
  }
  return null;
}
