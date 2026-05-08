'use client';

import { type ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import { Coins, Database, Sigma, Sparkles, Wallet } from 'lucide-react';
import {
  Area,
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import Topbar from '@/components/layout/Topbar';
import EmptyState from '@/components/ui/EmptyState';
import ErrorBanner from '@/components/ui/ErrorBanner';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { useAutoRefresh, useUser } from '@/lib/hooks';
import { api } from '@/lib/api';
import { TokenMeterResponse } from '@/lib/types';

type HourBucket = {
  label: string;
  input: number;
  output: number;
  total: number;
};

type SessionBucket = {
  label: string;
  session: string;
  input: number;
  output: number;
  total: number;
};

/** Series colors: high contrast on dark UI (input / output / total). */
const CHART = {
  input: '#0ea5e9',
  output: '#f59e0b',
  total: '#a855f7',
} as const;

const PIE_COLORS = [CHART.input, CHART.output];

const TZ_IST = 'Asia/Kolkata';

/** Parse API datetime; strings without timezone are treated as UTC (typical server storage). */
function parseApiDate(value: string): Date {
  const s = value.trim();
  if (!s) return new Date(NaN);
  if (/[zZ]$|[+-]\d{2}:?\d{2}$/.test(s)) return new Date(s);
  const normalized = s.includes('T') ? s : s.replace(' ', 'T');
  if (normalized.includes('T')) return new Date(`${normalized}Z`);
  return new Date(s);
}

function toNumber(v: unknown): number {
  const parsed = Number(v);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatDateKeyIST(d: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ_IST,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

function getHourIST(d: Date): number {
  const hour = new Intl.DateTimeFormat('en-US', {
    timeZone: TZ_IST,
    hour: 'numeric',
    hourCycle: 'h23',
  }).formatToParts(d).find((p) => p.type === 'hour')?.value;
  return hour != null ? parseInt(hour, 10) : 0;
}

function istMinuteKey(d: Date): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: TZ_IST,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(d);
  const get = (t: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === t)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}-${get('hour')}-${get('minute')}`;
}

function formatTimeIST(value?: string): string {
  if (!value) return '—';
  const d = parseApiDate(value);
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: TZ_IST,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  }).format(d);
}

function isTodayIST(value?: string): boolean {
  if (!value) return true;
  const d = parseApiDate(value);
  if (Number.isNaN(d.getTime())) return true;
  const now = new Date();
  return formatDateKeyIST(d) === formatDateKeyIST(now);
}

export default function TokenSpenditurePage() {
  const { user, isLoading: userLoading } = useUser();
  const [rows, setRows] = useState<TokenMeterResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!user?.id) {
      if (!userLoading) {
        setRows([]);
        setLoading(false);
      }
      return;
    }

    setLoading(true);
    try {
      const data = await api.getUserTokenUsage(user.id);
      setRows(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load token usage');
    } finally {
      setLoading(false);
    }
  }, [user?.id, userLoading]);

  useEffect(() => {
    if (user?.id) {
      fetchData();
    } else if (!userLoading) {
      setRows([]);
      setLoading(false);
    }
  }, [user?.id, userLoading, fetchData]);

  const { lastUpdated } = useAutoRefresh(fetchData, 30000);

  const todayRows = useMemo(() => {
    return rows.filter((row) => isTodayIST(row.timestamp ?? row.created_at));
  }, [rows]);

  const summary = useMemo(() => {
    const input = todayRows.reduce((acc, row) => acc + toNumber(row.input_token), 0);
    const output = todayRows.reduce((acc, row) => acc + toNumber(row.output_token), 0);
    const total = input + output;
    const sessions = new Set(todayRows.map((row) => row.session_id)).size;
    return { input, output, total, sessions, count: todayRows.length };
  }, [todayRows]);

  const hourlyData = useMemo<HourBucket[]>(() => {
    const buckets = new Map<number, HourBucket>();
    for (let h = 0; h < 24; h += 1) {
      const label = `${String(h).padStart(2, '0')}:00`;
      buckets.set(h, { label, input: 0, output: 0, total: 0 });
    }

    for (const row of todayRows) {
      const source = row.timestamp ?? row.created_at;
      const d = source ? parseApiDate(source) : null;
      if (!d || Number.isNaN(d.getTime())) continue;
      const bucket = buckets.get(getHourIST(d));
      if (!bucket) continue;
      bucket.input += toNumber(row.input_token);
      bucket.output += toNumber(row.output_token);
      bucket.total = bucket.input + bucket.output;
    }
    return Array.from(buckets.values());
  }, [todayRows]);

  const hasTimestampedRows = useMemo(
    () => todayRows.some((row) => !!row.timestamp || !!row.created_at),
    [todayRows]
  );

  const uniqueTimestampCount = useMemo(() => {
    const keys = new Set(
      todayRows
        .map((row) => row.timestamp ?? row.created_at)
        .filter((value): value is string => !!value)
        .map((value) => {
          const d = parseApiDate(value);
          if (Number.isNaN(d.getTime())) return null;
          return istMinuteKey(d);
        })
        .filter((value): value is string => !!value)
    );
    return keys.size;
  }, [todayRows]);

  const timelineHasSignal = useMemo(() => {
    if (!hasTimestampedRows) return false;
    return uniqueTimestampCount > 1;
  }, [hasTimestampedRows, uniqueTimestampCount]);

  const sessionData = useMemo<SessionBucket[]>(() => {
    const map = new Map<string, SessionBucket>();
    for (const row of todayRows) {
      const sid = row.session_id || 'unknown';
      if (!map.has(sid)) {
        map.set(sid, {
          label: `${sid.slice(0, 6)}...`,
          session: sid,
          input: 0,
          output: 0,
          total: 0,
        });
      }
      const bucket = map.get(sid);
      if (!bucket) continue;
      bucket.input += toNumber(row.input_token);
      bucket.output += toNumber(row.output_token);
      bucket.total = bucket.input + bucket.output;
    }
    return Array.from(map.values())
      .sort((a, b) => b.total - a.total);
  }, [todayRows]);

  const activityData = useMemo<HourBucket[] | SessionBucket[]>(() => {
    if (timelineHasSignal) return hourlyData;
    if (hasTimestampedRows) return sessionData;
    return todayRows.map((row, idx) => {
      const input = toNumber(row.input_token);
      const output = toNumber(row.output_token);
      return {
        label: `#${idx + 1}`,
        input,
        output,
        total: input + output,
      };
    });
  }, [timelineHasSignal, hourlyData, hasTimestampedRows, sessionData, todayRows]);

  const pieData = useMemo(
    () => [
      { name: 'Input', value: summary.input },
      { name: 'Output', value: summary.output },
    ],
    [summary.input, summary.output]
  );

  if (userLoading || loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Topbar
        title="Token Spenditure"
        subtitle="Daily token usage for your account"
        lastUpdated={lastUpdated}
        onRefresh={fetchData}
      />

      <div className="space-y-6 p-6">
        {error && (
          <ErrorBanner message={error} onDismiss={() => setError(null)} onRetry={fetchData} />
        )}

        <div className="relative overflow-hidden rounded-2xl border border-violet-500/30 bg-gradient-to-br from-violet-500/20 via-purple-500/10 to-cyan-500/10 p-5">
          <div className="pointer-events-none absolute -right-12 -top-12 h-36 w-36 rounded-full bg-violet-500/25 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-14 left-8 h-32 w-32 rounded-full bg-cyan-500/20 blur-3xl" />
          <div className="relative flex items-center justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-wider text-violet-200/80">Token spenditure</p>
              <h2 className="mt-1 text-xl font-semibold text-white">Today you used {summary.total.toLocaleString()} tokens</h2>
              <p className="mt-2 text-sm text-violet-100/80">
                {summary.count.toLocaleString()} actions across {summary.sessions.toLocaleString()} sessions
              </p>
            </div>
            <div className="hidden rounded-xl border border-white/20 bg-white/10 p-3 text-white md:flex">
              <Sparkles className="h-5 w-5" />
            </div>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard title="Total tokens today" value={summary.total} icon={<Coins className="h-4 w-4" />} accent="violet" />
          <MetricCard title="Input tokens" value={summary.input} icon={<Database className="h-4 w-4" />} accent="cyan" />
          <MetricCard title="Output tokens" value={summary.output} icon={<Sigma className="h-4 w-4" />} accent="purple" />
          <MetricCard title="Sessions used" value={summary.sessions} icon={<Wallet className="h-4 w-4" />} accent="emerald" />
        </div>

        {todayRows.length === 0 ? (
          <div className="rounded-md border border-border bg-card">
            <EmptyState
              icon={<Coins className="h-6 w-6" />}
              title="No token usage today"
              description="Token records for today will appear here as actions are executed."
            />
          </div>
        ) : (
          <div className="grid gap-6 xl:grid-cols-3">
            <div className="rounded-2xl border border-border/80 bg-card/80 p-4 shadow-sm backdrop-blur-sm xl:col-span-2">
              <div className="mb-4">
                <h2 className="text-sm font-semibold text-foreground">Usage timeline</h2>
                <p className="text-xs text-muted-foreground">
                  {timelineHasSignal
                    ? 'Interactive timeline for input, output, and total tokens. Hour labels are India Standard Time (IST).'
                    : hasTimestampedRows
                      ? 'Session-wise usage view (timestamps are identical in this dataset).'
                      : 'Interactive usage chart (timestamps not returned by API).'}
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                  <LegendPill label="Total" color={CHART.total} />
                  <LegendPill label="Input" color={CHART.input} />
                  <LegendPill label="Output" color={CHART.output} />
                </div>
              </div>
              <div className="h-[340px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={activityData}>
                    <defs>
                      <linearGradient id="tokenTotalGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={CHART.total} stopOpacity={0.35} />
                        <stop offset="95%" stopColor={CHART.total} stopOpacity={0.06} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis
                      dataKey="label"
                      tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }}
                      interval={0}
                      angle={timelineHasSignal ? 0 : -20}
                      textAnchor={timelineHasSignal ? 'middle' : 'end'}
                      height={timelineHasSignal ? 36 : 50}
                    />
                    <YAxis tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }} />
                    <Tooltip
                      cursor={{ fill: 'rgba(168, 85, 247, 0.08)' }}
                      contentStyle={{
                        background: 'var(--card)',
                        border: '1px solid var(--border)',
                        borderRadius: 8,
                        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.22)',
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="total"
                      stroke={CHART.total}
                      strokeWidth={2}
                      fill="url(#tokenTotalGradient)"
                    />
                    <Bar dataKey="input" fill={CHART.input} radius={[4, 4, 0, 0]} />
                    <Bar dataKey="output" fill={CHART.output} radius={[4, 4, 0, 0]} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="rounded-2xl border border-border/80 bg-card/80 p-4 shadow-sm backdrop-blur-sm">
              <div className="mb-4">
                <h2 className="text-sm font-semibold text-foreground">Input vs output split</h2>
                <p className="text-xs text-muted-foreground">Distribution of tokens used today.</p>
              </div>
              <div className="h-[340px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={110}
                      innerRadius={65}
                      paddingAngle={3}
                      label={({ percent }) => `${((percent || 0) * 100).toFixed(0)}%`}
                    >
                      {pieData.map((entry, idx) => (
                        <Cell key={entry.name} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        background: 'var(--card)',
                        border: '1px solid var(--border)',
                        borderRadius: 8,
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}

        <div className="rounded-md border border-border bg-card">
          <div className="border-b border-border px-4 py-3">
            <h2 className="text-sm font-medium text-foreground">Recent usage records (today, IST)</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-muted/30 text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 text-left font-medium">Time (IST)</th>
                  <th className="px-4 py-2 text-left font-medium">Session</th>
                  <th className="px-4 py-2 text-left font-medium">Input</th>
                  <th className="px-4 py-2 text-left font-medium">Output</th>
                  <th className="px-4 py-2 text-left font-medium">Total</th>
                </tr>
              </thead>
              <tbody>
                {todayRows.map((row) => {
                  const input = toNumber(row.input_token);
                  const output = toNumber(row.output_token);
                  return (
                    <tr key={row.id} className="border-t border-border">
                      <td className="whitespace-nowrap px-4 py-2 text-xs text-muted-foreground">
                        {formatTimeIST(row.timestamp ?? row.created_at)}
                      </td>
                      <td className="px-4 py-2 font-mono text-xs text-muted-foreground">
                        {row.session_id?.slice(0, 8)}...
                      </td>
                      <td className="px-4 py-2 text-foreground">{input.toLocaleString()}</td>
                      <td className="px-4 py-2 text-foreground">{output.toLocaleString()}</td>
                      <td className="px-4 py-2 font-medium text-foreground">
                        {(input + output).toLocaleString()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="border-t border-border px-4 py-2 text-xs text-muted-foreground">
            {todayRows.length} record{todayRows.length !== 1 ? 's' : ''} today (times in India Standard Time).
          </div>
        </div>
      </div>
    </div>
  );
}

function MetricCard({
  title,
  value,
  icon,
  accent,
}: {
  title: string;
  value: number;
  icon: ReactNode;
  accent: 'violet' | 'cyan' | 'purple' | 'emerald';
}) {
  const styles = {
    violet: {
      card: 'border-violet-500/30 bg-gradient-to-br from-violet-500/15 to-violet-500/5',
      icon: 'bg-violet-500/20 text-violet-200',
      value: 'text-violet-100',
    },
    cyan: {
      card: 'border-cyan-500/30 bg-gradient-to-br from-cyan-500/15 to-cyan-500/5',
      icon: 'bg-cyan-500/20 text-cyan-200',
      value: 'text-cyan-100',
    },
    purple: {
      card: 'border-purple-500/30 bg-gradient-to-br from-purple-500/15 to-purple-500/5',
      icon: 'bg-purple-500/20 text-purple-200',
      value: 'text-purple-100',
    },
    emerald: {
      card: 'border-emerald-500/30 bg-gradient-to-br from-emerald-500/15 to-emerald-500/5',
      icon: 'bg-emerald-500/20 text-emerald-200',
      value: 'text-emerald-100',
    },
  }[accent];

  return (
    <div className={`rounded-2xl border p-4 shadow-sm ${styles.card}`}>
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs text-muted-foreground">{title}</p>
        <div className={`rounded-lg p-2 ${styles.icon}`}>{icon}</div>
      </div>
      <p className={`text-2xl font-semibold ${styles.value}`}>{value.toLocaleString()}</p>
    </div>
  );
}

function LegendPill({ label, color }: { label: string; color: string }) {
  return (
    <div className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/40 px-2 py-1">
      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  );
}
