'use client';

/**
 * Prompts — `/dashboard/prompts`.
 *
 * List + editor split. Name, description, and body come from the API.
 * Variables are derived from `{braces}` in the body — not a separate field.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ScrollText } from 'lucide-react';
import { api } from '@/lib/api';
import { UserPrompt } from '@/lib/types';
import { useAutoRefresh, useUser } from '@/lib/hooks';
import Topbar from '@/components/layout/Topbar';
import EmptyState from '@/components/ui/EmptyState';
import ErrorBanner from '@/components/ui/ErrorBanner';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { RelativeTime } from '@/components/ui/RelativeTime';
import { Skeleton } from '@/components/ui/Skeleton';
import { useToast } from '@/components/ui/Toast';
import { cn } from '@/lib/utils';

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

type PromptFormState = {
  name: string;
  description: string;
  prompt: string;
};

const emptyForm = (): PromptFormState => ({
  name: '',
  description: '',
  prompt: '',
});

function formFromPrompt(prompt: UserPrompt): PromptFormState {
  return {
    name: prompt.name ?? '',
    description: prompt.description ?? '',
    prompt: prompt.prompt ?? '',
  };
}

type PromptVariable = { name: string; line: number };

function extractPromptVariables(body: string): PromptVariable[] {
  const seen = new Map<string, number>();
  const lines = body.split('\n');
  for (let i = 0; i < lines.length; i += 1) {
    const re = /\{([^{}\n]+)\}/g;
    let match: RegExpExecArray | null;
    while ((match = re.exec(lines[i])) !== null) {
      const name = match[1].trim();
      if (!name || seen.has(name)) continue;
      seen.set(name, i + 1);
    }
  }
  return [...seen.entries()].map(([name, line]) => ({ name, line }));
}

function variableCountLabel(count: number): string {
  if (count === 1) return '1 variable';
  return `${count} variables`;
}

function PromptBodyEditor({
  value,
  onChange,
}: {
  value: string;
  onChange: (next: string) => void;
}) {
  const overlayRef = useRef<HTMLPreElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const parts = value.split(/(\{[^{}]+\})/g);

  const syncScroll = () => {
    const overlay = overlayRef.current;
    const textarea = textareaRef.current;
    if (!overlay || !textarea) return;
    overlay.scrollTop = textarea.scrollTop;
    overlay.scrollLeft = textarea.scrollLeft;
  };

  const sharedText =
    'min-h-[240px] w-full whitespace-pre-wrap break-words p-3 font-sans text-[13px] leading-[1.65]';

  return (
    <div className="relative">
      <pre
        ref={overlayRef}
        aria-hidden
        className={cn(
          sharedText,
          'pointer-events-none absolute inset-0 m-0 overflow-hidden text-[var(--neutral-strong-950)]',
        )}
      >
        {value
          ? parts.map((part, i) =>
              /^\{[^{}]+\}$/.test(part) ? (
                <span
                  key={i}
                  className="rounded-[4px] bg-[var(--primary-alpha-10)] px-0.5 font-medium text-[var(--primary-base)]"
                >
                  {part}
                </span>
              ) : (
                <span key={i}>{part}</span>
              ),
            )
          : null}
        {'\n'}
      </pre>
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onScroll={syncScroll}
        spellCheck={false}
        placeholder="Write the prompt. Anything in {curly} braces becomes a variable."
        className={cn(
          sharedText,
          'relative z-10 resize-y overflow-auto bg-transparent text-transparent caret-[var(--neutral-strong-950)] outline-none',
          'placeholder:text-[var(--neutral-soft-400)] selection:bg-[var(--primary-alpha-16)]',
        )}
      />
    </div>
  );
}

export default function PromptsPage() {
  const { user, isLoading: userLoading } = useUser();
  const toast = useToast();
  const demo = useMemo(() => isDemoMode(), []);

  const [prompts, setPrompts] = useState<UserPrompt[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isDraft, setIsDraft] = useState(false);
  const [form, setForm] = useState<PromptFormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const selected = prompts.find((p) => p.id === selectedId) ?? null;
  const variables = useMemo(() => extractPromptVariables(form.prompt), [form.prompt]);

  const baseline = isDraft || !selected ? emptyForm() : formFromPrompt(selected);
  const dirty =
    form.name !== baseline.name ||
    form.description !== baseline.description ||
    form.prompt !== baseline.prompt;
  const canSave = dirty && Boolean(form.name.trim()) && Boolean(form.prompt.trim());

  const fetchData = useCallback(async () => {
    if (!user && !demo) {
      if (!userLoading) {
        setPrompts([]);
        setLoading(false);
      }
      return;
    }
    try {
      const data = await api.getUserPrompts();
      setPrompts(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load prompts');
    } finally {
      setLoading(false);
    }
  }, [demo, user, userLoading]);

  useEffect(() => {
    if (demo || user) fetchData();
    else if (!userLoading) {
      setPrompts([]);
      setLoading(false);
    }
  }, [demo, user, userLoading, fetchData]);

  const { lastUpdated } = useAutoRefresh(fetchData, 60000);

  useEffect(() => {
    if (loading) return;
    if (isDraft) return;
    if (selectedId && prompts.some((p) => p.id === selectedId)) return;
    const first = prompts[0];
    if (first) {
      setSelectedId(first.id);
      setForm(formFromPrompt(first));
      setIsDraft(false);
      return;
    }
    setSelectedId(null);
    setForm(emptyForm());
    setIsDraft(true);
  }, [loading, prompts, selectedId, isDraft]);

  const patchForm = (patch: Partial<PromptFormState>) => {
    setForm((prev) => ({ ...prev, ...patch }));
  };

  const selectPrompt = (prompt: UserPrompt) => {
    setIsDraft(false);
    setSelectedId(prompt.id);
    setForm(formFromPrompt(prompt));
  };

  const startDraft = () => {
    if (isDraft) return;
    setIsDraft(true);
    setSelectedId(null);
    setForm(emptyForm());
  };

  const buildPayload = () => ({
    prompt: form.prompt.trim(),
    name: form.name.trim(),
    description: form.description.trim(),
  });

  const handleSave = async () => {
    if (!canSave || (!user && !demo)) return;
    setSaving(true);
    try {
      if (isDraft || !selected) {
        const created = await api.createUserPrompt(buildPayload());
        setPrompts((prev) => [created, ...prev.filter((p) => p.id !== created.id)]);
        setSelectedId(created.id);
        setForm(formFromPrompt(created));
        setIsDraft(false);
        toast.success('Prompt created');
      } else {
        const updated = await api.updateUserPrompt(selected.id, buildPayload());
        setPrompts((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
        setForm(formFromPrompt(updated));
        toast.success('Prompt saved');
      }
    } catch (err) {
      toast.error(isDraft || !selected ? 'Failed to create prompt' : 'Failed to save prompt', {
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selected || (!user && !demo)) return;
    setDeleting(true);
    try {
      await api.deleteUserPrompt(selected.id);
      const remaining = prompts.filter((p) => p.id !== selected.id);
      setPrompts(remaining);
      setPendingDelete(false);
      const next = remaining[0];
      if (next) {
        setSelectedId(next.id);
        setForm(formFromPrompt(next));
        setIsDraft(false);
      } else {
        startDraft();
      }
      toast.success('Prompt deleted');
    } catch (err) {
      toast.error('Failed to delete prompt', {
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setDeleting(false);
    }
  };

  const showEditor = isDraft || selected !== null;

  return (
    <>
      <Topbar title="Prompts" lastUpdated={lastUpdated} onRefresh={fetchData} />

      <div className="flex h-[calc(100dvh-48px-56px)] flex-col lg:h-[calc(100dvh-56px)]">
        {error && (
          <div className="border-b border-[var(--stroke-soft-200)] px-4 py-3 sm:px-6">
            <ErrorBanner
              message={error}
              onDismiss={() => setError(null)}
              onRetry={fetchData}
            />
          </div>
        )}

        <div className="flex items-center justify-between gap-3 border-b border-[var(--stroke-soft-200)] px-4 py-3 sm:px-6">
          <div className="flex min-w-0 items-baseline gap-2">
            <h2 className="text-[16px] font-semibold tracking-[-0.02em] text-[var(--neutral-strong-950)]">
              Prompts
            </h2>
            <span className="text-[13px] tabular-nums text-[var(--neutral-soft-400)]">
              {loading ? '—' : prompts.length}
            </span>
          </div>
          <Button variant="primary" size="sm" onClick={startDraft} data-tour="new-prompt">
            New prompt
          </Button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
          <aside className="max-h-[40vh] shrink-0 overflow-y-auto border-b border-[var(--stroke-soft-200)] lg:max-h-none lg:w-[300px] lg:border-b-0 lg:border-r">
            {loading ? (
              <PromptsListSkeleton />
            ) : prompts.length === 0 ? (
              <EmptyState
                compact
                icon={<ScrollText className="h-5 w-5" />}
                title="No prompts yet"
                description="New prompt opens an empty editor. Save writes name, description, and body."
              />
            ) : (
              <ul>
                {prompts.map((prompt) => {
                  const count = extractPromptVariables(prompt.prompt).length;
                  const editedAt = prompt.updated_at ?? prompt.created_at;
                  const active = !isDraft && prompt.id === selectedId;
                  return (
                    <li key={prompt.id}>
                      <button
                        type="button"
                        onClick={() => selectPrompt(prompt)}
                        className={cn(
                          'w-full px-4 py-3 text-left transition-colors sm:px-5',
                          active
                            ? 'bg-[var(--neutral-weak-50)]'
                            : 'hover:bg-[var(--neutral-weak-50)]/70',
                        )}
                      >
                        <div className="truncate text-[13.5px] font-medium tracking-[-0.015em] text-[var(--neutral-strong-950)]">
                          {prompt.name || 'Untitled prompt'}
                        </div>
                        <div className="mt-0.5 truncate text-[12px] text-[var(--neutral-soft-400)]">
                          {variableCountLabel(count)}
                          {editedAt ? (
                            <>
                              {' · edited '}
                              <RelativeTime timestamp={editedAt} />
                            </>
                          ) : null}
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </aside>

          <section className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6 lg:px-8">
            {!showEditor ? (
              <div className="flex h-full items-center justify-center">
                <EmptyState
                  compact
                  icon={<ScrollText className="h-5 w-5" />}
                  title="Select a prompt"
                  description="Pick one from the list, or create a new prompt."
                />
              </div>
            ) : (
              <div className="mx-auto flex w-full max-w-[720px] flex-col gap-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <input
                      type="text"
                      value={form.name}
                      onChange={(e) => patchForm({ name: e.target.value })}
                      placeholder="Untitled prompt"
                      aria-label="Prompt name"
                      className="w-full bg-transparent text-[20px] font-semibold leading-[1.2] tracking-[-0.03em] text-[var(--neutral-strong-950)] outline-none placeholder:text-[var(--neutral-soft-400)]"
                    />
                    <textarea
                      value={form.description}
                      onChange={(e) => patchForm({ description: e.target.value })}
                      placeholder="Short description — when this prompt is used."
                      rows={2}
                      aria-label="Prompt description"
                      className="mt-1.5 w-full resize-none bg-transparent text-[13px] leading-[1.55] text-[var(--neutral-sub-600)] outline-none placeholder:text-[var(--neutral-soft-400)]"
                    />
                  </div>
                  <div className="flex shrink-0 items-center gap-1 pt-0.5">
                    {!isDraft && selected && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setPendingDelete(true)}
                        disabled={saving || deleting}
                      >
                        Delete
                      </Button>
                    )}
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => void handleSave()}
                      disabled={!canSave || saving}
                    >
                      {saving ? 'Saving…' : 'Save'}
                    </Button>
                  </div>
                </div>

                <section className="overflow-hidden rounded-[12px] border border-[var(--stroke-soft-200)] bg-[var(--neutral-weak-50)]">
                  <div className="border-b border-[var(--stroke-soft-200)] px-3 py-2">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--neutral-soft-400)]">
                      Body
                      <span className="font-medium normal-case tracking-normal">
                        {' · '}anything in curly braces becomes a variable
                      </span>
                    </p>
                  </div>
                  <PromptBodyEditor
                    value={form.prompt}
                    onChange={(prompt) => patchForm({ prompt })}
                  />
                </section>

                <section className="overflow-hidden rounded-[12px] border border-[var(--stroke-soft-200)]">
                  <div className="border-b border-[var(--stroke-soft-200)] px-3 py-2">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--neutral-soft-400)]">
                      Variables
                      <span className="font-medium normal-case tracking-normal">
                        {' · '}derived from the body · {variables.length} found
                      </span>
                    </p>
                  </div>
                  {variables.length === 0 ? (
                    <p className="px-3 py-3 text-[13px] text-[var(--neutral-soft-400)]">
                      No curly-brace variables in the body yet.
                    </p>
                  ) : (
                    <ul>
                      {variables.map((variable) => (
                        <li
                          key={variable.name}
                          className="flex items-center justify-between gap-3 border-t border-[var(--stroke-soft-200)] px-3 py-2 first:border-t-0"
                        >
                          <code className="rounded-[4px] bg-[var(--primary-alpha-10)] px-1.5 py-0.5 text-[12.5px] font-medium text-[var(--primary-base)]">
                            {`{${variable.name}}`}
                          </code>
                          <span className="text-[12px] text-[var(--neutral-soft-400)]">
                            found on line {variable.line}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              </div>
            )}
          </section>
        </div>
      </div>

      <ConfirmDialog
        open={pendingDelete}
        onOpenChange={setPendingDelete}
        title="Delete this prompt?"
        description="This cannot be undone. Agents will no longer be able to use it."
        confirmLabel="Delete prompt"
        variant="danger"
        loading={deleting}
        onConfirm={() => void handleDelete()}
      />
    </>
  );
}

function PromptsListSkeleton() {
  return (
    <div className="space-y-1 p-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="space-y-1.5 px-2 py-2">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-3 w-32" />
        </div>
      ))}
    </div>
  );
}
