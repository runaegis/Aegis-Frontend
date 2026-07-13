'use client';

import { useCallback, useEffect, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { Braces, Check, Clock, Pencil, Plus, ScrollText, X } from 'lucide-react';
import { api } from '@/lib/api';
import { UserPrompt } from '@/lib/types';
import { useAutoRefresh, useUser } from '@/lib/hooks';
import Topbar from '@/components/layout/Topbar';
import EmptyState from '@/components/ui/EmptyState';
import ErrorBanner from '@/components/ui/ErrorBanner';
import { Button } from '@/components/ui/Button';
import { RelativeTime } from '@/components/ui/RelativeTime';
import { useToast } from '@/components/ui/Toast';
import { cn } from '@/lib/utils';
import { DUR, EASE, fadeUp, staggerContainer } from '@/lib/motion';

const inputClass = cn(
  'w-full rounded-[8px] border border-[var(--stroke-soft-200)] bg-white outline-none',
  'text-[13px] text-[var(--neutral-strong-950)] placeholder:text-[var(--neutral-soft-400)]',
  'focus:border-[var(--primary-base)]/50 focus:ring-2 focus:ring-[var(--primary-alpha-10)]',
);

const textareaClass = cn(
  inputClass,
  'resize-y px-3 py-2.5 leading-[1.6]',
);

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

function PromptVariableHint() {
  return (
    <div className="flex gap-2.5 rounded-[8px] border border-[var(--primary-base)]/20 bg-[var(--primary-alpha-10)] px-3 py-2.5">
      <Braces
        className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--primary-base)]"
        strokeWidth={2.25}
      />
      <p className="text-[12px] leading-[1.55] text-[var(--neutral-sub-600)]">
        Use curly braces for values you want filled in at invocation time — e.g.{' '}
        <code className="rounded-[4px] bg-white/70 px-1 py-0.5 font-medium text-[var(--primary-base)]">
          {'{repo}'}
        </code>
        ,{' '}
        <code className="rounded-[4px] bg-white/70 px-1 py-0.5 font-medium text-[var(--primary-base)]">
          {'{ticket_id}'}
        </code>
        . When this prompt is used, you&apos;ll be asked to provide each variable.
      </p>
    </div>
  );
}

function PromptBody({ text }: { text: string }) {
  const parts = text.split(/(\{[^{}]+\})/g);

  return (
    <p className="whitespace-pre-wrap text-[13px] leading-[1.65] text-[var(--neutral-sub-600)]">
      {parts.map((part, i) =>
        /^\{[^{}]+\}$/.test(part) ? (
          <span
            key={i}
            className="rounded-[4px] bg-[var(--primary-alpha-10)] px-1 py-0.5 font-medium text-[var(--primary-base)]"
          >
            {part}
          </span>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </p>
  );
}

function PromptFormFields({
  values,
  onChange,
  promptRows = 4,
}: {
  values: PromptFormState;
  onChange: (patch: Partial<PromptFormState>) => void;
  promptRows?: number;
}) {
  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-[11.5px] font-medium text-[var(--neutral-sub-600)]">
            Name
          </label>
          <input
            type="text"
            value={values.name}
            onChange={(e) => onChange({ name: e.target.value })}
            placeholder="e.g. PR review checklist"
            className={cn(inputClass, 'h-9 px-3')}
          />
        </div>
        <div>
          <label className="mb-1.5 block text-[11.5px] font-medium text-[var(--neutral-sub-600)]">
            Description <span className="text-[var(--neutral-soft-400)]">(optional)</span>
          </label>
          <input
            type="text"
            value={values.description}
            onChange={(e) => onChange({ description: e.target.value })}
            placeholder="Short note on when to use this prompt"
            className={cn(inputClass, 'h-9 px-3')}
          />
        </div>
      </div>

      <div>
        <label className="mb-1.5 block text-[11.5px] font-medium text-[var(--neutral-sub-600)]">
          Prompt body
        </label>
        <textarea
          value={values.prompt}
          onChange={(e) => onChange({ prompt: e.target.value })}
          placeholder="e.g. Review the PR for {repo} and summarize risks before merge…"
          rows={promptRows}
          className={textareaClass}
        />
      </div>

      <PromptVariableHint />
    </div>
  );
}

export default function PromptsPage() {
  const { user, isLoading: userLoading } = useUser();
  const reduce = useReducedMotion();
  const toast = useToast();

  const [prompts, setPrompts] = useState<UserPrompt[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [newForm, setNewForm] = useState<PromptFormState>(emptyForm);
  const [creating, setCreating] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<PromptFormState>(emptyForm);
  const [savingId, setSavingId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!user) {
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
  }, [user, userLoading]);

  useEffect(() => {
    if (user) fetchData();
    else if (!userLoading) {
      setPrompts([]);
      setLoading(false);
    }
  }, [user, userLoading, fetchData]);

  const { lastUpdated } = useAutoRefresh(fetchData, 60000);

  const startEdit = (prompt: UserPrompt) => {
    setEditingId(prompt.id);
    setEditForm({
      name: prompt.name,
      description: prompt.description ?? '',
      prompt: prompt.prompt,
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm(emptyForm());
  };

  const buildPayload = (form: PromptFormState) => ({
    prompt: form.prompt.trim(),
    ...(form.name.trim() ? { name: form.name.trim() } : {}),
    ...(form.description.trim() ? { description: form.description.trim() } : {}),
  });

  const handleCreate = async () => {
    const payload = buildPayload(newForm);
    if (!payload.prompt || !user) return;
    setCreating(true);
    try {
      const created = await api.createUserPrompt(payload);
      setPrompts((prev) => [created, ...prev]);
      setNewForm(emptyForm());
      toast.success('Prompt added');
    } catch (err) {
      toast.error('Failed to add prompt', {
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setCreating(false);
    }
  };

  const handleSave = async (prompt: UserPrompt) => {
    const payload = buildPayload(editForm);
    if (!payload.prompt || !user) return;
    setSavingId(prompt.id);
    try {
      const updated = await api.updateUserPrompt(prompt.id, payload);
      setPrompts((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
      cancelEdit();
      toast.success('Prompt updated');
    } catch (err) {
      toast.error('Failed to update prompt', {
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setSavingId(null);
    }
  };

  return (
    <>
      <Topbar
        title="Prompts"
        subtitle="Daily reusable instructions for your agents"
        lastUpdated={lastUpdated}
        onRefresh={fetchData}
      />

      <div className="mx-auto max-w-[1320px] 2xl:max-w-[1480px] px-4 py-6 sm:px-6 sm:py-7 lg:px-8 lg:py-8">
        {error && (
          <div className="mb-6">
            <ErrorBanner
              message={error}
              onDismiss={() => setError(null)}
              onRetry={fetchData}
            />
          </div>
        )}

        <motion.header
          className="mb-6"
          variants={staggerContainer(0.05, 0.04)}
          initial={reduce ? false : 'hidden'}
          animate="show"
        >
          <motion.p
            variants={fadeUp}
            className="mb-2 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-[var(--primary-base)]"
          >
            Agent prompts · {prompts.length.toLocaleString()}{' '}
            {prompts.length === 1 ? 'entry' : 'entries'}
          </motion.p>
          <motion.h1
            variants={fadeUp}
            className="max-w-[620px] text-[28px] font-semibold leading-[1.1] tracking-[-0.03em] text-[var(--neutral-strong-950)] sm:text-[34px]"
          >
            Reusable daily instructions.
          </motion.h1>
          <motion.p
            variants={fadeUp}
            className="mt-3 max-w-[540px] text-[14px] leading-[1.6] text-[var(--neutral-sub-600)]"
          >
            Configure standing prompts your agents can pull into sessions — standups,
            review checklists, coding standards, or anything you repeat every day.
          </motion.p>
        </motion.header>

        <motion.section
          initial={reduce ? false : { opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: DUR.default, ease: EASE.out, delay: 0.12 }}
          className="mb-8 overflow-hidden rounded-[12px] border border-[var(--stroke-soft-200)] bg-white shadow-[0_1px_2px_rgba(23,23,23,0.04)]"
        >
          <div className="border-b border-[var(--stroke-soft-200)] px-4 py-3 sm:px-5">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-[7px] bg-[var(--primary-alpha-10)]">
                <Plus className="h-3.5 w-3.5 text-[var(--primary-base)]" strokeWidth={2.25} />
              </div>
              <h2 className="text-[13.5px] font-semibold text-[var(--neutral-strong-950)]">
                Add prompt
              </h2>
            </div>
          </div>
          <div className="space-y-4 p-4 sm:p-5">
            <PromptFormFields
              values={newForm}
              onChange={(patch) => setNewForm((prev) => ({ ...prev, ...patch }))}
            />
            <div className="flex justify-end">
              <Button
                variant="primary"
                size="sm"
                onClick={handleCreate}
                disabled={creating || !newForm.prompt.trim()}
                leadingIcon={<Plus className="h-3.5 w-3.5" strokeWidth={2.25} />}
              >
                {creating ? 'Adding…' : 'Add prompt'}
              </Button>
            </div>
          </div>
        </motion.section>

        {loading ? (
          <PromptsSkeleton />
        ) : prompts.length === 0 ? (
          <div className="overflow-hidden rounded-[12px] border border-[var(--stroke-soft-200)] bg-white shadow-[0_1px_2px_rgba(23,23,23,0.04)]">
            <EmptyState
              icon={<ScrollText className="h-5 w-5" />}
              title="No prompts yet"
              description="Add your first reusable prompt above. Agents can reference these during daily work."
            />
          </div>
        ) : (
          <motion.div
            variants={staggerContainer(0.04, 0.16)}
            initial={reduce ? false : 'hidden'}
            animate="show"
            className="space-y-3"
          >
            {prompts.map((prompt) => {
              const isEditing = editingId === prompt.id;
              const isSaving = savingId === prompt.id;

              return (
                <motion.article
                  key={prompt.id}
                  variants={fadeUp}
                  className={cn(
                    'overflow-hidden rounded-[12px] border bg-white shadow-[0_1px_2px_rgba(23,23,23,0.04)]',
                    isEditing
                      ? 'border-[var(--primary-base)]/40 ring-1 ring-[var(--primary-alpha-10)]'
                      : 'border-[var(--stroke-soft-200)]',
                    isSaving && 'pointer-events-none opacity-60',
                  )}
                >
                  <div className="flex items-start justify-between gap-3 border-b border-[var(--stroke-soft-200)] px-4 py-3 sm:px-5">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[7px] bg-[var(--primary-alpha-10)]">
                          <ScrollText
                            className="h-3.5 w-3.5 text-[var(--primary-base)]"
                            strokeWidth={2}
                          />
                        </div>
                        {isEditing ? (
                          <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--neutral-soft-400)]">
                            Editing prompt
                          </span>
                        ) : (
                          <div className="min-w-0">
                            <h3 className="truncate text-[14px] font-semibold leading-[1.25] tracking-[-0.015em] text-[var(--neutral-strong-950)]">
                              {prompt.name}
                            </h3>
                            {prompt.description && (
                              <p className="mt-0.5 truncate text-[12px] text-[var(--neutral-soft-400)]">
                                {prompt.description}
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    {!isEditing && (
                      <button
                        type="button"
                        onClick={() => startEdit(prompt)}
                        aria-label="Edit prompt"
                        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[7px] text-[var(--neutral-soft-400)] transition-colors hover:bg-[var(--neutral-weak-50)] hover:text-[var(--neutral-strong-950)]"
                      >
                        <Pencil className="h-3.5 w-3.5" strokeWidth={2} />
                      </button>
                    )}
                  </div>

                  <div className="px-4 py-4 sm:px-5">
                    {isEditing ? (
                      <PromptFormFields
                        values={editForm}
                        onChange={(patch) => setEditForm((prev) => ({ ...prev, ...patch }))}
                        promptRows={5}
                      />
                    ) : (
                      <PromptBody text={prompt.prompt} />
                    )}
                  </div>

                  <div className="flex min-h-[42px] items-center justify-between gap-2 border-t border-[var(--stroke-soft-200)] bg-[var(--neutral-weak-50)]/70 px-4 py-2 sm:px-5">
                    {isEditing ? (
                      <div className="flex w-full items-center justify-end gap-2">
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={cancelEdit}
                          disabled={isSaving}
                          leadingIcon={<X className="h-3.5 w-3.5" strokeWidth={2} />}
                        >
                          Cancel
                        </Button>
                        <Button
                          size="sm"
                          variant="primary"
                          onClick={() => handleSave(prompt)}
                          disabled={isSaving || !editForm.prompt.trim()}
                          leadingIcon={<Check className="h-3.5 w-3.5" strokeWidth={2.25} />}
                        >
                          {isSaving ? 'Saving…' : 'Save'}
                        </Button>
                      </div>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-[11px] text-[var(--neutral-soft-400)]">
                        <Clock className="h-3 w-3" strokeWidth={2} />
                        {prompt.updated_at ?? prompt.created_at ? (
                          <RelativeTime
                            timestamp={(prompt.updated_at ?? prompt.created_at) as string}
                          />
                        ) : (
                          <span>Saved</span>
                        )}
                      </span>
                    )}
                  </div>
                </motion.article>
              );
            })}
          </motion.div>
        )}

        {prompts.length > 0 && (
          <motion.p
            initial={reduce ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: DUR.slow, ease: EASE.out, delay: 0.4 }}
            className="mt-10 text-center text-[12px] text-[var(--neutral-soft-400)]"
          >
            Prompts are user-scoped and available to your agents across sessions.
          </motion.p>
        )}
      </div>
    </>
  );
}

function PromptsSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <div
          key={i}
          className="overflow-hidden rounded-[12px] border border-[var(--stroke-soft-200)] bg-white shadow-[0_1px_2px_rgba(23,23,23,0.04)]"
        >
          <div className="border-b border-[var(--stroke-soft-200)] px-5 py-3">
            <div className="flex items-center gap-2">
              <div className="h-7 w-7 animate-pulse rounded-[7px] bg-[var(--neutral-weak-50)]" />
              <div className="space-y-1.5">
                <div className="h-4 w-40 animate-pulse rounded-[6px] bg-[var(--neutral-weak-50)]" />
                <div className="h-3 w-56 animate-pulse rounded-[6px] bg-[var(--neutral-weak-50)]" />
              </div>
            </div>
          </div>
          <div className="space-y-2 p-5">
            <div className="h-3 w-full animate-pulse rounded-[6px] bg-[var(--neutral-weak-50)]" />
            <div className="h-3 w-5/6 animate-pulse rounded-[6px] bg-[var(--neutral-weak-50)]" />
            <div className="h-3 w-2/3 animate-pulse rounded-[6px] bg-[var(--neutral-weak-50)]" />
          </div>
          <div className="flex h-[42px] items-center border-t border-[var(--stroke-soft-200)] bg-[var(--neutral-weak-50)]/70 px-5">
            <div className="h-3 w-24 animate-pulse rounded-[6px] bg-[var(--neutral-weak-50)]" />
          </div>
        </div>
      ))}
    </div>
  );
}
