'use client';

/**
 * Bring your own MCP — /dashboard/connectors/custom
 *
 * The universal-chokepoint surface: point Aegis at any MCP endpoint, it runs
 * list_tools to discover the tools, and reads each tool's risk from the MCP
 * protocol's own annotations (readOnlyHint / destructiveHint) so writes and
 * destructive calls are flagged without any hand-built taxonomy. A custom MCP
 * lands in Observe by default (records, blocks nothing); the owner sets a
 * per-tool policy, then flips to Enforce. Governance is the same Allow /
 * Approval / Deny model every built-in connector uses.
 *
 * Frontend only for now — discovery + save are shimmed in preview
 * (lib/preview-data.ts). Backend contract: POST /mcp/discover, then
 * POST /room/{id}/mcp-servers. See the Notion tickets.
 */

import { useState } from 'react';
import Link from 'next/link';
import { motion, useReducedMotion } from 'motion/react';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Eye,
  Loader2,
  Lock,
  Plus,
  Search,
  ShieldCheck,
  TriangleAlert,
} from 'lucide-react';
import Topbar from '@/components/layout/Topbar';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useToast } from '@/components/ui/Toast';
import { api } from '@/lib/api';
import type { DiscoveredMcpTool, McpToolPolicy, McpToolRisk } from '@/lib/types';
import { fadeUp, staggerContainer } from '@/lib/motion';
import { cn } from '@/lib/utils';

// ─── Risk (from MCP annotations) → colour + label ────────────────────
const RISK_META: Record<McpToolRisk, { label: string; text: string; bg: string; ring: string }> = {
  read: {
    label: 'Read',
    text: 'var(--neutral-sub-600)',
    bg: 'var(--neutral-weak-50)',
    ring: 'var(--stroke-soft-200)',
  },
  write: {
    label: 'Write',
    text: 'var(--warning-dark, #9a6a00)',
    bg: 'var(--warning-lighter, rgba(246,181,30,0.12))',
    ring: 'var(--warning, #f6b51e)',
  },
  destructive: {
    label: 'Destructive',
    text: 'var(--error-dark, #b3261e)',
    bg: 'var(--error-lighter, rgba(251,55,72,0.10))',
    ring: 'var(--error, #fb3748)',
  },
};

const POLICIES: McpToolPolicy[] = ['allow', 'approval', 'deny'];
const POLICY_LABEL: Record<McpToolPolicy, string> = {
  allow: 'Allow',
  approval: 'Approval',
  deny: 'Deny',
};

export default function CustomMcpPage() {
  const reduce = useReducedMotion();
  const toast = useToast();

  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [authType, setAuthType] = useState<'none' | 'bearer'>('none');
  const [token, setToken] = useState('');

  const [discovering, setDiscovering] = useState(false);
  const [tools, setTools] = useState<DiscoveredMcpTool[] | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const canDiscover = url.trim().length > 0 && (authType === 'none' || token.trim().length > 0);

  const discover = async () => {
    setDiscovering(true);
    setSaved(false);
    try {
      const res = await api.discoverMcpTools({
        url: url.trim(),
        auth_type: authType,
        token: authType === 'bearer' ? token.trim() : undefined,
      });
      setTools(res.tools);
    } catch {
      toast.error('Could not reach that MCP endpoint. Check the URL and auth.');
    } finally {
      setDiscovering(false);
    }
  };

  const setPolicy = (toolName: string, policy: McpToolPolicy) => {
    setTools((prev) =>
      prev ? prev.map((t) => (t.name === toolName ? { ...t, policy } : t)) : prev,
    );
  };

  const save = async () => {
    if (!tools) return;
    setSaving(true);
    try {
      await api.saveCustomMcp('demo', {
        name: name.trim() || 'Custom MCP',
        url: url.trim(),
        auth_type: authType,
        mode: 'observe',
        tools,
      });
      setSaved(true);
      toast.success('Custom MCP added in Observe mode');
    } catch {
      toast.error('Could not save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const writeCount = tools?.filter((t) => t.risk === 'write').length ?? 0;
  const destructiveCount = tools?.filter((t) => t.risk === 'destructive').length ?? 0;

  return (
    <>
      <Topbar title="Bring your own MCP" subtitle="Govern any MCP server, not just the built-in connectors" />

      <div className="mx-auto max-w-[880px] px-4 pb-16 pt-5 sm:px-6 sm:pt-6 lg:px-8">
        <Link
          href="/dashboard/connectors"
          className="mb-5 inline-flex items-center gap-1.5 text-[12.5px] font-medium text-[var(--neutral-sub-600)] transition-colors hover:text-[var(--neutral-strong-950)]"
        >
          <ArrowLeft className="h-3.5 w-3.5" strokeWidth={2} />
          All connectors
        </Link>

        <motion.div
          variants={staggerContainer(0.06)}
          initial={reduce ? false : 'hidden'}
          animate="show"
          className="space-y-5"
        >
          {/* ─── Hero ──────────────────────────────────────────────── */}
          <motion.div variants={fadeUp}>
            <h1 className="text-[26px] font-semibold leading-[1.1] tracking-[-0.025em] text-[var(--neutral-strong-950)]">
              Govern any MCP server
            </h1>
            <p className="mt-2 max-w-[620px] text-[13.5px] leading-[1.6] text-[var(--neutral-sub-600)]">
              Point Aegis at any MCP endpoint. It runs <span className="font-mono text-[12px] text-[var(--neutral-strong-950)]">list_tools</span> to
              discover what the server exposes, reads each tool&rsquo;s risk from its
              own annotations, and governs it with the same Allow, Approval, Deny
              model your built-in connectors use.
            </p>
          </motion.div>

          {/* ─── Endpoint form ─────────────────────────────────────── */}
          <motion.section
            variants={fadeUp}
            className="overflow-hidden rounded-[12px] border border-[var(--stroke-soft-200)] bg-white shadow-[0_1px_2px_rgba(23,23,23,0.04)]"
          >
            <div className="border-b border-[var(--stroke-soft-200)] px-5 py-3.5">
              <h2 className="text-[14px] font-semibold tracking-[-0.01em] text-[var(--neutral-strong-950)]">
                MCP endpoint
              </h2>
              <p className="mt-0.5 text-[11.5px] text-[var(--neutral-soft-400)]">
                An HTTP or SSE MCP server URL. Aegis connects and lists its tools.
              </p>
            </div>
            <div className="space-y-4 p-5">
              <Field label="Name">
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Acme internal MCP"
                />
              </Field>
              <Field label="Endpoint URL">
                <Input
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://mcp.acme.internal/sse"
                  leadingIcon={<Search className="h-3.5 w-3.5" strokeWidth={2} />}
                />
              </Field>
              <Field label="Authentication">
                <div className="inline-flex items-center rounded-[9px] border border-[var(--stroke-soft-200)] bg-[var(--white-0)] p-0.5">
                  {(['none', 'bearer'] as const).map((a) => (
                    <button
                      key={a}
                      type="button"
                      onClick={() => setAuthType(a)}
                      className={cn(
                        'h-7 rounded-[7px] px-3 text-[12px] transition-colors',
                        authType === a
                          ? 'bg-[var(--neutral-weak-50)] font-semibold text-[var(--neutral-strong-950)]'
                          : 'font-medium text-[var(--neutral-sub-600)] hover:text-[var(--neutral-strong-950)]',
                      )}
                    >
                      {a === 'none' ? 'None' : 'Bearer token'}
                    </button>
                  ))}
                </div>
                {authType === 'bearer' && (
                  <div className="mt-2.5">
                    <Input
                      type="password"
                      value={token}
                      onChange={(e) => setToken(e.target.value)}
                      placeholder="Token (stored encrypted, masked in the UI)"
                      leadingIcon={<Lock className="h-3.5 w-3.5" strokeWidth={2} />}
                    />
                  </div>
                )}
              </Field>
              <div className="flex justify-end pt-1">
                <Button
                  variant="primary"
                  onClick={discover}
                  disabled={!canDiscover || discovering}
                  leadingIcon={
                    discovering ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={2} />
                    ) : (
                      <Search className="h-3.5 w-3.5" strokeWidth={2} />
                    )
                  }
                >
                  {discovering ? 'Discovering…' : tools ? 'Re-discover tools' : 'Discover tools'}
                </Button>
              </div>
            </div>
          </motion.section>

          {/* ─── Discovered tools + governance ─────────────────────── */}
          {tools && (
            <motion.section
              initial={reduce ? { opacity: 0 } : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.24, ease: [0.2, 0.8, 0.2, 1] }}
              className="space-y-4"
            >
              {/* Observe banner */}
              <div className="flex items-start gap-3 rounded-[12px] border border-[var(--information,#335cff)]/20 bg-[var(--information-alpha-10,rgba(51,92,255,0.06))] px-4 py-3.5">
                <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--information,#335cff)] text-white">
                  <Eye className="h-3.5 w-3.5" strokeWidth={2.25} />
                </span>
                <div>
                  <p className="text-[13px] font-semibold text-[var(--neutral-strong-950)]">
                    Added in Observe. Nothing is blocked yet.
                  </p>
                  <p className="mt-0.5 text-[12px] leading-[1.5] text-[var(--neutral-sub-600)]">
                    Aegis records what each tool would do and flags risk from the
                    server&rsquo;s own annotations. Set a policy per tool, then flip to
                    Enforce when you&rsquo;re ready.
                  </p>
                </div>
              </div>

              {/* Summary */}
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[12.5px] text-[var(--neutral-sub-600)]">
                <ShieldCheck className="h-4 w-4 text-[var(--success-dark)]" strokeWidth={2} />
                <strong className="font-semibold text-[var(--neutral-strong-950)]">
                  {tools.length} tools discovered
                </strong>
                <span aria-hidden className="text-[var(--neutral-soft-400)]">·</span>
                <span>
                  {writeCount} write{writeCount === 1 ? '' : 's'} default to Approval,{' '}
                  {destructiveCount} destructive default to Deny
                </span>
                <span aria-hidden className="text-[var(--neutral-soft-400)]">·</span>
                <span>inferred from MCP annotations, not hardcoded</span>
              </div>

              {/* Tool rows */}
              <div className="overflow-hidden rounded-[12px] border border-[var(--stroke-soft-200)] bg-white shadow-[0_1px_2px_rgba(23,23,23,0.04)]">
                {tools.map((t, i) => (
                  <div
                    key={t.name}
                    className={cn(
                      'flex flex-col gap-2.5 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between',
                      i > 0 && 'border-t border-[var(--stroke-soft-200)]',
                    )}
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <RiskBadge risk={t.risk} />
                        <span className="truncate font-mono text-[12.5px] text-[var(--neutral-strong-950)]">
                          {t.name}
                        </span>
                      </div>
                      {t.description && (
                        <p className="mt-1 text-[11.5px] leading-[1.45] text-[var(--neutral-sub-600)]">
                          {t.description}
                        </p>
                      )}
                    </div>
                    <PolicySegment value={t.policy} onChange={(p) => setPolicy(t.name, p)} />
                  </div>
                ))}
              </div>

              {/* Save */}
              <div className="flex items-center justify-end gap-3 pt-1">
                {saved && (
                  <span className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-[var(--success-dark)]">
                    <CheckCircle2 className="h-4 w-4" strokeWidth={2} />
                    Saved in Observe
                  </span>
                )}
                <Button
                  variant="primary"
                  onClick={save}
                  disabled={saving}
                  trailingIcon={<ArrowRight className="h-3.5 w-3.5" strokeWidth={2} />}
                >
                  {saving ? 'Saving…' : 'Add to Aegis'}
                </Button>
              </div>
            </motion.section>
          )}

          {/* ─── Empty hint before discovery ───────────────────────── */}
          {!tools && !discovering && (
            <motion.div
              variants={fadeUp}
              className="rounded-[12px] border border-dashed border-[var(--stroke-soft-200)] px-4 py-8 text-center"
            >
              <span className="mx-auto inline-flex h-10 w-10 items-center justify-center rounded-[10px] bg-[var(--neutral-weak-50)] text-[var(--neutral-soft-400)]">
                <Plus className="h-5 w-5" strokeWidth={2} />
              </span>
              <p className="mt-3 text-[13px] font-medium text-[var(--neutral-strong-950)]">
                Discover a server&rsquo;s tools
              </p>
              <p className="mt-1 text-[12px] text-[var(--neutral-sub-600)]">
                Enter an endpoint above. Aegis lists its tools and pre-fills a safe
                default policy for each one.
              </p>
            </motion.div>
          )}
        </motion.div>
      </div>
    </>
  );
}

// ─── Field ────────────────────────────────────────────────────────────
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[var(--neutral-soft-400)]">
        {label}
      </label>
      <div className="mt-1.5">{children}</div>
    </div>
  );
}

// ─── Risk badge (from MCP annotations) ────────────────────────────────
function RiskBadge({ risk }: { risk: McpToolRisk }) {
  const m = RISK_META[risk];
  return (
    <span
      className="inline-flex h-[18px] shrink-0 items-center gap-1 rounded-full px-2 text-[9.5px] font-bold uppercase tracking-[0.06em]"
      style={{ color: m.text, background: m.bg, boxShadow: `inset 0 0 0 1px ${m.ring}` }}
    >
      {risk === 'destructive' && <TriangleAlert className="h-2.5 w-2.5" strokeWidth={2.5} />}
      {m.label}
    </span>
  );
}

// ─── Per-tool policy segmented control ────────────────────────────────
function PolicySegment({
  value,
  onChange,
}: {
  value: McpToolPolicy;
  onChange: (p: McpToolPolicy) => void;
}) {
  return (
    <div className="inline-flex shrink-0 items-center rounded-[9px] border border-[var(--stroke-soft-200)] bg-[var(--white-0)] p-0.5">
      {POLICIES.map((p) => {
        const active = value === p;
        const activeStyle =
          p === 'allow'
            ? 'bg-[var(--success-lighter,rgba(31,193,107,0.12))] text-[var(--success-dark)]'
            : p === 'approval'
              ? 'bg-[var(--primary-alpha-10)] text-[var(--primary-base)]'
              : 'bg-[var(--error-lighter,rgba(251,55,72,0.10))] text-[var(--error-dark,#b3261e)]';
        return (
          <button
            key={p}
            type="button"
            onClick={() => onChange(p)}
            className={cn(
              'h-[26px] rounded-[7px] px-2.5 text-[11px] font-semibold transition-colors',
              active ? activeStyle : 'text-[var(--neutral-soft-400)] hover:text-[var(--neutral-sub-600)]',
            )}
          >
            {POLICY_LABEL[p]}
          </button>
        );
      })}
    </div>
  );
}
