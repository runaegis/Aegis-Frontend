'use client';

/**
 * Approval detail — `/dashboard/approvals/[id]`.
 *
 * Permalink-able view of a single MCP approval. Used when a reviewer
 * needs to focus on one decision (incident triage, escalated review,
 * deep-link from email / Slack) without scrolling through the full
 * inline-expanded approvals list.
 *
 * What's on the page (in order):
 *   1. Topbar with action summary
 *   2. Identity row: agent + decision badge + SemanticTypeChip
 *   3. Metadata grid: tool, repository, branch, created
 *   4. Arguments JSON viewer
 *   5. ContextEvidencePanel — the 4-context evidence (Session /
 *      Repo / Branch / Env). Renders only when backend has persisted
 *      contexts. Hidden today; lights up after Sprint Board Ticket 2.
 *   6. Approve / Deny action row (only when status === pending)
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Check, X, ArrowLeft } from 'lucide-react';
import { api } from '@/lib/api';
import { useUser } from '@/lib/hooks';
import type { MCPApproval } from '@/lib/types';
import { extractPullRequestUrl } from '@/lib/utils';
import Topbar from '@/components/layout/Topbar';
import { AgentMark } from '@/components/ui/AgentMark';
import { Button } from '@/components/ui/Button';
import { CodeChip } from '@/components/ui/CodeChip';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import DecisionBadge from '@/components/ui/DecisionBadge';
import DiagnosticErrorState from '@/components/ui/DiagnosticErrorState';
import EmptyState from '@/components/ui/EmptyState';
import JsonViewer from '@/components/ui/JsonViewer';
import { PullRequestLink } from '@/components/ui/PullRequestLink';
import { RelativeTime } from '@/components/ui/RelativeTime';
import { SemanticTypeChip } from '@/components/ui/SemanticTypeChip';
import { useToast } from '@/components/ui/Toast';
import { ContextEvidencePanel } from '@/components/dashboard/ContextEvidencePanel';
import type { CILFields } from '@/lib/cil-types';
import { FileQuestion } from 'lucide-react';

export default function ApprovalDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = String(params?.id ?? '');
  const { user, isLoading: userLoading } = useUser();
  const toast = useToast();

  const [approval, setApproval] = useState<MCPApproval | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actioning, setActioning] = useState(false);
  const [pendingDeny, setPendingDeny] = useState(false);

  const fetchApproval = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    setError(null);
    try {
      const list = await api.getMcpApprovals(user.id);
      const found = list.find((a) => a.id === id) ?? null;
      setApproval(found);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load approval');
    } finally {
      setLoading(false);
    }
  }, [user?.id, id]);

  useEffect(() => {
    void fetchApproval();
  }, [fetchApproval]);

  const onAction = useCallback(
    async (reject: boolean) => {
      if (!approval) return;
      setActioning(true);
      try {
        await api.executeMcpApproval(approval.id, reject);
        if (reject) toast.error('Denied');
        else toast.success('Approved');
        // Refetch so the UI reflects the new status.
        await fetchApproval();
      } catch (err) {
        toast.error('Failed', {
          description:
            err instanceof Error ? err.message : 'Action did not complete',
        });
      } finally {
        setActioning(false);
        setPendingDeny(false);
      }
    },
    [approval, fetchApproval, toast],
  );

  const cilApproval = approval as (MCPApproval & CILFields) | null;
  const prUrl = useMemo(
    () => (approval ? extractPullRequestUrl(approval) : null),
    [approval],
  );

  // ─── Loading / error / not-found ──────────────────────────
  if (userLoading || loading) {
    return (
      <>
        <Topbar title="Approval" />
        <div className="mx-auto max-w-[920px] px-4 py-6 sm:px-6 sm:py-7 lg:px-8 lg:py-8">
          <div className="h-72 animate-pulse rounded-[12px] bg-[var(--neutral-weak-50)]" />
        </div>
      </>
    );
  }

  if (error) {
    return (
      <>
        <Topbar title="Approval" />
        <div className="mx-auto max-w-[920px] px-4 py-6 sm:px-6 sm:py-7 lg:px-8 lg:py-8">
          <DiagnosticErrorState
            title="Couldn't load this approval"
            description="The approval record may have been deleted, or the API is temporarily unavailable."
            diagnostic={{
              request_id: id,
              endpoint: 'GET /get_mcp_approvals',
              status: '500',
            }}
            onRetry={() => void fetchApproval()}
          />
        </div>
      </>
    );
  }

  if (!approval) {
    return (
      <>
        <Topbar title="Approval" />
        <div className="mx-auto max-w-[920px] px-4 py-6 sm:px-6 sm:py-7 lg:px-8 lg:py-8">
          <EmptyState
            icon={<FileQuestion className="h-5 w-5" strokeWidth={2} />}
            title="Approval not found"
            description="This approval may have been actioned and removed, or you may not have access to it."
            action={
              <Button onClick={() => router.push('/dashboard/approvals')}>
                Back to approvals
              </Button>
            }
          />
        </div>
      </>
    );
  }

  // ─── Populated state ─────────────────────────────────────
  const agentName =
    (approval.context?.agent_name as string | undefined) ||
    (approval.context?.session_id as string | undefined) ||
    'agent';
  const repo = approval.arguments?.repo as string | undefined;
  const branch =
    (approval.arguments?.head as string | undefined) ||
    (approval.arguments?.branch as string | undefined);
  const isPending = approval.status === 'pending';

  return (
    <>
      <Topbar title="Approval" />
      <div className="mx-auto max-w-[920px] space-y-4 px-4 py-6 sm:px-6 sm:py-7 lg:px-8 lg:py-8">
        {/* Back link — small, mono, top-left like a breadcrumb. */}
        <button
          type="button"
          onClick={() => router.push('/dashboard/approvals')}
          className="inline-flex items-center gap-1.5 text-[11.5px] text-[var(--neutral-soft-400)] transition-colors hover:text-[var(--neutral-strong-950)]"
        >
          <ArrowLeft className="h-3 w-3" strokeWidth={2} />
          All approvals
        </button>

        {/* Identity card */}
        <div className="rounded-[12px] border border-[var(--stroke-soft-200)] bg-[var(--white-0)] p-5 shadow-[0_1px_2px_rgba(23,23,23,0.04)]">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <AgentMark name={agentName} size="md" />
              <div className="min-w-0">
                <p className="truncate text-[13.5px] font-semibold tracking-[-0.005em] text-[var(--neutral-strong-950)]">
                  {agentName}
                </p>
                <div className="mt-0.5 flex items-center gap-1.5 text-[11.5px] text-[var(--neutral-soft-400)]">
                  <RelativeTime timestamp={approval.created_at} />
                  {approval.approved_at && (
                    <>
                      <span>·</span>
                      <span>
                        actioned <RelativeTime timestamp={approval.approved_at} />
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>
            <div className="flex flex-col items-end gap-1.5">
              <DecisionBadge decision={approval.status} />
              {cilApproval?.semantic_type && (
                <SemanticTypeChip
                  semantic_type={cilApproval.semantic_type}
                  variant="compact"
                />
              )}
              {prUrl && <PullRequestLink url={prUrl} variant="chip" />}
            </div>
          </div>

          <p className="mt-5 text-[15px] font-medium leading-[1.5] tracking-[-0.01em] text-[var(--neutral-strong-950)]">
            {approval.action_summary}
          </p>

          {/* Metadata grid */}
          <div className="mt-5 grid grid-cols-1 gap-x-8 gap-y-3 border-t border-[var(--stroke-soft-200)] pt-5 sm:grid-cols-2 lg:grid-cols-3">
            <MetaCell label="Tool">
              <CodeChip>{approval.tool_name}</CodeChip>
            </MetaCell>
            {repo && (
              <MetaCell label="Repository">
                <CodeChip>{repo}</CodeChip>
              </MetaCell>
            )}
            {branch && (
              <MetaCell label="Branch">
                <CodeChip>{branch}</CodeChip>
              </MetaCell>
            )}
          </div>

          {/* Approve / Deny — only when pending */}
          {isPending && (
            <div className="mt-5 flex items-center gap-2 border-t border-[var(--stroke-soft-200)] pt-5">
              <Button
                variant="primary"
                disabled={actioning}
                onClick={() => void onAction(false)}
                leadingIcon={<Check className="h-3.5 w-3.5" strokeWidth={2.25} />}
              >
                {actioning ? 'Working…' : 'Approve'}
              </Button>
              <Button
                variant="secondary"
                disabled={actioning}
                onClick={() => setPendingDeny(true)}
                leadingIcon={<X className="h-3.5 w-3.5" strokeWidth={2.25} />}
              >
                Deny
              </Button>
            </div>
          )}
        </div>

        {/* Arguments JSON */}
        {approval.arguments && Object.keys(approval.arguments).length > 0 && (
          <JsonViewer
            data={approval.arguments}
            collapsed={false}
            label="Arguments"
          />
        )}

        {/* ContextEvidencePanel — renders the 4-context evidence when
            backend has persisted contexts. Until then (today), the
            panel renders an honest empty state explaining that
            persistence isn't enabled yet. */}
        <ContextEvidencePanel
          contexts={cilApproval?.contexts}
          decisionPath={cilApproval?.decision_path}
        />

        <ConfirmDialog
          open={pendingDeny}
          onOpenChange={(o) => setPendingDeny(o)}
          title="Deny this approval?"
          description="The agent will receive a deny response. This cannot be undone."
          confirmLabel="Deny"
          variant="danger"
          loading={actioning}
          onConfirm={() => void onAction(true)}
        />
      </div>
    </>
  );
}

function MetaCell({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[var(--neutral-soft-400)]">
        {label}
      </p>
      <div className="mt-1.5">{children}</div>
    </div>
  );
}
