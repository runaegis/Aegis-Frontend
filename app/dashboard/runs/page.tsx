'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Activity, ChevronRight, Search, X } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import Topbar from '@/components/layout/Topbar';
import { AgentMark } from '@/components/ui/AgentMark';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { CodeChip } from '@/components/ui/CodeChip';
import { CONNECTORS, ConnectorMark } from '@/components/ui/ConnectorMark';
import { decisionColor } from '@/components/ui/DecisionBadge';
import EmptyState from '@/components/ui/EmptyState';
import ErrorBanner from '@/components/ui/ErrorBanner';
import { FilterChip } from '@/components/ui/FilterChip';
import { Input } from '@/components/ui/Input';
import JsonViewer from '@/components/ui/JsonViewer';
import { RunsSkeleton } from '@/components/ui/PageSkeletons';
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
import { api } from '@/lib/api';
import {
  formatDashboardDateRangeLabel,
  getActionDateFilters,
  matchesActionDateFilters,
} from '@/lib/dashboardDateRange';
import { useDashboardData } from '@/lib/dashboardDataContext';
import { useUser } from '@/lib/hooks';
import { DUR, EASE, fadeUp, staggerContainer } from '@/lib/motion';
import { buildRunActivityFilterOptions, buildRunActivityViewModel, filterRunActivity, summarizeRunActivity, type RunActivityViewModel } from '@/lib/runActivity';
import { formatExecutionTimeMs, formatFullTimestamp, readBlastRadius } from '@/lib/utils';
import type { Metrics, PaginatedResponse, SessionAction } from '@/lib/types';

const PAGE_SIZE = 20;
const EMPTY_PAGE: PaginatedResponse<SessionAction> = {
  items: [],
  total: 0,
  page: 1,
  page_size: PAGE_SIZE,
  pages: 0,
};
const EMPTY_METRICS: Metrics = {
  total: 0,
  allows: 0,
  denies: 0,
  rewrites: 0,
  approvals: 0,
};

type SortKey =
  | 'agent'
  | 'tool'
  | 'connector'
  | 'target'
  | 'policy'
  | 'risk'
  | 'decision'
  | 'time';

function compareText(left: string, right: string): number {
  return left.localeCompare(right, undefined, { sensitivity: 'base' });
}

export default function RunsPage() {
  const { user, isLoading: userLoading } = useUser();
  const { dateRange, setDateRange } = useDashboardData();
  const reduceMotion = useReducedMotion();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const scopedSessionId = searchParams.get('session')?.trim() || null;

  const [runs, setRuns] = useState<SessionAction[]>([]);
  const [pageMeta, setPageMeta] = useState<PaginatedResponse<SessionAction>>(EMPTY_PAGE);
  const [rangeMetrics, setRangeMetrics] = useState<Metrics>(EMPTY_METRICS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | undefined>(undefined);
  const [page, setPage] = useState(1);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [agentFilter, setAgentFilter] = useState<string[]>([]);
  const [decisionFilter, setDecisionFilter] = useState<string[]>([]);
  const [connectorFilter, setConnectorFilter] = useState<string[]>([]);
  const [targetFilter, setTargetFilter] = useState<string[]>([]);
  const [toolFilter, setToolFilter] = useState<string[]>([]);

  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<SortDirection>(null);

  const dateFilters = useMemo(() => getActionDateFilters(dateRange), [dateRange]);
  const rangeLabel = useMemo(
    () => formatDashboardDateRangeLabel(dateRange, 'All time'),
    [dateRange],
  );

  const fetchData = useCallback(
    async (options?: { soft?: boolean }) => {
      if (!user?.id) {
        if (!userLoading) {
          setRuns([]);
          setPageMeta(EMPTY_PAGE);
          setRangeMetrics(EMPTY_METRICS);
          setLoading(false);
        }
        return;
      }

      if (!options?.soft) {
        setLoading(true);
      }

      try {
        if (scopedSessionId) {
          const sessionActions = (await api.getSessionActions(scopedSessionId))
            .filter((action) => matchesActionDateFilters(action.timestamp, dateFilters))
            .sort(
              (left, right) =>
                new Date(right.timestamp).getTime() - new Date(left.timestamp).getTime(),
            );

          const scopedMetrics = summarizeRunActivity(
            sessionActions.map((action) => buildRunActivityViewModel(action)),
          );

          setRuns(sessionActions);
          setPageMeta({
            items: sessionActions,
            total: sessionActions.length,
            page: 1,
            page_size: PAGE_SIZE,
            pages: sessionActions.length > 0 ? 1 : 0,
          });
          setRangeMetrics(scopedMetrics);
        } else {
          const [pagedRuns, metrics] = await Promise.all([
            api.getSessionActionsPage(user.id, page, PAGE_SIZE, dateFilters),
            api.getMetrics(user.id, dateFilters),
          ]);

          setRuns(Array.isArray(pagedRuns.items) ? pagedRuns.items : []);
          setPageMeta(pagedRuns);
          setRangeMetrics(metrics);
        }
        setLastUpdated(new Date());
        setError(null);
      } catch (fetchError) {
        setError(fetchError instanceof Error ? fetchError.message : 'Failed to load runs.');
      } finally {
        if (!options?.soft) {
          setLoading(false);
        }
      }
    },
    [dateFilters, page, scopedSessionId, user?.id, userLoading],
  );

  useEffect(() => {
    if (user?.id) {
      void fetchData();
      return;
    }
    if (!userLoading) {
      setRuns([]);
      setPageMeta(EMPTY_PAGE);
      setRangeMetrics(EMPTY_METRICS);
      setLoading(false);
    }
  }, [fetchData, page, scopedSessionId, user?.id, userLoading]);

  useEffect(() => {
    if (!user?.id) return;
    const interval = window.setInterval(() => {
      void fetchData({ soft: true });
    }, 30000);
    return () => window.clearInterval(interval);
  }, [fetchData, user?.id]);

  const runItems = useMemo(
    () => runs.map((run) => buildRunActivityViewModel(run)),
    [runs],
  );

  const filterOptions = useMemo(
    () => buildRunActivityFilterOptions(runItems),
    [runItems],
  );

  const filteredItems = useMemo(
    () =>
      filterRunActivity(runItems, {
        searchQuery,
        agentFilter,
        decisionFilter,
        connectorFilter,
        targetFilter,
        toolFilter,
        scopedSessionId,
      }),
    [
      agentFilter,
      connectorFilter,
      decisionFilter,
      runItems,
      scopedSessionId,
      searchQuery,
      targetFilter,
      toolFilter,
    ],
  );

  const filteredMetrics = useMemo(
    () => summarizeRunActivity(filteredItems),
    [filteredItems],
  );

  const totalMetrics = useMemo(
    () => rangeMetrics,
    [rangeMetrics],
  );

  const onSort = useCallback(
    (key: SortKey) => {
      if (sortKey !== key) {
        setSortKey(key);
        setSortDir('asc');
        return;
      }

      if (sortDir === 'asc') {
        setSortDir('desc');
        return;
      }

      setSortKey(null);
      setSortDir(null);
    },
    [sortDir, sortKey],
  );

  const sortedItems = useMemo(() => {
    if (!sortKey || sortDir === null) {
      return filteredItems;
    }

    const sorted = [...filteredItems];
    sorted.sort((left, right) => {
      switch (sortKey) {
        case 'agent':
          return compareByDirection(
            left.action.agent_name || '',
            right.action.agent_name || '',
            sortDir,
          );
        case 'tool':
          return compareByDirection(left.toolLabel, right.toolLabel, sortDir);
        case 'connector':
          return compareByDirection(
            CONNECTORS[left.connectorId].name,
            CONNECTORS[right.connectorId].name,
            sortDir,
          );
        case 'target':
          return compareByDirection(
            left.target.primary || '',
            right.target.primary || '',
            sortDir,
          );
        case 'policy':
          return compareByDirection(
            String(left.action.policy || ''),
            String(right.action.policy || ''),
            sortDir,
          );
        case 'risk':
          return compareByDirection(
            blastRadiusSortValue(left.action),
            blastRadiusSortValue(right.action),
            sortDir,
          );
        case 'decision':
          return compareByDirection(left.decision, right.decision, sortDir);
        case 'time':
          return compareByDirection(
            new Date(left.action.timestamp).getTime(),
            new Date(right.action.timestamp).getTime(),
            sortDir,
          );
      }
    });

    return sorted;
  }, [filteredItems, sortDir, sortKey]);

  const safePage = scopedSessionId ? 1 : Math.max(1, pageMeta.page || 1);
  const totalPages = scopedSessionId ? (pageMeta.total > 0 ? 1 : 0) : pageMeta.pages;
  const visibleItems = sortedItems;

  const hasActiveFilters =
    agentFilter.length > 0 ||
    decisionFilter.length > 0 ||
    connectorFilter.length > 0 ||
    targetFilter.length > 0 ||
    toolFilter.length > 0 ||
    searchQuery.trim().length > 0 ||
    Boolean(scopedSessionId);

  useEffect(() => {
    setExpandedRow(null);
  }, [
    agentFilter,
    decisionFilter,
    searchQuery,
    connectorFilter,
    targetFilter,
    toolFilter,
  ]);

  useEffect(() => {
    setPage(1);
    setExpandedRow(null);
  }, [dateRange, scopedSessionId]);

  const clearSessionScope = useCallback(() => {
    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.delete('session');
    const nextUrl = nextParams.toString() ? `${pathname}?${nextParams.toString()}` : pathname;
    router.replace(nextUrl, { scroll: false });
  }, [pathname, router, searchParams]);

  const clearAllFilters = useCallback(() => {
    setSearchQuery('');
    setAgentFilter([]);
    setDecisionFilter([]);
    setConnectorFilter([]);
    setTargetFilter([]);
    setToolFilter([]);
    setSortKey(null);
    setSortDir(null);
    if (scopedSessionId) {
      clearSessionScope();
    }
  }, [clearSessionScope, scopedSessionId]);

  const dirFor = useCallback(
    (key: SortKey): SortDirection => (sortKey === key ? sortDir : null),
    [sortDir, sortKey],
  );

  if (userLoading || (loading && runs.length === 0)) {
    return (
      <>
        <Topbar
          title="Runs"
          subtitle="Cross-connector agent activity"
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
        subtitle="Cross-connector agent activity"
        lastUpdated={lastUpdated}
        onRefresh={() => void fetchData()}
        showDateRange
        dateRangeValue={dateRange}
        onDateRangeChange={setDateRange}
      />
      <div className="mx-auto max-w-[1320px] 2xl:max-w-[1480px] px-4 py-6 sm:px-6 sm:py-7 lg:px-8 lg:py-8">
        {error ? (
          <div className="mb-6">
            <ErrorBanner
              message={error}
              onDismiss={() => setError(null)}
              onRetry={() => void fetchData()}
            />
          </div>
        ) : null}

        <motion.header
          className="mb-6"
          variants={staggerContainer(0.05, 0.04)}
          initial={reduceMotion ? false : 'hidden'}
          animate="show"
        >
          <motion.div variants={fadeUp} className="mb-3 flex flex-wrap items-center gap-2">
            <Badge tone="info" leadingDot>
              Agent activity
            </Badge>
            <Badge tone="neutral">{rangeLabel}</Badge>
            {scopedSessionId ? (
              <Badge tone="feature">Scoped session</Badge>
            ) : null}
          </motion.div>
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
            {filteredMetrics.total.toLocaleString()} visible runs on this page
            {hasActiveFilters
              ? ` of ${totalMetrics.total.toLocaleString()} in ${scopedSessionId ? 'this session scope' : 'the selected range'}.`
              : ` of ${totalMetrics.total.toLocaleString()} in ${scopedSessionId ? 'this session scope' : 'the selected range'}.`}
          </motion.p>
          {scopedSessionId ? (
            <motion.div variants={fadeUp} className="mt-3 flex flex-wrap items-center gap-2">
              <CodeChip>{scopedSessionId}</CodeChip>
              <button
                type="button"
                onClick={clearSessionScope}
                className="text-[12px] font-medium text-[var(--neutral-sub-600)] underline decoration-[var(--stroke-sub-300)] underline-offset-2 transition-colors hover:text-[var(--neutral-strong-950)]"
              >
                Clear session scope
              </button>
            </motion.div>
          ) : null}
        </motion.header>

        <motion.section
          className="mb-6 overflow-hidden rounded-[12px] border border-[var(--stroke-soft-200)] bg-white shadow-[0_1px_2px_rgba(23,23,23,0.04)]"
          initial={reduceMotion ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: DUR.slow, ease: EASE.out, delay: 0.12 }}
        >
          <div className="grid grid-cols-2 divide-y divide-[var(--stroke-soft-200)] sm:grid-cols-3 sm:divide-y-0 lg:grid-cols-5 lg:divide-x lg:divide-y-0">
            <MetricStripCell label="Visible runs" value={filteredMetrics.total} />
            <MetricStripCell label="Allow" value={filteredMetrics.allows} dot="var(--success)" />
            <MetricStripCell label="Deny" value={filteredMetrics.denies} dot="var(--error)" />
            <MetricStripCell label="Rewrite" value={filteredMetrics.rewrites} dot="var(--feature)" />
            <MetricStripCell label="Approval" value={filteredMetrics.approvals} dot="var(--warning)" />
          </div>
        </motion.section>

        {runs.length === 0 ? (
          <div className="rounded-[12px] border border-[var(--stroke-soft-200)] bg-white shadow-[0_1px_2px_rgba(23,23,23,0.04)]">
            <EmptyState
              icon={<Activity className="h-5 w-5" />}
              title="No agent actions yet"
              description="Connect your agent to start monitoring governed actions."
              action={
                <Link href="/onboarding">
                  <Button variant="primary">Set up agent</Button>
                </Link>
              }
            />
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="rounded-[12px] border border-[var(--stroke-soft-200)] bg-white shadow-[0_1px_2px_rgba(23,23,23,0.04)]">
            <EmptyState
              icon={<Activity className="h-5 w-5" />}
              title="No runs match the current filters"
              description="Adjust or clear the current search and filters to inspect other actions in this range."
              action={
                <Button variant="secondary" onClick={clearAllFilters}>
                  Clear filters
                </Button>
              }
            />
          </div>
        ) : (
          <>
            <motion.div
              className="mb-3 rounded-[12px] border border-[var(--stroke-soft-200)] bg-white p-3 shadow-[0_1px_2px_rgba(23,23,23,0.04)]"
              initial={reduceMotion ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: DUR.slow, ease: EASE.out, delay: 0.16 }}
            >
              <div className="flex flex-wrap items-center gap-2">
                <div className="min-w-[240px] flex-1">
                  <Input
                    type="text"
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder="Search agent, tool, connector, target, policy, or session"
                    leadingIcon={<Search className="h-3.5 w-3.5" strokeWidth={2} />}
                    trailingIcon={
                      searchQuery ? (
                        <button
                          type="button"
                          onClick={() => setSearchQuery('')}
                          aria-label="Clear search"
                          className="rounded p-0.5 text-[var(--neutral-soft-400)] transition-colors hover:text-[var(--neutral-strong-950)]"
                        >
                          <X className="h-3.5 w-3.5" strokeWidth={2.25} />
                        </button>
                      ) : undefined
                    }
                  />
                </div>
                <FilterChip
                  label="Agent"
                  options={filterOptions.agents}
                  value={agentFilter}
                  onChange={setAgentFilter}
                />
                <FilterChip
                  label="Decision"
                  options={filterOptions.decisions.map((option) => ({
                    value: option.value,
                    label: option.label,
                    icon: <DecisionOptionDot decision={option.value} />,
                  }))}
                  value={decisionFilter}
                  onChange={setDecisionFilter}
                />
                <FilterChip
                  label="Connector"
                  options={filterOptions.connectors.map((option) => ({
                    value: option.value,
                    label: CONNECTORS[option.value as keyof typeof CONNECTORS].name,
                    icon: (
                      <ConnectorMark
                        id={option.value as keyof typeof CONNECTORS}
                        size="xs"
                        className="cursor-default"
                      />
                    ),
                  }))}
                  value={connectorFilter}
                  onChange={setConnectorFilter}
                />
                <FilterChip
                  label="Target"
                  options={filterOptions.targets}
                  value={targetFilter}
                  onChange={setTargetFilter}
                />
                <FilterChip
                  label="Tool"
                  options={filterOptions.tools}
                  value={toolFilter}
                  onChange={setToolFilter}
                />
                {hasActiveFilters ? (
                  <button
                    type="button"
                    onClick={clearAllFilters}
                    className="inline-flex h-7 items-center gap-1 rounded-[8px] px-2 text-[11.5px] font-medium text-[var(--neutral-sub-600)] transition-colors hover:bg-[var(--neutral-weak-50)] hover:text-[var(--neutral-strong-950)]"
                  >
                    <X className="h-3 w-3" strokeWidth={2.25} aria-hidden />
                    Clear filters
                  </button>
                ) : null}
              </div>
              {!scopedSessionId ? (
                <p className="mt-2 text-[11.5px] text-[var(--neutral-soft-400)]">
                  Search and facet filters apply to the loaded page. Use pagination to inspect older activity.
                </p>
              ) : null}
            </motion.div>

            <motion.div
              initial={reduceMotion ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: DUR.slow, ease: EASE.out, delay: 0.2 }}
            >
              <Table scrollX>
                <THead>
                  <tr>
                    <TH sortable sortDirection={dirFor('agent')} onSort={() => onSort('agent')}>
                      Agent
                    </TH>
                    <TH sortable sortDirection={dirFor('tool')} onSort={() => onSort('tool')}>
                      Tool
                    </TH>
                    <TH sortable sortDirection={dirFor('connector')} onSort={() => onSort('connector')}>
                      Connector
                    </TH>
                    <TH sortable sortDirection={dirFor('target')} onSort={() => onSort('target')}>
                      Target
                    </TH>
                    <TH aria-label="Expand" className="w-8" />
                  </tr>
                </THead>
                <TBody>
                  {visibleItems.map((item) => (
                    <RunRow
                      key={item.action.id}
                      item={item}
                      isExpanded={expandedRow === item.action.id}
                      onToggle={() =>
                        setExpandedRow(expandedRow === item.action.id ? null : item.action.id)
                      }
                    />
                  ))}
                </TBody>
              </Table>

              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-[12px] border border-[var(--stroke-soft-200)] bg-white px-4 py-3 shadow-[0_1px_2px_rgba(23,23,23,0.04)]">
                <p className="text-xs text-[var(--neutral-soft-400)]">
                  Showing{' '}
                  <span className="font-medium text-[var(--neutral-strong-950)]">
                    {sortedItems.length.toLocaleString()}
                  </span>{' '}
                  matching runs on this page
                  {!scopedSessionId ? (
                    <>
                      {' '}
                      of{' '}
                      <span className="font-medium text-[var(--neutral-strong-950)]">
                        {pageMeta.total.toLocaleString()}
                      </span>{' '}
                      in the selected range
                    </>
                  ) : null}
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={Boolean(scopedSessionId) || safePage <= 1}
                    onClick={() => setPage((current) => Math.max(1, current - 1))}
                  >
                    Previous
                  </Button>
                  <span className="text-[12px] text-[var(--neutral-soft-400)]">
                    Page {safePage} of {Math.max(totalPages, 1)}
                  </span>
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={Boolean(scopedSessionId) || totalPages <= 1 || safePage >= totalPages}
                    onClick={() =>
                      setPage((current) => Math.min(Math.max(totalPages, 1), current + 1))
                    }
                  >
                    Next
                  </Button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </div>
    </>
  );
}

function RunRow({
  item,
  isExpanded,
  onToggle,
}: {
  item: RunActivityViewModel;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const action = item.action;

  return (
    <>
      <TR clickable isExpanded={isExpanded} onClick={onToggle}>
        <TD className="max-w-[220px]">
          <div className="flex items-center gap-2.5">
            <span
              className="inline-block h-1.5 w-1.5 shrink-0 rounded-full"
              style={{ backgroundColor: decisionColor(action.decision) }}
              aria-hidden
            />
            <AgentMark name={action.agent_name || ''} size="xs" />
            <span className="truncate text-[13.5px] font-semibold text-[var(--neutral-strong-950)]">
              {action.agent_name || 'Unknown'}
            </span>
          </div>
        </TD>
        <TD>
          <CodeChip title={action.tool_name || ''}>{item.toolLabel}</CodeChip>
        </TD>
        <TD className="whitespace-nowrap">
          <div
            className="flex items-center gap-2"
            title={`${CONNECTORS[item.connectorId].name} connector`}
          >
            <ConnectorMark id={item.connectorId} size="xs" className="cursor-default" />
            <span className="text-[12.5px] text-[var(--neutral-sub-600)]">
              {CONNECTORS[item.connectorId].name}
            </span>
          </div>
        </TD>
        <TD className="max-w-[260px]">
          {item.target.primary ? (
            <div className="flex min-w-0 items-center gap-2" title={item.target.kind}>
              <span className="truncate text-[12.5px] text-[var(--neutral-sub-600)]">
                {item.target.primary}
              </span>
              {item.target.secondary ? <CodeChip>{item.target.secondary}</CodeChip> : null}
            </div>
          ) : (
            <span className="text-[12px] italic text-[var(--neutral-soft-400)]">No target</span>
          )}
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
      <AnimatePresence initial={false}>
        {isExpanded ? (
          <TRExpanded key="expanded" colSpan={5}>
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(320px,0.9fr)]">
              <div>
                <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.05em] text-[var(--neutral-soft-400)]">
                  Full summary
                </p>
                <p className="text-[13px] leading-[1.6] text-[var(--neutral-strong-950)]">
                  {action.action_summary || 'No summary provided'}
                </p>
                {action.arguments ? (
                  <div className="mt-4">
                    <JsonViewer data={action.arguments} collapsed={false} label="Arguments" />
                  </div>
                ) : null}
              </div>

              <div className="grid grid-cols-2 gap-3 text-[12px] md:grid-cols-3">
                <MetaCell label="Connector" value={CONNECTORS[item.connectorId].name} />
                <MetaCell label="Target kind" value={item.target.kind} />
                <MetaCell label="Session" value={action.session_id || 'Unavailable'} mono />
                <MetaCell label="Timestamp" value={formatFullTimestamp(action.timestamp)} />
                <MetaCell
                  label="Execution"
                  value={formatExecutionTimeMs(action.execution_time) || 'Unavailable'}
                />
                <MetaCell label="Policy" value={String(action.policy || 'Unavailable')} mono />
              </div>
            </div>
          </TRExpanded>
        ) : null}
      </AnimatePresence>
    </>
  );
}

function DecisionOptionDot({ decision }: { decision: string }) {
  return (
    <span
      className="inline-block h-2 w-2 shrink-0 rounded-full"
      style={{ backgroundColor: decisionColor(decision) }}
      aria-hidden
    />
  );
}

function MetaCell({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-[0.05em] text-[var(--neutral-soft-400)]">
        {label}
      </p>
      <p
        className={
          mono
            ? 'mt-0.5 break-all text-[var(--neutral-strong-950)] [font-family:var(--font-geist-mono),ui-monospace,monospace]'
            : 'mt-0.5 text-[var(--neutral-strong-950)]'
        }
      >
        {value}
      </p>
    </div>
  );
}

function compareByDirection(left: string | number, right: string | number, direction: SortDirection): number {
  const comparison =
    typeof left === 'number' && typeof right === 'number'
      ? left - right
      : compareText(String(left), String(right));

  return direction === 'asc' ? comparison : -comparison;
}

function blastRadiusSortValue(action: SessionAction): number {
  const value = (readBlastRadius(action) || '').toLowerCase();
  if (value === 'low') return 1;
  if (value === 'medium') return 2;
  if (value === 'high') return 3;
  if (value === 'critical') return 4;
  return 0;
}

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
    <div className="px-6 py-4">
      <div className="flex items-center gap-2">
        {dot ? (
          <span
            className="inline-block h-[7px] w-[7px] shrink-0 rounded-full"
            style={{ backgroundColor: dot }}
            aria-hidden
          />
        ) : null}
        <p className="text-[10.5px] font-semibold uppercase tracking-[0.07em] text-[var(--neutral-soft-400)]">
          {label}
        </p>
      </div>
      <p className="mt-1.5 text-[26px] font-semibold leading-none tracking-[-0.04em] tabular-nums text-[var(--neutral-strong-950)]">
        {value.toLocaleString()}
      </p>
    </div>
  );
}
