'use client';

import { useCallback, useEffect, useState } from 'react';
import { ChevronDown, Loader2, Zap } from 'lucide-react';
import { api, type WorkspaceRun } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { cn, formatExecutionTimeMs } from '@/lib/utils';
import { PanelEmpty } from './PanelEmpty';

function statusClass(status: string) {
  const key = status.toLowerCase();
  if (key === 'success' || key === 'ok' || key === 'completed') {
    return 'text-[var(--success-dark)] bg-[rgba(31,193,107,0.12)]';
  }
  if (key === 'failed' || key === 'error') {
    return 'text-[var(--error-dark)] bg-[var(--error-lighter)]';
  }
  if (key === 'running' || key === 'in_progress') {
    return 'text-[var(--primary-dark)] bg-[var(--primary-alpha-10)]';
  }
  return 'text-[var(--neutral-sub-600)] bg-[var(--neutral-weak-50)]';
}

function prettyJson(value: unknown) {
  if (value == null) return '—';
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

export function WorkspaceRunsPanel({
  workspaceId,
  onTotalChange,
}: {
  workspaceId: string;
  onTotalChange?: (total: number) => void;
}) {
  const [items, setItems] = useState<WorkspaceRun[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [details, setDetails] = useState<Record<string, WorkspaceRun>>({});
  const [detailError, setDetailError] = useState<string | null>(null);
  const limit = 20;

  const loadPage = useCallback(
    async (nextOffset: number, append: boolean) => {
      if (append) setLoadingMore(true);
      else setLoading(true);
      setError(null);
      try {
        const page = await api.getWorkspaceRuns(workspaceId, { limit, offset: nextOffset });
        setItems((current) => (append ? [...current, ...page.items] : page.items));
        setTotal(page.total);
        setOffset(nextOffset);
        onTotalChange?.(page.total);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not load runs.');
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [workspaceId, onTotalChange],
  );

  useEffect(() => {
    setItems([]);
    setOpenId(null);
    setDetails({});
    void loadPage(0, false);
  }, [loadPage]);

  const openRun = async (id: string) => {
    if (openId === id) {
      setOpenId(null);
      return;
    }
    setOpenId(id);
    setDetailError(null);
    if (details[id]) return;
    try {
      const row = await api.getWorkspaceRun(id);
      setDetails((current) => ({ ...current, [id]: row }));
    } catch (e) {
      setDetailError(e instanceof Error ? e.message : 'Could not load run detail.');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-12 text-[13px] text-[var(--neutral-sub-600)]">
        <Loader2 size={14} className="animate-spin" />
        Loading runs…
      </div>
    );
  }

  if (error) {
    return (
      <div className="px-4 py-6">
        <p className="text-[13px] text-[var(--error-dark)]">{error}</p>
        <Button variant="secondary" size="sm" className="mt-3" onClick={() => void loadPage(0, false)}>
          Retry
        </Button>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <PanelEmpty
        icon={Zap}
        title="No runs yet"
        hint="Tool executions for this workspace will show up here."
      />
    );
  }

  return (
    <div className="px-3 py-2">
      <ul className="divide-y divide-[var(--stroke-soft-200)]">
        {items.map((run) => {
          const open = openId === run.id;
          const detail = details[run.id] ?? run;
          return (
            <li key={run.id}>
              <button
                type="button"
                onClick={() => void openRun(run.id)}
                className="flex w-full items-start gap-3 px-2 py-2.5 text-left hover:bg-[var(--neutral-weak-50)]"
              >
                <ChevronDown
                  size={14}
                  className={cn(
                    'mt-0.5 shrink-0 text-[var(--neutral-soft-400)] transition-transform',
                    open && 'rotate-180',
                  )}
                />
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-1.5">
                    <span className="font-mono text-[12.5px] font-medium text-[var(--neutral-strong-950)]">
                      {run.tool_name}
                    </span>
                    <span
                      className={cn(
                        'rounded px-1.5 py-px text-[10.5px] font-medium capitalize',
                        statusClass(run.status),
                      )}
                    >
                      {run.status}
                    </span>
                  </span>
                  <span className="mt-0.5 block text-[11.5px] text-[var(--neutral-sub-600)]">
                    {run.agent_handle ? `@${run.agent_handle}` : 'Unknown agent'}
                    {run.execution_time_ms != null && (
                      <> · {formatExecutionTimeMs(run.execution_time_ms)}</>
                    )}
                  </span>
                </span>
              </button>
              {open && (
                <div className="mb-2 ml-7 rounded-md border border-[var(--stroke-soft-200)] bg-[var(--bg-surface-alt)] p-3">
                  {detailError && openId === run.id ? (
                    <p className="text-[12px] text-[var(--error-dark)]">{detailError}</p>
                  ) : (
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <p className="text-[10.5px] font-medium uppercase tracking-[0.04em] text-[var(--neutral-soft-400)]">
                          Arguments
                        </p>
                        <pre className="mt-1 max-h-48 overflow-auto whitespace-pre-wrap font-mono text-[11.5px] leading-[1.5] text-[var(--neutral-strong-950)]">
                          {prettyJson(detail.arguments)}
                        </pre>
                      </div>
                      <div>
                        <p className="text-[10.5px] font-medium uppercase tracking-[0.04em] text-[var(--neutral-soft-400)]">
                          Result
                        </p>
                        <pre className="mt-1 max-h-48 overflow-auto whitespace-pre-wrap font-mono text-[11.5px] leading-[1.5] text-[var(--neutral-strong-950)]">
                          {prettyJson(detail.result_payload)}
                        </pre>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
      {items.length < total && (
        <div className="px-2 py-3">
          <Button
            variant="secondary"
            size="sm"
            disabled={loadingMore}
            onClick={() => void loadPage(offset + limit, true)}
          >
            {loadingMore ? 'Loading…' : `Load more (${items.length} of ${total})`}
          </Button>
        </div>
      )}
    </div>
  );
}
