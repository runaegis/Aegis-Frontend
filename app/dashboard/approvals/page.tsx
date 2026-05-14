'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { Bell, Check, ChevronDown, ChevronRight, Clock, X } from 'lucide-react';
import { api } from '@/lib/api';
import { useAutoRefresh, useUser } from '@/lib/hooks';
import { MCPApproval } from '@/lib/types';
import { formatRelativeTime } from '@/lib/utils';
import Topbar from '@/components/layout/Topbar';
import AgentAvatar from '@/components/ui/AgentAvatar';
import DecisionBadge from '@/components/ui/DecisionBadge';
import EmptyState from '@/components/ui/EmptyState';
import ErrorBanner from '@/components/ui/ErrorBanner';
import JsonViewer from '@/components/ui/JsonViewer';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { Button } from '@/components/ui/Button';
import { CodeChip } from '@/components/ui/CodeChip';
import { useToast } from '@/components/ui/Toast';
import { DUR, EASE, fadeUp, fadeUpSm, staggerContainer } from '@/lib/motion';

type ApprovalFilter = 'all' | 'pending' | 'approved' | 'rejected';

function normalizeStatus(status: string): 'pending' | 'approved' | 'rejected' {
  const value = (status ?? '').toLowerCase();
  if (value === 'approved' || value === 'rejected') return value;
  return 'pending';
}

const FILTER_TABS: { value: ApprovalFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
];

export default function ApprovalsPage() {
  const { user, isLoading: userLoading } = useUser();
  const reduce = useReducedMotion();
  const toast = useToast();
  const [approvals, setApprovals] = useState<MCPApproval[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<ApprovalFilter>('all');
  const [actioningIds, setActioningIds] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const fetchData = useCallback(async () => {
    if (!user?.id) {
      if (!userLoading) {
        setApprovals([]);
        setLoading(false);
      }
      return;
    }
    setLoading(true);
    try {
      const data = await api.getMcpApprovals(user.id);
      setApprovals(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load approvals');
    } finally {
      setLoading(false);
    }
  }, [user?.id, userLoading]);

  useEffect(() => {
    if (user?.id) fetchData();
    else if (!userLoading) {
      setApprovals([]);
      setLoading(false);
    }
  }, [user?.id, userLoading, fetchData]);

  const { lastUpdated } = useAutoRefresh(fetchData, 30000);

  const handleAction = async (id: string, reject: boolean) => {
    setActioningIds((prev) => new Set(prev).add(id));
    try {
      await api.executeMcpApproval(id, reject);
      setError(null);
      await fetchData();
      if (reject) {
        toast.warning('Request denied', {
          description: 'The agent will receive the rejection.',
        });
      } else {
        toast.success('Request approved', {
          description: 'The agent can proceed with the action.',
        });
      }
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : 'Failed to update approval status';
      setError(msg);
      toast.error("Couldn't update approval", { description: msg });
    } finally {
      setActioningIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const counts = useMemo(
    () =>
      approvals.reduce(
        (acc, approval) => {
          const normalized = normalizeStatus(approval.status);
          acc[normalized] += 1;
          return acc;
        },
        { pending: 0, approved: 0, rejected: 0 } as Record<
          'pending' | 'approved' | 'rejected',
          number
        >,
      ),
    [approvals],
  );

  const filteredApprovals = useMemo(
    () =>
      approvals.filter((approval) => {
        if (statusFilter === 'all') return true;
        return normalizeStatus(approval.status) === statusFilter;
      }),
    [approvals, statusFilter],
  );

  const tabCount = (tab: ApprovalFilter) =>
    tab === 'all' ? approvals.length : counts[tab];

  if (userLoading || loading) {
    return (
      <>
        <Topbar title="Approvals" subtitle="Actions requiring review" />
        <div className="flex h-[60vh] items-center justify-center">
          <LoadingSpinner size="lg" />
        </div>
      </>
    );
  }

  return (
    <>
      <Topbar
        title="Approvals"
        subtitle="Actions requiring review"
        lastUpdated={lastUpdated}
        onRefresh={fetchData}
        unreadCount={counts.pending}
      />
      <div className="mx-auto max-w-[1320px] px-4 py-6 sm:px-6 sm:py-7 lg:px-8 lg:py-8">
        {error && (
          <div className="mb-6">
            <ErrorBanner
              message={error}
              onDismiss={() => setError(null)}
              onRetry={fetchData}
            />
          </div>
        )}

        <motion.header
          className="mb-6"
          variants={staggerContainer(0.05, 0.04)}
          initial={reduce ? false : 'hidden'}
          animate="show"
        >
          <motion.p
            variants={fadeUp}
            className="mb-2 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-[var(--neutral-soft-400)]"
          >
            Approvals queue
          </motion.p>
          <motion.h1
            variants={fadeUp}
            className="text-[26px] font-semibold leading-[1.1] tracking-[-0.03em] text-[var(--neutral-strong-950)]"
          >
            Review what your agents want to do
          </motion.h1>
          <motion.p
            variants={fadeUp}
            className="mt-2 text-[13.5px] text-[var(--neutral-sub-600)]"
          >
            <span className="font-semibold" style={{ color: 'var(--primary-base)' }}>
              {counts.pending.toLocaleString()}
            </span>{' '}
            pending,{' '}
            <span className="font-semibold" style={{ color: 'var(--success)' }}>
              {counts.approved.toLocaleString()}
            </span>{' '}
            approved,{' '}
            <span className="font-semibold" style={{ color: 'var(--error)' }}>
              {counts.rejected.toLocaleString()}
            </span>{' '}
            rejected.
          </motion.p>
        </motion.header>

        {/* Filter tabs */}
        <motion.div
          className="mb-6 inline-flex gap-1 rounded-[10px] border border-[var(--stroke-soft-200)] bg-white p-1 shadow-[0_1px_2px_rgba(23,23,23,0.04)]"
          initial={reduce ? false : { opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: DUR.default, ease: EASE.out, delay: 0.18 }}
        >
          {FILTER_TABS.map((tab) => {
            const active = statusFilter === tab.value;
            return (
              <button
                key={tab.value}
                onClick={() => setStatusFilter(tab.value)}
                className={[
                  'inline-flex h-7 items-center gap-1.5 rounded-[7px] px-3 text-[12.5px] font-medium transition-colors',
                  active
                    ? 'bg-[var(--primary-alpha-10)] text-[var(--primary-base)]'
                    : 'text-[var(--neutral-sub-600)] hover:bg-[var(--neutral-weak-50)] hover:text-[var(--neutral-strong-950)]',
                ].join(' ')}
              >
                {tab.label}
                <span
                  className="text-[10.5px] font-bold tabular-nums"
                  style={{
                    color: active ? 'var(--primary-base)' : 'var(--neutral-soft-400)',
                  }}
                >
                  {tabCount(tab.value).toLocaleString()}
                </span>
              </button>
            );
          })}
        </motion.div>

        {filteredApprovals.length === 0 ? (
          <div className="overflow-hidden rounded-[12px] border border-[var(--stroke-soft-200)] bg-white shadow-[0_1px_2px_rgba(23,23,23,0.04)]">
            <EmptyState
              icon={<Bell className="h-5 w-5" />}
              title={statusFilter === 'pending' ? 'All clear' : 'Nothing here'}
              description={
                statusFilter === 'pending'
                  ? 'No approvals waiting for review.'
                  : 'No approval requests match this filter.'
              }
            />
          </div>
        ) : (
          <motion.ul
            className="space-y-3"
            variants={staggerContainer(0.04, 0.26)}
            initial={reduce ? false : 'hidden'}
            animate="show"
          >
            {filteredApprovals.map((approval) => {
              const approvalStatus = normalizeStatus(approval.status);
              const isPending = approvalStatus === 'pending';
              const isActioning = actioningIds.has(approval.id);
              const isExpanded = expanded.has(approval.id);
              const toggle = () =>
                setExpanded((prev) => {
                  const next = new Set(prev);
                  if (next.has(approval.id)) next.delete(approval.id);
                  else next.add(approval.id);
                  return next;
                });

              const contextUser =
                typeof approval.context?.user === 'string'
                  ? approval.context.user
                  : 'Agent';
              const repo =
                typeof approval.arguments?.repo === 'string'
                  ? approval.arguments.repo
                  : null;
              const branch =
                typeof approval.arguments?.branch === 'string'
                  ? approval.arguments.branch
                  : null;
              const summary =
                typeof approval.action_summary === 'string'
                  ? approval.action_summary
                  : `Requested tool: ${approval.tool_name}`;

              return (
                <ApprovalItem
                  key={approval.id}
                  approval={approval}
                  contextUser={contextUser}
                  summary={summary}
                  repo={repo}
                  branch={branch}
                  isPending={isPending}
                  isActioning={isActioning}
                  isExpanded={isExpanded}
                  toggle={toggle}
                  onAction={handleAction}
                />
              );
            })}
          </motion.ul>
        )}
      </div>
    </>
  );
}

function ApprovalItem({
  approval,
  contextUser,
  summary,
  repo,
  branch,
  isPending,
  isActioning,
  isExpanded,
  toggle,
  onAction,
}: {
  approval: MCPApproval;
  contextUser: string;
  summary: string;
  repo: string | null;
  branch: string | null;
  isPending: boolean;
  isActioning: boolean;
  isExpanded: boolean;
  toggle: () => void;
  onAction: (id: string, reject: boolean) => void;
}) {
  return (
    <motion.li
      variants={fadeUpSm}
      data-card-hover
      className={`group overflow-hidden rounded-[12px] border shadow-[0_1px_2px_rgba(23,23,23,0.04)] hover:shadow-[0_4px_12px_rgba(23,23,23,0.06)] ${
        isPending
          ? 'border-[var(--primary-base)]/20 bg-gradient-to-b from-[var(--primary-lighter)]/55 via-white to-white'
          : 'border-[var(--stroke-soft-200)] bg-white opacity-75'
      }`}
    >

      <div className="p-5">
        {/* Top row: avatar + agent + meta on left, status pill on right */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <AgentAvatar name={contextUser} size="sm" />
            <div className="min-w-0">
              <p className="truncate text-[13.5px] font-semibold text-[var(--neutral-strong-950)]">
                {contextUser}
              </p>
              <div className="mt-0.5 flex items-center gap-1.5 text-[11.5px] text-[var(--neutral-soft-400)]">
                <Clock className="h-3 w-3" strokeWidth={2} />
                <span>{formatRelativeTime(approval.created_at)}</span>
                {approval.approved_at && (
                  <>
                    <span>·</span>
                    <span>actioned {formatRelativeTime(approval.approved_at)}</span>
                  </>
                )}
              </div>
            </div>
          </div>
          <DecisionBadge decision={approval.status} />
        </div>

        {/* Action summary — headline */}
        <p className="mt-4 text-[14.5px] font-medium leading-[1.5] tracking-[-0.01em] text-[var(--neutral-strong-950)]">
          {summary}
        </p>

        {/* Metadata grid — labeled cells separated from the action summary
            by a thin top divider, no surrounding panel surface so the
            CodeChips read cleanly against pure white. */}
        <div className="mt-4 grid grid-cols-1 gap-x-8 gap-y-3 border-t border-[var(--stroke-soft-200)] pt-4 sm:grid-cols-2 lg:grid-cols-3">
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
          {approval.context?.model && (
            <MetaCell label="Model">
              <CodeChip>{String(approval.context.model)}</CodeChip>
            </MetaCell>
          )}
          {approval.context?.conversation_id && (
            <MetaCell label="Conversation">
              <CodeChip>{String(approval.context.conversation_id)}</CodeChip>
            </MetaCell>
          )}
        </div>

        {/* Actions */}
        <div className="mt-4 flex items-center justify-between">
          <button
            onClick={toggle}
            className="inline-flex items-center gap-1 text-[12px] font-medium text-[var(--neutral-sub-600)] hover:text-[var(--neutral-strong-950)]"
          >
            {isExpanded ? (
              <>
                <ChevronDown className="h-3.5 w-3.5" strokeWidth={2} />
                Hide details
              </>
            ) : (
              <>
                <ChevronRight className="h-3.5 w-3.5" strokeWidth={2} />
                Show details
              </>
            )}
          </button>

          {isPending && (
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="secondary"
                disabled={isActioning}
                onClick={() => onAction(approval.id, true)}
                leadingIcon={<X className="h-3.5 w-3.5" strokeWidth={2} />}
              >
                Deny
              </Button>
              <Button
                size="sm"
                variant="primary"
                disabled={isActioning}
                onClick={() => onAction(approval.id, false)}
                leadingIcon={<Check className="h-3.5 w-3.5" strokeWidth={2.25} />}
              >
                Approve
              </Button>
            </div>
          )}
        </div>

        {isExpanded && approval.arguments && (
          <div className="mt-4">
            <JsonViewer
              data={approval.arguments}
              collapsed={false}
              label="Arguments"
            />
          </div>
        )}
      </div>
    </motion.li>
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
    <div className="min-w-0">
      <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.07em] text-[var(--neutral-soft-400)]">
        {label}
      </p>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
