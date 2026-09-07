'use client';

/**
 * Connectors — `/dashboard/connectors`.
 *
 * Layout: header counts · per-person banner · SET UP rows · catalog grid.
 * Clicking a connector opens /dashboard/connectors/{key}.
 *
 * Attention = last_error or revoked_at. Test = POST /setup/{key}/test.
 * Do not invent extra vendors, 401 copy, or Test-without-saving.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Lock } from 'lucide-react';
import Topbar from '@/components/layout/Topbar';
import { CatalogIcon } from '@/components/connectors/CatalogIcon';
import { CONNECTORS } from '@/components/ui/ConnectorMark';
import ErrorBanner from '@/components/ui/ErrorBanner';
import { RelativeTime } from '@/components/ui/RelativeTime';
import { Skeleton } from '@/components/ui/Skeleton';
import { Switch } from '@/components/ui/Switch';
import { useToast } from '@/components/ui/Toast';
import { api } from '@/lib/api';
import {
  connectorAttentionLabel,
  connectorNeedsAttention,
  isKnownConnectorId,
} from '@/lib/connectorCredentials';
import { useUser } from '@/lib/hooks';
import type { ConnectorCatalogItem, PrivateConnectorCredentialStatus } from '@/lib/types';
import { cn } from '@/lib/utils';

const INTERNAL_KEYS = new Set(['memory', 'workspace']);

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

function humanizeKey(key: string): string {
  const aliases: Record<string, string> = {
    github_pat: 'token',
    api_key: 'api key',
    api_token: 'api token',
    connection_string: 'connection string',
  };
  return aliases[key] ?? key.replace(/_/g, ' ');
}

function keysSummary(keys: string[]): string {
  if (keys.length === 0) return 'credentials set';
  const labels = keys.map(humanizeKey);
  if (labels.length === 1) return `${labels[0]} set`;
  if (labels.length === 2) return `${labels[0]} and ${labels[1]} set`;
  return `${labels.slice(0, -1).join(', ')}, and ${labels[labels.length - 1]} all set`;
}

type SetupRowModel = {
  key: string;
  name: string;
  status: PrivateConnectorCredentialStatus;
  attention: boolean;
};

export default function ConnectorsPage() {
  const toast = useToast();
  const { user, isLoading: userLoading } = useUser();
  const demo = useMemo(() => isDemoMode(), []);

  const [catalog, setCatalog] = useState<ConnectorCatalogItem[] | null>(null);
  const [privateByKey, setPrivateByKey] = useState<Record<string, PrivateConnectorCredentialStatus>>({});
  const [error, setError] = useState<string | null>(null);
  const [togglingKey, setTogglingKey] = useState<string | null>(null);
  const [testingKey, setTestingKey] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!demo && !user?.id) return;
    setError(null);
    try {
      const [items, priv] = await Promise.all([
        api.getConnectorCatalog(false),
        api.getPrivateConnectorCredentials(),
      ]);
      setCatalog(items.filter((item) => !INTERNAL_KEYS.has(item.connector_key)));
      setPrivateByKey(Object.fromEntries(priv.map((s) => [s.connector_key, s])));
    } catch (err) {
      setCatalog([]);
      setError(err instanceof Error ? err.message : 'Could not load connectors.');
    }
  }, [demo, user?.id]);

  useEffect(() => {
    if (demo || user?.id) {
      void load();
      return;
    }
    if (!userLoading) setCatalog([]);
  }, [demo, user?.id, userLoading, load]);

  const catalogByKey = useMemo(
    () => Object.fromEntries((catalog ?? []).map((item) => [item.connector_key, item])),
    [catalog],
  );

  const setupRows: SetupRowModel[] = useMemo(() => {
    const rows: SetupRowModel[] = [];

    for (const status of Object.values(privateByKey)) {
      if (!status.configured || INTERNAL_KEYS.has(status.connector_key)) continue;
      const item = catalogByKey[status.connector_key] ?? null;
      rows.push({
        key: status.connector_key,
        name:
          item?.display_name ??
          (isKnownConnectorId(status.connector_key)
            ? CONNECTORS[status.connector_key].name
            : status.connector_key),
        status,
        attention: connectorNeedsAttention(status),
      });
    }

    rows.sort((a, b) => {
      if (a.attention !== b.attention) return a.attention ? -1 : 1;
      const aOn = a.status.is_enabled !== false;
      const bOn = b.status.is_enabled !== false;
      if (aOn !== bOn) return aOn ? -1 : 1;
      return a.name.localeCompare(b.name);
    });

    return rows;
  }, [privateByKey, catalogByKey]);

  const restOfCatalog = useMemo(() => {
    const configured = new Set(
      Object.values(privateByKey)
        .filter((s) => s.configured)
        .map((s) => s.connector_key),
    );
    return (catalog ?? []).filter((item) => !configured.has(item.connector_key));
  }, [catalog, privateByKey]);

  const setupCount = setupRows.length;
  const attentionCount = setupRows.filter((row) => row.attention).length;
  const catalogCount = catalog?.length ?? 0;

  const handleToggle = async (key: string, next: boolean) => {
    setTogglingKey(key);
    try {
      const status = await api.setConnectorEnabled(key, next);
      setPrivateByKey((prev) => ({ ...prev, [status.connector_key]: status }));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not update connector.');
    } finally {
      setTogglingKey(null);
    }
  };

  const handleTest = async (key: string) => {
    setTestingKey(key);
    try {
      const status = await api.testPrivateConnectorCredentials(key);
      setPrivateByKey((prev) => ({ ...prev, [status.connector_key]: status }));
      if (status.last_error) {
        toast.error('Test failed', { description: status.last_error });
      } else {
        toast.success('Credentials are valid');
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not test connector.');
    } finally {
      setTestingKey(null);
    }
  };

  return (
    <>
      <Topbar title="Connectors" subtitle="Personal credentials for the tools your agents use" />

      <div className="mx-auto w-full max-w-[1180px] px-6 py-6">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-[19px] font-semibold tracking-[-0.02em] text-[var(--neutral-strong-950)]">
              Connectors
            </h1>
            <p className="mt-1 text-[13px] text-[var(--neutral-sub-600)]">
              {catalog === null ? (
                <span className="inline-block h-4 w-56 animate-pulse rounded bg-[var(--neutral-weak-50)]" />
              ) : (
                <>
                  {catalogCount} in the catalog
                  {' · '}
                  {setupCount} set up
                  {attentionCount > 0
                    ? ` · ${attentionCount} need${attentionCount === 1 ? 's' : ''} attention`
                    : null}
                </>
              )}
            </p>
          </div>
          <a
            href="#catalog"
            className="text-[13px] font-medium text-[var(--primary-dark)] underline-offset-2 hover:underline"
          >
            Browse the catalog
          </a>
        </div>

        <div className="mb-8 flex gap-3 rounded-xl border border-[var(--stroke-soft-200)] bg-[var(--neutral-weak-50)] px-4 py-3">
          <Lock className="mt-0.5 h-4 w-4 shrink-0 text-[var(--neutral-soft-400)]" strokeWidth={2} />
          <p className="text-[13px] leading-[1.55] text-[var(--neutral-sub-600)]">
            Connectors are set up per person, not per organisation. Your credentials are yours, and
            every agent you connect uses them.
          </p>
        </div>

        {error && (
          <div className="mb-6">
            <ErrorBanner message={error} onDismiss={() => setError(null)} onRetry={load} />
          </div>
        )}

        {catalog === null && (
          <div className="flex flex-col gap-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="flex items-center gap-3 rounded-xl border border-[var(--stroke-soft-200)] bg-[var(--bg-surface)] px-4 py-3"
              >
                <Skeleton className="h-7 w-7 rounded-lg" />
                <div className="min-w-0 flex-1">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="mt-2 h-3 w-48" />
                </div>
                <Skeleton className="h-5 w-9 rounded-full" />
              </div>
            ))}
          </div>
        )}

        {catalog && setupRows.length > 0 && (
          <section className="mb-10">
            <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--neutral-soft-400)]">
              Set up
            </h2>
            <div className="flex flex-col gap-2">
              {setupRows.map((row) => (
                <SetupRow
                  key={row.key}
                  row={row}
                  toggling={togglingKey === row.key}
                  testing={testingKey === row.key}
                  onToggle={(next) => void handleToggle(row.key, next)}
                  onTest={() => void handleTest(row.key)}
                />
              ))}
            </div>
          </section>
        )}

        {catalog && (
          <section id="catalog">
            <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--neutral-soft-400)]">
              The rest of the catalog
            </h2>
            {restOfCatalog.length === 0 ? (
              <p className="rounded-xl border border-[var(--stroke-soft-200)] bg-[var(--bg-surface)] px-4 py-6 text-[13px] text-[var(--neutral-sub-600)]">
                Every connector in the catalog is set up.
              </p>
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {restOfCatalog.map((item) => (
                  <CatalogCard key={item.connector_key} item={item} />
                ))}
              </div>
            )}
          </section>
        )}
      </div>
    </>
  );
}

function SetupRow({
  row,
  toggling,
  testing,
  onToggle,
  onTest,
}: {
  row: SetupRowModel;
  toggling: boolean;
  testing: boolean;
  onToggle: (next: boolean) => void;
  onTest: () => void;
}) {
  const enabled = row.status.is_enabled !== false && !row.attention;
  const summary = keysSummary(row.status.configured_keys);
  const attentionCopy = connectorAttentionLabel(row.status);
  const href = `/dashboard/connectors/${row.key}`;
  const canTest = row.status.configured && !row.status.revoked_at;

  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-3 rounded-xl border bg-[var(--bg-surface)] px-4 py-3',
        row.attention
          ? 'border-[var(--attention)] bg-[var(--attention-lighter)]'
          : 'border-[var(--stroke-soft-200)]',
      )}
    >
      <Link href={href} className="flex min-w-0 flex-1 items-center gap-3">
        <CatalogIcon connectorKey={row.key} />
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 flex-wrap items-baseline gap-2">
            <span className="truncate text-[14px] font-semibold tracking-[-0.015em] text-[var(--neutral-strong-950)]">
              {row.name}
            </span>
            {row.attention ? (
              <span className="truncate text-[12px] font-medium text-[var(--attention-dark)]">
                {attentionCopy}
              </span>
            ) : enabled ? (
              <span className="text-[12px] font-medium text-[var(--success-dark)]">enabled</span>
            ) : (
              <span className="text-[12px] font-medium text-[var(--neutral-soft-400)]">disabled</span>
            )}
          </div>
          <p className="mt-0.5 truncate text-[12px] text-[var(--neutral-sub-600)]">
            {summary}
            {row.status.last_tested_at ? (
              <>
                {' · tested '}
                <RelativeTime timestamp={row.status.last_tested_at} />
              </>
            ) : row.status.updated_at ? (
              <>
                {' · updated '}
                <RelativeTime timestamp={row.status.updated_at} />
              </>
            ) : (
              ' · never updated'
            )}
          </p>
        </div>
      </Link>
      <div className="ml-auto flex items-center gap-3">
        {canTest && (
          <button
            type="button"
            onClick={onTest}
            disabled={testing}
            className="text-[12.5px] font-medium text-[var(--neutral-sub-600)] hover:text-[var(--neutral-strong-950)] disabled:opacity-50"
          >
            {testing ? 'Testing…' : 'Test'}
          </button>
        )}
        {row.attention ? (
          <Link
            href={href}
            className="btn-primary inline-flex h-7 items-center rounded-[8px] px-2.5 text-[12px] font-medium"
          >
            Fix the credentials
          </Link>
        ) : (
          <Switch
            checked={enabled}
            disabled={toggling}
            onChange={onToggle}
            ariaLabel={`${enabled ? 'Disable' : 'Enable'} ${row.name}`}
          />
        )}
      </div>
    </div>
  );
}

function CatalogCard({ item }: { item: ConnectorCatalogItem }) {
  const fallback = isKnownConnectorId(item.connector_key)
    ? CONNECTORS[item.connector_key].description
    : null;
  const description =
    item.description?.trim() || fallback || 'Set up credentials so agents can use this tool.';
  const href = `/dashboard/connectors/${item.connector_key}`;

  return (
    <Link
      href={href}
      className="flex flex-col rounded-xl border border-[var(--stroke-soft-200)] bg-[var(--bg-surface)] p-4 transition-colors hover:bg-[var(--neutral-weak-50)]"
    >
      <div className="flex items-start justify-between gap-3">
        <CatalogIcon connectorKey={item.connector_key} size="sm" />
        <span className="text-[12.5px] font-medium text-[var(--primary-dark)]">Set up</span>
      </div>
      <div className="mt-3 text-[14px] font-semibold tracking-[-0.015em] text-[var(--neutral-strong-950)]">
        {item.display_name}
      </div>
      <p className="mt-1 line-clamp-2 text-[12.5px] leading-[1.45] text-[var(--neutral-sub-600)]">
        {description}
      </p>
    </Link>
  );
}
