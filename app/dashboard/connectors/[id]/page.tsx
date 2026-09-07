'use client';

/**
 * Connector setup — `/dashboard/connectors/[id]`.
 *
 * Fields come from the catalog private_config_schema. Secrets are never
 * returned. Test is POST /setup/{key}/test on already-saved credentials.
 * Do not invent Test-without-saving, runs-failed-since, or 401 copy.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { AlertTriangle, ArrowLeft, Eye, EyeOff, Loader2, Lock } from 'lucide-react';
import Topbar from '@/components/layout/Topbar';
import { CatalogIcon } from '@/components/connectors/CatalogIcon';
import { Button } from '@/components/ui/Button';
import ErrorBanner from '@/components/ui/ErrorBanner';
import { Input } from '@/components/ui/Input';
import { RelativeTime } from '@/components/ui/RelativeTime';
import { Skeleton } from '@/components/ui/Skeleton';
import { useToast } from '@/components/ui/Toast';
import { api } from '@/lib/api';
import {
  connectorAttentionLabel,
  connectorNeedsAttention,
  isKnownConnectorId,
  parsePrivateCredentialFields,
} from '@/lib/connectorCredentials';
import { CONNECTORS } from '@/components/ui/ConnectorMark';
import { useUser } from '@/lib/hooks';
import type { ConnectorCatalogItem, PrivateConnectorCredentialStatus } from '@/lib/types';
import { formatRelativeTime, parseApiUtcTimestamp } from '@/lib/utils';

function stubCatalogItem(connectorKey: string): ConnectorCatalogItem | null {
  if (!isKnownConnectorId(connectorKey)) return null;
  const known = CONNECTORS[connectorKey];
  return {
    connector_key: connectorKey,
    display_name: known.name,
    description: known.description,
    is_active: true,
  };
}

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

function formatTestedClock(timestamp: string): string {
  const parsed = parseApiUtcTimestamp(timestamp);
  if (Number.isNaN(parsed.getTime())) return formatRelativeTime(timestamp);
  const clock = parsed.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  return `${formatRelativeTime(timestamp)}, ${clock}`;
}

export default function ConnectorSetupPage() {
  const params = useParams<{ id: string }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const toast = useToast();
  const { user, isLoading: userLoading } = useUser();
  const demo = useMemo(() => isDemoMode(), []);

  const [catalogItem, setCatalogItem] = useState<ConnectorCatalogItem | null | undefined>(undefined);
  const [status, setStatus] = useState<PrivateConnectorCredentialStatus | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [showSecret, setShowSecret] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const connectorKey = id ?? '';
  const displayName =
    catalogItem?.display_name ??
    (isKnownConnectorId(connectorKey) ? CONNECTORS[connectorKey].name : connectorKey);
  const fields = useMemo(
    () => parsePrivateCredentialFields(connectorKey, catalogItem ?? null),
    [connectorKey, catalogItem],
  );
  const requiredKeys = useMemo(() => fields.filter((f) => f.required).map((f) => f.key), [fields]);
  const configuredKeys = status?.configured_keys ?? [];
  const configured = !!status?.configured;
  const attention = connectorNeedsAttention(status);
  const attentionLabel = connectorAttentionLabel(status);
  const secretKeys = useMemo(() => fields.filter((f) => f.secret).map((f) => f.key), [fields]);

  const load = useCallback(async () => {
    if (!connectorKey) return;
    if (!demo && !user?.id) return;
    setLoadError(null);
    try {
      const [catalog, priv] = await Promise.all([
        api.getConnectorCatalog(false),
        api.getPrivateConnectorCredentials(),
      ]);
      const item =
        catalog.find((c) => c.connector_key === connectorKey) ?? stubCatalogItem(connectorKey);
      setCatalogItem(item);
      setStatus(priv.find((s) => s.connector_key === connectorKey) ?? null);
    } catch (err) {
      setCatalogItem(null);
      setLoadError(err instanceof Error ? err.message : 'Could not load connector.');
    }
  }, [connectorKey, demo, user?.id]);

  useEffect(() => {
    if (demo || user?.id) {
      void load();
      return;
    }
    if (!userLoading) setCatalogItem(null);
  }, [demo, user?.id, userLoading, load]);

  useEffect(() => {
    setValues({});
    setShowSecret({});
    setFormError(null);
  }, [connectorKey]);

  const filledRequired = requiredKeys.every((k) => (values[k] ?? '').trim().length > 0);
  const hasAnyValue = fields.some((f) => (values[f.key] ?? '').trim().length > 0);
  const canSave = fields.length > 0 && (configured ? hasAnyValue : filledRequired);
  const canTest = configured && !status?.revoked_at;

  const savePayload = (): Record<string, string> => {
    const payload: Record<string, string> = {};
    for (const f of fields) {
      const v = (values[f.key] ?? '').trim();
      if (v) payload[f.key] = v;
    }
    return payload;
  };

  const handleSaveAndTest = async () => {
    if (!canSave || saving) return;
    setSaving(true);
    setFormError(null);
    try {
      const saved = await api.savePrivateConnectorCredentials(connectorKey, savePayload());
      setStatus(saved);
      setValues({});
      try {
        const tested = await api.testPrivateConnectorCredentials(connectorKey);
        setStatus(tested);
        if (tested.last_error) {
          toast.error('Saved, but the test failed', { description: tested.last_error });
        } else {
          toast.success('Saved and tested');
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Test failed';
        toast.error('Saved, but the test could not run', { description: msg });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Could not save credentials';
      setFormError(msg);
      toast.error('Save failed', { description: msg });
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    if (!canTest || testing) return;
    setTesting(true);
    setFormError(null);
    try {
      const tested = await api.testPrivateConnectorCredentials(connectorKey);
      setStatus(tested);
      if (tested.last_error) {
        toast.error('Test failed', { description: tested.last_error });
      } else {
        toast.success('Credentials are valid');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Could not test credentials';
      setFormError(msg);
      toast.error('Test failed', { description: msg });
    } finally {
      setTesting(false);
    }
  };

  const missing = catalogItem === null && !loadError && catalogItem !== undefined;

  return (
    <>
      <Topbar title="Connectors" subtitle={displayName || 'connector setup'} />

      <div className="mx-auto w-full max-w-[720px] px-6 py-6">
        <Link
          href="/dashboard/connectors"
          className="mb-5 inline-flex items-center gap-1.5 text-[12.5px] font-medium text-[var(--neutral-sub-600)] hover:text-[var(--neutral-strong-950)]"
        >
          <ArrowLeft className="h-3.5 w-3.5" strokeWidth={2} />
          Connectors
        </Link>

        {catalogItem === undefined && (
          <div className="space-y-3">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-28 w-full rounded-xl" />
            <Skeleton className="h-64 w-full rounded-xl" />
          </div>
        )}

        {loadError && (
          <ErrorBanner message={loadError} onRetry={load} />
        )}

        {missing && (
          <div className="rounded-xl border border-[var(--stroke-soft-200)] bg-[var(--bg-surface)] px-4 py-6">
            <h1 className="text-[16px] font-semibold text-[var(--neutral-strong-950)]">Connector not found</h1>
            <p className="mt-1 text-[13px] text-[var(--neutral-sub-600)]">
              No connector with key <span className="font-mono">{connectorKey}</span> in the catalog.
            </p>
          </div>
        )}

        {catalogItem && (
          <>
            <div className="mb-6 flex items-end gap-3">
              <CatalogIcon connectorKey={connectorKey} size="md" />
              <div className="min-w-0">
                <h1 className="text-[22px] font-semibold tracking-[-0.03em] text-[var(--neutral-strong-950)]">
                  {displayName}
                </h1>
                <p className="text-[13px] text-[var(--neutral-soft-400)]">connector setup</p>
              </div>
            </div>

            {attention && (
              <div className="mb-6 rounded-xl border border-[var(--attention)] bg-[var(--attention-lighter)] px-4 py-3.5">
                <div className="flex items-start gap-2.5">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--attention-dark)]" strokeWidth={2} />
                  <div className="min-w-0">
                    <p className="text-[13.5px] font-semibold text-[var(--attention-dark)]">
                      {displayName} rejected the last call
                    </p>
                    <p className="mt-1 text-[12.5px] leading-[1.5] text-[var(--neutral-sub-600)]">
                      {attentionLabel}
                      {status?.last_tested_at ? (
                        <>
                          {', '}
                          <RelativeTime timestamp={status.last_tested_at} />
                        </>
                      ) : null}
                      . Save new credentials, then test again.
                    </p>
                    <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-[12px]">
                      <dt className="text-[var(--neutral-soft-400)]">Last tested</dt>
                      <dd className="text-[var(--neutral-sub-600)]">
                        {status?.last_tested_at ? formatTestedClock(status.last_tested_at) : 'never'}
                      </dd>
                      <dt className="text-[var(--neutral-soft-400)]">Last error</dt>
                      <dd className="text-[var(--neutral-sub-600)]">{status?.last_error?.trim() || 'revoked'}</dd>
                    </dl>
                  </div>
                </div>
              </div>
            )}

            <section className="rounded-xl border border-[var(--stroke-soft-200)] bg-[var(--bg-surface)] p-4 sm:p-5">
              <div className="mb-4">
                <h2 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--neutral-soft-400)]">
                  Credentials
                </h2>
                <p className="mt-1 text-[12.5px] text-[var(--neutral-sub-600)]">
                  The schema comes from the catalog, so these fields are whatever {displayName} asks for.
                </p>
              </div>

              {formError && (
                <div className="mb-4">
                  <ErrorBanner message={formError} onDismiss={() => setFormError(null)} />
                </div>
              )}

              {fields.length === 0 ? (
                <p className="text-[13px] text-[var(--neutral-sub-600)]">
                  This connector does not advertise a private credential schema yet.
                </p>
              ) : (
                <div className="space-y-4">
                  {fields.map((field) => {
                    const saved = configuredKeys.includes(field.key);
                    const isSecret = field.secret;
                    const show = !!showSecret[field.key];
                    const inputType =
                      field.inputType === 'password' ? (show ? 'text' : 'password') : field.inputType ?? 'text';
                    const highlightSecret = attention && isSecret && secretKeys[0] === field.key;

                    return (
                      <div key={field.key} className="space-y-1.5">
                        <div className="flex items-baseline justify-between gap-2">
                          <label className="text-[12.5px] font-medium text-[var(--neutral-sub-600)]">
                            {field.label}
                            {saved ? (
                              <span className="ml-1.5 text-[11px] font-medium text-[var(--neutral-soft-400)]">
                                set
                              </span>
                            ) : field.required ? (
                              <span className="ml-1.5 text-[11px] text-[var(--neutral-soft-400)]">required</span>
                            ) : null}
                          </label>
                        </div>
                        <Input
                          type={inputType}
                          value={values[field.key] ?? ''}
                          onChange={(e) => setValues((prev) => ({ ...prev, [field.key]: e.target.value }))}
                          placeholder={saved ? (isSecret ? '••••••••••••' : 'Saved — enter a new value to replace') : field.placeholder}
                          autoComplete="off"
                          attention={highlightSecret}
                          className="font-mono"
                          trailingIcon={
                            highlightSecret ? (
                              <AlertTriangle className="h-3.5 w-3.5 text-[var(--attention-dark)]" strokeWidth={2} />
                            ) : isSecret ? (
                              <button
                                type="button"
                                onClick={() =>
                                  setShowSecret((prev) => ({ ...prev, [field.key]: !prev[field.key] }))
                                }
                                aria-label={show ? 'Hide value' : 'Show value'}
                                className="inline-flex items-center justify-center"
                              >
                                {show ? (
                                  <EyeOff className="h-4 w-4" strokeWidth={2} />
                                ) : (
                                  <Eye className="h-4 w-4" strokeWidth={2} />
                                )}
                              </button>
                            ) : undefined
                          }
                        />
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="mt-5 flex flex-wrap items-center gap-3">
                <Button
                  variant="primary"
                  onClick={() => void handleSaveAndTest()}
                  disabled={!canSave || saving || fields.length === 0}
                  leadingIcon={
                    saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={2} /> : undefined
                  }
                >
                  Save and test
                </Button>
                {canTest && (
                  <button
                    type="button"
                    onClick={() => void handleTest()}
                    disabled={testing || saving}
                    className="text-[13px] font-medium text-[var(--neutral-sub-600)] underline-offset-2 hover:text-[var(--neutral-strong-950)] hover:underline disabled:opacity-50"
                  >
                    {testing ? 'Testing…' : 'Test'}
                  </button>
                )}
              </div>
              <p className="mt-3 flex items-start gap-1.5 text-[12px] leading-[1.5] text-[var(--neutral-soft-400)]">
                <Lock className="mt-0.5 h-3 w-3 shrink-0" strokeWidth={2} />
                Credentials are stored per person and never returned to the browser once saved.
              </p>
            </section>
          </>
        )}
      </div>
    </>
  );
}
