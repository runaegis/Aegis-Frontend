'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Activity, ChevronRight, Search } from 'lucide-react';
import Link from 'next/link';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { DUR, EASE, fadeUp, staggerContainer } from '@/lib/motion';
import { useUser } from '@/lib/hooks';
import { formatDashboardDateRangeLabel } from '@/lib/dashboardDateRange';
import { SessionAction } from '@/lib/types';
import { useDashboardData } from '@/lib/dashboardDataContext';
import {
  blastRadiusRank,
  extractPullRequestUrl,
  formatExecutionTimeMs,
  formatFullTimestamp,
  readBlastRadius,
} from '@/lib/utils';
import { RelativeTime } from '@/components/ui/RelativeTime';
import Topbar from '@/components/layout/Topbar';
import { AgentMark } from '@/components/ui/AgentMark';
import { ConnectorMark, CONNECTORS, type ConnectorId } from '@/components/ui/ConnectorMark';
import { connectorForTool, deriveTarget, RUN_CONNECTOR_FILTERS } from '@/lib/runConnector';
import DecisionBadge, { decisionColor } from '@/components/ui/DecisionBadge';
import EmptyState from '@/components/ui/EmptyState';
import ErrorBanner from '@/components/ui/ErrorBanner';
import JsonViewer from '@/components/ui/JsonViewer';
import { RunsSkeleton } from '@/components/ui/PageSkeletons';
import { BlastRadiusChip } from '@/components/ui/BlastRadiusChip';
import { Button } from '@/components/ui/Button';
import { CodeChip } from '@/components/ui/CodeChip';
import { Input } from '@/components/ui/Input';
import { PolicyChip } from '@/components/ui/PolicyChip';
import { PullRequestLink } from '@/components/ui/PullRequestLink';
import { SelectMenu } from '@/components/ui/SelectMenu';
import {
  Table,
  TBody,
  TD,
  TH,
  THead,
  TR,
  TRExpanded,
  type SortDirection,
} from '@/components/ui/Table';

// Tool -> connector mapping and connector-aware target derivation live in
// lib/runConnector.ts, so the Runs, Sessions and Audit surfaces share one
// source of truth for actions that span GitHub, Postgres, Terraform, Slack
// and the rest. The Runs table no longer assumes a repo/branch shape.

export default function RunsPage() {
  const { isLoading: userLoading } = useUser();
  const reduce = useReducedMotion();
  const [search, setSearch] = useState('');
  const [decisionFilter, setDecisionFilter] = useState('all');
  const [connectorFilter, setConnectorFilter] = useState('all');
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  const {
  dateRange,
  setDateRange,
  sessionActions: runs,
  runsLoading,
  runsLoadingMore,
  runsError,
  dismissRunsError,
  hasMoreRuns,
  loadMoreRuns,
  refreshRuns,
  metrics,
  lastUpdated,
} = useDashboardData();
  const rangeLabel = useMemo(
    () => formatDashboardDateRangeLabel(dateRange, 'All time'),
    [dateRange],
  );

  const filteredRuns = runs.filter((run) => {
    const connectorId = connectorForTool(run.tool_name);
    const target = deriveTarget(run);
    const q = search.toLowerCase();
    const matchesSearch =
      !search ||
      run.agent_name?.toLowerCase().includes(q) ||
      run.tool_name?.toLowerCase().includes(q) ||
      CONNECTORS[connectorId].name.toLowerCase().includes(q) ||
      (target.primary ?? '').toLowerCase().includes(q) ||
      (target.secondary ?? '').toLowerCase().includes(q) ||
      run.action_summary?.toLowerCase().includes(q);

    const matchesDecision =
      decisionFilter === 'all' ||
      (decisionFilter === 'approval'
        ? run.decision?.toUpperCase().includes('APPROVAL')
        : run.decision?.toUpperCase() === decisionFilter.toUpperCase());

    const matchesConnector =
      connectorFilter === 'all' || connectorId === connectorFilter;

    return matchesSearch && matchesDecision && matchesConnector;
  });

  // Client-side sort layered on top of the filter. Default is null
  // (server order — newest-first from DashboardDataProvider). Clicking
  // a sortable column header cycles asc → desc → null. No backend
  // change: we're just reordering the in-memory filtered array.
  //
  // `policy` sorts alphabetically by the policy verdict text.
  // `risk` sorts by blast-radius severity rank (most severe last in
  // asc / first in desc) — more product-meaningful than sorting by
  // the textual blast-radius label.
  type SortKey = 'agent' | 'tool' | 'connector' | 'target' | 'policy' | 'risk' | 'decision' | 'time';
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<SortDirection>(null);
  const onSort = useCallback(
    (key: SortKey) => {
      if (sortKey !== key) {
        setSortKey(key);
        setSortDir('asc');
      } else if (sortDir === 'asc') {
        setSortDir('desc');
      } else {
        setSortKey(null);
        setSortDir(null);
      }
    },
    [sortKey, sortDir],
  );

  const sortedRuns = useMemo(() => {
    if (!sortKey || sortDir === null) return filteredRuns;
    const acc = (r: typeof filteredRuns[number]): string | number => {
      switch (sortKey) {
        case 'agent':     return r.agent_name?.toLowerCase() ?? '';
        case 'tool':      return r.tool_name?.toLowerCase() ?? '';
        case 'connector': return CONNECTORS[connectorForTool(r.tool_name)].name.toLowerCase();
        case 'target':    return (deriveTarget(r).primary ?? '').toLowerCase();
        case 'policy':    return String(r.policy ?? '').toLowerCase();
        case 'risk':      return blastRadiusRank(readBlastRadius(r));
        case 'decision':  return r.decision ?? '';
        case 'time':      return new Date(r.timestamp).getTime();
      }
    };
    const arr = [...filteredRuns];
    arr.sort((a, b) => {
      const av = acc(a);
      const bv = acc(b);
      if (av < bv) return sortDir === 'asc' ? -1 : 1;
      if (av > bv) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
    return arr;
  }, [filteredRuns, sortKey, sortDir]);

  const dirFor = (key: SortKey): SortDirection =>
    sortKey === key ? sortDir : null;

  if (userLoading || (runsLoading && runs.length === 0)) {
    return (
      <>
        <Topbar
          title="Runs"
          subtitle="Real-time agent activity"
          showDateRange
          dateRangeValue={dateRange}
          onDateRangeChange={setDateRange}
        />
        <div className="mx-auto max-w-[1320px] 2xl:max-w-[1480px] px-4 py-6 sm:px-6 sm:py-7 lg:px-8 lg:py-8">
          <RunsSkeleton />
        </div>
      </>
    );
  }

  return (
    <>
      <Topbar
        title="Runs"
        subtitle="Real-time agent activity"
        lastUpdated={lastUpdated}
        onRefresh={refreshRuns}
        showDateRange
        dateRangeValue={dateRange}
        onDateRangeChange={setDateRange}
      />
      <div className="mx-auto max-w-[1320px] 2xl:max-w-[1480px] px-4 py-6 sm:px-6 sm:py-7 lg:px-8 lg:py-8">
        {runsError && (
          <div className="mb-6">
            <ErrorBanner
              message={runsError}
              onDismiss={() => dismissRunsError()}
              onRetry={refreshRuns}
            />
          </div>
        )}

        {/* Eyebrow + page title */}
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
            Agent activity · {rangeLabel}
          </motion.p>
          <motion.h1
            variants={fadeUp}
            className="text-[26px] font-semibold leading-[1.1] tracking-[-0.03em] text-[var(--neutral-strong-950)]"
          >
            Every action your agents took
          </motion.h1>
          <motion.p
            variants={fadeUp}
            className="mt-2 text-[13.5px] text-[var(--neutral-sub-600)]"
          >
            {metrics.total.toLocaleString()} {metrics.total === 1 ? 'decision' : 'decisions'} evaluated in the selected range · auto-refresh every 30s
          </motion.p>
        </motion.header>

        {/* Metric strip — single card, 5 divided cells (matches Dashboard stat strip) */}
        <motion.section
          className="mb-6 overflow-hidden rounded-[12px] border border-[var(--stroke-soft-200)] bg-white shadow-[0_1px_2px_rgba(23,23,23,0.04)]"
          initial={reduce ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: DUR.slow, ease: EASE.out, delay: 0.16 }}
        >
          <motion.div
            className="grid grid-cols-2 divide-y divide-[var(--stroke-soft-200)] sm:grid-cols-3 sm:divide-y-0 lg:grid-cols-5 lg:divide-x lg:divide-y-0"
            variants={staggerContainer(0.04, 0.28)}
            initial={reduce ? false : 'hidden'}
            animate="show"
          >
            <MetricStripCell label="Total Runs" value={metrics.total} />
            <MetricStripCell label="Allowed"    value={metrics.allows}    dot="var(--success)" />
            <MetricStripCell label="Denied"     value={metrics.denies}    dot="var(--error)" />
            <MetricStripCell label="Rewritten"  value={metrics.rewrites}  dot="var(--feature)" />
            <MetricStripCell label="Approvals"  value={metrics.approvals} dot="var(--primary-base)" />
          </motion.div>
        </motion.section>

        {runs.length === 0 ? (
          <div className="rounded-[12px] border border-[var(--stroke-soft-200)] bg-white shadow-[0_1px_2px_rgba(23,23,23,0.04)]">
            <EmptyState
              icon={<Activity className="h-5 w-5" />}
              title="No agent actions yet"
              description="Connect your agent to start monitoring actions."
              action={
                <Link href="/onboarding">
                  <Button variant="primary">Set up agent</Button>
                </Link>
              }
            />
          </div>
        ) : (
          <div className="space-y-3">
            {/* Filters */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="min-w-[220px] flex-1 sm:min-w-[260px]">
                <Input
                  type="text"
                  placeholder="Search by agent, tool, connector, target, summary…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  leadingIcon={<Search className="h-3.5 w-3.5" strokeWidth={2} />}
                />
              </div>
              <SelectMenu
                value={connectorFilter}
                onChange={setConnectorFilter}
                ariaLabel="Filter by connector"
                minWidth={190}
                align="end"
                options={[
                  { value: 'all', label: 'All connectors', leading: <Swatch color="var(--neutral-soft-400)" /> },
                  ...RUN_CONNECTOR_FILTERS.map((id) => ({
                    value: id,
                    label: CONNECTORS[id].name,
                    leading: <ConnectorMark id={id} size="xs" className="cursor-default" />,
                  })),
                ]}
              />
              <SelectMenu
                value={decisionFilter}
                onChange={setDecisionFilter}
                ariaLabel="Filter by decision"
                minWidth={180}
                align="end"
                options={[
                  { value: 'all',      label: 'All decisions', leading: <Swatch color="var(--neutral-soft-400)" /> },
                  { value: 'ALLOW',    label: 'Allow',         leading: <Swatch color="var(--success)" /> },
                  { value: 'DENY',     label: 'Deny',          leading: <Swatch color="var(--error)" /> },
                  { value: 'REWRITE',  label: 'Rewrite',       leading: <Swatch color="var(--feature)" /> },
                  { value: 'approval', label: 'Approval',      leading: <Swatch color="var(--warning)" /> },
                ]}
              />
            </div>

            {/* Table — wide (9 data columns), so horizontal scroll stays
                on at every breakpoint. Trades the page-level sticky thead
                for a wrapper-level one — acceptable since this page is
                table-first and the user is rarely scrolled far past the
                header anyway. */}
            <Table scrollX>
              <THead>
                <tr>
                  <TH sortable sortDirection={dirFor('agent')} onSort={() => onSort('agent')}>Agent</TH>
                  <TH sortable sortDirection={dirFor('tool')} onSort={() => onSort('tool')}>Tool</TH>
                  <TH sortable sortDirection={dirFor('connector')} onSort={() => onSort('connector')}>Connector</TH>
                  <TH sortable sortDirection={dirFor('target')} onSort={() => onSort('target')}>Target</TH>
                  <TH sortable sortDirection={dirFor('policy')} onSort={() => onSort('policy')}>Policy</TH>
                  <TH sortable sortDirection={dirFor('risk')} onSort={() => onSort('risk')}>Blast Radius</TH>
                  <TH sortable sortDirection={dirFor('decision')} onSort={() => onSort('decision')}>Decision</TH>
                  <TH sortable sortDirection={dirFor('time')} onSort={() => onSort('time')} className="text-right">Time</TH>
                  <TH aria-label="Expand" className="w-8" />
                </tr>
              </THead>
              <TBody>
                {sortedRuns.map((run) => (
                  <RunRow
                    key={run.id}
                    run={run}
                    isExpanded={expandedRow === run.id}
                    onToggle={() =>
                      setExpandedRow(expandedRow === run.id ? null : run.id)
                    }
                  />
                ))}
              </TBody>
            </Table>
            {filteredRuns.length === 0 && search && (
              <div className="rounded-[12px] border border-[var(--stroke-soft-200)] bg-white py-10 text-center text-[13px] text-[var(--neutral-soft-400)]">
                No runs match your search.
              </div>
            )}

            {hasMoreRuns && (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-[12px] border border-[var(--stroke-soft-200)] bg-white px-4 py-3 shadow-[0_1px_2px_rgba(23,23,23,0.04)]">
                <p className="text-xs text-[var(--neutral-soft-400)]">
                  Showing{' '}
                  <span className="font-medium text-[var(--neutral-strong-950)]">
                    {runs.length.toLocaleString()}
                  </span>{' '}
                  of{' '}
                  <span className="font-medium text-[var(--neutral-strong-950)]">
                    {metrics.total.toLocaleString()}
                  </span>{' '}
                  actions loaded.
                </p>

                <Button
                  variant="secondary"
                  size="sm"
                  disabled={runsLoadingMore}
                  onClick={() => void loadMoreRuns()}
                >
                  {runsLoadingMore ? 'Loading…' : 'Load more'}
                </Button>
              </div>
            )}
            </div>
        )}
      </div>
    </>
  );
}

function RunRow({
  run,
  isExpanded,
  onToggle,
}: {
  run: SessionAction;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  // Delayed visual-expanded state — keeps the trigger row in its expanded
  // visual treatment (gradient, no row-divider) until the panel below
  // has finished its exit animation. Prevents the trigger row from
  // "snapping back" with a 1px border re-appearing while the panel is
  // still collapsing — which the user perceived as a layout shift.
  const [stillExpanded, setStillExpanded] = useState(isExpanded);
  useEffect(() => {
    if (isExpanded) setStillExpanded(true);
    // collapse → false happens via AnimatePresence onExitComplete below
  }, [isExpanded]);

  const prUrl = extractPullRequestUrl({
    action_pointers: run.action_pointers,
    result: run.result,
    arguments: run.arguments,
  });

  return (
    <>
      <TR clickable isExpanded={stillExpanded} onClick={onToggle}>
        <TD className="max-w-[220px]">
          <div className="flex items-center gap-2.5">
            <span
              className="inline-block h-1.5 w-1.5 shrink-0 rounded-full"
              style={{ backgroundColor: decisionColor(run.decision) }}
              aria-hidden
            />
            <AgentMark name={run.agent_name || ''} size="xs" />
            <span className="truncate text-[13.5px] font-semibold text-[var(--neutral-strong-950)]">
              {run.agent_name || 'Unknown'}
            </span>
          </div>
        </TD>
        <TD>
          <CodeChip>{run.tool_name}</CodeChip>
        </TD>
        <TD className="whitespace-nowrap">
          {(() => {
            const connectorId = connectorForTool(run.tool_name);
            return (
              <div
                className="flex items-center gap-2"
                title={`${CONNECTORS[connectorId].name} connector`}
              >
                <ConnectorMark id={connectorId} size="xs" className="cursor-default" />
                <span className="text-[12.5px] text-[var(--neutral-sub-600)]">
                  {CONNECTORS[connectorId].name}
                </span>
              </div>
            );
          })()}
        </TD>
        <TD className="max-w-[260px]">
          {(() => {
            const tgt = deriveTarget(run);
            if (!tgt.primary && !tgt.secondary) return null;
            return (
              <div className="flex min-w-0 items-center gap-2">
                {tgt.primary && (
                  <span
                    className="truncate text-[12.5px] text-[var(--neutral-sub-600)]"
                    title={tgt.primary}
                  >
                    {tgt.primary}
                  </span>
                )}
                {tgt.secondary && <CodeChip>{tgt.secondary}</CodeChip>}
              </div>
            );
          })()}
        </TD>
        <TD className="whitespace-nowrap">
          <PolicyChip policy={run.policy} />
        </TD>
        <TD className="whitespace-nowrap">
          <BlastRadiusChip value={readBlastRadius(run)} />
        </TD>
        <TD className="whitespace-nowrap">
          <div className="flex flex-col items-start gap-1">
            <DecisionBadge decision={run.decision} />
            {prUrl && <PullRequestLink url={prUrl} variant="chip" />}
          </div>
        </TD>
        <TD className="whitespace-nowrap text-right tabular-nums">
          <div className="flex flex-col items-end gap-1">
            <RelativeTime
              timestamp={run.timestamp}
              className="whitespace-nowrap text-[12px] text-[var(--neutral-soft-400)]"
            />
            {(() => {
              const exec = formatExecutionTimeMs(run.execution_time);
              return exec ? <CodeChip>{exec}</CodeChip> : null;
            })()}
          </div>
        </TD>
        <TD className="w-8 text-right">
          <ChevronRight
            className={`ml-auto h-3.5 w-3.5 text-[var(--neutral-soft-400)] transition-transform duration-150 group-hover:translate-x-0.5 group-hover:text-[var(--neutral-strong-950)] ${
              isExpanded ? 'rotate-90' : ''
            }`}
            strokeWidth={2}
          />
        </TD>
      </TR>
      <AnimatePresence
        initial={false}
        onExitComplete={() => setStillExpanded(false)}
      >
      {isExpanded && (
        <TRExpanded key="expanded" colSpan={9}>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <div>
              <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.05em] text-[var(--neutral-soft-400)]">
                Full Summary
              </p>
              {run.action_summary ? (
                <p className="text-[13px] text-[var(--neutral-strong-950)]">
                  {run.action_summary}
                </p>
              ) : (
                <p className="text-[13px] italic text-[var(--neutral-soft-400)]">
                  No summary provided
                </p>
              )}
              {/* Policy + Blast Radius are already shown as separate
                  columns in the row — no need to repeat them inside the
                  expanded panel. Keeps the inspector focused on details
                  not visible at the row level. */}
            </div>
            <div className="grid grid-cols-2 gap-3 text-[12px] md:grid-cols-4">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.05em] text-[var(--neutral-soft-400)]">
                  Sequence
                </p>
                <p className="mt-0.5 text-[var(--neutral-strong-950)]">
                  #{run.sequence_order}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.05em] text-[var(--neutral-soft-400)]">
                  Session
                </p>
                <Link
                  href={`/dashboard/sessions?id=${run.session_id}`}
                  className="mt-0.5 block text-[var(--primary-base)] hover:underline [font-family:var(--font-geist-mono),ui-monospace,monospace]"
                  onClick={(e) => e.stopPropagation()}
                >
                  {run.session_id?.substring(0, 8)}…
                </Link>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.05em] text-[var(--neutral-soft-400)]">
                  Timestamp
                </p>
                <p className="mt-0.5 text-[var(--neutral-strong-950)]">
                  {formatFullTimestamp(run.timestamp)}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.05em] text-[var(--neutral-soft-400)]">
                  Execution
                </p>
                <p className="mt-0.5 text-[var(--neutral-strong-950)]">
                  {formatExecutionTimeMs(run.execution_time)}
                </p>
              </div>
            </div>
          </div>
          {run.arguments && (
            <div className="mt-4">
              <JsonViewer data={run.arguments} collapsed={false} label="Arguments" />
            </div>
          )}
        </TRExpanded>
      )}
      </AnimatePresence>
    </>
  );
}

// ── Decision color swatch for the SelectMenu options ───────────────────────
function Swatch({ color }: { color: string }) {
  return (
    <span
      className="inline-block h-2 w-2 shrink-0 rounded-full"
      style={{ backgroundColor: color }}
      aria-hidden
    />
  );
}

// ── Metric strip cell — divided cells inside one card (no gaps) ─────────────
function MetricStripCell({
  label,
  value,
  dot,
}: {
  label: string;
  value: number;
  dot?: string;
}) {
  return (
    <motion.div variants={fadeUp} className="px-6 py-4">
      <div className="flex items-center gap-2">
        {dot && (
          <span
            className="inline-block h-[7px] w-[7px] shrink-0 rounded-full"
            style={{ backgroundColor: dot }}
            aria-hidden
          />
        )}
        <p className="text-[10.5px] font-semibold uppercase tracking-[0.07em] text-[var(--neutral-soft-400)]">
          {label}
        </p>
      </div>
      <p className="mt-1.5 text-[26px] font-semibold leading-none tracking-[-0.04em] tabular-nums text-[var(--neutral-strong-950)]">
        {value.toLocaleString()}
      </p>
    </motion.div>
  );
}
