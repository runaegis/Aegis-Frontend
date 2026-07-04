'use client';

/**
 * ShadowReport — the "here's what we would have caught" surface.
 *
 * The conversion moment: after a room has run in Observe for a while, this
 * turns the recorded history into an audit-grade report a security buyer
 * trusts. Structure follows dev-infra report references (Stellate / Dub):
 * stat row → one distribution → the ranked "moments that mattered" → a link
 * to the full log. Colour lives only on decision chips and the export CTA;
 * everything else stays neutral so it reads as evidence, not marketing.
 */

import Link from 'next/link';
import { motion, useReducedMotion } from 'motion/react';
import { ArrowRight, Download, Eye } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import MetricCard from '@/components/ui/MetricCard';
import { DecisionBar } from '@/components/ui/DecisionBar';
import DecisionBadge from '@/components/ui/DecisionBadge';
import { BlastRadiusChip } from '@/components/ui/BlastRadiusChip';
import { PolicyChip } from '@/components/ui/PolicyChip';
import { RelativeTime } from '@/components/ui/RelativeTime';
import { SHADOW_WINDOWS, wouldActCount, type ShadowWindow } from '@/lib/shadowReport';
import type { EnforcementMode, ShadowMoment, ShadowReport as ShadowReportData } from '@/lib/types';
import { cn } from '@/lib/utils';

interface ShadowReportProps {
  report: ShadowReportData;
  mode: EnforcementMode;
  windowKey: ShadowWindow;
  onWindowChange: (w: ShadowWindow) => void;
  onExport: () => void;
  exporting?: boolean;
  roomId: string;
}

export function ShadowReport({
  report,
  mode,
  windowKey,
  onWindowChange,
  onExport,
  exporting = false,
  roomId,
}: ShadowReportProps) {
  const reduce = useReducedMotion();
  const wouldAct = wouldActCount(report);
  const maxTool = Math.max(1, ...report.distribution.map((d) => d.count));

  return (
    <div className="space-y-6">
      {/* ─── Header: reassurance + window + export ─────────────────── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span
              className="inline-flex h-5 items-center gap-1.5 rounded-full px-2 text-[10.5px] font-semibold uppercase tracking-[0.06em]"
              style={{
                background: 'var(--information-alpha-10, rgba(51,92,255,0.08))',
                color: 'var(--information)',
              }}
            >
              <Eye className="h-3 w-3" strokeWidth={2.25} aria-hidden />
              {mode === 'observe' ? 'Observe mode' : mode === 'warn' ? 'Warn mode' : 'Enforce mode'}
            </span>
          </div>
          <h2 className="mt-2 text-[19px] font-semibold tracking-[-0.02em] text-[var(--neutral-strong-950)]">
            {mode === 'observe' ? (
              <>Aegis watched {report.totalObserved.toLocaleString()} actions and blocked none.</>
            ) : (
              <>{report.totalObserved.toLocaleString()} actions governed.</>
            )}
          </h2>
          <p className="mt-1 text-[13px] leading-[1.5] text-[var(--neutral-sub-600)]">
            {mode === 'observe' ? (
              <>
                It would have acted on{' '}
                <strong className="font-semibold text-[var(--neutral-strong-950)]">
                  {wouldAct.toLocaleString()}
                </strong>{' '}
                of them. Turn on enforcement to make that real.
              </>
            ) : (
              <>Decisions were applied for real over the selected window.</>
            )}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <div className="inline-flex items-center rounded-[9px] bg-[var(--neutral-weak-50)] p-0.5">
            {SHADOW_WINDOWS.map((w) => (
              <button
                key={w.key}
                type="button"
                onClick={() => onWindowChange(w.key)}
                className={cn(
                  'h-7 rounded-[7px] px-2.5 text-[12px] font-medium transition-colors',
                  windowKey === w.key
                    ? 'bg-[var(--white-0)] text-[var(--neutral-strong-950)] shadow-[0_1px_2px_rgba(23,23,23,0.06)]'
                    : 'text-[var(--neutral-sub-600)] hover:text-[var(--neutral-strong-950)]',
                )}
              >
                {w.key === 'all' ? 'All' : w.key}
              </button>
            ))}
          </div>
          <Button
            variant="secondary"
            onClick={onExport}
            disabled={exporting}
            leadingIcon={<Download className="h-3.5 w-3.5" strokeWidth={2} />}
          >
            {exporting ? 'Preparing…' : 'Export'}
          </Button>
        </div>
      </div>

      {/* ─── Stat row ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <MetricCard label="Actions observed" value={report.totalObserved} />
        <MetricCard label="Would allow" value={report.counts.allow} variant="allow" />
        <MetricCard label="Would block" value={report.counts.deny} variant="deny" />
        <MetricCard label="Would rewrite" value={report.counts.rewrite} variant="rewrite" />
        <MetricCard label="Would need approval" value={report.counts.approval} variant="approval" />
      </div>

      {/* ─── Distribution ──────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <section className="rounded-[12px] border border-[var(--stroke-soft-200)] bg-[var(--white-0)] p-4 shadow-[0_1px_2px_rgba(23,23,23,0.04)]">
          <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--neutral-soft-400)]">
            Decision mix
          </p>
          <div className="mt-3">
            <DecisionBar
              allow={report.counts.allow}
              deny={report.counts.deny}
              rewrite={report.counts.rewrite}
              approval={report.counts.approval}
            />
          </div>
        </section>
        <section className="rounded-[12px] border border-[var(--stroke-soft-200)] bg-[var(--white-0)] p-4 shadow-[0_1px_2px_rgba(23,23,23,0.04)]">
          <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--neutral-soft-400)]">
            Most-used tools
          </p>
          {report.distribution.length === 0 ? (
            <p className="mt-3 text-[12.5px] text-[var(--neutral-sub-600)]">No tool activity yet.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {report.distribution.map((d) => (
                <li key={d.label} className="flex items-center gap-3">
                  <span className="w-40 shrink-0 truncate font-mono text-[11.5px] text-[var(--neutral-sub-600)]">
                    {d.label}
                  </span>
                  <span className="relative h-2 flex-1 overflow-hidden rounded-full bg-[var(--neutral-weak-50)]">
                    <span
                      className="absolute inset-y-0 left-0 rounded-full bg-[var(--neutral-sub-300,var(--neutral-soft-400))]"
                      style={{ width: `${(d.count / maxTool) * 100}%` }}
                    />
                  </span>
                  <span className="w-8 shrink-0 text-right font-mono text-[11.5px] tabular-nums text-[var(--neutral-strong-950)]">
                    {d.count}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* ─── Moments that mattered ─────────────────────────────────── */}
      <section>
        <div className="mb-3 flex items-baseline justify-between">
          <h3 className="text-[14px] font-semibold tracking-[-0.01em] text-[var(--neutral-strong-950)]">
            Moments that mattered
          </h3>
          <span className="text-[11.5px] text-[var(--neutral-soft-400)]">
            highest blast radius first
          </span>
        </div>
        {report.moments.length === 0 ? (
          <div className="rounded-[12px] border border-dashed border-[var(--stroke-soft-200)] bg-[var(--white-0)] px-4 py-8 text-center">
            <p className="text-[13px] font-medium text-[var(--neutral-strong-950)]">
              Nothing risky yet.
            </p>
            <p className="mt-1 text-[12px] text-[var(--neutral-sub-600)]">
              Every observed action would have been allowed. As agents do more, the ones Aegis
              would catch show up here.
            </p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {report.moments.map((m, i) => (
              <MomentCard key={m.action.id} moment={m} index={i} reduce={!!reduce} />
            ))}
          </div>
        )}
      </section>

      {/* ─── Footer: full log ──────────────────────────────────────── */}
      <div className="flex justify-center pt-1">
        <Link
          href={`/dashboard/rooms/${roomId}/activity`}
          className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-[var(--neutral-sub-600)] transition-colors hover:text-[var(--neutral-strong-950)]"
        >
          View all {report.totalObserved.toLocaleString()} observed actions
          <ArrowRight className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
        </Link>
      </div>
    </div>
  );
}

// ─── Moment card ──────────────────────────────────────────────────────
function MomentCard({
  moment,
  index,
  reduce,
}: {
  moment: ShadowMoment;
  index: number;
  reduce: boolean;
}) {
  const a = moment.action;
  const target = a.target_branch ? `${a.target_repo}:${a.target_branch}` : a.target_repo;
  return (
    <motion.article
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: [0.2, 0.8, 0.2, 1], delay: Math.min(index * 0.03, 0.15) }}
      className="rounded-[12px] border border-[var(--stroke-soft-200)] bg-[var(--white-0)] p-3.5 shadow-[0_1px_2px_rgba(23,23,23,0.04)]"
    >
      <div className="flex flex-wrap items-center gap-2">
        <DecisionBadge decision={moment.wouldDecision} />
        <BlastRadiusChip value={a.blast_radius ?? a.blast_redius} />
        {a.policy ? <PolicyChip policy={a.policy} /> : null}
        <span className="ml-auto text-[11px] text-[var(--neutral-soft-400)]">
          <RelativeTime timestamp={a.timestamp} />
        </span>
      </div>
      <p className="mt-2 text-[13px] leading-[1.5] text-[var(--neutral-strong-950)]">
        {moment.headline}
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-[11px] text-[var(--neutral-sub-600)]">
        <span className="text-[var(--neutral-soft-400)]">{a.agent_name}</span>
        <span aria-hidden className="text-[var(--neutral-soft-400)]">·</span>
        <span>{a.tool_name}</span>
        <span aria-hidden className="text-[var(--neutral-soft-400)]">·</span>
        <span className="truncate">{target}</span>
      </div>
    </motion.article>
  );
}
