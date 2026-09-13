'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, ChevronRight, Search, X } from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';

import Topbar from '@/components/layout/Topbar';
import { AgentMark } from '@/components/ui/AgentMark';
import { Button } from '@/components/ui/Button';
import { CodeChip } from '@/components/ui/CodeChip';
import { CONNECTORS, ConnectorMark } from '@/components/ui/ConnectorMark';
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
import { api, type RunRecord } from '@/lib/api';
import type { WorkspaceDetail, WorkspaceSummary } from '@/lib/api';
import { DUR, EASE } from '@/lib/motion';
import { formatFullTimestamp } from '@/lib/utils';

const PAGE_SIZE = 20;

const EMPTY_PAGE = {
  items: [] as RunRecord[],
  total: 0,
  limit: PAGE_SIZE,
  offset: 0,
};

type FilterValue = string;

type SortKey =
  | 'tool'
  | 'agent'
  | 'connector'
  | 'result'
  | 'execution'
  | 'tokens'
  | 'time';

type AgentOption = {
  id: string;
  handle: string;
  workspace_id: string;
};

const STATUS_OPTIONS = [
  { value: 'all', label: 'Any' },
  { value: 'queued', label: 'Queued' },
  { value: 'running', label: 'Running' },
  { value: 'completed', label: 'Completed' },
  { value: 'failed', label: 'Failed' },
  { value: 'cancelled', label: 'Cancelled' },
];

function compareText(left: string, right: string): number {
  return left.localeCompare(right, undefined, { sensitivity: 'base' });
}

function formatTokenCount(value: number | null | undefined): string {
  const count = Number(value ?? 0);

  if (!Number.isFinite(count)) {
    return "0";
  }

  if (Math.abs(count) < 1000) {
    return Math.round(count).toLocaleString();
  }

  const thousands = count / 1000;

  return `${thousands.toFixed(1).replace(/\.0$/, "")}K`;
}

function compareByDirection(
  left: string | number,
  right: string | number,
  direction: SortDirection,
): number {
  const comparison =
    typeof left === 'number' && typeof right === 'number'
      ? left - right
      : compareText(String(left), String(right));

  return direction === 'asc' ? comparison : -comparison;
}

function connectorName(connectorKey: string | null | undefined): string {
  const key = String(connectorKey || '').trim().toLowerCase();
  if (!key) return '—';

  const connector = (CONNECTORS as Record<string, { name?: string }>)[key];
  if (connector?.name) return connector.name;

  return key
    .split(/[-_]/g)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function connectorId(
  connectorKey: string | null | undefined,
): keyof typeof CONNECTORS | null {
  const key = String(connectorKey || '').trim().toLowerCase();
  if (key && key in CONNECTORS) {
    return key as keyof typeof CONNECTORS;
  }
  return null;
}

function formatDuration(ms: number | null | undefined): string {
  if (ms == null || !Number.isFinite(ms)) return '—';
  if (ms < 1000) return `${Math.round(ms)} ms`;

  const seconds = ms / 1000;
  if (seconds < 60) return `${seconds.toFixed(seconds >= 10 ? 1 : 2)} s`;

  const minutes = Math.floor(seconds / 60);
  const remainder = Math.round(seconds % 60);
  return `${minutes}m ${remainder}s`;
}

function numberFromPayload(
  payload: unknown,
  key: string,
): number | null {
  if (!payload || typeof payload !== 'object') return null;
  const value = (payload as Record<string, unknown>)[key];
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function resultText(run: RunRecord): string {
  if (run.result_summary?.trim()) return run.result_summary.trim();

  if (run.error_message?.trim()) return run.error_message.trim();

  if (run.result_payload && typeof run.result_payload === 'object') {
    const payload = run.result_payload as Record<string, unknown>;
    const message =
      typeof payload.message === 'string'
        ? payload.message
        : typeof payload.error === 'string'
          ? payload.error
          : null;

    if (message?.trim()) return message.trim();
  }

  switch (run.status) {
    case 'completed':
      return 'Completed';
    case 'failed':
      return 'Run failed';
    case 'running':
      return 'Running';
    case 'queued':
      return 'Queued';
    case 'cancelled':
      return 'Cancelled by the agent';
    default:
      return 'No result summary';
  }
}

function retryLabel(run: RunRecord): boolean {
  if (!run.result_payload || typeof run.result_payload !== 'object') return false;

  const payload = run.result_payload as Record<string, unknown>;
  return (
    payload.retry === true ||
    payload.retryable === true ||
    payload.is_retry === true
  );
}

function statusLabel(status: string): string {
  switch (status) {
    case 'completed':
      return 'Completed';
    case 'failed':
      return 'Failed';
    case 'running':
      return 'Running';
    case 'queued':
      return 'Queued';
    case 'cancelled':
      return 'Cancelled';
    default:
      return status || 'Unknown';
  }
}

function statusClasses(status: string): {
  dot: string;
  text: string;
  row: string;
  badge: string;
} {
  switch (status) {
    case 'completed':
      return {
        dot: 'bg-[var(--success)]',
        text: 'text-[var(--success)]',
        row: '',
        badge: 'bg-[var(--success-lighter)] text-[var(--success)]',
      };
    case 'failed':
      return {
        dot: 'bg-[var(--error)]',
        text: 'text-[var(--error)]',
        row: 'bg-[var(--error-lighter)]/40',
        badge: 'bg-[var(--error-lighter)] text-[var(--error)]',
      };
    case 'running':
      return {
        dot: 'bg-[var(--warning)]',
        text: 'text-[var(--warning)]',
        row: '',
        badge: 'bg-[var(--warning-lighter)] text-[var(--warning)]',
      };
    case 'queued':
      return {
        dot: 'bg-[var(--neutral-soft-400)]',
        text: 'text-[var(--neutral-sub-600)]',
        row: '',
        badge: 'bg-[var(--neutral-weak-50)] text-[var(--neutral-sub-600)]',
      };
    case 'cancelled':
      return {
        dot: 'bg-[var(--neutral-soft-400)]',
        text: 'text-[var(--neutral-sub-600)]',
        row: '',
        badge: 'bg-[var(--neutral-weak-50)] text-[var(--neutral-sub-600)]',
      };
    default:
      return {
        dot: 'bg-[var(--neutral-soft-400)]',
        text: 'text-[var(--neutral-sub-600)]',
        row: '',
        badge: 'bg-[var(--neutral-weak-50)] text-[var(--neutral-sub-600)]',
      };
  }
}

function extractSelected(value: string[]): FilterValue {
  return value[0] || 'all';
}

export default function RunsPage() {
  const reduceMotion = useReducedMotion();

  const [runs, setRuns] = useState<RunRecord[]>([]);
  const [pageMeta, setPageMeta] = useState(EMPTY_PAGE);
  const [workspaces, setWorkspaces] = useState<WorkspaceSummary[]>([]);
  const [agents, setAgents] = useState<AgentOption[]>([]);

  const [loading, setLoading] = useState(true);
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date>();

  const [page, setPage] = useState(1);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [workspaceFilter, setWorkspaceFilter] = useState<string[]>(['all']);
  const [statusFilter, setStatusFilter] = useState<string[]>(['all']);
  const [connectorFilter, setConnectorFilter] = useState<string[]>(['all']);
  const [toolFilter, setToolFilter] = useState<string[]>(['all']);
  const [agentFilter, setAgentFilter] = useState<string[]>(['all']);

  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<SortDirection>(null);

  const selectedWorkspace = extractSelected(workspaceFilter);
  const selectedStatus = extractSelected(statusFilter);
  const selectedConnector = extractSelected(connectorFilter);
  const selectedTool = extractSelected(toolFilter);
  const selectedAgent = extractSelected(agentFilter);

  const fetchRuns = useCallback(
    async (options?: { soft?: boolean }) => {
      if (!options?.soft) setLoading(true);

      try {
        const response = await api.getRunsPage({
          page,
          page_size: PAGE_SIZE,
          workspace_id:
            selectedWorkspace !== 'all' ? selectedWorkspace : undefined,
          status: selectedStatus !== 'all' ? selectedStatus : undefined,
          connector_key:
            selectedConnector !== 'all' ? selectedConnector : undefined,
          tool_name: selectedTool !== 'all' ? selectedTool : undefined,
          agent_id: selectedAgent !== 'all' ? selectedAgent : undefined,
        });

        setRuns(Array.isArray(response.items) ? response.items : []);
        setPageMeta(response);
        setLastUpdated(new Date());
        setError(null);
      } catch (fetchError) {
        setError(
          fetchError instanceof Error
            ? fetchError.message
            : 'Failed to load runs.',
        );
      } finally {
        if (!options?.soft) setLoading(false);
      }
    },
    [
      page,
      selectedAgent,
      selectedConnector,
      selectedStatus,
      selectedTool,
      selectedWorkspace,
    ],
  );

  useEffect(() => {
    void fetchRuns();
  }, [fetchRuns]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      void fetchRuns({ soft: true });
    }, 30000);

    return () => window.clearInterval(interval);
  }, [fetchRuns]);

  useEffect(() => {
    let cancelled = false;

    async function loadOptions() {
      setLoadingOptions(true);

      try {
        const workspaceRows = await api.getWorkspaces();
        if (cancelled) return;

        setWorkspaces(workspaceRows);

        const details = await Promise.all(
          workspaceRows.map(async (workspace) => {
            try {
              return await api.getWorkspace(workspace.id);
            } catch {
              return null;
            }
          }),
        );

        if (cancelled) return;

        const nextAgents: AgentOption[] = [];

        details.forEach((detail: WorkspaceDetail | null) => {
          if (!detail) return;

          detail.agents.forEach((agent) => {
            nextAgents.push({
              id: agent.id,
              handle: agent.handle,
              workspace_id: agent.workspace_id,
            });
          });
        });

        const deduped = Array.from(
          new Map(nextAgents.map((agent) => [agent.id, agent])).values(),
        ).sort((left, right) =>
          compareText(left.handle, right.handle),
        );

        setAgents(deduped);
      } catch {
        if (!cancelled) {
          setWorkspaces([]);
          setAgents([]);
        }
      } finally {
        if (!cancelled) setLoadingOptions(false);
      }
    }

    void loadOptions();

    return () => {
      cancelled = true;
    };
  }, []);

  const connectorOptions = useMemo(() => {
    const keys = Array.from(
      new Set(
        runs
          .map((run) => run.connector_key?.trim().toLowerCase())
          .filter((key): key is string => Boolean(key)),
      ),
    ).sort(compareText);

    return [
      { value: 'all', label: 'Any' },
      ...keys.map((key) => ({
        value: key,
        label: connectorName(key),
      })),
    ];
  }, [runs]);

  const toolOptions = useMemo(() => {
    const tools = Array.from(
      new Set(
        runs
          .map((run) => run.tool_name?.trim())
          .filter((tool): tool is string => Boolean(tool)),
      ),
    ).sort(compareText);

    return [
      { value: 'all', label: 'Any' },
      ...tools.map((tool) => ({ value: tool, label: tool })),
    ];
  }, [runs]);

  const workspaceOptions = useMemo(
    () => [
      { value: 'all', label: 'All' },
      ...workspaces.map((workspace) => ({
        value: workspace.id,
        label: workspace.title,
      })),
    ],
    [workspaces],
  );

  const agentOptions = useMemo(
    () => [
      { value: 'all', label: 'Any' },
      ...agents.map((agent) => ({
        value: agent.id,
        label: `@${agent.handle.replace(/^@/, '')}`,
      })),
    ],
    [agents],
  );

  const filteredRuns = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    if (!query) return runs;

    return runs.filter((run) => {
      const haystack = [
        run.agent_name,
        run.agent_handle,
        run.tool_name,
        connectorName(run.connector_key),
        run.workspace_name,
        run.workspace_title,
        resultText(run),
        run.error_message,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return haystack.includes(query);
    });
  }, [runs, searchQuery]);

  const sortedRuns = useMemo(() => {
    if (!sortKey || sortDir === null) return filteredRuns;

    const sorted = [...filteredRuns];

    sorted.sort((left, right) => {
      switch (sortKey) {
        case 'tool':
          return compareByDirection(
            left.tool_name,
            right.tool_name,
            sortDir,
          );
        case 'agent':
          return compareByDirection(
            left.agent_handle || left.agent_name || '',
            right.agent_handle || right.agent_name || '',
            sortDir,
          );
        case 'connector':
          return compareByDirection(
            connectorName(left.connector_key),
            connectorName(right.connector_key),
            sortDir,
          );
        case 'result':
          return compareByDirection(
            resultText(left),
            resultText(right),
            sortDir,
          );
        case 'execution':
          return compareByDirection(
            left.execution_time_ms ?? 0,
            right.execution_time_ms ?? 0,
            sortDir,
          );
        case 'tokens':
          return compareByDirection(
            (left.input_token ?? 0) + (left.output_token ?? 0),
            (right.input_token ?? 0) + (right.output_token ?? 0),
            sortDir,
        );
        case 'time':
          return compareByDirection(
            new Date(
              left.created_at || left.started_at || 0,
            ).getTime(),
            new Date(
              right.created_at || right.started_at || 0,
            ).getTime(),
            sortDir,
          );
      }
    });

    return sorted;
  }, [filteredRuns, sortDir, sortKey]);

  const totalPages = Math.max(
    1,
    Math.ceil(pageMeta.total / Math.max(pageMeta.limit, 1)),
  );

  const firstItem =
    pageMeta.total === 0 ? 0 : pageMeta.offset + 1;
  const lastItem =
    pageMeta.total === 0
      ? 0
      : Math.min(pageMeta.offset + sortedRuns.length, pageMeta.total);

  const hasActiveFilters =
    selectedWorkspace !== 'all' ||
    selectedStatus !== 'all' ||
    selectedConnector !== 'all' ||
    selectedTool !== 'all' ||
    selectedAgent !== 'all' ||
    searchQuery.trim().length > 0;

  useEffect(() => {
    setPage(1);
    setExpandedRow(null);
  }, [
    selectedAgent,
    selectedConnector,
    selectedStatus,
    selectedTool,
    selectedWorkspace,
  ]);

  const clearAllFilters = useCallback(() => {
    setSearchQuery('');
    setWorkspaceFilter(['all']);
    setStatusFilter(['all']);
    setConnectorFilter(['all']);
    setToolFilter(['all']);
    setAgentFilter(['all']);
    setSortKey(null);
    setSortDir(null);
    setPage(1);
    setExpandedRow(null);
  }, []);

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

  const dirFor = useCallback(
    (key: SortKey): SortDirection =>
      sortKey === key ? sortDir : null,
    [sortDir, sortKey],
  );

  if (loading && runs.length === 0) {
    return (
      <>
        <Topbar
          title="Runs"
          subtitle="Every tool call an agent has made"
        />
        <div className="mx-auto max-w-[1480px] px-4 py-6 sm:px-6 lg:px-8">
          <RunsSkeleton />
        </div>
      </>
    );
  }

  return (
    <>
      <Topbar
        title="Runs"
        subtitle={`${pageMeta.total.toLocaleString()} · every tool call an agent has made`}
        lastUpdated={lastUpdated}
        onRefresh={() => void fetchRuns()}
      />

      <div className="mx-auto max-w-[1480px] px-4 py-5 sm:px-6 lg:px-8">
        {error ? (
          <div className="mb-4">
            <ErrorBanner
              message={error}
              onDismiss={() => setError(null)}
              onRetry={() => void fetchRuns()}
            />
          </div>
        ) : null}

        <motion.section
          className="overflow-hidden rounded-[10px] border border-[var(--stroke-soft-200)] bg-white shadow-[0_1px_2px_rgba(23,23,23,0.04)]"
          initial={reduceMotion ? false : { opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            duration: DUR.slow,
            ease: EASE.out,
          }}
        >
          <div className="border-b border-[var(--stroke-soft-200)] px-3 py-3">
            <div className="flex flex-wrap items-center gap-2">
              <FilterChip
                label="Workspace"
                options={workspaceOptions}
                value={workspaceFilter}
                onChange={(values) =>
                  setWorkspaceFilter(values.length ? [values[0]] : ['all'])
                }
              />

              <FilterChip
                label="Status"
                options={STATUS_OPTIONS}
                value={statusFilter}
                onChange={(values) =>
                  setStatusFilter(values.length ? [values[0]] : ['all'])
                }
              />

              <FilterChip
                label="Connector"
                options={connectorOptions}
                value={connectorFilter}
                onChange={(values) =>
                  setConnectorFilter(values.length ? [values[0]] : ['all'])
                }
              />

              <FilterChip
                label="Tool"
                options={toolOptions}
                value={toolFilter}
                onChange={(values) =>
                  setToolFilter(values.length ? [values[0]] : ['all'])
                }
              />

              <FilterChip
                label="Agent"
                options={agentOptions}
                value={agentFilter}
                onChange={(values) =>
                  setAgentFilter(values.length ? [values[0]] : ['all'])
                }
              />

              <div className="ml-auto min-w-[220px] max-w-[320px] flex-1">
                <Input
                  type="text"
                  value={searchQuery}
                  onChange={(event) =>
                    setSearchQuery(event.target.value)
                  }
                  placeholder="Search runs"
                  leadingIcon={
                    <Search
                      className="h-3.5 w-3.5"
                      strokeWidth={2}
                    />
                  }
                  trailingIcon={
                    searchQuery ? (
                      <button
                        type="button"
                        onClick={() => setSearchQuery('')}
                        aria-label="Clear search"
                        className="rounded p-0.5 text-[var(--neutral-soft-400)] transition-colors hover:text-[var(--neutral-strong-950)]"
                      >
                        <X
                          className="h-3.5 w-3.5"
                          strokeWidth={2.25}
                        />
                      </button>
                    ) : undefined
                  }
                />
              </div>

              {hasActiveFilters ? (
                <button
                  type="button"
                  onClick={clearAllFilters}
                  className="inline-flex h-7 items-center gap-1 rounded-[8px] px-2 text-[11.5px] font-medium text-[var(--neutral-sub-600)] transition-colors hover:bg-[var(--neutral-weak-50)] hover:text-[var(--neutral-strong-950)]"
                >
                  <X
                    className="h-3 w-3"
                    strokeWidth={2.25}
                    aria-hidden
                  />
                  Clear
                </button>
              ) : null}
            </div>
          </div>

          {runs.length === 0 ? (
            <EmptyState
              icon={<ActivityIcon />}
              title="No runs yet"
              description="Run an action through one of your agents to see it here."
            />
          ) : sortedRuns.length === 0 ? (
            <EmptyState
              icon={<ActivityIcon />}
              title="No runs match these filters"
              description="Clear a filter or search term to inspect other runs."
              action={
                <Button
                  variant="secondary"
                  onClick={clearAllFilters}
                >
                  Clear filters
                </Button>
              }
            />
          ) : (
            <>
              <Table scrollX>
                <THead>
                  <tr>
                    <TH
                      sortable
                      sortDirection={dirFor('tool')}
                      onSort={() => onSort('tool')}
                    >
                      Tool
                    </TH>
                    <TH
                      sortable
                      sortDirection={dirFor('agent')}
                      onSort={() => onSort('agent')}
                    >
                      Agent
                    </TH>
                    <TH
                      sortable
                      sortDirection={dirFor('connector')}
                      onSort={() => onSort('connector')}
                    >
                      Connector
                    </TH>
                    <TH
                      sortable
                      sortDirection={dirFor('result')}
                      onSort={() => onSort('result')}
                    >
                      Result
                    </TH>
                    <TH
                      sortable
                      sortDirection={dirFor('execution')}
                      onSort={() => onSort('execution')}
                    >
                      Took
                    </TH>
                    <TH
                      sortable
                      sortDirection={dirFor('tokens')}
                      onSort={() => onSort('tokens')}
                    >
                      In/Out Tokens
                    </TH>
                    <TH
                      sortable
                      sortDirection={dirFor('time')}
                      onSort={() => onSort('time')}
                    >
                      When
                    </TH>
                    <TH
                      aria-label="Expand"
                      className="w-8"
                    />
                  </tr>
                </THead>

                <TBody>
                  {sortedRuns.map((run) => (
                    <RunRow
                      key={run.id}
                      run={run}
                      isExpanded={expandedRow === run.id}
                      onToggle={() =>
                        setExpandedRow(
                          expandedRow === run.id ? null : run.id,
                        )
                      }
                    />
                  ))}
                </TBody>
              </Table>

              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--stroke-soft-200)] px-4 py-3">
                <p className="text-xs text-[var(--neutral-soft-400)]">
                  Showing{' '}
                  <span className="font-medium text-[var(--neutral-strong-950)]">
                    {firstItem.toLocaleString()}
                  </span>{' '}
                  to{' '}
                  <span className="font-medium text-[var(--neutral-strong-950)]">
                    {lastItem.toLocaleString()}
                  </span>{' '}
                  of{' '}
                  <span className="font-medium text-[var(--neutral-strong-950)]">
                    {pageMeta.total.toLocaleString()}
                  </span>
                </p>

                <div className="flex items-center gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() =>
                      setPage((current) =>
                        Math.max(1, current - 1),
                      )
                    }
                  >
                    Previous
                  </Button>

                  <span className="text-[12px] text-[var(--neutral-soft-400)]">
                    Page {page} of {totalPages}
                  </span>

                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={page >= totalPages}
                    onClick={() =>
                      setPage((current) =>
                        Math.min(totalPages, current + 1),
                      )
                    }
                  >
                    Next
                  </Button>
                </div>
              </div>
            </>
          )}
        </motion.section>

        {loadingOptions ? null : null}
      </div>
    </>
  );
}

function RunRow({
  run,
  isExpanded,
  onToggle,
}: {
  run: RunRecord;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const status = statusClasses(run.status);
  const connectorKey = connectorId(run.connector_key);
  const handle = run.agent_handle || run.agent_name || 'Unknown';
  const result = resultText(run);

  return (
    <>
      <TR
        clickable
        isExpanded={isExpanded}
        onClick={onToggle}
        className={status.row}
      >
        <TD className="max-w-[220px]">
          <div className="flex items-center gap-2">
            <span
              className={`inline-block h-1.5 w-1.5 shrink-0 rounded-full ${status.dot}`}
              aria-hidden
            />
            <CodeChip title={run.tool_name}>
              {run.tool_name}
            </CodeChip>
          </div>
        </TD>

        <TD className="max-w-[180px]">
          <div className="flex min-w-0 items-center gap-2">
            <AgentMark name={handle} size="xs" />
            <span className="truncate text-[12.5px] font-medium text-[var(--neutral-strong-950)]">
              {handle.startsWith('@') ? handle : `@${handle}`}
            </span>
          </div>
        </TD>

        <TD className="whitespace-nowrap">
          <div
            className="flex items-center gap-2"
            title={`${connectorName(run.connector_key)} connector`}
          >
            {connectorKey ? (
              <ConnectorMark
                id={connectorKey}
                size="xs"
                className="cursor-default"
              />
            ) : null}
            <span className="text-[12.5px] text-[var(--neutral-sub-600)]">
              {connectorName(run.connector_key)}
            </span>
          </div>
        </TD>

        <TD className="min-w-[300px] max-w-[460px]">
          <div className="flex min-w-0 items-center gap-2">
            <span
              className={`truncate text-[12.5px] ${
                run.status === 'failed'
                  ? 'text-[var(--error)]'
                  : 'text-[var(--neutral-sub-600)]'
              }`}
              title={result}
            >
              {result}
            </span>

            {retryLabel(run) ? (
              <span className="shrink-0 rounded-[5px] border border-[var(--stroke-soft-200)] bg-white px-1.5 py-0.5 text-[10px] font-medium text-[var(--neutral-sub-600)]">
                retry
              </span>
            ) : null}
          </div>
        </TD>

        <TD className="whitespace-nowrap text-[12px] text-[var(--neutral-sub-600)]">
          {formatDuration(run.execution_time_ms)}
        </TD>

        <TD className="whitespace-nowrap text-[12px] text-[var(--neutral-sub-600)]">
          {formatTokenCount(run.input_token)}/
          {formatTokenCount(run.output_token)}
        </TD>

        <TD className="whitespace-nowrap text-[12px] text-[var(--neutral-sub-600)]">
          {formatRelativeTime(
            run.created_at || run.started_at,
          )}
        </TD>

        <TD className="w-8 text-right">
          <ChevronRight
            className={`ml-auto h-3.5 w-3.5 text-[var(--neutral-soft-400)] transition-transform duration-150 ${
              isExpanded ? 'rotate-90' : ''
            }`}
            strokeWidth={2}
          />
        </TD>
      </TR>

      <AnimatePresence initial={false}>
        {isExpanded ? (
          <TRExpanded key="expanded" colSpan={8}>
            <RunDetails run={run} />
          </TRExpanded>
        ) : null}
      </AnimatePresence>
    </>
  );
}

function RunDetails({ run }: { run: RunRecord }) {
  const status = statusClasses(run.status);
  const isSuccessful = run.status === 'completed';

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_270px]">
      <div className="min-w-0">
        <div
          className={`rounded-[9px] border px-4 py-3 ${
            isSuccessful
              ? 'border-[var(--success-light)] bg-[var(--success-lighter)]'
              : run.status === 'failed'
                ? 'border-[var(--error-light)] bg-[var(--error-lighter)]'
                : 'border-[var(--stroke-soft-200)] bg-white'
          }`}
        >
          <div className="flex items-center gap-2">
            {isSuccessful ? (
              <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-[var(--success)] text-white">
                <Check
                  className="h-2.5 w-2.5"
                  strokeWidth={3}
                  aria-hidden
                />
              </span>
            ) : (
              <span
                className={`inline-block h-2 w-2 rounded-full ${status.dot}`}
              />
            )}

            <p className={`text-[12px] font-semibold ${status.text}`}>
              {run.status === 'failed'
                ? 'This run failed'
                : run.status === 'completed'
                  ? 'This run completed'
                  : `This run is ${statusLabel(run.status).toLowerCase()}`}
            </p>
          </div>

          <p className="mt-1 text-[12px] text-[var(--neutral-sub-600)]">
            {resultText(run)}
          </p>
        </div>

        <div className="mt-4">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.06em] text-[var(--neutral-soft-400)]">
            What the agent sent
          </p>
          <div className="rounded-[9px] border border-[var(--stroke-soft-200)] bg-[var(--neutral-weak-50)] p-3">
            <JsonViewer
              data={{
                tool: run.tool_name,
                connector: run.connector_key,
                arguments: run.arguments || {},
              }}
              collapsed={false}
              label="Request"
            />
          </div>
        </div>

        <div className="mt-4">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.06em] text-[var(--neutral-soft-400)]">
            What came back
          </p>
          <div className="rounded-[9px] border border-[var(--stroke-soft-200)] bg-[var(--neutral-weak-50)] p-3">
            <JsonViewer
              data={
                run.result_payload &&
                typeof run.result_payload === 'object'
                  ? run.result_payload
                  : {
                      result: run.result_payload,
                      error: run.error_message,
                    }
              }
              collapsed={false}
              label="Response"
            />
          </div>
        </div>
      </div>

      <aside className="rounded-[9px] border border-[var(--stroke-soft-200)] bg-white p-4">
        <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.06em] text-[var(--neutral-soft-400)]">
          The record
        </p>

        <div className="space-y-3">
          <MetaCell
            label="Status"
            value={statusLabel(run.status)}
            valueClass={status.text}
          />
          <MetaCell
            label="Agent"
            value={
              run.agent_handle
                ? `@${run.agent_handle.replace(/^@/, '')}`
                : run.agent_name || 'Unavailable'
            }
          />
          <MetaCell
            label="Workspace"
            value={
              run.workspace_title ||
              run.workspace_name ||
              'Unavailable'
            }
          />
          <MetaCell
            label="Connector"
            value={connectorName(run.connector_key)}
          />
          <MetaCell
            label="Tool"
            value={run.tool_name || 'Unavailable'}
            mono
          />
          <MetaCell
            label="Started"
            value={formatFullTimestamp(run.started_at)}
          />
          <MetaCell
            label="Completed"
            value={formatFullTimestamp(run.completed_at)}
          />
          <MetaCell
            label="Execution time"
            value={formatDuration(run.execution_time_ms)}
          />
          <MetaCell
            label="In/Out Tokens"
            value={`${formatTokenCount(run.input_token)}/${formatTokenCount(run.output_token)}`}
          />
        </div>
      </aside>
    </div>
  );
}

function MetaCell({
  label,
  value,
  mono = false,
  valueClass = 'text-[var(--neutral-strong-950)]',
}: {
  label: string;
  value: string;
  mono?: boolean;
  valueClass?: string;
}) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-[0.05em] text-[var(--neutral-soft-400)]">
        {label}
      </p>
      <p
        className={`mt-0.5 ${
          mono
            ? '[font-family:var(--font-geist-mono),ui-monospace,monospace] break-all'
            : ''
        } text-[12px] ${valueClass}`}
      >
        {value}
      </p>
    </div>
  );
}

function formatRelativeTime(value?: string | null): string {
  if (!value) return '—';

  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return '—';

  const seconds = Math.max(
    0,
    Math.floor((Date.now() - timestamp) / 1000),
  );

  if (seconds < 60) return `${seconds}s ago`;

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;

  return new Date(timestamp).toLocaleDateString();
}

function ActivityIcon() {
  return (
    <span className="inline-flex h-5 w-5 items-center justify-center">
      <span className="h-2 w-2 rounded-full bg-[var(--neutral-soft-400)]" />
    </span>
  );
}