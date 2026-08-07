'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import {
  Activity,
  BarChart3,
  Clock3,
  Layers3,
  RefreshCcw,
  Wrench,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from 'recharts';
import Topbar from '@/components/layout/Topbar';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardEyebrow, CardFooter, CardHeader, CardTitle } from '@/components/ui/Card';
import { CodeChip } from '@/components/ui/CodeChip';
import EmptyState from '@/components/ui/EmptyState';
import ErrorBanner from '@/components/ui/ErrorBanner';
import MetricCard from '@/components/ui/MetricCard';
import { TokenSpendSkeleton } from '@/components/ui/PageSkeletons';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/Table';
import {
  ChartContainer,
  ChartTooltip,
  type ChartConfig,
} from '@/components/ui/chart';
import { api } from '@/lib/api';
import { useAutoRefresh, useUser } from '@/lib/hooks';
import { DUR, EASE, fadeUp, staggerContainer } from '@/lib/motion';
import type {
  PaginatedResponse,
  TokenAnalyticsResponse,
  TokenMeterResponse,
  TokenUsageChartItem,
  TokenUsageSessionItem,
} from '@/lib/types';
import { formatMcpAegisToolDisplayName, parseApiUtcTimestamp } from '@/lib/utils';

type UsageRange = 'today' | '7d' | '30d' | '90d' | 'all';

type SessionChartRow = {
  label: string;
  sessionId: string;
  input: number;
  output: number;
  total: number;
  calls: number;
};

type DistributionSlice = {
  name: string;
  value: number;
  input: number;
  output: number;
  calls: number;
};

type TooltipItem = {
  color?: string;
  dataKey?: string | number;
  name?: string | number;
  value?: number | string;
  payload?: SessionChartRow | DistributionSlice;
};

const TZ_IST = 'Asia/Kolkata';

const USAGE_RANGE_OPTIONS: Array<{ value: UsageRange; label: string }> = [
  { value: 'today', label: 'Today' },
  { value: '7d', label: '7 days' },
  { value: '30d', label: '30 days' },
  { value: '90d', label: '90 days' },
  { value: 'all', label: 'All time' },
];

const SESSION_CHART_CONFIG = {
  input: { label: 'Input', color: 'var(--information)' },
  output: { label: 'Output', color: 'var(--feature)' },
} satisfies ChartConfig;

const DISTRIBUTION_CHART_CONFIG = {
  value: { label: 'Tokens', color: 'var(--information)' },
} satisfies ChartConfig;

const PIE_COLORS = [
  'var(--information)',
  'var(--feature)',
  'var(--success)',
  'var(--warning)',
  'var(--neutral-sub-300)',
];
const TOKEN_ROWS_PAGE_SIZE = 20;
const EMPTY_TOKEN_ROWS: PaginatedResponse<TokenMeterResponse> = {
  items: [],
  total: 0,
  page: 1,
  page_size: TOKEN_ROWS_PAGE_SIZE,
  pages: 0,
};

const emptyAnalytics: TokenAnalyticsResponse = {
  user_id: '',
  date_range: 'today',
  start_date: null,
  end_date: null,
  allocation: 'both',
  summary: {
    input_tokens: 0,
    output_tokens: 0,
    total_tokens: 0,
    tool_call_count: 0,
  },
  category_chart: [],
  tool_chart: [],
};

function toNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function displayCategoryName(name: string): string {
  return name
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function displayToolName(name: string): string {
  return formatMcpAegisToolDisplayName(name) || name || 'Unknown';
}

function formatDateTimeIST(value?: string | null): string {
  if (!value) return 'Unavailable';
  const parsed = parseApiUtcTimestamp(value);
  if (Number.isNaN(parsed.getTime())) return 'Unavailable';
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: TZ_IST,
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  }).format(parsed);
}

function formatTimeIST(value?: string | null): string {
  if (!value) return 'Unavailable';
  const parsed = parseApiUtcTimestamp(value);
  if (Number.isNaN(parsed.getTime())) return 'Unavailable';
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: TZ_IST,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  }).format(parsed);
}

function rangeSubtitle(range: UsageRange): string {
  switch (range) {
    case 'today':
      return 'Live token usage for today';
    case '7d':
      return 'Token usage across the last 7 days';
    case '30d':
      return 'Token usage across the last 30 days';
    case '90d':
      return 'Token usage across the last 90 days';
    case 'all':
      return 'All recorded token usage';
  }
}

function rangeSummaryLabel(range: UsageRange): string {
  switch (range) {
    case 'today':
      return 'today';
    case '7d':
      return 'the last 7 days';
    case '30d':
      return 'the last 30 days';
    case '90d':
      return 'the last 90 days';
    case 'all':
      return 'all time';
  }
}

function rangeEmptyDescription(range: UsageRange): string {
  switch (range) {
    case 'today':
      return 'Token records for today will appear here as governed actions run.';
    case '7d':
      return 'No token usage was recorded in the last 7 days.';
    case '30d':
      return 'No token usage was recorded in the last 30 days.';
    case '90d':
      return 'No token usage was recorded in the last 90 days.';
    case 'all':
      return 'No token usage has been recorded for this account yet.';
  }
}

function shareOfTotal(value: number, total: number): string {
  if (!total) return '0% of total';
  return `${Math.round((value / total) * 100)}% of total`;
}

function buildDistributionData(
  items: TokenUsageChartItem[],
  labelForName: (name: string) => string,
  limit = 5,
): DistributionSlice[] {
  const sorted = [...items]
    .filter((item) => item.total_tokens > 0)
    .sort((left, right) => right.total_tokens - left.total_tokens);

  const visible = sorted.slice(0, limit).map((item) => ({
    name: labelForName(item.name),
    value: item.total_tokens,
    input: item.input_tokens,
    output: item.output_tokens,
    calls: item.tool_call_count,
  }));

  const remainder = sorted.slice(limit);
  if (remainder.length === 0) return visible;

  const other = remainder.reduce<DistributionSlice>(
    (accumulator, item) => ({
      name: 'Other',
      value: accumulator.value + item.total_tokens,
      input: accumulator.input + item.input_tokens,
      output: accumulator.output + item.output_tokens,
      calls: accumulator.calls + item.tool_call_count,
    }),
    { name: 'Other', value: 0, input: 0, output: 0, calls: 0 },
  );

  return other.value > 0 ? [...visible, other] : visible;
}

function buildSessionChartRows(
  sessions: TokenUsageSessionItem[],
  rows: TokenMeterResponse[],
): SessionChartRow[] {
  if (sessions.length > 0) {
    return [...sessions]
      .sort((left, right) => toNumber(right.total_tokens) - toNumber(left.total_tokens))
      .slice(0, 8)
      .map((session, index) => ({
        label: `S${index + 1}`,
        sessionId: session.session_id || 'unknown',
        input: toNumber(session.input_tokens),
        output: toNumber(session.output_tokens),
        total: toNumber(session.total_tokens),
        calls: toNumber(session.tool_call_count),
      }));
  }

  const grouped = new Map<string, Omit<SessionChartRow, 'label'>>();
  for (const row of rows) {
    const sessionId = row.session_id || 'unknown';
    const input = toNumber(row.input_token);
    const output = toNumber(row.output_token);
    const existing = grouped.get(sessionId);
    if (existing) {
      existing.input += input;
      existing.output += output;
      existing.total += input + output;
      existing.calls += 1;
      continue;
    }
    grouped.set(sessionId, {
      sessionId,
      input,
      output,
      total: input + output,
      calls: 1,
    });
  }

  return Array.from(grouped.values())
    .sort((left, right) => right.total - left.total)
    .slice(0, 8)
    .map((session, index) => ({
      label: `S${index + 1}`,
      ...session,
    }));
}

function sessionLabel(sessionId: string, labels: Map<string, string>): string {
  return labels.get(sessionId) ?? sessionId.slice(0, 8);
}

export default function TokenSpenditurePage() {
  const { user, isLoading: userLoading } = useUser();
  const reduceMotion = useReducedMotion();
  const [rows, setRows] = useState<TokenMeterResponse[]>([]);
  const [rowsMeta, setRowsMeta] = useState<PaginatedResponse<TokenMeterResponse>>(EMPTY_TOKEN_ROWS);
  const [rowsPage, setRowsPage] = useState(1);
  const [analytics, setAnalytics] = useState<TokenAnalyticsResponse>(emptyAnalytics);
  const [tokenSessions, setTokenSessions] = useState<TokenUsageSessionItem[]>([]);
  const [usageRange, setUsageRange] = useState<UsageRange>('today');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!user?.id) {
      if (!userLoading) {
        setRows([]);
        setRowsMeta(EMPTY_TOKEN_ROWS);
        setAnalytics(emptyAnalytics);
        setTokenSessions([]);
        setLoading(false);
      }
      return;
    }

    setLoading(true);
    try {
      const [tokenRows, tokenAnalytics, sessions] = await Promise.all([
        api.getUserTokenUsage(user.id, rowsPage, TOKEN_ROWS_PAGE_SIZE),
        api.getTokenUsageAnalytics(user.id, {
          date_range: usageRange,
          allocation: 'both',
        }),
        api.getTokenUsageSessions(user.id, {
          date_range: usageRange,
          limit: 500,
        }),
      ]);

      const sortedRows = Array.isArray(tokenRows.items)
        ? [...tokenRows.items].sort((left, right) => {
            const leftTime = parseApiUtcTimestamp(left.timestamp ?? left.created_at ?? '').getTime();
            const rightTime = parseApiUtcTimestamp(right.timestamp ?? right.created_at ?? '').getTime();
            return rightTime - leftTime;
          })
        : [];

      setRows(sortedRows);
      setRowsMeta(tokenRows);
      setAnalytics(tokenAnalytics);
      setTokenSessions(Array.isArray(sessions) ? sessions : []);
      setError(null);
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : 'Failed to load token usage.');
    } finally {
      setLoading(false);
    }
  }, [rowsPage, usageRange, user?.id, userLoading]);

  useEffect(() => {
    if (user?.id) {
      void fetchData();
      return;
    }
    if (!userLoading) {
      setRows([]);
      setRowsMeta(EMPTY_TOKEN_ROWS);
      setAnalytics(emptyAnalytics);
      setTokenSessions([]);
      setLoading(false);
    }
  }, [fetchData, user?.id, userLoading]);

  useEffect(() => {
    setRowsPage(1);
  }, [usageRange]);

  const { lastUpdated } = useAutoRefresh(fetchData, 30000);
  const summary = analytics.summary;

  const sessionRows = useMemo(
    () => buildSessionChartRows(tokenSessions, rows),
    [rows, tokenSessions],
  );

  const sessionLabels = useMemo(() => {
    return new Map(sessionRows.map((row) => [row.sessionId, row.label]));
  }, [sessionRows]);

  const categoryData = useMemo(
    () => buildDistributionData(analytics.category_chart, displayCategoryName),
    [analytics.category_chart],
  );

  const toolData = useMemo(
    () => buildDistributionData(analytics.tool_chart, displayToolName),
    [analytics.tool_chart],
  );

  const topCategory = categoryData[0] ?? null;
  const topTool = toolData[0] ?? null;
  const averagePerSession = tokenSessions.length
    ? Math.round(summary.total_tokens / tokenSessions.length)
    : 0;
  const latestRecord = rows[0] ?? null;
  const noData =
    summary.total_tokens === 0 &&
    sessionRows.length === 0 &&
    categoryData.length === 0 &&
    toolData.length === 0;

  if (userLoading || loading) {
    return (
      <>
        <Topbar title="Token meter" subtitle={rangeSubtitle(usageRange)} />
        <div className="mx-auto max-w-[1320px] px-4 py-6 sm:px-6 sm:py-7 lg:px-8 lg:py-8">
          <TokenSpendSkeleton />
        </div>
      </>
    );
  }

  return (
    <>
      <Topbar
        title="Token meter"
        subtitle={rangeSubtitle(usageRange)}
        lastUpdated={lastUpdated}
        onRefresh={fetchData}
      />
      <div className="mx-auto max-w-[1320px] px-4 py-6 sm:px-6 sm:py-7 lg:px-8 lg:py-8">
        {error ? (
          <div className="mb-6">
            <ErrorBanner
              message={error}
              onDismiss={() => setError(null)}
              onRetry={fetchData}
            />
          </div>
        ) : null}

        <motion.section
          className="mb-6 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between"
          variants={staggerContainer(0.05, 0)}
          initial={reduceMotion ? false : 'hidden'}
          animate="show"
        >
          <div className="min-w-0">
            <motion.div variants={fadeUp} className="mb-3 flex flex-wrap items-center gap-2">
              <Badge tone="info" leadingDot>
                Tracked usage
              </Badge>
              <Badge tone="neutral">{rangeSummaryLabel(usageRange)}</Badge>
              <Badge tone="feature">{tokenSessions.length.toLocaleString()} sessions</Badge>
            </motion.div>
            <motion.h1
              variants={fadeUp}
              className="text-[28px] font-semibold leading-[1.05] tracking-[-0.03em] text-[var(--neutral-strong-950)]"
            >
              {summary.total_tokens.toLocaleString()} tokens recorded in {rangeSummaryLabel(usageRange)}
            </motion.h1>
            <motion.p
              variants={fadeUp}
              className="mt-3 max-w-[760px] text-[13px] leading-[1.6] text-[var(--neutral-sub-600)]"
            >
              Tracks raw token rows, session rollups, and category and tool analytics for the selected
              window.
            </motion.p>
          </div>
          <motion.div variants={fadeUp}>
            <UsageRangeTabs value={usageRange} onChange={setUsageRange} />
          </motion.div>
        </motion.section>

        {!user?.id ? (
          <Card>
            <CardBody>
              <EmptyState
                icon={<Activity className="h-4 w-4" />}
                title="User context unavailable"
                description="Token usage appears here once the current account is resolved."
                action={
                  <Button
                    variant="secondary"
                    size="lg"
                    leadingIcon={<RefreshCcw className="h-4 w-4" />}
                    onClick={() => void fetchData()}
                  >
                    Retry
                  </Button>
                }
              />
            </CardBody>
          </Card>
        ) : noData ? (
          <Card>
            <CardBody>
              <EmptyState
                icon={<BarChart3 className="h-4 w-4" />}
                title="No token usage yet"
                description={rangeEmptyDescription(usageRange)}
                action={
                  <Button
                    variant="secondary"
                    size="lg"
                    leadingIcon={<RefreshCcw className="h-4 w-4" />}
                    onClick={() => void fetchData()}
                  >
                    Refresh
                  </Button>
                }
              />
            </CardBody>
          </Card>
        ) : (
          <>
            <motion.section
              className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4"
              initial={reduceMotion ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: DUR.slow, ease: EASE.out, delay: 0.08 }}
            >
              <MetricCard
                label="Total tokens"
                value={summary.total_tokens}
                meta={`${tokenSessions.length.toLocaleString()} sessions in scope`}
              />
              <MetricCard
                label="Input tokens"
                value={summary.input_tokens}
                meta={shareOfTotal(summary.input_tokens, summary.total_tokens)}
              />
              <MetricCard
                label="Output tokens"
                value={summary.output_tokens}
                meta={shareOfTotal(summary.output_tokens, summary.total_tokens)}
              />
              <MetricCard
                label="Tool calls"
                value={summary.tool_call_count}
                meta={`${rowsMeta.total.toLocaleString()} raw rows available`}
              />
            </motion.section>

            <motion.section
              className="mb-6 grid gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(320px,0.9fr)]"
              initial={reduceMotion ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: DUR.slow, ease: EASE.out, delay: 0.12 }}
            >
              <Card>
                <CardHeader>
                  <div className="min-w-0">
                    <CardEyebrow>Session usage</CardEyebrow>
                    <CardTitle>Input and output by session</CardTitle>
                  </div>
                  <Badge tone="neutral">{sessionRows.length} shown</Badge>
                </CardHeader>
                <CardBody>
                  {sessionRows.length === 0 ? (
                    <EmptyState
                      compact
                      icon={<BarChart3 className="h-4 w-4" />}
                      title="No sessions in this window"
                      description="Session rollups appear here once token usage is recorded."
                    />
                  ) : (
                    <div className="h-[320px]">
                      <ChartContainer
                        config={SESSION_CHART_CONFIG}
                        className="h-full w-full"
                      >
                        <BarChart data={sessionRows} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                          <CartesianGrid vertical={false} stroke="var(--stroke-soft-200)" />
                          <XAxis
                            dataKey="label"
                            axisLine={false}
                            tickLine={false}
                            tickMargin={10}
                            tick={{ fill: 'var(--neutral-soft-400)', fontSize: 11 }}
                          />
                          <YAxis
                            axisLine={false}
                            tickLine={false}
                            tickMargin={10}
                            tick={{ fill: 'var(--neutral-soft-400)', fontSize: 11 }}
                            tickFormatter={(value: number) => value.toLocaleString()}
                          />
                          <ChartTooltip cursor={false} content={<SessionChartTooltip />} />
                          <Bar dataKey="input" stackId="tokens" fill="var(--color-input)" radius={[4, 4, 0, 0]} />
                          <Bar dataKey="output" stackId="tokens" fill="var(--color-output)" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ChartContainer>
                    </div>
                  )}
                </CardBody>
                <CardFooter className="text-[11.5px] text-[var(--neutral-soft-400)]">
                  <span>Shows the highest-usage sessions for the selected window.</span>
                  <span>{summary.total_tokens.toLocaleString()} total tokens</span>
                </CardFooter>
              </Card>

              <Card>
                <CardHeader>
                  <div className="min-w-0">
                    <CardEyebrow>Highlights</CardEyebrow>
                    <CardTitle>Where usage is concentrating</CardTitle>
                  </div>
                </CardHeader>
                <CardBody className="space-y-3">
                  <InsightRow
                    icon={<Layers3 className="h-4 w-4" />}
                    label="Top category"
                    value={topCategory ? topCategory.name : 'No category data'}
                    meta={topCategory ? `${topCategory.value.toLocaleString()} tokens` : 'Waiting for category breakdowns'}
                  />
                  <InsightRow
                    icon={<Wrench className="h-4 w-4" />}
                    label="Top tool"
                    value={topTool ? topTool.name : 'No tool data'}
                    meta={topTool ? `${topTool.calls.toLocaleString()} calls` : 'Waiting for tool breakdowns'}
                  />
                  <InsightRow
                    icon={<BarChart3 className="h-4 w-4" />}
                    label="Average per session"
                    value={averagePerSession.toLocaleString()}
                    meta={tokenSessions.length ? `${tokenSessions.length.toLocaleString()} sessions reported` : 'No session rollups yet'}
                  />
                  <InsightRow
                    icon={<Clock3 className="h-4 w-4" />}
                    label="Latest record"
                    value={latestRecord ? formatDateTimeIST(latestRecord.timestamp ?? latestRecord.created_at) : 'Unavailable'}
                    meta={latestRecord ? formatTimeIST(latestRecord.timestamp ?? latestRecord.created_at) : 'No recent row loaded'}
                  />
                </CardBody>
                <CardFooter className="text-[11.5px] text-[var(--neutral-soft-400)]">
                  <span>Refreshes every 30 seconds.</span>
                  <span>{rowsMeta.total.toLocaleString()} paginated token meter rows</span>
                </CardFooter>
              </Card>
            </motion.section>

            <motion.section
              className="mb-6 grid gap-6 xl:grid-cols-2"
              initial={reduceMotion ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: DUR.slow, ease: EASE.out, delay: 0.16 }}
            >
              <DistributionCard
                eyebrow="Category breakdown"
                title="Tokens by connector category"
                subtitle="Grouped from /analytics/token-usage category_chart."
                data={categoryData}
                emptyDescription="Category splits appear once usage has been categorized."
              />
              <DistributionCard
                eyebrow="Tool breakdown"
                title="Tokens by tool"
                subtitle="Grouped from /analytics/token-usage tool_chart."
                data={toolData}
                emptyDescription="Tool splits appear once usage has been categorized."
              />
            </motion.section>

            <motion.section
              initial={reduceMotion ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: DUR.slow, ease: EASE.out, delay: 0.2 }}
            >
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-[14px] font-semibold tracking-[-0.01em] text-[var(--neutral-strong-950)]">
                    Recent token meter records
                  </h2>
                  <p className="mt-1 text-[12px] text-[var(--neutral-soft-400)]">
                    Showing paginated raw rows from the token meter endpoint.
                  </p>
                </div>
                <Badge tone="neutral">
                  Page {rowsMeta.page} of {Math.max(rowsMeta.pages, 1)}
                </Badge>
              </div>

              <Table scrollX>
                <THead>
                  <tr>
                    <TH>Time (IST)</TH>
                    <TH>Session</TH>
                    <TH>Tool</TH>
                    <TH className="text-right">Input</TH>
                    <TH className="text-right">Output</TH>
                    <TH className="text-right">Total</TH>
                  </tr>
                </THead>
                <TBody>
                  {rows.map((row) => {
                    const input = toNumber(row.input_token);
                    const output = toNumber(row.output_token);
                    const timestamp = row.timestamp ?? row.created_at;
                    const rawTool = row.tool_name ?? '';
                    const toolLabel = rawTool ? displayToolName(rawTool) : 'Unknown';
                    return (
                      <TR key={row.id}>
                        <TD className="whitespace-nowrap text-[12px] text-[var(--neutral-sub-600)]">
                          {formatDateTimeIST(timestamp)}
                        </TD>
                        <TD>
                          <CodeChip title={row.session_id || ''}>
                            {row.session_id ? sessionLabel(row.session_id, sessionLabels) : 'Unavailable'}
                          </CodeChip>
                        </TD>
                        <TD>
                          <CodeChip title={toolLabel}>{toolLabel}</CodeChip>
                        </TD>
                        <TD className="text-right tabular-nums">{input.toLocaleString()}</TD>
                        <TD className="text-right tabular-nums">{output.toLocaleString()}</TD>
                        <TD className="text-right font-semibold tabular-nums">
                          {(input + output).toLocaleString()}
                        </TD>
                      </TR>
                    );
                  })}
                </TBody>
              </Table>
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-[12px] border border-[var(--stroke-soft-200)] bg-white px-4 py-3 shadow-[0_1px_2px_rgba(23,23,23,0.04)]">
                <p className="text-xs text-[var(--neutral-soft-400)]">
                  Showing{' '}
                  <span className="font-medium text-[var(--neutral-strong-950)]">
                    {rowsMeta.total === 0 ? 0 : (rowsMeta.page - 1) * rowsMeta.page_size + 1}
                    {' '}to{' '}
                    {Math.min(rowsMeta.page * rowsMeta.page_size, rowsMeta.total)}
                  </span>{' '}
                  of{' '}
                  <span className="font-medium text-[var(--neutral-strong-950)]">
                    {rowsMeta.total.toLocaleString()}
                  </span>{' '}
                  raw rows
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={rowsPage <= 1}
                    onClick={() => setRowsPage((current) => Math.max(1, current - 1))}
                  >
                    Previous
                  </Button>
                  <span className="text-[12px] text-[var(--neutral-soft-400)]">
                    Page {rowsMeta.page} of {Math.max(rowsMeta.pages, 1)}
                  </span>
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={rowsMeta.pages <= 1 || rowsPage >= rowsMeta.pages}
                    onClick={() =>
                      setRowsPage((current) => Math.min(Math.max(rowsMeta.pages, 1), current + 1))
                    }
                  >
                    Next
                  </Button>
                </div>
              </div>
            </motion.section>
          </>
        )}
      </div>
    </>
  );
}

function UsageRangeTabs({
  value,
  onChange,
}: {
  value: UsageRange;
  onChange: (next: UsageRange) => void;
}) {
  return (
    <div className="inline-flex flex-wrap rounded-[10px] border border-[var(--stroke-soft-200)] bg-white p-1 shadow-[var(--shadow-regular-xs)]">
      {USAGE_RANGE_OPTIONS.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={
              active
                ? 'h-8 rounded-[8px] bg-[var(--information-lighter)] px-3 text-[12px] font-medium text-[var(--info-dark)]'
                : 'h-8 rounded-[8px] px-3 text-[12px] font-medium text-[var(--neutral-sub-600)] transition-colors hover:bg-[var(--neutral-weak-50)] hover:text-[var(--neutral-strong-950)]'
            }
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

function InsightRow({
  icon,
  label,
  value,
  meta,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  meta: string;
}) {
  return (
    <div className="rounded-[10px] border border-[var(--stroke-soft-200)] bg-[var(--neutral-weak-50)] px-3.5 py-3">
      <div className="flex items-start gap-3">
        <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] border border-[var(--stroke-soft-200)] bg-white text-[var(--neutral-sub-600)]">
          {icon}
        </span>
        <div className="min-w-0">
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.07em] text-[var(--neutral-soft-400)]">
            {label}
          </p>
          <p className="mt-1 text-[13px] font-semibold text-[var(--neutral-strong-950)]">
            {value}
          </p>
          <p className="mt-1 text-[11.5px] text-[var(--neutral-sub-600)]">{meta}</p>
        </div>
      </div>
    </div>
  );
}

function SessionChartTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: TooltipItem[];
}) {
  if (!active || !payload?.length) return null;

  const row = payload[0]?.payload as SessionChartRow | undefined;
  if (!row) return null;

  return (
    <div className="min-w-[200px] rounded-[10px] border border-[var(--stroke-soft-200)] bg-white p-3 shadow-[0_8px_24px_rgba(23,23,23,0.08)]">
      <p className="text-[10.5px] font-semibold uppercase tracking-[0.07em] text-[var(--neutral-soft-400)]">
        Session
      </p>
      <div className="mt-1 flex items-center gap-2">
        <CodeChip>{row.label}</CodeChip>
        <CodeChip title={row.sessionId}>{row.sessionId}</CodeChip>
      </div>
      <div className="mt-3 space-y-1.5 text-[12px]">
        {payload.map((item) => (
          <div key={`${item.dataKey}`} className="flex items-center justify-between gap-4">
            <span className="inline-flex items-center gap-2 text-[var(--neutral-sub-600)]">
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: item.color }}
                aria-hidden
              />
              {item.name}
            </span>
            <span className="font-semibold tabular-nums text-[var(--neutral-strong-950)]">
              {typeof item.value === 'number' ? item.value.toLocaleString() : item.value}
            </span>
          </div>
        ))}
      </div>
      <div className="mt-3 border-t border-[var(--stroke-soft-200)] pt-2 text-[11.5px] text-[var(--neutral-sub-600)]">
        <div className="flex items-center justify-between gap-4">
          <span>Total</span>
          <span className="font-semibold tabular-nums text-[var(--neutral-strong-950)]">
            {row.total.toLocaleString()}
          </span>
        </div>
        <div className="mt-1 flex items-center justify-between gap-4">
          <span>Calls</span>
          <span className="font-semibold tabular-nums text-[var(--neutral-strong-950)]">
            {row.calls.toLocaleString()}
          </span>
        </div>
      </div>
    </div>
  );
}

function DistributionCard({
  eyebrow,
  title,
  subtitle,
  data,
  emptyDescription,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
  data: DistributionSlice[];
  emptyDescription: string;
}) {
  const total = data.reduce((sum, item) => sum + item.value, 0);

  return (
    <Card>
      <CardHeader>
        <div className="min-w-0">
          <CardEyebrow>{eyebrow}</CardEyebrow>
          <CardTitle>{title}</CardTitle>
          <p className="mt-1 text-[11.5px] text-[var(--neutral-soft-400)]">{subtitle}</p>
        </div>
        <Badge tone="neutral">{data.length} groups</Badge>
      </CardHeader>
      <CardBody>
        {data.length === 0 ? (
          <EmptyState
            compact
            icon={<Layers3 className="h-4 w-4" />}
            title="No breakdown data"
            description={emptyDescription}
          />
        ) : (
          <div className="grid gap-5 lg:grid-cols-[240px_minmax(0,1fr)] lg:items-center">
            <div className="relative flex h-[240px] items-center justify-center">
              <ChartContainer
                config={DISTRIBUTION_CHART_CONFIG}
                className="h-full w-full max-w-[240px]"
              >
                <PieChart>
                  <ChartTooltip cursor={false} content={<DistributionTooltip />} />
                  <Pie
                    data={data}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={56}
                    outerRadius={86}
                    paddingAngle={2}
                    stroke="var(--white-0)"
                    strokeWidth={2}
                  >
                    {data.map((item, index) => (
                      <Cell
                        key={`${item.name}-${index}`}
                        fill={PIE_COLORS[index % PIE_COLORS.length]}
                      />
                    ))}
                  </Pie>
                </PieChart>
              </ChartContainer>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <p className="text-[10.5px] font-semibold uppercase tracking-[0.07em] text-[var(--neutral-soft-400)]">
                  Total
                </p>
                <p className="mt-1 text-[24px] font-semibold tracking-[-0.03em] tabular-nums text-[var(--neutral-strong-950)]">
                  {total.toLocaleString()}
                </p>
                <p className="mt-1 text-[11px] text-[var(--neutral-soft-400)]">tokens</p>
              </div>
            </div>

            <div className="space-y-2">
              {data.map((item, index) => {
                const share = total ? Math.round((item.value / total) * 100) : 0;
                return (
                  <div
                    key={`${item.name}-${index}`}
                    className="rounded-[10px] border border-[var(--stroke-soft-200)] px-3 py-2.5"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span
                            className="h-2.5 w-2.5 shrink-0 rounded-full"
                            style={{ backgroundColor: PIE_COLORS[index % PIE_COLORS.length] }}
                            aria-hidden
                          />
                          <p className="truncate text-[12.5px] font-semibold text-[var(--neutral-strong-950)]">
                            {item.name}
                          </p>
                        </div>
                        <p className="mt-1 text-[11px] text-[var(--neutral-sub-600)]">
                          {item.calls.toLocaleString()} calls, {share}% of tokens
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-[12.5px] font-semibold tabular-nums text-[var(--neutral-strong-950)]">
                          {item.value.toLocaleString()}
                        </p>
                        <p className="mt-1 text-[10.5px] tabular-nums text-[var(--neutral-soft-400)]">
                          {item.input.toLocaleString()} in, {item.output.toLocaleString()} out
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </CardBody>
    </Card>
  );
}

function DistributionTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: TooltipItem[];
}) {
  if (!active || !payload?.length) return null;

  const row = payload[0]?.payload as DistributionSlice | undefined;
  if (!row) return null;

  return (
    <div className="min-w-[180px] rounded-[10px] border border-[var(--stroke-soft-200)] bg-white p-3 shadow-[0_8px_24px_rgba(23,23,23,0.08)]">
      <p className="text-[12.5px] font-semibold text-[var(--neutral-strong-950)]">{row.name}</p>
      <div className="mt-2 space-y-1.5 text-[12px] text-[var(--neutral-sub-600)]">
        <div className="flex items-center justify-between gap-4">
          <span>Tokens</span>
          <span className="font-semibold tabular-nums text-[var(--neutral-strong-950)]">
            {row.value.toLocaleString()}
          </span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span>Input</span>
          <span className="font-semibold tabular-nums text-[var(--neutral-strong-950)]">
            {row.input.toLocaleString()}
          </span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span>Output</span>
          <span className="font-semibold tabular-nums text-[var(--neutral-strong-950)]">
            {row.output.toLocaleString()}
          </span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span>Calls</span>
          <span className="font-semibold tabular-nums text-[var(--neutral-strong-950)]">
            {row.calls.toLocaleString()}
          </span>
        </div>
      </div>
    </div>
  );
}
