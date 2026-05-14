'use client';

import JsonViewer from '@/components/ui/JsonViewer';
import { formatMcpAegisToolDisplayName, getToolChipStyle } from '@/lib/utils';

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

/** Backend convention: `[tool_name, owner/repo, branch, tool_result, path]` (+ optional trailing lines). */
type StructuredPointers = {
  toolRaw: string;
  repo: string;
  branchDisplay: string;
  branchProtected: boolean;
  result: string;
  path?: string;
  extraLines: string[];
};

function parseStructuredPointers(list: string[]): StructuredPointers | null {
  if (list.length < 4) return null;
  const [toolRaw, repo, branchLine, result, ...afterResult] = list;
  const toolOk = typeof toolRaw === 'string' && toolRaw.trim().length > 0;
  const repoOk = typeof repo === 'string' && repo.trim().length > 0;
  if (!toolOk || !repoOk) return null;

  let branchDisplay = typeof branchLine === 'string' ? branchLine.trim() : '';
  let branchProtected = false;
  const protectedMatch = branchDisplay.match(/^(.*?)\s*\(\s*protected\s*\)\s*$/i);
  if (protectedMatch) {
    branchDisplay = protectedMatch[1].trim();
    branchProtected = true;
  }

  const fifth = afterResult[0];
  const path =
    list.length >= 5 && fifth != null && typeof fifth === 'string' && fifth.trim().length > 0
      ? fifth.trim()
      : undefined;
  const extraLines = afterResult
    .slice(path !== undefined ? 1 : 0)
    .filter((x) => typeof x === 'string' && x.trim().length > 0);

  return {
    toolRaw: toolRaw.trim(),
    repo: repo.trim(),
    branchDisplay,
    branchProtected,
    result: typeof result === 'string' ? result.trim() : '',
    path,
    extraLines,
  };
}

/** Lowercase first so BLOCKED / REWRITE / PR match reliably. Word boundaries avoid flaky substring matches. */
function resultHighlightClass(raw: string): string {
  const r = raw.trim().toLowerCase();
  if (!r) return 'bg-zinc-800/80 text-zinc-200 ring-1 ring-white/10';

  if (
    /\b(rewrite|rewritten|redirect|redirected)\b/.test(r) ||
    /\bpr\b/.test(r) ||
    r.includes('pull request')
  ) {
    return 'bg-amber-500/15 text-amber-100 ring-1 ring-amber-500/25';
  }

  if (
    /\b(deny|denied|blocked|block|reject|rejected|refused)\b/.test(r) ||
    /\b(fail|failure|failed|error)\b/.test(r)
  ) {
    return 'bg-rose-500/12 text-rose-100 ring-1 ring-rose-500/20';
  }

  if (/\b(allow|allowed|success|succeeded|approved|permit|permitted)\b/.test(r)) {
    return 'bg-emerald-500/12 text-emerald-100 ring-1 ring-emerald-500/20';
  }

  return 'bg-zinc-800/80 text-zinc-200 ring-1 ring-white/10';
}

/** Readable label when APIs return all-caps (e.g. "BLOCKED, REWRITTEN TO PR"). Leaves mixed-case text unchanged. */
function formatOutcomeDisplay(raw: string): string {
  const t = raw.trim();
  if (!t) return t;
  if (/[a-z]/.test(t)) return t;

  const letters = t.replace(/[^A-Za-z]/g, '');
  if (letters.length < 2) return t;

  return t
    .split(/\s*,\s*/)
    .map((clause) => {
      const lower = clause.trim().toLowerCase();
      if (!lower) return '';
      const words = lower.split(/\s+/).map((w, i) => {
        if (w === 'pr') return 'PR';
        if (i === 0) return w.charAt(0).toUpperCase() + w.slice(1);
        return w;
      });
      return words.join(' ');
    })
    .filter(Boolean)
    .join(', ');
}

function StructuredActionPointersCard({ data }: { data: StructuredPointers }) {
  const chip = getToolChipStyle(data.toolRaw);

  return (
    <div className="overflow-hidden rounded-lg border border-white/[0.07] bg-neutral-900/35">
      <dl className="divide-y divide-white/[0.05] text-sm">
        <div className="grid gap-1 px-3 py-3 sm:grid-cols-[7.5rem_1fr] sm:gap-4 sm:py-2.5">
          <dt className="text-zinc-500">Tool</dt>
          <dd className="min-w-0">
            <code
              className="inline-block max-w-full truncate rounded-md px-2 py-1 font-mono text-[12px] leading-tight"
              style={chip}
            >
              {formatMcpAegisToolDisplayName(data.toolRaw)}
            </code>
          </dd>
        </div>
        <div className="grid gap-1 px-3 py-3 sm:grid-cols-[7.5rem_1fr] sm:gap-4 sm:py-2.5">
          <dt className="text-zinc-500">Repository</dt>
          <dd className="min-w-0 break-all font-medium text-zinc-100">{data.repo}</dd>
        </div>
        <div className="grid gap-1 px-3 py-3 sm:grid-cols-[7.5rem_1fr] sm:gap-4 sm:py-2.5">
          <dt className="text-zinc-500">Branch</dt>
          <dd className="flex min-w-0 flex-wrap items-center gap-2">
            <code className="rounded-md bg-zinc-800/70 px-2 py-0.5 font-mono text-[12px] text-zinc-200">
              {data.branchDisplay || '—'}
            </code>
            {data.branchProtected ? (
              <span className="rounded-md bg-violet-500/15 px-2 py-0.5 text-[11px] font-medium text-violet-200 ring-1 ring-violet-500/25">
                Protected
              </span>
            ) : null}
          </dd>
        </div>
        <div className="grid gap-1 px-3 py-3 sm:grid-cols-[7.5rem_1fr] sm:gap-4 sm:py-2.5">
          <dt className="text-zinc-500">Outcome</dt>
          <dd>
            <span
              className={`inline-flex max-w-full rounded-md px-2.5 py-1.5 text-[13px] font-medium leading-snug ${resultHighlightClass(data.result)}`}
            >
              {data.result ? formatOutcomeDisplay(data.result) : '—'}
            </span>
          </dd>
        </div>
        {data.path ? (
          <div className="grid gap-1 px-3 py-3 sm:grid-cols-[7.5rem_1fr] sm:gap-4 sm:py-2.5">
            <dt className="text-zinc-500">Path</dt>
            <dd className="min-w-0">
              <code className="block break-all rounded-md bg-zinc-900/70 px-2 py-1.5 font-mono text-[12px] text-zinc-300">
                {data.path}
              </code>
            </dd>
          </div>
        ) : null}
      </dl>
      {data.extraLines.length > 0 ? (
        <div className="border-t border-white/[0.06] px-3 py-3">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
            Additional details
          </p>
          <ul className="space-y-1.5 text-[13px] leading-relaxed text-zinc-400">
            {data.extraLines.map((line, i) => (
              <li key={i} className="flex gap-2">
                <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-zinc-600" aria-hidden />
                <span>{line}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
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
  const structured = parseStructuredPointers(list);
  if (structured && list.length >= 4) {
    return <StructuredActionPointersCard data={structured} />;
  }
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
