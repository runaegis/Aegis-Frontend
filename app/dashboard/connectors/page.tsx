'use client';

/**
 * Connectors catalog — `/dashboard/connectors`.
 *
 * 2-column card grid. Each card has a brand-color radial signature in
 * the upper-left, anchoring its visual identity without committing to a
 * marketing-site full-color treatment. GitHub leads as the live
 * production integration; other live connectors follow.
 *
 * Design pulls from:
 *   • Linear app directory — large brand marks doing the heavy lifting,
 *     sparse copy per tile, single-line policy preview.
 *   • Stripe Apps — colored-signature header area with brand mark,
 *     content stack below, status pill consistent in upper-right.
 *   • Vercel Marketplace — subtle radial gradients giving each tile a
 *     unique color identity without flooding the card with brand.
 *
 * Data lives in CONNECTORS (components/ui/ConnectorMark.tsx).
 */

import { useEffect, useMemo, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { ArrowUpRight, CheckCircle2, Clock, KeyRound, Loader2, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import Topbar from '@/components/layout/Topbar';
import { ConnectorMark, CONNECTORS, type ConnectorId } from '@/components/ui/ConnectorMark';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import ErrorBanner from '@/components/ui/ErrorBanner';
import { useToast } from '@/components/ui/Toast';
import { api } from '@/lib/api';
import { useUser } from '@/lib/hooks';
import type { ConnectorCatalogItem, PrivateConnectorCredentialStatus } from '@/lib/types';
import { cn } from '@/lib/utils';
import { DUR, EASE, fadeUp, staggerContainer } from '@/lib/motion';
import { STATUS_BY_ID, type ConnectorStatus } from '@/lib/connectorCatalog';
import { ConnectorCredentialsModal } from '@/components/connectors/ConnectorCredentialsModal';

function isDemoMode(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return (
      document.documentElement.dataset.demo === 'true' ||
      localStorage.getItem('aegis_demo') === 'true'
    );
  } catch {
    return false;
  }
}

function credentialKeyFor(id: ConnectorId): string | null {
  if (id === 'github-actions') return 'github';
  return id;
}

// Display order — Live first, then In Progress, then queued in the
// priority order from the Notion roadmap.
const DISPLAY_ORDER: ConnectorId[] = [
  'github',
  'github-actions',
  'postgres',
  'mongodb',
  'linear',
  'jira',
  'terraform',
];

export default function ConnectorsPage() {
  const reduce = useReducedMotion();
  const toast = useToast();
  const { user, isLoading: userLoading } = useUser();
  const demo = useMemo(() => isDemoMode(), []);

  const [catalogByKey, setCatalogByKey] = useState<Record<string, ConnectorCatalogItem>>({});
  const [privateByKey, setPrivateByKey] = useState<Record<string, PrivateConnectorCredentialStatus>>({});
  const [credsLoading, setCredsLoading] = useState(true);
  const [credsError, setCredsError] = useState<string | null>(null);
  const [activeCredKey, setActiveCredKey] = useState<string | null>(null);

  const total = DISPLAY_ORDER.length;
  const live = DISPLAY_ORDER.filter((id) => STATUS_BY_ID[id] === 'live').length;

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (!demo && !user?.id) {
        if (!userLoading) setCredsLoading(false);
        return;
      }
      setCredsLoading(true);
      setCredsError(null);
      try {
        const [catalog, priv] = await Promise.all([
          api.getConnectorCatalog(true),
          api.getPrivateConnectorCredentials(),
        ]);
        if (cancelled) return;
        setCatalogByKey(Object.fromEntries(catalog.map((c) => [c.connector_key, c])));
        setPrivateByKey(Object.fromEntries(priv.map((s) => [s.connector_key, s])));
      } catch (err) {
        if (cancelled) return;
        setCredsError(err instanceof Error ? err.message : 'Failed to load connector credentials');
      } finally {
        if (!cancelled) setCredsLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [demo, user?.id, userLoading]);

  return (
    <>
      <Topbar title="Connectors" subtitle="The tools Aegis governs for your agents" />

      <div className="mx-auto max-w-[1320px] 2xl:max-w-[1480px] px-4 py-6 sm:px-6 sm:py-7 lg:px-8 lg:py-8">
        {/* ─── Hero ──────────────────────────────────────────────────── */}
        <motion.section
          variants={staggerContainer(0.05, 0.04)}
          initial={reduce ? false : 'hidden'}
          animate="show"
          className="mb-6 sm:mb-8"
        >
          <motion.p
            variants={fadeUp}
            className="mb-3 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-[var(--primary-base)]"
          >
            Connector catalog · {total} integrations · {live} live
          </motion.p>
          <motion.h1
            variants={fadeUp}
            className="max-w-[720px] text-[34px] font-semibold leading-[1.05] tracking-[-0.035em] text-[var(--neutral-strong-950)] sm:text-[40px]"
          >
            Govern every tool your agents touch.
          </motion.h1>
          <motion.p
            variants={fadeUp}
            className="mt-4 max-w-[560px] text-[14.5px] leading-[1.6] text-[var(--neutral-sub-600)]"
          >
            GitHub, GitHub Actions, PostgreSQL, MongoDB, Linear, Jira, and Terraform are live today. Each is governed by the same Allow, Approval, Deny model.
          </motion.p>
        </motion.section>

        {credsError && (
          <div className="mb-6">
            <ErrorBanner
              message={credsError}
              onDismiss={() => setCredsError(null)}
              onRetry={async () => {
                if (!demo && !user?.id) return;
                setCredsError(null);
                setCredsLoading(true);
                try {
                  const [catalog, priv] = await Promise.all([
                    api.getConnectorCatalog(true),
                    api.getPrivateConnectorCredentials(),
                  ]);
                  setCatalogByKey(Object.fromEntries(catalog.map((c) => [c.connector_key, c])));
                  setPrivateByKey(Object.fromEntries(priv.map((s) => [s.connector_key, s])));
                } catch (err) {
                  setCredsError(err instanceof Error ? err.message : 'Failed to load connector credentials');
                } finally {
                  setCredsLoading(false);
                }
              }}
            />
          </div>
        )}

        {/* ─── Grid ──────────────────────────────────────────────────── */}
        <motion.div
          variants={staggerContainer(0.04, 0.16)}
          initial={reduce ? false : 'hidden'}
          animate="show"
          className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3"
        >
          {DISPLAY_ORDER.map((id) => (
            <ConnectorCard
              key={id}
              id={id}
              status={STATUS_BY_ID[id]}
              credsLoading={credsLoading}
              privateStatus={(() => {
                const key = credentialKeyFor(id);
                return key ? privateByKey[key] ?? null : null;
              })()}
              onOpenCredentials={() => {
                const key = credentialKeyFor(id);
                if (!key) return;
                setActiveCredKey(key);
              }}
            />
          ))}
        </motion.div>

        {/* ─── Footer hint ───────────────────────────────────────────── */}
        <motion.p
          initial={reduce ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: DUR.slow, ease: EASE.out, delay: 0.5 }}
          className="mt-12 text-center text-[12px] text-[var(--neutral-soft-400)]"
        >
          Don&rsquo;t see your tool?{' '}
          <a
            href="mailto:product@runaegis.co"
            className="text-[var(--neutral-sub-600)] underline-offset-4 hover:text-[var(--neutral-strong-950)] hover:underline"
          >
            Tell us what to build next
          </a>
          .
        </motion.p>
      </div>

      <ConnectorCredentialsModal
        open={activeCredKey !== null}
        connectorKey={activeCredKey ?? ''}
        connectorName={catalogByKey[activeCredKey ?? '']?.display_name ?? 'Connector'}
        status={activeCredKey ? privateByKey[activeCredKey] ?? null : null}
        catalogItem={activeCredKey ? catalogByKey[activeCredKey] ?? null : null}
        onClose={() => setActiveCredKey(null)}
        onSaved={(status) => {
          setPrivateByKey((prev) => ({ ...prev, [status.connector_key]: status }));
          toast.success('Credentials saved');
        }}
      />
    </>
  );
}

// ─── The connector card itself ────────────────────────────────────────
function ConnectorCard({
  id,
  status,
  credsLoading,
  privateStatus,
  onOpenCredentials,
}: {
  id: ConnectorId;
  status: ConnectorStatus;
  credsLoading: boolean;
  privateStatus: PrivateConnectorCredentialStatus | null;
  onOpenCredentials: () => void;
}) {
  const def = CONNECTORS[id];
  const connected = !!privateStatus?.configured;

  return (
    <motion.article
      variants={fadeUp}
      // Lift handled by Framer Motion instead of CSS transition because
      // Framer uses requestAnimationFrame + translate3d under the hood,
      // which forces GPU compositing and avoids the subpixel-rendering
      // jank we kept hitting with CSS `hover:-translate-y-*`. Shadow +
      // border-color still transition via CSS since they're not
      // transform-related; their 220ms timing is intentionally shorter
      // than the lift's 260ms so the cosmetic settle lands a frame
      // before the motion completes — feels more polished than all
      // three landing at the same instant.
      whileHover={{ y: -2, transition: { duration: 0.26, ease: [0.32, 0.72, 0.32, 1] } }}
      className={cn(
        'group relative flex flex-col overflow-hidden rounded-[14px] border border-[var(--stroke-soft-200)] bg-white',
        'shadow-[0_1px_2px_rgba(23,23,23,0.04)]',
        'cursor-pointer',
        'transition-[box-shadow,border-color] duration-[220ms] ease-[cubic-bezier(0.2,0.8,0.2,1)]',
        'hover:border-[var(--primary-base)]/30',
        'hover:shadow-[0_12px_28px_rgba(23,23,23,0.07),0_2px_8px_rgba(250,115,25,0.06)]',
      )}
    >
      {/* Inset orange-tinted gradient — same treatment as the
          Dashboard's Decision Overview hero card. 4px inset on all
          four sides; fades to transparent before mid-card. Stays
          static (no hover state) so the only motion is the card lift. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-1 rounded-[10px]"
        style={{
          background:
            'linear-gradient(180deg, rgba(250, 115, 25, 0.07) 0%, rgba(250, 115, 25, 0.03) 28%, rgba(255, 255, 255, 0) 60%)',
        }}
      />

      {/* Top: brand mark + status pill */}
      <div className="relative flex items-start justify-between gap-3 px-4 pt-4">
        <ConnectorMark id={id} size="md" />
        <StatusPill status={status} />
      </div>

      {/* Title block — name leads, single meta line beneath combines
          category + primitive so they read as one piece of context
          instead of two stacked rows competing for the eye. */}
      <div className="relative px-4 pt-3">
        <h2 className="text-[16px] font-semibold leading-[1.2] tracking-[-0.015em] text-[var(--neutral-strong-950)]">
          {def.name}
        </h2>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-[10px] font-semibold uppercase tracking-[0.09em] text-[var(--neutral-soft-400)]">
          <span>{def.category}</span>
          {def.primitive && (
            <>
              <span aria-hidden className="text-[var(--neutral-soft-400)]/60">·</span>
              <span
                className="font-mono text-[9.5px] font-bold tracking-[0.06em] text-[var(--neutral-sub-600)]"
                title={`Codified policy primitive: ${def.primitive}`}
              >
                {def.primitive}
              </span>
            </>
          )}
        </p>
        {connected && !credsLoading && (
          <div className="mt-2">
            <Badge
              tone="success"
              leadingIcon={<CheckCircle2 className="h-3 w-3" strokeWidth={2.25} />}
            >
              Credentials saved
            </Badge>
          </div>
        )}
      </div>

      {/* Description — fills remaining vertical space so the footer
          band sits cleanly at the bottom across cards of varying copy
          lengths. */}
      <div className="relative flex flex-1 flex-col px-4 pb-4 pt-2">
        <p className="text-[12px] leading-[1.55] text-[var(--neutral-sub-600)]">
          {def.description}
        </p>
      </div>

      {/* Footer — uniform layout across all three status states: a
          status indicator (icon + label) on the left, optional action
          on the right. The consistent left-right rhythm gives the band
          its own clear hierarchy regardless of which status this card
          carries. */}
      <div className="relative flex min-h-[42px] items-center justify-between gap-3 border-t border-[var(--stroke-soft-200)] bg-[var(--neutral-weak-50)]/70 px-4 py-2 backdrop-blur-[2px]">
        {status === 'live' && (
          <>
            <span className="inline-flex items-center gap-1.5 text-[11.5px] font-semibold text-[var(--success-dark)]">
              <ShieldCheck className="h-3.5 w-3.5" strokeWidth={2} />
              Live today
            </span>
            <div className="flex items-center gap-1.5">
              <Button
                variant="secondary"
                size="sm"
                disabled={credsLoading}
                onClick={onOpenCredentials}
                leadingIcon={
                  credsLoading ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={2} />
                  ) : (
                    <KeyRound className="h-3.5 w-3.5" strokeWidth={2.25} />
                  )
                }
              >
                {connected ? 'Update credentials' : 'Add credentials'}
              </Button>
              <Link href={`/dashboard/connectors/${id}`}>
                <Button
                  variant="ghost"
                  size="sm"
                  trailingIcon={<ArrowUpRight className="h-3 w-3" strokeWidth={2.25} />}
                >
                  View
                </Button>
              </Link>
            </div>
          </>
        )}
        {status === 'in-progress' && (
          <span className="inline-flex items-center gap-1.5 text-[11.5px] font-semibold text-[var(--primary-base)]">
            <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={2} />
            Ships this sprint
          </span>
        )}
        {status === 'coming-soon' && (
          <span className="inline-flex items-center gap-1.5 text-[11.5px] font-medium text-[var(--neutral-soft-400)]">
            <Clock className="h-3.5 w-3.5" strokeWidth={2} />
            Designed · queued
          </span>
        )}
      </div>
    </motion.article>
  );
}

// ─── Status pill in upper-right ───────────────────────────────────────
function StatusPill({ status }: { status: ConnectorStatus }) {
  if (status === 'live') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--success)]/22 bg-[var(--success-lighter)]/50 px-2.5 py-0.5 text-[10.5px] font-bold uppercase tracking-[0.06em] text-[var(--success-dark)] backdrop-blur-[2px]">
        <span className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--success)]" />
        Live
      </span>
    );
  }
  if (status === 'in-progress') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--primary-base)]/24 bg-[var(--primary-alpha-10)] px-2.5 py-0.5 text-[10.5px] font-bold uppercase tracking-[0.06em] text-[var(--primary-base)] backdrop-blur-[2px]">
        <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--primary-base)]" />
        In progress
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full border border-[var(--stroke-soft-200)] bg-[var(--white-0)] px-2.5 py-0.5 text-[10.5px] font-bold uppercase tracking-[0.06em] text-[var(--neutral-soft-400)] backdrop-blur-[2px]">
      Coming soon
    </span>
  );
}

