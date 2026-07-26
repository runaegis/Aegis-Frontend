'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { FormEvent, ReactNode } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import {
  AlertTriangle,
  Check,
  Copy,
  KeyRound,
  Link2,
  Plus,
  RefreshCw,
  Trash2,
  X,
} from 'lucide-react';
import { api } from '@/lib/api';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import EmptyState from '@/components/ui/EmptyState';
import { Input } from '@/components/ui/Input';
import { RelativeTime } from '@/components/ui/RelativeTime';
import { Skeleton } from '@/components/ui/Skeleton';
import { useToast } from '@/components/ui/Toast';
import { useRoom } from '@/lib/roomContext';
import type { ApiKeySummary, ApiTokenPrefix, CreatedApiKey } from '@/lib/types';
import { fadeUp, staggerContainer } from '@/lib/motion';
import { cn } from '@/lib/utils';

type CopyTarget = 'api-key' | 'mcp-url';

export default function RoomApiPage() {
  const { roomId, loading: roomLoading } = useRoom();
  const toast = useToast();
  const reduce = useReducedMotion();

  const [prefix, setPrefix] = useState<ApiTokenPrefix | null>(null);
  const [keys, setKeys] = useState<ApiKeySummary[]>([]);
  const [loadingKeys, setLoadingKeys] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ApiKeySummary | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadPrefix = useCallback(async () => {
    try {
      const data = await api.getApiTokenPrefix();
      setPrefix(data);
    } catch (err) {
      toast.error("Couldn't load API prefix", {
        description: err instanceof Error ? err.message : 'Try again.',
      });
    }
  }, [toast]);

  const loadKeys = useCallback(
    async ({ quiet = false }: { quiet?: boolean } = {}) => {
      if (!roomId) return;
      if (quiet) setRefreshing(true);
      else setLoadingKeys(true);
      try {
        const data = await api.getApiKeys(roomId);
        setKeys(data);
      } catch (err) {
        toast.error("Couldn't load API keys", {
          description: err instanceof Error ? err.message : 'Try again.',
        });
      } finally {
        setLoadingKeys(false);
        setRefreshing(false);
      }
    },
    [roomId, toast],
  );

  useEffect(() => {
    void loadPrefix();
  }, [loadPrefix]);

  useEffect(() => {
    void loadKeys();
  }, [loadKeys]);

  const sortedKeys = useMemo(() => {
    return [...keys].sort((a, b) => {
      if (a.active !== b.active) return a.active ? -1 : 1;
      return (
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
    });
  }, [keys]);

  const activeCount = keys.filter((key) => key.active).length;

  const handleCreated = (created: CreatedApiKey) => {
    const summary: ApiKeySummary = {
      id: created.id,
      name: created.name,
      room_id: created.room_id,
      user_id: created.user_id,
      key_prefix: created.key_prefix,
      active: created.active,
      created_at: created.created_at,
      last_used_at: created.last_used_at,
    };
    setKeys((current) => [
      summary,
      ...current.filter((key) => key.id !== summary.id),
    ]);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.deleteApiKey(deleteTarget.id);
      setKeys((current) =>
        current.map((key) =>
          key.id === deleteTarget.id ? { ...key, active: false } : key,
        ),
      );
      setDeleteTarget(null);
      toast.success('API key deleted', {
        description: `${deleteTarget.name} is no longer active.`,
      });
    } catch (err) {
      toast.error('Could not delete API key', {
        description: err instanceof Error ? err.message : 'Try again.',
      });
    } finally {
      setDeleting(false);
    }
  };

  if (roomLoading || loadingKeys) {
    return (
      <div className="mx-auto w-full max-w-[1320px] 2xl:max-w-[1480px] px-4 pt-4 pb-6 sm:px-6 sm:pt-6 sm:pb-7 lg:px-8 lg:pt-8 lg:pb-8">
        <Skeleton className="h-[320px] w-full rounded-[12px]" />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[1320px] 2xl:max-w-[1480px] px-4 pt-4 pb-6 sm:px-6 sm:pt-6 sm:pb-7 lg:px-8 lg:pt-8 lg:pb-8">
      <motion.div
        variants={staggerContainer(0.06)}
        initial={reduce ? false : 'hidden'}
        animate="show"
        className="space-y-6"
      >
        <motion.div
          variants={fadeUp}
          className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"
        >
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-[var(--primary-alpha-10)] text-[var(--primary-base)]">
                <KeyRound className="h-4 w-4" strokeWidth={2} aria-hidden />
              </span>
              <div>
                <h2 className="text-[18px] font-semibold tracking-[-0.015em] text-[var(--neutral-strong-950)]">
                  API keys
                </h2>
                <p className="mt-0.5 text-[12.5px] leading-[1.5] text-[var(--neutral-sub-600)]">
                  Create room-scoped keys for MCP clients and automation.
                </p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="lg"
              variant="secondary"
              onClick={() => void loadKeys({ quiet: true })}
              disabled={refreshing}
              leadingIcon={
                <RefreshCw
                  className={cn('h-3.5 w-3.5', refreshing && 'animate-spin')}
                  strokeWidth={2}
                />
              }
            >
              Refresh
            </Button>
            <Button
              size="lg"
              variant="primary"
              onClick={() => setCreateOpen(true)}
              leadingIcon={<Plus className="h-3.5 w-3.5" strokeWidth={2} />}
            >
              New key
            </Button>
          </div>
        </motion.div>

        <motion.section
          variants={fadeUp}
          className="overflow-hidden rounded-[12px] border border-[var(--stroke-soft-200)] bg-white shadow-[0_1px_2px_rgba(23,23,23,0.04)]"
        >
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--stroke-soft-200)] px-5 py-3.5">
            <div className="flex items-center gap-2">
              <KeyRound
                className="h-4 w-4 text-[var(--primary-base)]"
                strokeWidth={2}
                aria-hidden
              />
              <h3 className="text-[14px] font-semibold tracking-[-0.01em] text-[var(--neutral-strong-950)]">
                Room API keys
              </h3>
              <span className="inline-flex h-[18px] items-center justify-center rounded-[5px] bg-[var(--neutral-weak-50)] px-[6px] text-[10.5px] font-bold tabular-nums text-[var(--neutral-sub-600)]">
                {activeCount.toLocaleString()}
              </span>
            </div>
            {prefix?.api_key_prefix && (
              <span className="text-[11.5px] text-[var(--neutral-soft-400)]">
                Prefix{' '}
                <code className="text-[var(--neutral-sub-600)] [font-family:var(--font-geist-mono),ui-monospace,monospace]">
                  {prefix.api_key_prefix}
                </code>
              </span>
            )}
          </div>

          {sortedKeys.length === 0 ? (
            <EmptyState
              icon={<KeyRound className="h-5 w-5" />}
              title="No API keys"
              description="Create a named key for Cursor, Claude Code, or another MCP client."
              compact
              action={
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => setCreateOpen(true)}
                  leadingIcon={<Plus className="h-3.5 w-3.5" strokeWidth={2} />}
                >
                  New key
                </Button>
              }
            />
          ) : (
            <ul className="divide-y divide-[var(--stroke-soft-200)]">
              {sortedKeys.map((key) => (
                <ApiKeyRow
                  key={key.id}
                  apiKey={key}
                  onDelete={() => setDeleteTarget(key)}
                />
              ))}
            </ul>
          )}
        </motion.section>

        <motion.section
          variants={fadeUp}
          className="rounded-[12px] border border-[var(--warning)]/25 bg-[rgba(246,181,30,0.08)] px-5 py-4"
        >
          <div className="flex items-start gap-3">
            <AlertTriangle
              className="mt-0.5 h-4 w-4 shrink-0 text-[var(--warning-dark)]"
              strokeWidth={2}
              aria-hidden
            />
            <div className="min-w-0">
              <p className="text-[13px] font-semibold tracking-[-0.005em] text-[var(--neutral-strong-950)]">
                Secrets are shown once
              </p>
              <p className="mt-0.5 text-[12px] leading-[1.55] text-[var(--neutral-sub-600)]">
                After creation, only the prefix is saved for display. Copy the
                API key before closing the creation dialog.
              </p>
            </div>
          </div>
        </motion.section>
      </motion.div>

      <CreateApiKeyDialog
        open={createOpen}
        roomId={roomId}
        prefix={prefix}
        onOpenChange={setCreateOpen}
        onCreated={handleCreated}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open && !deleting) setDeleteTarget(null);
        }}
        title="Delete API key?"
        description={
          deleteTarget ? (
            <>
              <span className="font-semibold text-[var(--neutral-strong-950)]">
                {deleteTarget.name}
              </span>{' '}
              will stop working immediately. Existing clients using this key
              will need a new one.
            </>
          ) : (
            'This key will stop working immediately.'
          )
        }
        confirmLabel="Delete key"
        loading={deleting}
        onConfirm={confirmDelete}
      />
    </div>
  );
}

function ApiKeyRow({
  apiKey,
  onDelete,
}: {
  apiKey: ApiKeySummary;
  onDelete: () => void;
}) {
  return (
    <li className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="truncate text-[13px] font-semibold tracking-[-0.005em] text-[var(--neutral-strong-950)]">
            {apiKey.name}
          </p>
          <Badge
            tone={apiKey.active ? 'success' : 'neutral'}
            uppercase
            leadingDot
          >
            {apiKey.active ? 'Active' : 'Inactive'}
          </Badge>
        </div>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] text-[var(--neutral-soft-400)]">
          <code className="text-[var(--neutral-sub-600)] [font-family:var(--font-geist-mono),ui-monospace,monospace]">
            {apiKey.key_prefix}••••
          </code>
          <span>
            Created{' '}
            <RelativeTime timestamp={apiKey.created_at} className="inline" />
          </span>
          <span>
            Last used{' '}
            {apiKey.last_used_at ? (
              <RelativeTime timestamp={apiKey.last_used_at} className="inline" />
            ) : (
              <span className="text-[var(--neutral-sub-600)]">Never</span>
            )}
          </span>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Button
          size="sm"
          variant="danger"
          onClick={onDelete}
          disabled={!apiKey.active}
          leadingIcon={<Trash2 className="h-3 w-3" strokeWidth={2} />}
        >
          Delete
        </Button>
      </div>
    </li>
  );
}

function CreateApiKeyDialog({
  open,
  roomId,
  prefix,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  roomId: string;
  prefix: ApiTokenPrefix | null;
  onOpenChange: (open: boolean) => void;
  onCreated: (created: CreatedApiKey) => void;
}) {
  const reduce = useReducedMotion();
  const toast = useToast();
  const inputRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState('');
  const [nameError, setNameError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [createdKey, setCreatedKey] = useState<CreatedApiKey | null>(null);
  const [copied, setCopied] = useState<CopyTarget | null>(null);

  const mcpUrl = useMemo(() => {
    if (!createdKey?.api_key || !prefix?.mcp_url_prefix) return '';
    return `${prefix.mcp_url_prefix}${createdKey.api_key}`;
  }, [createdKey?.api_key, prefix?.mcp_url_prefix]);

  useEffect(() => {
    if (!open) return;
    setName('');
    setNameError('');
    setSubmitting(false);
    setCreatedKey(null);
    setCopied(null);
    const id = window.setTimeout(() => inputRef.current?.focus(), 60);
    return () => window.clearTimeout(id);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !submitting) {
        event.preventDefault();
        onOpenChange(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onOpenChange, submitting]);

  const copyToClipboard = async (target: CopyTarget, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(target);
      window.setTimeout(() => setCopied(null), 1600);
      toast.success(target === 'api-key' ? 'API key copied' : 'MCP URL copied');
    } catch {
      toast.error('Could not copy', {
        description: 'Your browser blocked clipboard access.',
      });
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) {
      setNameError('API key name is required.');
      return;
    }
    setSubmitting(true);
    try {
      const created = await api.createApiKey({
        room_id: roomId,
        name: trimmedName,
      });
      setCreatedKey(created);
      onCreated(created);
      toast.success('API key created', {
        description: 'Copy it now. It cannot be recovered later.',
      });
    } catch (err) {
      toast.error('Could not create API key', {
        description: err instanceof Error ? err.message : 'Try again.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="fixed inset-0 z-[70] bg-black/40 backdrop-blur-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.16 }}
            onClick={() => !submitting && onOpenChange(false)}
          />
          <div className="fixed inset-0 z-[71] flex items-center justify-center px-4">
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-labelledby="create-api-key-title"
              className="pointer-events-auto w-full max-w-[560px] overflow-hidden rounded-[14px] border border-[var(--stroke-soft-200)] bg-[var(--white-0)] shadow-[0_24px_64px_rgba(0,0,0,0.18),0_4px_12px_rgba(0,0,0,0.08)]"
              initial={
                reduce ? { opacity: 0 } : { opacity: 0, scale: 0.96, y: 8 }
              }
              animate={
                reduce ? { opacity: 1 } : { opacity: 1, scale: 1, y: 0 }
              }
              exit={
                reduce
                  ? { opacity: 0 }
                  : { opacity: 0, scale: 0.96, y: 8 }
              }
              transition={{ duration: 0.2 }}
            >
              <div className="flex items-start justify-between gap-4 border-b border-[var(--stroke-soft-200)] px-5 py-4">
                <div className="flex min-w-0 items-start gap-3">
                  <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-[var(--primary-alpha-10)] text-[var(--primary-base)]">
                    <KeyRound
                      className="h-4 w-4"
                      strokeWidth={2}
                      aria-hidden
                    />
                  </span>
                  <div className="min-w-0">
                    <h2
                      id="create-api-key-title"
                      className="text-[15px] font-semibold leading-[1.3] tracking-[-0.01em] text-[var(--neutral-strong-950)]"
                    >
                      New API key
                    </h2>
                    <p className="mt-1 text-[12.5px] leading-[1.5] text-[var(--neutral-sub-600)]">
                      Name the key by client, teammate, or machine.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onOpenChange(false)}
                  disabled={submitting}
                  aria-label="Close"
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] text-[var(--neutral-soft-400)] transition-colors hover:bg-[var(--neutral-weak-50)] hover:text-[var(--neutral-strong-950)] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <X className="h-4 w-4" strokeWidth={2} aria-hidden />
                </button>
              </div>

              {createdKey ? (
                <div className="space-y-4 p-5">
                  <WarningCallout>
                    This is the only time the full secret will be shown. Copy
                    it before closing this dialog.
                  </WarningCallout>

                  <SecretField
                    label="API key"
                    value={createdKey.api_key}
                    copied={copied === 'api-key'}
                    onCopy={() => copyToClipboard('api-key', createdKey.api_key)}
                  />

                  <SecretField
                    label="MCP URL"
                    value={mcpUrl}
                    copied={copied === 'mcp-url'}
                    icon={<Link2 className="h-3.5 w-3.5" strokeWidth={2} />}
                    onCopy={() => copyToClipboard('mcp-url', mcpUrl)}
                    disabled={!mcpUrl}
                  />

                  <div className="flex items-center justify-end">
                    <Button
                      variant="primary"
                      onClick={() => onOpenChange(false)}
                    >
                      Done
                    </Button>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4 p-5">
                  <input type="hidden" name="room_id" value={roomId} />
                  <div>
                    <label className="mb-1.5 block text-[10.5px] font-semibold uppercase tracking-[0.07em] text-[var(--neutral-soft-400)]">
                      Key name
                    </label>
                    <Input
                      ref={inputRef}
                      value={name}
                      onChange={(event) => {
                        setName(event.target.value);
                        if (nameError) setNameError('');
                      }}
                      placeholder="My Cursor key"
                      invalid={Boolean(nameError)}
                      disabled={submitting}
                    />
                    {nameError && (
                      <p className="mt-1.5 text-[11.5px] text-[var(--error)]">
                        {nameError}
                      </p>
                    )}
                  </div>

                  <WarningCallout>
                    The full API key cannot be recovered later. Store it in the
                    client or secret manager you are connecting.
                  </WarningCallout>

                  <div className="flex items-center justify-end gap-2">
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => onOpenChange(false)}
                      disabled={submitting}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      variant="primary"
                      disabled={submitting}
                    >
                      {submitting ? 'Creating…' : 'Create key'}
                    </Button>
                  </div>
                </form>
              )}
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}

function WarningCallout({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-[10px] border border-[var(--warning)]/25 bg-[rgba(246,181,30,0.08)] px-3 py-2.5">
      <div className="flex items-start gap-2">
        <AlertTriangle
          className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--warning-dark)]"
          strokeWidth={2}
          aria-hidden
        />
        <p className="text-[12px] leading-[1.5] text-[var(--neutral-sub-600)]">
          {children}
        </p>
      </div>
    </div>
  );
}

function SecretField({
  label,
  value,
  copied,
  onCopy,
  disabled = false,
  icon,
}: {
  label: string;
  value: string;
  copied: boolean;
  onCopy: () => void;
  disabled?: boolean;
  icon?: ReactNode;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-[10.5px] font-semibold uppercase tracking-[0.07em] text-[var(--neutral-soft-400)]">
        {label}
      </label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          value={value}
          readOnly
          onClick={(event) => event.currentTarget.select()}
          className="h-9 min-w-0 flex-1 rounded-[8px] border border-[var(--stroke-sub-300)] bg-[var(--neutral-weak-50)] px-3 text-[11.5px] text-[var(--neutral-strong-950)] [font-family:var(--font-geist-mono),ui-monospace,monospace] focus:outline-none focus:ring-[3px] focus:ring-[var(--primary-alpha-16)]"
        />
        <Button
          type="button"
          variant="secondary"
          size="lg"
          onClick={onCopy}
          disabled={disabled}
          leadingIcon={
            copied ? (
              <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
            ) : (
              icon ?? <Copy className="h-3.5 w-3.5" strokeWidth={2} />
            )
          }
        >
          {copied ? 'Copied' : 'Copy'}
        </Button>
      </div>
    </div>
  );
}
