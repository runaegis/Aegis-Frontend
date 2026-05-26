'use client';

/**
 * ContextEvidencePanel — surfaces the 4 context structs that the
 * Layer 2 (CIL) classifier assembled at decision time.
 *
 * Renders as a 2x2 grid of SessionContext / RepoContext /
 * BranchContext / EnvContext blocks, each containing the key:value
 * snapshot fields that fed into the decision. Monospace throughout
 * because this is "what the classifier actually saw" — engineers
 * and auditors should read it as a data structure, not as marketing.
 *
 * Tone signalling on individual rows:
 *   warn (red)    — signal that triggered the verdict (high
 *                   denial_count, freeze window active, etc.)
 *   ok (green)    — signal that confirmed safety (ci_passing,
 *                   is_aegis_managed, etc.)
 *   default       — neutral display
 *
 * FIELD PRESENCE GUARDS
 * Until backend persists `contexts` on every action record (see
 * Engineering Sprint Board Ticket 2), this component renders an
 * empty state explaining that context data will appear once
 * classifier persistence is enabled. The empty state is intentional
 * — it tells the user the feature exists and is waiting on backend,
 * not that it's broken.
 *
 * Both real workspace AND demo workspace go through the same guard.
 * No demo-only mock data here. When backend ships, both light up
 * together.
 */

import { Layers, FileQuestion } from 'lucide-react';
import type { ActionContexts } from '@/lib/cil-types';
import { IconMark } from '@/components/ui/IconMark';

interface ContextEvidencePanelProps {
  contexts?: ActionContexts;
  /** Optional decision_path string to render below the panel as the
   *  classifier's "why" trail. */
  decisionPath?: string;
  /** Optional canonical_action_type to surface alongside the
   *  decision_path strip. */
  canonicalActionType?: string;
  /** When true, render in a compact mode without the section header
   *  + panel chrome. Useful when embedded inside a larger card. */
  compact?: boolean;
}

export function ContextEvidencePanel({
  contexts,
  decisionPath,
  canonicalActionType,
  compact = false,
}: ContextEvidencePanelProps) {
  const hasAnyContext = Boolean(
    contexts &&
      (contexts.session || contexts.repo || contexts.branch || contexts.env),
  );

  // ─── Empty state ────────────────────────────────────────────
  if (!hasAnyContext) {
    return (
      <div
        className={
          compact
            ? 'rounded-[10px] border border-dashed border-[var(--stroke-soft-200)] bg-[var(--neutral-weak-50)] px-4 py-5'
            : 'overflow-hidden rounded-[12px] border border-dashed border-[var(--stroke-soft-200)] bg-[var(--neutral-weak-50)]'
        }
      >
        <div
          className={
            compact
              ? 'flex items-center gap-3'
              : 'flex items-center gap-3 px-5 py-6'
          }
        >
          <IconMark
            icon={FileQuestion}
            color="var(--neutral-soft-400)"
            strokeWidth={2}
          />
          <div className="min-w-0">
            <p className="text-[12.5px] font-semibold tracking-[-0.005em] text-[var(--neutral-strong-950)]">
              Context evidence not yet available
            </p>
            <p className="mt-0.5 text-[11.5px] leading-[1.5] text-[var(--neutral-sub-600)]">
              The classifier&apos;s 4 context structs (Session, Repo, Branch,
              Env) will attach automatically once persistence is enabled on
              this workspace.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ─── Populated state ───────────────────────────────────────
  const inner = (
    <>
      <div className="grid grid-cols-1 divide-y divide-[var(--stroke-soft-200)] sm:grid-cols-2 sm:divide-x sm:divide-y-0">
        {contexts!.session && <SessionContextBlock data={contexts!.session} />}
        {contexts!.repo && <RepoContextBlock data={contexts!.repo} />}
        {contexts!.branch && <BranchContextBlock data={contexts!.branch} />}
        {contexts!.env && <EnvContextBlock data={contexts!.env} />}
      </div>

      {(decisionPath || canonicalActionType) && (
        <div className="border-t border-[var(--stroke-soft-200)] bg-[var(--neutral-weak-50)] px-4 py-3 sm:px-5">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 font-mono text-[10.5px]">
            {canonicalActionType && (
              <>
                <span className="uppercase tracking-[0.08em] text-[var(--neutral-soft-400)]">
                  canonical_action_type
                </span>
                <span className="font-semibold text-[var(--neutral-strong-950)]">
                  {canonicalActionType}
                </span>
              </>
            )}
            {decisionPath && (
              <>
                {canonicalActionType && (
                  <span className="text-[var(--neutral-soft-400)]">·</span>
                )}
                <span className="uppercase tracking-[0.08em] text-[var(--neutral-soft-400)]">
                  decision_path
                </span>
                <span className="font-semibold text-[var(--neutral-strong-950)]">
                  {decisionPath}
                </span>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );

  if (compact) {
    return (
      <div className="overflow-hidden rounded-[10px] border border-[var(--stroke-soft-200)] bg-[var(--white-0)]">
        {inner}
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-[12px] border border-[var(--stroke-soft-200)] bg-[var(--white-0)] shadow-[0_1px_2px_rgba(23,23,23,0.04)]">
      <div className="flex items-start justify-between gap-3 border-b border-[var(--stroke-soft-200)] bg-[var(--neutral-weak-50)] px-4 py-3 sm:px-5">
        <div className="flex items-center gap-2.5">
          <IconMark
            icon={Layers}
            color="var(--primary-base)"
            strokeWidth={2.25}
          />
          <div>
            <p className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[var(--neutral-soft-400)]">
              Context evidence
            </p>
            <h2 className="mt-0.5 text-[14px] font-semibold tracking-[-0.01em] text-[var(--neutral-strong-950)]">
              Four signals the classifier evaluated
            </h2>
          </div>
        </div>
      </div>
      {inner}
    </div>
  );
}

// ─── Per-context blocks ────────────────────────────────────────

function SessionContextBlock({
  data,
}: {
  data: NonNullable<ActionContexts['session']>;
}) {
  return (
    <ContextBlock title="SessionContext">
      <ContextRow label="agent" value={data.agent_name ?? '—'} />
      <ContextRow
        label="human_initiator"
        value={data.human_initiator ?? '—'}
      />
      <ContextRow label="push_count" value={String(data.push_count ?? 0)} />
      <ContextRow
        label="denial_count"
        value={String(data.denial_count ?? 0)}
        warn={(data.denial_count ?? 0) >= 2}
      />
      <ContextRow
        label="ci_failure_streak"
        value={String(data.ci_failure_streak ?? 0)}
        warn={(data.ci_failure_streak ?? 0) >= 3}
      />
      <ContextRow label="workflow_stage" value={data.workflow_stage ?? '—'} />
      <ContextRow label="linked_ticket" value={data.linked_ticket ?? '—'} />
    </ContextBlock>
  );
}

function RepoContextBlock({
  data,
}: {
  data: NonNullable<ActionContexts['repo']>;
}) {
  return (
    <ContextBlock title="RepoContext">
      <ContextRow label="target_branch" value={data.target_branch ?? '—'} />
      <ContextRow
        label="is_protected_branch"
        value={data.is_protected_branch ? 'true' : 'false'}
        warn={data.is_protected_branch === true}
      />
      <ContextRow
        label="ci_passing"
        value={data.ci_passing ? 'true' : 'false'}
        warn={data.ci_passing === false}
        ok={data.ci_passing === true}
      />
      {data.ci_failure_reason && (
        <ContextRow label="ci_failure_reason" value={data.ci_failure_reason} />
      )}
      <ContextRow
        label="freeze_window_active"
        value={data.freeze_window_active ? 'true' : 'false'}
        warn={data.freeze_window_active === true}
      />
      {data.freeze_window_label && (
        <ContextRow
          label="freeze_window_label"
          value={data.freeze_window_label}
        />
      )}
      <ContextRow
        label="sensitivity_level"
        value={data.sensitivity_level ?? 'standard'}
        warn={data.sensitivity_level === 'critical'}
      />
    </ContextBlock>
  );
}

function BranchContextBlock({
  data,
}: {
  data: NonNullable<ActionContexts['branch']>;
}) {
  return (
    <ContextBlock title="BranchContext">
      <ContextRow label="branch_name" value={data.branch_name ?? '—'} />
      <ContextRow
        label="is_aegis_managed"
        value={data.is_aegis_managed ? 'true' : 'false'}
        ok={data.is_aegis_managed === true}
      />
      <ContextRow
        label="session_owner_match"
        value={data.session_owner_match ? 'true' : 'false'}
      />
      <ContextRow
        label="has_open_pr"
        value={data.has_open_pr ? 'true' : 'false'}
      />
      {data.pr_number != null && (
        <ContextRow label="pr_number" value={`#${data.pr_number}`} />
      )}
      <ContextRow
        label="branch_age"
        value={formatBranchAge(data.branch_age_seconds)}
      />
      <ContextRow
        label="commits_this_session"
        value={String(data.commit_count_this_session ?? 0)}
      />
    </ContextBlock>
  );
}

function EnvContextBlock({
  data,
}: {
  data: NonNullable<ActionContexts['env']>;
}) {
  return (
    <ContextBlock title="EnvContext">
      <ContextRow
        label="environment_tier"
        value={data.environment_tier ?? 'dev'}
        warn={data.environment_tier === 'production'}
      />
      <ContextRow
        label="active_incident"
        value={data.active_incident ? 'true' : 'false'}
        warn={data.active_incident === true}
      />
      {data.incident_severity && (
        <ContextRow label="incident_severity" value={data.incident_severity} warn />
      )}
      <ContextRow
        label="within_business_hours"
        value={data.within_business_hours ? 'true' : 'false'}
      />
      <ContextRow label="timezone" value={data.timezone ?? 'UTC'} />
      <ContextRow
        label="deploy_locked"
        value={data.deploy_locked ? 'true' : 'false'}
        warn={data.deploy_locked === true}
      />
    </ContextBlock>
  );
}

// ─── Building blocks ──────────────────────────────────────────

function ContextBlock({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-[var(--white-0)] px-4 py-4 sm:px-5">
      <p className="mb-3 font-mono text-[10.5px] font-bold uppercase tracking-[0.08em] text-[var(--neutral-soft-400)]">
        {title}
      </p>
      <dl className="space-y-1.5">{children}</dl>
    </div>
  );
}

/**
 * One key:value row inside a ContextBlock. Renders as a key=value
 * assignment, monospace throughout. `warn` uses --error for signals
 * that triggered the verdict; `ok` uses --success for safe signals;
 * everything else uses --neutral-strong-950.
 */
function ContextRow({
  label,
  value,
  warn,
  ok,
}: {
  label: string;
  value: string;
  warn?: boolean;
  ok?: boolean;
}) {
  const valueColor = warn
    ? 'var(--error)'
    : ok
      ? 'var(--success)'
      : 'var(--neutral-strong-950)';
  return (
    <div className="flex items-baseline justify-between gap-3 font-mono text-[10.5px] leading-[1.5]">
      <dt className="shrink-0 text-[var(--neutral-soft-400)]">{label}</dt>
      <dd
        className="min-w-0 break-all text-right font-semibold"
        style={{ color: valueColor }}
      >
        {value}
      </dd>
    </div>
  );
}

/** Format branch_age_seconds into a human-readable string. */
function formatBranchAge(seconds?: number): string {
  if (seconds == null) return '—';
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.round(seconds / 3600)}h`;
  return `${Math.round(seconds / 86400)}d`;
}
