'use client';

import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Eye, EyeOff, Info, KeyRound, Link as LinkIcon, Loader2, Lock, Save, X } from 'lucide-react';
import { api } from '@/lib/api';
import type { ConnectorCatalogItem, PrivateConnectorCredentialStatus } from '@/lib/types';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { CodeChip } from '@/components/ui/CodeChip';
import ErrorBanner from '@/components/ui/ErrorBanner';
import { Input } from '@/components/ui/Input';
import { useToast } from '@/components/ui/Toast';
import { cn } from '@/lib/utils';

type FieldDef = {
  key: string;
  label: string;
  description: string | null;
  required: boolean;
  secret: boolean;
  placeholder?: string;
  inputType?: 'text' | 'password' | 'url';
};

type CredentialHelp = {
  what?: string;
  how?: string[];
  permissions?: string[];
  link?: { label: string; href: string };
};

const FALLBACK_PRIVATE_SCHEMAS: Record<
  string,
  { required: string[]; properties: Record<string, { title: string; description: string; placeholder?: string; secret?: boolean; type?: 'text' | 'password' | 'url' }> }
> = {
  github: {
    required: ['github_pat'],
    properties: {
      github_pat: {
        title: 'GitHub PAT',
        description: 'Personal access token used to call GitHub on your behalf.',
        placeholder: 'ghp_…',
        secret: true,
        type: 'password',
      },
    },
  },
  postgres: {
    required: ['connection_string'],
    properties: {
      connection_string: {
        title: 'Connection string',
        description: 'PostgreSQL connection URL for your database user.',
        placeholder: 'postgresql://user:password@host:5432/dbname',
        secret: true,
        type: 'password',
      },
    },
  },
  mongodb: {
    required: ['connection_string'],
    properties: {
      connection_string: {
        title: 'Connection string',
        description: 'MongoDB connection URI for your database user.',
        placeholder: 'mongodb+srv://user:password@cluster/dbname',
        secret: true,
        type: 'password',
      },
    },
  },
  linear: {
    required: ['api_key'],
    properties: {
      api_key: {
        title: 'API key',
        description: 'Personal Linear API key.',
        placeholder: 'lin_api_…',
        secret: true,
        type: 'password',
      },
    },
  },
  jira: {
    required: ['url', 'username', 'api_token'],
    properties: {
      url: {
        title: 'Jira URL',
        description: 'Your Jira base URL.',
        placeholder: 'https://your-company.atlassian.net',
        secret: false,
        type: 'url',
      },
      username: {
        title: 'Jira username',
        description: 'Usually the email address tied to your Jira account.',
        placeholder: 'you@company.com',
        secret: false,
        type: 'text',
      },
      api_token: {
        title: 'Jira API token',
        description: 'API token used for Jira REST calls.',
        placeholder: '••••••••••••',
        secret: true,
        type: 'password',
      },
    },
  },
  terraform: {
    required: ['url', 'api_token'],
    properties: {
      url: {
        title: 'Terraform URL',
        description: 'Terraform Cloud or Terraform Enterprise base URL.',
        placeholder: 'https://app.terraform.io',
        secret: false,
        type: 'url',
      },
      api_token: {
        title: 'Terraform API token',
        description: 'API token used for Terraform API access.',
        placeholder: '••••••••••••',
        secret: true,
        type: 'password',
      },
    },
  },
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function parseSchema(connectorKey: string, catalogItem: ConnectorCatalogItem | null): FieldDef[] {
  const raw = catalogItem?.private_config_schema ?? null;
  const schema = asRecord(raw);
  const properties = asRecord(schema?.properties);
  const requiredRaw = schema?.required;
  const required = Array.isArray(requiredRaw) ? requiredRaw.filter((v): v is string => typeof v === 'string') : [];

  const fallback = FALLBACK_PRIVATE_SCHEMAS[connectorKey];
  const keys = properties ? Object.keys(properties) : fallback ? Object.keys(fallback.properties) : [];

  return keys
    .map((key): FieldDef | null => {
      const p = properties ? asRecord(properties[key]) : null;
      const f = fallback?.properties?.[key];
      const label =
        (typeof p?.title === 'string' && p.title.trim()) ||
        f?.title ||
        key
          .replace(/_/g, ' ')
          .replace(/\b\w/g, (c) => c.toUpperCase());
      const description =
        (typeof p?.description === 'string' ? p.description : null) ??
        (typeof f?.description === 'string' ? f.description : null);

      const lower = key.toLowerCase();
      const secret =
        !!f?.secret ||
        /token|pat|secret|password|key|connection/.test(lower);

      const inputType: FieldDef['inputType'] =
        f?.type ??
        (lower.includes('url') ? 'url' : secret ? 'password' : 'text');

      const placeholder =
        f?.placeholder ??
        (typeof p?.examples === 'string' ? p.examples : undefined);

      return {
        key,
        label,
        description,
        required: required.includes(key) || !!fallback?.required.includes(key),
        secret,
        placeholder,
        inputType,
      };
    })
    .filter((f): f is FieldDef => f !== null)
    .sort((a, b) => Number(b.required) - Number(a.required) || a.label.localeCompare(b.label));
}

function credentialHelp(connectorKey: string, fieldKey: string): CredentialHelp | null {
  const k = connectorKey;
  const f = fieldKey;

  if (k === 'github' && f === 'github_pat') {
    return {
      what: 'A personal access token used to read and write to GitHub on your behalf.',
      how: [
        'Open GitHub Settings, then Developer settings, then Personal access tokens.',
        'Create a token and copy it. GitHub only shows it once.',
      ],
      permissions: [
        'Give the token access to the repositories you want Aegis to govern.',
        'If you use GitHub Actions governance, ensure the token has Actions workflow access.',
      ],
      link: { label: 'Open GitHub token settings', href: 'https://github.com/settings/tokens' },
    };
  }

  if (k === 'postgres' && f === 'connection_string') {
    return {
      what: 'A PostgreSQL connection string for the database user you want the agent to use.',
      how: [
        'Create a dedicated database user.',
        'Generate a connection URL for that user.',
      ],
      permissions: [
        'Grant least privilege. Start with read access, then add write only if needed.',
        'Use a separate user for production if your org requires it.',
      ],
    };
  }

  if (k === 'mongodb' && f === 'connection_string') {
    return {
      what: 'A MongoDB connection string for the database user you want the agent to use.',
      how: [
        'Create a database user in your MongoDB cluster.',
        'Copy the connection URI and replace user and password placeholders.',
      ],
      permissions: [
        'Grant least privilege on the databases and collections you allow.',
        'Prefer a dedicated user for agent access.',
      ],
    };
  }

  if (k === 'linear' && f === 'api_key') {
    return {
      what: 'A personal Linear API key used to read and update issues.',
      how: ['Open Linear Settings, then API, then create a personal API key.'],
      permissions: ['Ensure the account has access to the teams and projects you want to govern.'],
      link: { label: 'Open Linear API settings', href: 'https://linear.app/settings/api' },
    };
  }

  if (k === 'jira' && (f === 'url' || f === 'username' || f === 'api_token')) {
    const base: CredentialHelp = {
      what: 'Jira credentials used to call the Jira REST API on your behalf.',
      how: [
        'Set Jira URL to your Atlassian site URL.',
        'Set username to the email for your Jira account.',
        'Create an API token in your Atlassian account settings.',
      ],
      permissions: ['Ensure the Jira user has access to the projects you want to govern.'],
      link: { label: 'Open Atlassian API tokens', href: 'https://id.atlassian.com/manage-profile/security/api-tokens' },
    };
    return base;
  }

  if (k === 'terraform' && (f === 'url' || f === 'api_token')) {
    return {
      what: 'Terraform credentials used to read plans and apply changes under policy.',
      how: [
        'Set Terraform URL to your Terraform Cloud or Terraform Enterprise base URL.',
        'Create a user or team API token and copy it.',
      ],
      permissions: [
        'Grant least privilege to the organizations and workspaces you allow.',
        'Prefer a team token scoped to the workspaces you manage.',
      ],
      link: { label: 'Open Terraform tokens', href: 'https://app.terraform.io/app/settings/tokens' },
    };
  }

  return null;
}

function InfoHint({
  label,
  description,
  help,
}: {
  label: string;
  description: string | null;
  help: CredentialHelp | null;
}) {
  if (!description && !help) return null;

  const title = help?.what ? label : label;
  const body = help?.what ?? description ?? '';
  const how = help?.how ?? [];
  const perms = help?.permissions ?? [];

  return (
    <span className="relative inline-flex">
      <span className="group inline-flex">
        <button
          type="button"
          aria-label={`Info: ${label}`}
          className={cn(
            'inline-flex h-6 w-6 items-center justify-center rounded-[6px]',
            'text-[var(--neutral-soft-400)] transition-colors',
            'hover:bg-[var(--neutral-weak-50)] hover:text-[var(--neutral-sub-600)]',
          )}
        >
          <Info className="h-3.5 w-3.5" strokeWidth={2} />
        </button>

        <div
          className={cn(
            'pointer-events-none absolute right-0 top-full z-[120] mt-2 w-[320px] rounded-[12px] border border-[var(--stroke-soft-200)] bg-[var(--white-0)] p-3 shadow-[0_18px_48px_rgba(0,0,0,0.14),0_2px_8px_rgba(0,0,0,0.08)]',
            'opacity-0 transition-opacity duration-150 group-hover:opacity-100',
          )}
          role="tooltip"
        >
          <p className="text-[12.5px] font-semibold text-[var(--neutral-strong-950)]">{title}</p>
          <p className="mt-1 text-[12px] leading-[1.55] text-[var(--neutral-sub-600)]">{body}</p>

          {how.length > 0 && (
            <div className="mt-2">
              <p className="text-[10.5px] font-semibold uppercase tracking-[0.1em] text-[var(--neutral-soft-400)]">How to get it</p>
              <ul className="mt-1 list-disc space-y-0.5 pl-4 text-[12px] leading-[1.5] text-[var(--neutral-sub-600)]">
                {how.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </div>
          )}

          {perms.length > 0 && (
            <div className="mt-2">
              <p className="text-[10.5px] font-semibold uppercase tracking-[0.1em] text-[var(--neutral-soft-400)]">Permissions</p>
              <ul className="mt-1 list-disc space-y-0.5 pl-4 text-[12px] leading-[1.5] text-[var(--neutral-sub-600)]">
                {perms.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </div>
          )}

          {help?.link && (
            <a
              href={help.link.href}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-flex items-center gap-1.5 text-[12px] font-medium text-[var(--neutral-sub-600)] underline-offset-4 hover:text-[var(--neutral-strong-950)] hover:underline"
            >
              <LinkIcon className="h-3.5 w-3.5" strokeWidth={2} />
              {help.link.label}
            </a>
          )}
        </div>
      </span>
    </span>
  );
}

export function ConnectorCredentialsModal({
  open,
  connectorKey,
  connectorName,
  catalogItem,
  status,
  onClose,
  onSaved,
}: {
  open: boolean;
  connectorKey: string;
  connectorName: string;
  catalogItem: ConnectorCatalogItem | null;
  status: PrivateConnectorCredentialStatus | null;
  onClose: () => void;
  onSaved: (status: PrivateConnectorCredentialStatus) => void;
}) {
  const reduce = useReducedMotion();
  const toast = useToast();
  const [values, setValues] = useState<Record<string, string>>({});
  const [showSecret, setShowSecret] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fields = useMemo(() => parseSchema(connectorKey, catalogItem), [connectorKey, catalogItem]);
  const requiredKeys = useMemo(() => fields.filter((f) => f.required).map((f) => f.key), [fields]);
  const configuredKeys = status?.configured_keys ?? [];
  const configured = !!status?.configured;

  useEffect(() => {
    if (!open) return;
    setValues({});
    setShowSecret({});
    setSaving(false);
    setError(null);
  }, [open, connectorKey]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const canSave = requiredKeys.length > 0 && requiredKeys.every((k) => (values[k] ?? '').trim().length > 0);

  const handleSave = async () => {
    if (!canSave || saving) return;
    setSaving(true);
    setError(null);
    try {
      const payload: Record<string, string> = {};
      for (const f of fields) {
        const v = (values[f.key] ?? '').trim();
        if (v) payload[f.key] = v;
      }
      const saved = await api.savePrivateConnectorCredentials(connectorKey, payload);
      onSaved(saved);
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to save credentials';
      setError(msg);
      toast.error('Save failed', { description: msg });
    } finally {
      setSaving(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="fixed inset-0 z-[90] bg-black/40 backdrop-blur-[3px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={onClose}
            aria-hidden
          />

          <div className="fixed inset-0 z-[91] flex items-center justify-center px-4">
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-label={`${connectorName} credentials`}
              className="w-full max-w-[640px] overflow-hidden rounded-[16px] border border-[var(--stroke-soft-200)] bg-[var(--white-0)] shadow-[0_24px_72px_rgba(0,0,0,0.18),0_4px_16px_rgba(0,0,0,0.08)]"
              initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.98, y: 10 }}
              animate={reduce ? { opacity: 1 } : { opacity: 1, scale: 1, y: 0 }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.99, y: 6 }}
              transition={{ duration: 0.2 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-3 border-b border-[var(--stroke-soft-200)] px-6 py-5">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-[var(--neutral-strong-950)]">
                    <span className="inline-flex h-9 w-9 items-center justify-center rounded-[10px] border border-[var(--stroke-soft-200)] bg-[var(--neutral-weak-50)]">
                      <KeyRound className="h-4 w-4 text-[var(--neutral-sub-600)]" strokeWidth={2.25} />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-[16px] font-semibold tracking-[-0.015em]">
                        {connectorName} credentials
                      </p>
                      <p className="mt-0.5 text-[12.5px] leading-[1.5] text-[var(--neutral-sub-600)]">
                        Private credentials are user-scoped. Rooms store shared connector configuration separately.
                      </p>
                    </div>
                  </div>

                  {configured && (
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <Badge tone="success" leadingDot>
                        Connected
                      </Badge>
                      {configuredKeys.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1.5">
                          {configuredKeys.slice(0, 4).map((k) => (
                            <CodeChip key={k}>{k}</CodeChip>
                          ))}
                          {configuredKeys.length > 4 && (
                            <CodeChip>{`+${configuredKeys.length - 4} more`}</CodeChip>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Close"
                  className="inline-flex h-9 w-9 items-center justify-center rounded-[10px] border border-[var(--stroke-soft-200)] bg-white text-[var(--neutral-soft-400)] transition-colors hover:bg-[var(--neutral-weak-50)] hover:text-[var(--neutral-sub-600)]"
                >
                  <X className="h-4 w-4" strokeWidth={2.25} />
                </button>
              </div>

              <div className="px-6 py-5">
                {error && (
                  <div className="mb-4">
                    <ErrorBanner message={error} onDismiss={() => setError(null)} />
                  </div>
                )}

                {fields.length === 0 ? (
                  <div className="rounded-[12px] border border-[var(--stroke-soft-200)] bg-[var(--neutral-weak-50)] px-4 py-3">
                    <p className="text-[13px] font-semibold text-[var(--neutral-strong-950)]">No credential fields</p>
                    <p className="mt-1 text-[12.5px] leading-[1.55] text-[var(--neutral-sub-600)]">
                      This connector does not advertise a private credential schema yet.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="rounded-[12px] border border-[var(--stroke-soft-200)] bg-[var(--neutral-weak-50)] px-4 py-3">
                      <div className="flex items-start gap-2.5">
                        <span className="mt-0.5 inline-flex h-7 w-7 items-center justify-center rounded-[8px] border border-[var(--stroke-soft-200)] bg-white text-[var(--neutral-sub-600)]">
                          <Lock className="h-3.5 w-3.5" strokeWidth={2.25} />
                        </span>
                        <div className="min-w-0">
                          <p className="text-[12.5px] font-semibold text-[var(--neutral-strong-950)]">
                            Secrets are not shown again
                          </p>
                          <p className="mt-0.5 text-[12px] leading-[1.55] text-[var(--neutral-sub-600)]">
                            If you are updating credentials, re-enter required fields. Aegis stores secrets, but never returns them to the browser.
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-3">
                      {fields.map((field) => {
                        const help = credentialHelp(connectorKey, field.key);
                        const saved = configuredKeys.includes(field.key);
                        const isSecret = field.secret;
                        const show = !!showSecret[field.key];
                        const inputType =
                          field.inputType === 'password'
                            ? show
                              ? 'text'
                              : 'password'
                            : field.inputType ?? 'text';

                        return (
                          <div key={field.key} className="space-y-1.5">
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <p className="text-[11.5px] font-semibold text-[var(--neutral-sub-600)]">
                                  {field.label}
                                  {field.required && (
                                    <span className="ml-1 text-[var(--neutral-soft-400)]">(required)</span>
                                  )}
                                </p>
                                <InfoHint label={field.label} description={field.description} help={help} />
                              </div>
                              {saved && (
                                <Badge tone="neutral" uppercase>
                                  Saved
                                </Badge>
                              )}
                            </div>

                            <Input
                              type={inputType}
                              value={values[field.key] ?? ''}
                              onChange={(e) =>
                                setValues((prev) => ({ ...prev, [field.key]: e.target.value }))
                              }
                              placeholder={field.placeholder}
                              autoComplete="off"
                              trailingIcon={
                                isSecret ? (
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
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between gap-3 border-t border-[var(--stroke-soft-200)] bg-[var(--neutral-weak-50)]/40 px-6 py-4">
                <span className="text-[11.5px] text-[var(--neutral-soft-400)]">
                  Connector key: <span className="font-mono">{connectorKey}</span>
                </span>
                <div className="flex items-center gap-2">
                  <Button variant="secondary" onClick={onClose} leadingIcon={<X className="h-3.5 w-3.5" strokeWidth={2} />}>
                    Cancel
                  </Button>
                  <Button
                    variant="primary"
                    onClick={handleSave}
                    disabled={!canSave || saving || fields.length === 0}
                    leadingIcon={
                      saving ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={2} />
                      ) : (
                        <Save className="h-3.5 w-3.5" strokeWidth={2.25} />
                      )
                    }
                  >
                    Save credentials
                  </Button>
                </div>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
