'use client';

/**
 * Room → Shadow tab.
 *
 * The observe-mode home for a room: the enforcement-mode ramp at the top,
 * then either the "we're observing, waiting for your agent" state (a brand-new
 * room with no traffic yet) or the full Shadow Report once actions exist.
 *
 * The report is derived client-side from the room's recorded actions
 * (`getSessionsByRoomId`) via `buildShadowReport`, so the same code renders
 * the demo workspace and a real customer's data — the only backend piece
 * Shadow Mode needs is the observe branch that records decisions without
 * enforcing them, plus the enforcement-mode flag.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { motion, useReducedMotion } from 'motion/react';
import { Eye, Plug, ArrowRight } from 'lucide-react';
import { api } from '@/lib/api';
import { useRoom } from '@/lib/roomContext';
import { buildShadowReport, type ShadowWindow } from '@/lib/shadowReport';
import type { EnforcementMode, RoomSessionAction } from '@/lib/types';
import { Button } from '@/components/ui/Button';
import { EnforcementModeControl } from '@/components/ui/EnforcementModeControl';
import { ShadowReport } from '@/components/shadow/ShadowReport';

const CONTAINER =
  'mx-auto w-full max-w-[1320px] 2xl:max-w-[1480px] px-4 py-6 sm:px-6 sm:py-7 lg:px-8';

export default function RoomShadowPage() {
  const reduce = useReducedMotion();
  const { roomId, room, loading: roomLoading } = useRoom();

  const [actions, setActions] = useState<RoomSessionAction[]>([]);
  const [loadingActions, setLoadingActions] = useState(true);
  const [mode, setMode] = useState<EnforcementMode>('observe');
  const [savingMode, setSavingMode] = useState(false);
  const [windowKey, setWindowKey] = useState<ShadowWindow>('7d');
  const [exporting, setExporting] = useState(false);

  // Seed the control from the room's stored posture (default observe).
  useEffect(() => {
    if (room?.enforcement_mode) setMode(room.enforcement_mode);
  }, [room?.enforcement_mode]);

  // Load the room's recorded actions — same source as the Activity tab.
  useEffect(() => {
    if (!roomId) return;
    let cancelled = false;
    setLoadingActions(true);
    api
      .getSessionsByRoomId(roomId)
      .then((res) => {
        if (!cancelled) setActions(res.items ?? []);
      })
      .catch(() => {
        if (!cancelled) setActions([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingActions(false);
      });
    return () => {
      cancelled = true;
    };
  }, [roomId]);

  const repoName = room?.repo_name ?? roomId;

  const report = useMemo(
    () =>
      buildShadowReport(roomId, repoName, actions, Date.now(), {
        window: windowKey,
        generatedAt: new Date().toISOString(),
      }),
    [roomId, repoName, actions, windowKey],
  );

  const onModeChange = useCallback(
    async (next: EnforcementMode) => {
      const prev = mode;
      setMode(next); // optimistic — the segment reflects intent immediately
      setSavingMode(true);
      try {
        await api.setRoomEnforcementMode(roomId, next);
      } catch {
        setMode(prev); // revert on failure
      } finally {
        setSavingMode(false);
      }
    },
    [mode, roomId],
  );

  // Export the report as a JSON evidence pack — real and works today; the
  // richer PDF pack reuses the audit export path once it's wired.
  const onExport = useCallback(() => {
    setExporting(true);
    try {
      const payload = {
        generatedAt: report.generatedAt,
        room: repoName,
        mode,
        window: report.window,
        totals: { observed: report.totalObserved, ...report.counts },
        moments: report.moments.map((m) => ({
          wouldDecision: m.wouldDecision,
          blastRadius: m.action.blast_radius ?? m.action.blast_redius ?? null,
          policy: m.action.policy ?? null,
          agent: m.action.agent_name,
          tool: m.action.tool_name,
          target: m.action.target_branch
            ? `${m.action.target_repo}:${m.action.target_branch}`
            : m.action.target_repo,
          summary: m.headline,
          at: m.action.timestamp,
        })),
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `aegis-shadow-report-${repoName.replace(/[^a-z0-9]+/gi, '-')}-${report.window}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  }, [report, repoName, mode]);

  const hasTraffic = actions.length > 0;

  return (
    <div className={CONTAINER}>
      {/* ─── Header ─────────────────────────────────────────────────── */}
      <header className="mb-5">
        <h1 className="text-[22px] font-semibold tracking-[-0.025em] text-[var(--neutral-strong-950)]">
          Shadow Mode
        </h1>
        <p className="mt-1 max-w-[640px] text-[13px] leading-[1.55] text-[var(--neutral-sub-600)]">
          Let Aegis watch this room without changing anything. Review what it
          would have done, then turn enforcement on when you trust it.
        </p>
      </header>

      {/* ─── Enforcement mode ramp ──────────────────────────────────── */}
      <section className="mb-6 rounded-[12px] border border-[var(--stroke-soft-200)] bg-[var(--white-0)] p-4 shadow-[0_1px_2px_rgba(23,23,23,0.04)]">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--neutral-soft-400)]">
            Enforcement
          </p>
          {savingMode && (
            <span className="text-[11px] text-[var(--neutral-soft-400)]">Saving…</span>
          )}
        </div>
        <EnforcementModeControl mode={mode} onChange={onModeChange} busy={savingMode} />
      </section>

      {/* ─── Body: loading / waiting / report ───────────────────────── */}
      {loadingActions || roomLoading ? (
        <div className="space-y-3">
          <div className="h-24 animate-pulse rounded-[12px] bg-[var(--neutral-weak-50)]" />
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-20 animate-pulse rounded-[12px] bg-[var(--neutral-weak-50)]" />
            ))}
          </div>
        </div>
      ) : hasTraffic ? (
        <ShadowReport
          report={report}
          mode={mode}
          windowKey={windowKey}
          onWindowChange={setWindowKey}
          onExport={onExport}
          exporting={exporting}
          roomId={roomId}
        />
      ) : (
        <WaitingState roomId={roomId} reduce={!!reduce} />
      )}
    </div>
  );
}

// ─── Waiting-for-first-action state ───────────────────────────────────
function WaitingState({ roomId, reduce }: { roomId: string; reduce: boolean }) {
  return (
    <motion.div
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: [0.2, 0.8, 0.2, 1] }}
      className="relative overflow-hidden rounded-[14px] border border-[var(--stroke-soft-200)] bg-[var(--white-0)] px-6 py-12 text-center shadow-[0_1px_2px_rgba(23,23,23,0.04)]"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-1 rounded-[10px]"
        style={{
          background:
            'linear-gradient(180deg, rgba(51,92,255,0.06) 0%, rgba(51,92,255,0.02) 30%, rgba(255,255,255,0) 62%)',
        }}
      />
      <div className="relative mx-auto max-w-[440px]">
        <span className="relative mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-[var(--information-alpha-10,rgba(51,92,255,0.08))]">
          <span
            aria-hidden
            className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--information)] opacity-20"
          />
          <Eye className="h-5 w-5 text-[var(--information)]" strokeWidth={2} aria-hidden />
        </span>
        <h2 className="mt-4 text-[16px] font-semibold tracking-[-0.01em] text-[var(--neutral-strong-950)]">
          Observing. Nothing will be blocked.
        </h2>
        <p className="mt-1.5 text-[13px] leading-[1.55] text-[var(--neutral-sub-600)]">
          Aegis is connected to this room and watching. Point your agent at it and run
          your normal work. The first action it takes will show up here, and after a few
          you&rsquo;ll get a report of what Aegis would have caught.
        </p>
        <div className="mt-5 flex items-center justify-center">
          <Link href={`/dashboard/rooms/${roomId}/connect`}>
            <Button
              variant="primary"
              leadingIcon={<Plug className="h-3.5 w-3.5" strokeWidth={2} />}
              trailingIcon={<ArrowRight className="h-3.5 w-3.5" strokeWidth={2.25} />}
            >
              Connect your agent
            </Button>
          </Link>
        </div>
      </div>
    </motion.div>
  );
}
