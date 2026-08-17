'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion, useReducedMotion } from 'motion/react';
import {
  ArrowUpRight,
  ChevronRight,
  Info,
  Loader2,
  LogOut,
  Plug,
  RefreshCw,
  Search,
  ShieldCheck,
} from 'lucide-react';
import { api, AuthError, getApiErrorMessage } from '@/lib/api';
import {
  ConnectorCatalogItem,
  PrivateConnectorCredentialStatus,
} from '@/lib/types';
import { AegisLogo } from '@/components/ui/AegisLogo';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Skeleton } from '@/components/ui/Skeleton';
import { ConnectorMark, CONNECTORS, type ConnectorId } from '@/components/ui/ConnectorMark';
import { fadeUp, staggerContainer } from '@/lib/motion';

type OnboardingScreen = 'recommended_connectors' | 'welcome';

type SchemaField = {
  key: string;
  label: string;
  description?: string;
  required: boolean;
  secret: boolean;
};

const DEFAULT_RECOMMENDED_CONNECTORS = ['github', 'postgres', 'linear'];

export default function OnboardingPage() {
  const router = useRouter();
  const reduce = useReducedMotion();
  const [screen, setScreen] = useState<OnboardingScreen>('recommended_connectors');
  const [catalog, setCatalog] = useState<ConnectorCatalogItem[]>([]);
  const [statuses, setStatuses] = useState<PrivateConnectorCredentialStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, Record<string, string>>>({});
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [finishError, setFinishError] = useState<string | null>(null);
  const [finishing, setFinishing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const user = await api.getUserDetails();
      const completed =
        typeof user.onboarding_status === 'boolean'
          ? user.onboarding_status
          : (await api.getOnboardingStatus()).onboarding_status;

      if (completed) {
        router.replace('/dashboard');
        return;
      }

      const [catalogRows, credentialRows] = await Promise.all([
        api.getConnectorCatalog(true),
        api.getPrivateConnectorCredentials(),
      ]);
      setCatalog(catalogRows);
      setStatuses(credentialRows);
    } catch (err) {
      if (err instanceof AuthError) {
        router.replace('/auth');
        return;
      }
      setError(getApiErrorMessage(err, 'Could not load onboarding.'));
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    void load();
  }, [load]);

  const statusByKey = useMemo(() => {
    return new Map(statuses.map((status) => [status.connector_key, status]));
  }, [statuses]);

  const recommended = useMemo(() => {
    const active = catalog.filter((item) => item.is_active !== false);
    const byKey = new Map(active.map((item) => [item.connector_key, item]));
    const picked: ConnectorCatalogItem[] = [];

    for (const key of DEFAULT_RECOMMENDED_CONNECTORS) {
      const item = byKey.get(key);
      if (item) picked.push(item);
    }

    for (const item of active) {
      if (picked.length >= 3) break;
      if (!picked.some((pickedItem) => pickedItem.connector_key === item.connector_key)) {
        picked.push(item);
      }
    }

    return picked.slice(0, 3);
  }, [catalog]);

  const handleDraftChange = (connectorKey: string, fieldKey: string, value: string) => {
    setDrafts((prev) => ({
      ...prev,
      [connectorKey]: {
        ...(prev[connectorKey] ?? {}),
        [fieldKey]: value,
      },
    }));
    setFieldErrors((prev) => {
      const next = { ...prev };
      delete next[`${connectorKey}:${fieldKey}`];
      return next;
    });
  };

  const saveCredentials = async (connector: ConnectorCatalogItem) => {
    const fields = getSchemaFields(connector.private_config_schema);
    const draft = drafts[connector.connector_key] ?? {};
    const nextErrors: Record<string, string> = {};

    for (const field of fields) {
      if (field.required && !draft[field.key]?.trim()) {
        nextErrors[`${connector.connector_key}:${field.key}`] = 'Required';
      }
    }

    if (Object.keys(nextErrors).length > 0) {
      setFieldErrors(nextErrors);
      return;
    }

    setSavingKey(connector.connector_key);
    try {
      const payload = Object.fromEntries(
        fields.map((field) => [field.key, draft[field.key]?.trim() ?? '']),
      );
      const status = await api.savePrivateConnectorCredentials(
        connector.connector_key,
        payload,
        { source: 'onboarding' },
      );
      setStatuses((prev) => [
        status,
        ...prev.filter((item) => item.connector_key !== status.connector_key),
      ]);
      setDrafts((prev) => ({ ...prev, [connector.connector_key]: {} }));
      setSelectedKey(null);
    } catch (err) {
      setError(getApiErrorMessage(err, `Could not save ${connector.display_name} credentials.`));
    } finally {
      setSavingKey(null);
    }
  };

  const finishOnboarding = async () => {
    setFinishing(true);
    setFinishError(null);
    try {
      await api.updateOnboardingStatus(true);
      try {
        localStorage.setItem('aegis_demo', 'false');
      } catch {
        // localStorage may be unavailable in embedded contexts.
      }
      router.replace('/dashboard');
    } catch (err) {
      setFinishError(getApiErrorMessage(err, 'Could not finish onboarding.'));
    } finally {
      setFinishing(false);
    }
  };

  const handleLogout = async () => {
    await api.logOut();
    router.replace('/auth');
  };

  return (
    <div className="flex min-h-screen flex-col bg-[var(--bg-app)]">
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-[var(--stroke-soft-200)] bg-[var(--white-0)] px-4 sm:px-6">
        <AegisLogo
          style={{ height: 22, width: 'auto', color: 'var(--neutral-strong-950)' }}
        />
        <button
          type="button"
          onClick={handleLogout}
          className="inline-flex h-8 items-center gap-1.5 rounded-[8px] border border-[var(--stroke-sub-300)] bg-[var(--white-0)] px-2.5 text-[12px] font-medium text-[var(--neutral-sub-600)] transition-colors hover:bg-[var(--neutral-weak-50)] hover:text-[var(--neutral-strong-950)]"
        >
          <LogOut className="h-3.5 w-3.5" strokeWidth={2} />
          <span className="hidden sm:inline">Sign out</span>
        </button>
      </header>

      <main className="mx-auto flex w-full max-w-[1120px] flex-1 flex-col px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
        {screen === 'recommended_connectors' ? (
          <motion.div
            variants={staggerContainer(0.05, 0.04)}
            initial={reduce ? false : 'hidden'}
            animate="show"
          >
            <motion.div variants={fadeUp} className="mb-7">
              <Badge tone="neutral" uppercase>
                Onboarding 1 of 2
              </Badge>
              <h1 className="mt-3 max-w-[720px] text-[30px] font-semibold leading-[1.08] text-[var(--neutral-strong-950)] sm:text-[38px]">
                Connect the tools your agents will use first.
              </h1>
              <p className="mt-3 max-w-[620px] text-[14px] leading-[1.6] text-[var(--neutral-sub-600)]">
                Add private credentials for recommended connectors now, or skip this step and configure them from Connectors later.
              </p>
            </motion.div>

            {error && (
              <motion.div
                variants={fadeUp}
                className="mb-4 rounded-[12px] border border-[var(--error)]/25 bg-[var(--error-lighter)] px-4 py-3"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-[13px] font-medium text-[var(--error-dark)]">{error}</p>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => void load()}
                    leadingIcon={<RefreshCw className="h-3.5 w-3.5" strokeWidth={2} />}
                  >
                    Retry
                  </Button>
                </div>
              </motion.div>
            )}

            {loading ? (
              <ConnectorSkeletonGrid />
            ) : recommended.length > 0 ? (
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                {recommended.map((connector) => (
                  <RecommendedConnectorCard
                    key={connector.connector_key}
                    connector={connector}
                    status={statusByKey.get(connector.connector_key)}
                    expanded={expandedKey === connector.connector_key}
                    selected={selectedKey === connector.connector_key}
                    saving={savingKey === connector.connector_key}
                    draft={drafts[connector.connector_key] ?? {}}
                    fieldErrors={fieldErrors}
                    onToggleDetails={() =>
                      setExpandedKey((key) =>
                        key === connector.connector_key ? null : connector.connector_key,
                      )
                    }
                    onConnect={() =>
                      setSelectedKey((key) =>
                        key === connector.connector_key ? null : connector.connector_key,
                      )
                    }
                    onDraftChange={(fieldKey, value) =>
                      handleDraftChange(connector.connector_key, fieldKey, value)
                    }
                    onSave={() => void saveCredentials(connector)}
                  />
                ))}
              </div>
            ) : (
              <motion.div
                variants={fadeUp}
                className="rounded-[12px] border border-[var(--stroke-soft-200)] bg-[var(--white-0)] p-6 text-center"
              >
                <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-[10px] border border-[var(--stroke-soft-200)] bg-[var(--neutral-weak-50)]">
                  <Plug className="h-5 w-5 text-[var(--neutral-soft-400)]" strokeWidth={2} />
                </div>
                <h2 className="mt-3 text-[15px] font-semibold text-[var(--neutral-strong-950)]">
                  No active connectors yet
                </h2>
                <p className="mx-auto mt-1 max-w-[420px] text-[13px] leading-[1.55] text-[var(--neutral-sub-600)]">
                  You can still continue. The connector catalogue will be available from the dashboard once the backend has active rows.
                </p>
              </motion.div>
            )}

            <motion.div
              variants={fadeUp}
              className="mt-6 flex flex-col gap-3 border-t border-[var(--stroke-soft-200)] pt-5 sm:flex-row sm:items-center sm:justify-between"
            >
              <Link
                href="/dashboard/connectors"
                className="inline-flex h-9 items-center justify-center gap-1.5 rounded-[8px] border border-[var(--stroke-sub-300)] bg-[var(--white-0)] px-3 text-[13px] font-medium text-[var(--neutral-strong-950)] transition-colors hover:bg-[var(--neutral-weak-50)]"
              >
                <Search className="h-3.5 w-3.5" strokeWidth={2} />
                Browse all connectors
              </Link>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <Button
                  variant="ghost"
                  onClick={() => setScreen('welcome')}
                >
                  Skip for now
                </Button>
                <Button
                  variant="primary"
                  onClick={() => setScreen('welcome')}
                  trailingIcon={<ChevronRight className="h-3.5 w-3.5" strokeWidth={2.25} />}
                >
                  Continue
                </Button>
              </div>
            </motion.div>
          </motion.div>
        ) : (
          <WelcomeScreen
            reduce={!!reduce}
            finishing={finishing}
            error={finishError}
            configuredCount={statuses.filter((status) => status.configured).length}
            onBack={() => setScreen('recommended_connectors')}
            onFinish={() => void finishOnboarding()}
          />
        )}
      </main>
    </div>
  );
}

function RecommendedConnectorCard({
  connector,
  status,
  expanded,
  selected,
  saving,
  draft,
  fieldErrors,
  onToggleDetails,
  onConnect,
  onDraftChange,
  onSave,
}: {
  connector: ConnectorCatalogItem;
  status?: PrivateConnectorCredentialStatus;
  expanded: boolean;
  selected: boolean;
  saving: boolean;
  draft: Record<string, string>;
  fieldErrors: Record<string, string>;
  onToggleDetails: () => void;
  onConnect: () => void;
  onDraftChange: (fieldKey: string, value: string) => void;
  onSave: () => void;
}) {
  const fields = getSchemaFields(connector.private_config_schema);
  const configured = status?.configured ?? false;
  const configuredKeys = status?.configured_keys ?? [];

  return (
    <motion.article
      variants={fadeUp}
      whileHover={{ y: -2, transition: { duration: 0.22, ease: [0.32, 0.72, 0.32, 1] } }}
      className="group flex min-h-[320px] flex-col overflow-hidden rounded-[12px] border border-[var(--stroke-soft-200)] bg-[var(--white-0)] transition-[border-color] duration-200 hover:border-[var(--stroke-sub-300)]"
    >
      <div className="flex items-start justify-between gap-3 border-b border-[var(--stroke-soft-200)] bg-[var(--neutral-weak-50)] px-4 py-4">
        <SafeConnectorMark connectorKey={connector.connector_key} displayName={connector.display_name} />
        <Badge tone={configured ? 'success' : 'neutral'} uppercase leadingDot={configured}>
          {configured ? 'Connected' : 'Optional'}
        </Badge>
      </div>

      <div className="flex flex-1 flex-col px-4 py-4">
        <h2 className="text-[16px] font-semibold leading-[1.2] text-[var(--neutral-strong-950)]">
          {connector.display_name}
        </h2>
        <p className="mt-2 min-h-[58px] text-[12.5px] leading-[1.55] text-[var(--neutral-sub-600)]">
          {connector.description || 'Configure private credentials for this connector.'}
        </p>

        {configuredKeys.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {configuredKeys.slice(0, 4).map((key) => (
              <span
                key={key}
                className="rounded-[6px] border border-[var(--stroke-soft-200)] bg-[var(--neutral-weak-50)] px-1.5 py-0.5 font-mono text-[10.5px] font-semibold text-[var(--neutral-sub-600)]"
              >
                {key}
              </span>
            ))}
          </div>
        )}

        {expanded && (
          <div className="mt-4 rounded-[10px] border border-[var(--stroke-soft-200)] bg-[var(--neutral-weak-50)] p-3">
            <div className="flex items-start gap-2">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--neutral-soft-400)]" strokeWidth={2} />
              <div>
                <p className="text-[12px] font-semibold text-[var(--neutral-strong-950)]">
                  Private credential fields
                </p>
                <p className="mt-1 text-[11.5px] leading-[1.5] text-[var(--neutral-sub-600)]">
                  {fields.length > 0
                    ? fields.map((field) => field.label).join(', ')
                    : 'No private credential fields are required by the current schema.'}
                </p>
              </div>
            </div>
          </div>
        )}

        {selected && (
          <div className="mt-4 space-y-3 rounded-[10px] border border-[var(--stroke-soft-200)] bg-[var(--white-0)] p-3">
            {fields.length > 0 ? (
              fields.map((field) => {
                const error = fieldErrors[`${connector.connector_key}:${field.key}`];
                return (
                  <label key={field.key} className="block">
                    <span className="flex items-center justify-between gap-2 text-[12px] font-medium text-[var(--neutral-sub-600)]">
                      {field.label}
                      {field.required && (
                        <span className="text-[11px] text-[var(--neutral-soft-400)]">Required</span>
                      )}
                    </span>
                    <Input
                      type={field.secret ? 'password' : 'text'}
                      value={draft[field.key] ?? ''}
                      onChange={(event) => onDraftChange(field.key, event.target.value)}
                      placeholder={field.secret ? 'Stored as a private credential' : field.label}
                      invalid={!!error}
                      autoComplete="off"
                      className="mt-1"
                    />
                    {field.description && (
                      <span className="mt-1 block text-[11px] leading-[1.45] text-[var(--neutral-soft-400)]">
                        {field.description}
                      </span>
                    )}
                    {error && (
                      <span className="mt-1 block text-[11px] text-[var(--error-dark)]">
                        {error}
                      </span>
                    )}
                  </label>
                );
              })
            ) : (
              <p className="text-[12px] leading-[1.5] text-[var(--neutral-sub-600)]">
                This connector does not require private credential fields.
              </p>
            )}
            <Button
              variant="primary"
              size="sm"
              fullWidth
              onClick={onSave}
              disabled={saving}
              leadingIcon={saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : undefined}
            >
              {saving ? 'Saving' : configured ? 'Update credentials' : 'Save credentials'}
            </Button>
          </div>
        )}
      </div>

      <div className="flex min-h-[44px] items-center justify-between gap-3 border-t border-[var(--stroke-soft-200)] bg-[var(--neutral-weak-50)] px-4 py-2">
        <button
          type="button"
          onClick={onToggleDetails}
          className="text-[12px] font-medium text-[var(--neutral-sub-600)] underline-offset-4 hover:text-[var(--neutral-strong-950)] hover:underline"
        >
          {expanded ? 'Hide details' : 'Read details'}
        </button>
        <Button
          variant="secondary"
          size="sm"
          onClick={onConnect}
        >
          {selected ? 'Close' : configured ? 'Update' : 'Connect'}
        </Button>
      </div>
    </motion.article>
  );
}

function WelcomeScreen({
  reduce,
  finishing,
  error,
  configuredCount,
  onBack,
  onFinish,
}: {
  reduce: boolean;
  finishing: boolean;
  error: string | null;
  configuredCount: number;
  onBack: () => void;
  onFinish: () => void;
}) {
  return (
    <motion.div
      variants={staggerContainer(0.05, 0.04)}
      initial={reduce ? false : 'hidden'}
      animate="show"
      className="mx-auto flex w-full max-w-[760px] flex-1 flex-col justify-center py-8"
    >
      <motion.section
        variants={fadeUp}
        className="overflow-hidden rounded-[12px] border border-[var(--stroke-soft-200)] bg-[var(--white-0)]"
      >
        <div className="border-b border-[var(--stroke-soft-200)] bg-[var(--neutral-weak-50)] px-5 py-4">
          <Badge tone="neutral" uppercase>
            Onboarding 2 of 2
          </Badge>
        </div>
        <div className="px-5 py-10 text-center sm:px-8 sm:py-12">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-[14px] border border-[var(--stroke-soft-200)] bg-[var(--neutral-weak-50)]">
            <ShieldCheck className="h-7 w-7 text-[var(--success-dark)]" strokeWidth={2} />
          </div>
          <h1 className="mx-auto mt-5 max-w-[520px] text-[28px] font-semibold leading-[1.12] text-[var(--neutral-strong-950)] sm:text-[34px]">
            Welcome to Aegis.
          </h1>
          <p className="mx-auto mt-3 max-w-[520px] text-[14px] leading-[1.6] text-[var(--neutral-sub-600)]">
            Your workspace is ready. {configuredCount > 0
              ? `${configuredCount} private connector ${configuredCount === 1 ? 'credential is' : 'credentials are'} configured.`
              : 'You can add private connector credentials whenever you need them.'}
          </p>

          {error && (
            <div className="mx-auto mt-5 max-w-[480px] rounded-[10px] border border-[var(--error)]/25 bg-[var(--error-lighter)] px-3.5 py-3 text-left text-[13px] font-medium text-[var(--error-dark)]">
              {error}
            </div>
          )}

          <div className="mt-7 flex flex-col justify-center gap-2 sm:flex-row">
            <Button variant="secondary" onClick={onBack}>
              Back
            </Button>
            <Button
              variant="primary"
              onClick={onFinish}
              disabled={finishing}
              leadingIcon={finishing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : undefined}
              trailingIcon={!finishing ? <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={2.25} /> : undefined}
            >
              {finishing ? 'Finishing' : 'Go to dashboard'}
            </Button>
          </div>
        </div>
      </motion.section>
    </motion.div>
  );
}

function ConnectorSkeletonGrid() {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      {[0, 1, 2].map((item) => (
        <div
          key={item}
          className="rounded-[12px] border border-[var(--stroke-soft-200)] bg-[var(--white-0)] p-4"
        >
          <div className="flex items-center justify-between">
            <Skeleton variant="block" className="h-10 w-10 rounded-[10px]" />
            <Skeleton variant="block" className="h-5 w-20 rounded-full" />
          </div>
          <Skeleton variant="block" className="mt-5 h-5 w-36" />
          <Skeleton variant="block" className="mt-3 h-3 w-full" />
          <Skeleton variant="block" className="mt-2 h-3 w-4/5" />
          <Skeleton variant="block" className="mt-16 h-9 w-full" />
        </div>
      ))}
    </div>
  );
}

function SafeConnectorMark({
  connectorKey,
  displayName,
}: {
  connectorKey: string;
  displayName: string;
}) {
  if (connectorKey in CONNECTORS) {
    return <ConnectorMark id={connectorKey as ConnectorId} size="md" />;
  }

  const monogram = displayName.trim().slice(0, 1).toUpperCase() || '?';
  return (
    <span
      aria-hidden
      className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] border border-[var(--stroke-soft-200)] bg-[var(--white-0)] text-[14px] font-semibold text-[var(--neutral-strong-950)]"
    >
      {monogram}
    </span>
  );
}

function getSchemaFields(schema?: Record<string, unknown> | null): SchemaField[] {
  if (!schema || typeof schema !== 'object') return [];

  const required = Array.isArray(schema.required)
    ? new Set(schema.required.filter((key): key is string => typeof key === 'string'))
    : new Set<string>();
  const properties =
    schema.properties && typeof schema.properties === 'object'
      ? (schema.properties as Record<string, unknown>)
      : {};

  return Object.entries(properties).map(([key, value]) => {
    const raw = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
    const label =
      typeof raw.title === 'string'
        ? raw.title
        : key
            .split('_')
            .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
            .join(' ');
    const description =
      typeof raw.description === 'string' ? raw.description : undefined;
    return {
      key,
      label,
      description,
      required: required.has(key),
      secret: isSecretField(key),
    };
  });
}

function isSecretField(key: string): boolean {
  const normalized = key.toLowerCase();
  return (
    normalized.includes('token') ||
    normalized.includes('secret') ||
    normalized.includes('password') ||
    normalized.includes('key') ||
    normalized.includes('connection')
  );
}
