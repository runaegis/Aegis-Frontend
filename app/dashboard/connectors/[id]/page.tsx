'use client';

/**
 * Per-connector detail page.
 *
 * Reached from the Connectors catalog (each live card links here). Replaces
 * the old "live card → /dashboard/rooms" jump, which dropped the user on a
 * context-less room list. Explains what the connector governs, what Aegis
 * layers on top that the native tool can't do itself, and routes to the real
 * enable surface (a room's Connect/Tools tab) with that framing.
 *
 * Layout: hero header + two-column body (wide main content + sticky right
 * meta/CTA rail) — the canonical integration-detail pattern (Linear /
 * ElevenLabs), on the dashboard's standard max-width. AlignUI tokens; the
 * `--feature` accent marks the "What Aegis adds" differentiation.
 *
 * Data: CONNECTORS (ConnectorMark) + STATUS_BY_ID / CONNECTOR_CAPABILITIES
 * (lib/connectorCatalog). Frontend-only; no backend dependency.
 * A "Rooms using this connector" section drops into the main column once the
 * connector→room mapping ships (Sprint Board ticket).
 */

import { useParams } from 'next/navigation';
import Link from 'next/link';
import { motion, useReducedMotion } from 'motion/react';
import { ArrowLeft, ArrowUpRight, Clock, Loader2, ShieldCheck, Sparkles, Check } from 'lucide-react';
import Topbar from '@/components/layout/Topbar';
import { ConnectorMark, CONNECTORS, type ConnectorId } from '@/components/ui/ConnectorMark';
import { Button } from '@/components/ui/Button';
import {
  STATUS_BY_ID,
  CONNECTOR_CAPABILITIES,
  type ConnectorStatus,
} from '@/lib/connectorCatalog';
import { fadeUp, staggerContainer } from '@/lib/motion';

const STATUS_META: Record<ConnectorStatus, { label: string; icon: typeof ShieldCheck; cls: string; spin?: boolean }> = {
  live: { label: 'Live today', icon: ShieldCheck, cls: 'text-[var(--success-dark)] border-[var(--success)]/22 bg-[var(--success-lighter)]/50' },
  'in-progress': { label: 'Ships this sprint', icon: Loader2, cls: 'text-[var(--primary-base)] border-[var(--primary-base)]/22 bg-[var(--primary-lighter)]/50', spin: true },
  'coming-soon': { label: 'Designed · queued', icon: Clock, cls: 'text-[var(--neutral-soft-400)] border-[var(--stroke-soft-200)] bg-[var(--neutral-weak-50)]' },
};

const STANCE_META: Record<string, { label: string; cls: string }> = {
  allow: { label: 'Allow', cls: 'text-[var(--success-dark)] bg-[var(--success-lighter)]/60' },
  approval: { label: 'Approval', cls: 'text-[var(--warning-dark)] bg-[var(--warning-lighter)]/60' },
  deny: { label: 'Deny', cls: 'text-[var(--error-dark)] bg-[var(--error-lighter)]/60' },
};

function StatusPill({ status }: { status: ConnectorStatus }) {
  const m = STATUS_META[status];
  const Icon = m.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10.5px] font-bold uppercase tracking-[0.06em] ${m.cls}`}>
      <Icon className={`h-3.5 w-3.5 ${m.spin ? 'animate-spin' : ''}`} strokeWidth={2} />
      {m.label}
    </span>
  );
}

export default function ConnectorDetailPage() {
  const params = useParams<{ id: string }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const reduce = useReducedMotion();

  const def = id && id in CONNECTORS ? CONNECTORS[id as ConnectorId] : null;

  if (!def) {
    return (
      <>
        <Topbar title="Connector" subtitle="Not found" />
        <div className="mx-auto max-w-[920px] px-4 py-10 sm:px-6 lg:px-8">
          <Link href="/dashboard/connectors" className="mb-6 inline-flex items-center gap-1.5 text-[12.5px] font-medium text-[var(--neutral-sub-600)] hover:text-[var(--neutral-strong-950)]">
            <ArrowLeft className="h-3.5 w-3.5" strokeWidth={2} /> Connectors
          </Link>
          <div className="rounded-[12px] border border-[var(--stroke-soft-200)] bg-white p-8 text-center shadow-[0_1px_2px_rgba(23,23,23,0.04)]">
            <h1 className="text-[16px] font-semibold text-[var(--neutral-strong-950)]">Connector not found</h1>
            <p className="mt-1 text-[13px] text-[var(--neutral-sub-600)]">No connector with id <span className="font-mono">{id}</span>.</p>
          </div>
        </div>
      </>
    );
  }

  const status = STATUS_BY_ID[def.id];
  const caps = CONNECTOR_CAPABILITIES[def.id];

  return (
    <>
      <Topbar title="Connectors" subtitle="The tools Aegis governs for your agents" />
      <motion.div
        className="mx-auto max-w-[1320px] 2xl:max-w-[1480px] px-4 py-6 sm:px-6 sm:py-7 lg:px-8 lg:py-8"
        variants={staggerContainer(0.05, 0.04)}
        initial={reduce ? false : 'hidden'}
        animate="show"
      >
        <motion.div variants={fadeUp}>
          <Link href="/dashboard/connectors" className="mb-5 inline-flex items-center gap-1.5 text-[12.5px] font-medium text-[var(--neutral-sub-600)] transition-colors hover:text-[var(--neutral-strong-950)]">
            <ArrowLeft className="h-3.5 w-3.5" strokeWidth={2} /> Connectors
          </Link>
        </motion.div>

        {/* Hero */}
        <motion.section
          variants={fadeUp}
          className="relative mb-6 overflow-hidden rounded-[14px] border border-[var(--stroke-soft-200)] bg-white shadow-[0_1px_2px_rgba(23,23,23,0.04)]"
        >
          <div
            aria-hidden
            className="pointer-events-none absolute inset-1 rounded-[12px]"
            style={{ background: 'linear-gradient(180deg, rgba(250,115,25,0.08) 0%, rgba(250,115,25,0.03) 30%, rgba(255,255,255,0) 62%)' }}
          />
          <div className="relative flex flex-col gap-5 p-6 sm:flex-row sm:items-center sm:gap-6 sm:p-8">
            <ConnectorMark id={def.id} size="lg" />
            <div className="min-w-0 flex-1">
              <p className="mb-1.5 text-[10.5px] font-semibold uppercase tracking-[0.1em] text-[var(--neutral-soft-400)]">{def.category}</p>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                <h1 className="text-[24px] font-semibold leading-tight tracking-[-0.025em] text-[var(--neutral-strong-950)] sm:text-[28px]">{def.name}</h1>
                <StatusPill status={status} />
              </div>
              <p className="mt-2.5 max-w-[64ch] text-balance text-[14px] leading-[1.5] text-[var(--neutral-sub-600)]">
                {def.description}
              </p>
            </div>
          </div>
        </motion.section>

        {/* Two-column body */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
          {/* Main content */}
          <div className="flex min-w-0 flex-col gap-6">
            {caps ? (
              <>
                {/* Governed actions */}
                <motion.section variants={fadeUp} className="rounded-[12px] border border-[var(--stroke-soft-200)] bg-white p-5 shadow-[0_1px_2px_rgba(23,23,23,0.04)] sm:p-6">
                  <p className="text-[10.5px] font-semibold uppercase tracking-[0.1em] text-[var(--neutral-soft-400)]">Governed actions</p>
                  <p className="mt-1 text-[12.5px] text-[var(--neutral-sub-600)]">Native {def.name} actions Aegis proxies and gates.</p>
                  <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {caps.governs.map((c) => (
                      <div key={c.label} className="flex gap-2.5 rounded-[10px] border border-[var(--stroke-soft-200)] bg-[var(--neutral-weak-50)]/40 p-3">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-[var(--neutral-soft-400)]" strokeWidth={2} />
                        <div className="min-w-0">
                          <div className="text-[13px] font-medium text-[var(--neutral-strong-950)]">{c.label}</div>
                          <div className="mt-0.5 text-[12px] leading-[1.5] text-[var(--neutral-sub-600)]">{c.detail}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </motion.section>

                {/* What Aegis adds — the differentiation */}
                <motion.section variants={fadeUp} className="overflow-hidden rounded-[12px] border border-[var(--feature)]/25 bg-white shadow-[0_1px_2px_rgba(23,23,23,0.04)]">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 border-b border-[var(--stroke-soft-200)] bg-[color-mix(in_srgb,var(--feature)_6%,transparent)] px-5 py-3.5 sm:px-6">
                    <Sparkles className="h-4 w-4 text-[var(--feature)]" strokeWidth={2} />
                    <span className="text-[13px] font-semibold text-[var(--neutral-strong-950)]">What Aegis adds</span>
                    <span className="text-[11.5px] text-[var(--neutral-soft-400)]">— capabilities native {def.name} doesn&rsquo;t have</span>
                  </div>
                  <div className="grid grid-cols-1 gap-x-5 gap-y-0 p-1.5 sm:grid-cols-2 sm:p-2">
                    {caps.aegisAdds.map((c) => (
                      <div key={c.label} className="flex gap-3 rounded-[10px] p-3.5 transition-colors hover:bg-[var(--neutral-weak-50)]/50">
                        <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md" style={{ background: 'color-mix(in srgb, var(--feature) 12%, transparent)' }}>
                          <ShieldCheck className="h-3 w-3 text-[var(--feature)]" strokeWidth={2.25} />
                        </span>
                        <div className="min-w-0">
                          <div className="text-[13px] font-semibold text-[var(--neutral-strong-950)]">{c.label}</div>
                          <div className="mt-0.5 text-[12px] leading-[1.55] text-[var(--neutral-sub-600)]">{c.detail}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </motion.section>

                {caps.note && (
                  <motion.p variants={fadeUp} className="rounded-[10px] border border-[var(--stroke-soft-200)] bg-[var(--neutral-weak-50)]/60 px-4 py-3 text-[12px] leading-[1.55] text-[var(--neutral-sub-600)]">
                    {caps.note}
                  </motion.p>
                )}
              </>
            ) : (
              <motion.section variants={fadeUp} className="rounded-[12px] border border-[var(--stroke-soft-200)] bg-white p-6 shadow-[0_1px_2px_rgba(23,23,23,0.04)]">
                <div className="flex items-center gap-2 text-[var(--neutral-soft-400)]">
                  <Clock className="h-4 w-4" strokeWidth={2} />
                  <span className="text-[12.5px] font-semibold uppercase tracking-[0.06em]">Designed · queued</span>
                </div>
                <p className="mt-2 max-w-[68ch] text-[13.5px] leading-[1.6] text-[var(--neutral-sub-600)]">
                  The governance pack for {def.name} is designed and on the roadmap. It follows the same proxy pattern as the live connectors: every action is classified, gated by policy, and written to the audit trail.
                </p>
              </motion.section>
            )}

            {/* "Rooms using this connector" drops in here once the
                connector→room mapping ships (Sprint Board ticket). */}
          </div>

          {/* Right rail */}
          <aside className="flex flex-col gap-5 lg:sticky lg:top-[72px] lg:self-start">
            <motion.div variants={fadeUp} className="rounded-[12px] border border-[var(--stroke-soft-200)] bg-white p-5 shadow-[0_1px_2px_rgba(23,23,23,0.04)]">
              <p className="text-[10.5px] font-semibold uppercase tracking-[0.1em] text-[var(--neutral-soft-400)]">Status</p>
              <div className="mt-2"><StatusPill status={status} /></div>

              <div className="my-4 h-px bg-[var(--stroke-soft-200)]" />

              <p className="text-[10.5px] font-semibold uppercase tracking-[0.1em] text-[var(--neutral-soft-400)]">Default policy stance</p>
              <div className="mt-2.5 flex flex-col gap-2">
                {([['Reads', def.policy.read], ['Writes', def.policy.write], ['Destructive', def.policy.destructive]] as const).map(([k, stance]) => (
                  <div key={k} className="flex items-center justify-between gap-3">
                    <span className="text-[12px] text-[var(--neutral-sub-600)]">{k}</span>
                    <span className={`inline-flex rounded-md px-1.5 py-0.5 text-[11px] font-semibold ${STANCE_META[stance].cls}`}>{STANCE_META[stance].label}</span>
                  </div>
                ))}
              </div>

              {def.primitive && (
                <>
                  <div className="my-4 h-px bg-[var(--stroke-soft-200)]" />
                  <p className="text-[10.5px] font-semibold uppercase tracking-[0.1em] text-[var(--neutral-soft-400)]">Policy primitive</p>
                  <span className="mt-2 inline-flex items-center rounded-md border border-[var(--stroke-soft-200)] bg-[var(--neutral-weak-50)] px-2 py-1 font-mono text-[10.5px] font-semibold text-[var(--neutral-sub-600)]">{def.primitive}</span>
                </>
              )}

              <p className="mt-4 text-[11px] leading-[1.5] text-[var(--neutral-soft-400)]">Defaults shown. Each room tunes the stance and tool allowlist per role.</p>
            </motion.div>

            <motion.div variants={fadeUp} className="rounded-[12px] border border-[var(--stroke-soft-200)] bg-white p-5 shadow-[0_1px_2px_rgba(23,23,23,0.04)]">
              <p className="text-[10.5px] font-semibold uppercase tracking-[0.1em] text-[var(--neutral-soft-400)]">Use this connector</p>
              <p className="mt-2 text-[12.5px] leading-[1.55] text-[var(--neutral-sub-600)]">
                Connectors are enabled per room. Open a room&rsquo;s <span className="font-medium text-[var(--neutral-strong-950)]">Connect</span> tab to wire {def.name} to a repo, team, and role allowlist.
              </p>
              <Link href="/dashboard/rooms" className="mt-4 block">
                <Button variant="primary" size="md" className="w-full justify-center" trailingIcon={<ArrowUpRight className="h-3.5 w-3.5" strokeWidth={2.25} />}>
                  {status === 'live' ? 'Enable in a room' : 'View rooms'}
                </Button>
              </Link>
            </motion.div>
          </aside>
        </div>
      </motion.div>
    </>
  );
}
