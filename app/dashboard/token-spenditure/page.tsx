'use client';

/**
 * Usage — `/dashboard/token-spenditure`.
 *
 * Tokens only. Summary + tool_chart from GET /api/v3/analytics/token-usage.
 * Daily stacked bars are bucketed from GET /api/v3/analytics/token-usage/runs
 * timestamps. Do not invent prices, failed counts, or extra tools.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { DateRange } from 'react-day-picker';
import { Bar, BarChart, XAxis } from 'recharts';
import Topbar from '@/components/layout/Topbar';
import { Button } from '@/components/ui/Button';
import { DateRangePicker } from '@/components/ui/DateRangePicker';
import EmptyState from '@/components/ui/EmptyState';
import ErrorBanner from '@/components/ui/ErrorBanner';
import { TokenSpendSkeleton } from '@/components/ui/PageSkeletons';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/Table';
import {
  ChartContainer,
  ChartTooltip,
  type ChartConfig,
} from '@/components/ui/chart';
import { formatDashboardDateRangeLabel } from '@/lib/dashboardDateRange';
import { api } from '@/lib/api';
import { useAutoRefresh, useUser } from '@/lib/hooks';
import type {
  TokenAnalyticsDateRange,
  TokenAnalyticsResponse,
  TokenUsageChartItem,
  TokenUsageSessionItem,
} from '@/lib/types';
import { parseApiUtcTimestamp } from '@/lib/utils';
import { BarChart3 } from 'lucide-react';

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

const emptyAnalytics: TokenAnalyticsResponse = {
  user_id: '',
  date_range: '30d',
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

const DAILY_CHART_CONFIG = {
  input: { label: 'input', color: 'var(--neutral-sub-300)' },
  output: { label: 'output', color: 'var(--primary-base)' },
} satisfies ChartConfig;

const RUNS_LIMIT = 500;

function startOfLocalDay(date: Date): Date {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function endOfLocalDay(date: Date): Date {
  const next = new Date(date);
  next.setHours(23, 59, 59, 999);
  return next;
}

function isSameLocalDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function last30DaysRange(now = new Date()): DateRange {
  const to = startOfLocalDay(now);
  const from = new Date(to);
  from.setDate(from.getDate() - 29);
  return { from, to };
}

function toNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatCompact(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) {
    const scaled = value / 1_000_000;
    const digits = abs >= 10_000_000 ? 0 : 1;
    return `${scaled.toFixed(digits).replace(/\.0$/, '')}M`;
  }
  if (abs >= 10_000) {
    const scaled = value / 1_000;
    const digits = abs >= 100_000 ? 0 : 1;
    return `${scaled.toFixed(digits).replace(/\.0$/, '')}k`;
  }
  return value.toLocaleString();
}

function percentOf(part: number, total: number): number {
  if (!total) return 0;
  return Math.round((part / total) * 100);
}

function dayKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function enumerateDays(from: Date, to: Date): string[] {
  const days: string[] = [];
  const cursor = startOfLocalDay(from);
  const end = startOfLocalDay(to);
  while (cursor.getTime() <= end.getTime()) {
    days.push(dayKey(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return days;
}

function analyticsFiltersForRange(range: DateRange | undefined): {
  date_range: TokenAnalyticsDateRange;
  start_date?: string;
  end_date?: string;
} {
  if (!range?.from) return { date_range: 'all' };

  const from = startOfLocalDay(range.from);
  const to = startOfLocalDay(range.to ?? range.from);
  const today = startOfLocalDay(new Date());
  const dayCount =
    Math.round((to.getTime() - from.getTime()) / (24 * 60 * 60 * 1000)) + 1;

  if (isSameLocalDay(from, today) && isSameLocalDay(to, today)) {
    return { date_range: 'today' };
  }
  if (isSameLocalDay(to, today) && dayCount === 7) return { date_range: '7d' };
  if (isSameLocalDay(to, today) && dayCount === 30) return { date_range: '30d' };
  if (isSameLocalDay(to, today) && dayCount === 90) return { date_range: '90d' };

  return {
    date_range: 'custom',
    start_date: from.toISOString(),
    end_date: endOfLocalDay(range.to ?? range.from).toISOString(),
  };
}

type DailyRow = {
  date: string;
  label: string;
  input: number;
  output: number;
  total: number;
};

function buildDailyRows(
  sessions: TokenUsageSessionItem[],
  range: DateRange | undefined,
): DailyRow[] {
  const today = startOfLocalDay(new Date());
  const from = range?.from ? startOfLocalDay(range.from) : today;
  const to = range?.to ? startOfLocalDay(range.to) : from;
  const keys = enumerateDays(from, to);
  const buckets = new Map(keys.map((key) => [key, { input: 0, output: 0 }]));

  for (const session of sessions) {
    const stamp = session.last_seen_at ?? session.first_seen_at;
    if (!stamp) continue;
    const parsed = parseApiUtcTimestamp(stamp);
    if (Number.isNaN(parsed.getTime())) continue;
    const key = dayKey(parsed);
    const bucket = buckets.get(key);
    if (!bucket) continue;
    bucket.input += toNumber(session.input_tokens);
    bucket.output += toNumber(session.output_tokens);
  }

  return keys.map((date) => {
    const bucket = buckets.get(date) ?? { input: 0, output: 0 };
    const [year, month, day] = date.split('-');
    const label = `${Number(month)}/${Number(day)}`;
    void year;
    return {
      date,
      label,
      input: bucket.input,
      output: bucket.output,
      total: bucket.input + bucket.output,
    };
  });
}

function downloadJson(filename: string, payload: unknown) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export default function TokenSpenditurePage() {
  const { user, isLoading: userLoading } = useUser();
  const demo = useMemo(() => isDemoMode(), []);
  const effectiveUserId = user?.id ?? (demo ? 'preview-user' : null);

  const [analytics, setAnalytics] = useState<TokenAnalyticsResponse>(emptyAnalytics);
  const [sessions, setSessions] = useState<TokenUsageSessionItem[]>([]);
  const [range, setRange] = useState<DateRange | undefined>(() => last30DaysRange());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const hydratedRef = useRef(false);

  const filters = useMemo(() => analyticsFiltersForRange(range), [range]);

  const fetchData = useCallback(async () => {
    if (!effectiveUserId) {
      if (!userLoading) {
        setAnalytics(emptyAnalytics);
        setSessions([]);
        setLoading(false);
      }
      return;
    }

    if (!hydratedRef.current) setLoading(true);
    try {
      const [tokenAnalytics, runs] = await Promise.all([
        api.getTokenUsageAnalytics(effectiveUserId, {
          ...filters,
          allocation: 'both',
        }),
        api.getTokenUsageSessions(effectiveUserId, {
          date_range: filters.date_range,
          start_date: filters.start_date,
          end_date: filters.end_date,
          limit: RUNS_LIMIT,
        }),
      ]);
      setAnalytics(tokenAnalytics);
      setSessions(Array.isArray(runs) ? runs : []);
      setError(null);
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : 'Failed to load token usage.');
    } finally {
      hydratedRef.current = true;
      setLoading(false);
    }
  }, [effectiveUserId, filters, userLoading]);

  useEffect(() => {
    if (effectiveUserId) {
      void fetchData();
      return;
    }
    if (!userLoading) {
      setAnalytics(emptyAnalytics);
      setSessions([]);
      setLoading(false);
    }
  }, [effectiveUserId, fetchData, userLoading]);

  const { lastUpdated } = useAutoRefresh(fetchData, 30000);
  const summary = analytics.summary;
  const total = toNumber(summary.total_tokens);
  const input = toNumber(summary.input_tokens);
  const output = toNumber(summary.output_tokens);
  const calls = toNumber(summary.tool_call_count);

  const dailyRows = useMemo(() => buildDailyRows(sessions, range), [sessions, range]);
  const toolRows = useMemo(() => {
    return [...analytics.tool_chart]
      .filter((item) => item && item.name)
      .sort((a, b) => toNumber(b.total_tokens) - toNumber(a.total_tokens));
  }, [analytics.tool_chart]);

  const rangeLabel =
    filters.date_range === 'today'
      ? 'today'
      : filters.date_range === '7d'
        ? 'last 7 days'
        : filters.date_range === '30d'
          ? 'last 30 days'
          : filters.date_range === '90d'
            ? 'last 90 days'
            : filters.date_range === 'all'
              ? 'all time'
              : formatDashboardDateRangeLabel(range, 'custom range');
  const hasDaily = dailyRows.some((row) => row.total > 0);

  const handleExport = () => {
    downloadJson(`aegis-usage-${filters.date_range}.json`, analytics);
  };

  if (userLoading || loading) {
    return (
      <>
        <Topbar title="Usage" />
        <div className="mx-auto max-w-[1320px] px-4 py-6 sm:px-6 sm:py-7 lg:px-8 lg:py-8">
          <TokenSpendSkeleton />
        </div>
      </>
    );
  }

  return (
    <>
      <Topbar title="Usage" lastUpdated={lastUpdated} onRefresh={fetchData} />

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

        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-[22px] font-semibold tracking-[-0.03em] text-[var(--neutral-strong-950)]">
              Usage
            </h1>
            <p className="mt-1 text-[13px] text-[var(--neutral-sub-600)]">
              tokens only · V1 has no prices anywhere
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <DateRangePicker
              value={range}
              onChange={setRange}
              defaultPreset="last30"
              size="sm"
            />
            <Button variant="secondary" size="sm" onClick={handleExport}>
              Export JSON
            </Button>
          </div>
        </div>

        <section className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Total tokens"
            value={formatCompact(total)}
            meta={`across ${calls.toLocaleString()} tool calls`}
          />
          <StatCard
            label="Input"
            value={formatCompact(input)}
            meta={`${percentOf(input, total)}% of the total`}
          />
          <StatCard
            label="Output"
            value={formatCompact(output)}
            meta={`${percentOf(output, total)}% of the total`}
          />
          <StatCard
            label="Tool calls"
            value={calls.toLocaleString()}
            meta="recorded in this window"
          />
        </section>

        <section className="mb-6 overflow-hidden rounded-[12px] border border-[var(--stroke-soft-200)] bg-[var(--white-0)]">
          <div className="px-4 py-3 sm:px-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--neutral-soft-400)]">
              Tokens per day
              <span className="font-medium normal-case tracking-normal">
                {' · '}
                {rangeLabel} — input and output stacked
              </span>
            </p>
          </div>
          <div className="px-2 pb-4 sm:px-4">
            {!hasDaily ? (
              <EmptyState
                compact
                icon={<BarChart3 className="h-5 w-5" />}
                title="No token usage in this window"
                description="Daily input and output appear here once runs record tokens."
              />
            ) : (
              <>
                <div className="h-[220px]">
                  <ChartContainer config={DAILY_CHART_CONFIG} className="h-full w-full">
                    <BarChart data={dailyRows} barCategoryGap="12%" margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
                      <XAxis
                        dataKey="label"
                        axisLine={false}
                        tickLine={false}
                        tickMargin={8}
                        interval="preserveStartEnd"
                        minTickGap={28}
                        tick={{ fill: 'var(--neutral-soft-400)', fontSize: 10 }}
                      />
                      <ChartTooltip cursor={false} content={<DailyTooltip />} />
                      <Bar
                        dataKey="input"
                        stackId="tokens"
                        fill="var(--color-input)"
                        maxBarSize={18}
                      />
                      <Bar
                        dataKey="output"
                        stackId="tokens"
                        fill="var(--color-output)"
                        radius={[3, 3, 0, 0]}
                        maxBarSize={18}
                      />
                    </BarChart>
                  </ChartContainer>
                </div>
                <div className="mt-2 flex items-center gap-4 px-2">
                  <LegendDot color="var(--neutral-sub-300)" label="input" />
                  <LegendDot color="var(--primary-base)" label="output" />
                </div>
              </>
            )}
          </div>
        </section>

        <section>
          <div className="mb-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--neutral-soft-400)]">
              By tool
              <span className="font-medium normal-case tracking-normal">
                {' · '}the API breaks usage down by category and by tool
              </span>
            </p>
          </div>
          {toolRows.length === 0 ? (
            <div className="overflow-hidden rounded-[12px] border border-[var(--stroke-soft-200)] bg-[var(--white-0)]">
              <EmptyState
                compact
                icon={<BarChart3 className="h-5 w-5" />}
                title="No tool breakdown"
                description="Tool rows come from tool_chart on the analytics payload."
              />
            </div>
          ) : (
            <Table>
              <THead>
                <tr>
                  <TH>Tool</TH>
                  <TH className="text-right">Calls</TH>
                  <TH className="text-right">Input</TH>
                  <TH className="text-right">Output</TH>
                  <TH className="text-right">Total</TH>
                  <TH className="w-[180px]">Share</TH>
                </tr>
              </THead>
              <TBody>
                {toolRows.map((row) => (
                  <ToolRow key={row.name} row={row} total={total} />
                ))}
              </TBody>
            </Table>
          )}
        </section>
      </div>
    </>
  );
}

function StatCard({
  label,
  value,
  meta,
}: {
  label: string;
  value: string;
  meta: string;
}) {
  return (
    <div className="rounded-[12px] border border-[var(--stroke-soft-200)] bg-[var(--white-0)] px-5 py-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--neutral-soft-400)]">
        {label}
      </p>
      <p className="mt-2 text-[28px] font-semibold leading-none tracking-[-0.04em] tabular-nums text-[var(--neutral-strong-950)]">
        {value}
      </p>
      <p className="mt-2 text-[12px] text-[var(--neutral-soft-400)]">{meta}</p>
    </div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[12px] text-[var(--neutral-sub-600)]">
      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} aria-hidden />
      {label}
    </span>
  );
}

function ToolRow({ row, total }: { row: TokenUsageChartItem; total: number }) {
  const share = percentOf(toNumber(row.total_tokens), total);
  return (
    <TR>
      <TD>
        <code className="text-[12.5px] text-[var(--neutral-strong-950)]">{row.name}</code>
      </TD>
      <TD className="text-right tabular-nums">{toNumber(row.tool_call_count).toLocaleString()}</TD>
      <TD className="text-right tabular-nums">{formatCompact(toNumber(row.input_tokens))}</TD>
      <TD className="text-right tabular-nums">{formatCompact(toNumber(row.output_tokens))}</TD>
      <TD className="text-right font-medium tabular-nums">
        {formatCompact(toNumber(row.total_tokens))}
      </TD>
      <TD>
        <div className="flex items-center gap-2.5">
          <div className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-[var(--neutral-weak-50)]">
            <div
              className="h-full rounded-full bg-[var(--primary-base)]"
              style={{ width: `${share}%` }}
            />
          </div>
          <span className="w-8 shrink-0 text-right text-[12px] tabular-nums text-[var(--neutral-sub-600)]">
            {share}%
          </span>
        </div>
      </TD>
    </TR>
  );
}

function DailyTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{
    color?: string;
    dataKey?: string | number;
    name?: string | number;
    value?: number | string;
    payload?: DailyRow;
  }>;
}) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload;
  if (!row) return null;

  return (
    <div className="min-w-[160px] rounded-[10px] border border-[var(--stroke-soft-200)] bg-[var(--white-0)] p-3 shadow-[0_8px_24px_rgba(23,23,23,0.08)]">
      <p className="text-[11px] font-semibold text-[var(--neutral-strong-950)]">{row.date}</p>
      <div className="mt-2 space-y-1.5 text-[12px]">
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
            <span className="font-medium tabular-nums text-[var(--neutral-strong-950)]">
              {typeof item.value === 'number' ? item.value.toLocaleString() : item.value}
            </span>
          </div>
        ))}
        <div className="flex items-center justify-between gap-4 border-t border-[var(--stroke-soft-200)] pt-1.5 text-[var(--neutral-sub-600)]">
          <span>total</span>
          <span className="font-medium tabular-nums text-[var(--neutral-strong-950)]">
            {row.total.toLocaleString()}
          </span>
        </div>
      </div>
    </div>
  );
}
