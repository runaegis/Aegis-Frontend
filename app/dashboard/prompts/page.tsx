'use client';

import { useCallback, useEffect, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { Check, Clock, Pencil, Plus, ScrollText, X } from 'lucide-react';
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

export default function PromptsPage() {
  const { user, isLoading: userLoading } = useUser();
  const reduce = useReducedMotion();
  const toast = useToast();

  const [prompts, setPrompts] = useState<UserPrompt[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [newPrompt, setNewPrompt] = useState('');
  const [creating, setCreating] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [savingId, setSavingId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!user?.id) {
      if (!userLoading) {
        setPrompts([]);
        setLoading(false);
      }
      return;
    }
    try {
      const data = await api.getUserPrompts(user.id);
      setPrompts(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load prompts');
    } finally {
      setLoading(false);
    }
  }, [user?.id, userLoading]);

  useEffect(() => {
    if (user?.id) fetchData();
    else if (!userLoading) {
      setPrompts([]);
      setLoading(false);
    }
  }, [user?.id, userLoading, fetchData]);

  const { lastUpdated } = useAutoRefresh(fetchData, 60000);

  const startEdit = (prompt: UserPrompt) => {
    setEditingId(prompt.id);
    setEditText(prompt.prompt);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditText('');
  };

  const handleCreate = async () => {
    const text = newPrompt.trim();
    if (!text || !user?.id) return;
    setCreating(true);
    try {
      const created = await api.createUserPrompt(user.id, text);
      setPrompts((prev) => [created, ...prev]);
      setNewPrompt('');
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
    const text = editText.trim();
    if (!text || !user?.id) return;
    setSavingId(prompt.id);
    try {
      const updated = await api.updateUserPrompt(prompt.id, user.id, text);
      setPrompts((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
      setEditingId(null);
      setEditText('');
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
          <div className="space-y-3 p-4 sm:p-5">
            <textarea
              value={newPrompt}
              onChange={(e) => setNewPrompt(e.target.value)}
              placeholder="e.g. Before opening a PR, run tests and summarize what changed in plain language…"
              rows={4}
              className={cn(
                'w-full resize-y rounded-[8px] border border-[var(--stroke-soft-200)] bg-white px-3 py-2.5',
                'text-[13px] leading-[1.6] text-[var(--neutral-strong-950)] placeholder:text-[var(--neutral-soft-400)]',
                'outline-none focus:border-[var(--primary-base)]/50 focus:ring-2 focus:ring-[var(--primary-alpha-10)]',
              )}
            />
            <div className="flex justify-end">
              <Button
                variant="primary"
                size="sm"
                onClick={handleCreate}
                disabled={creating || !newPrompt.trim()}
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
                    <div className="flex items-center gap-2">
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[7px] bg-[var(--primary-alpha-10)]">
                        <ScrollText
                          className="h-3.5 w-3.5 text-[var(--primary-base)]"
                          strokeWidth={2}
                        />
                      </div>
                      <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--neutral-soft-400)]">
                        Prompt
                      </span>
                    </div>
                    {!isEditing && (
                      <button
                        type="button"
                        onClick={() => startEdit(prompt)}
                        aria-label="Edit prompt"
                        className="flex h-7 w-7 items-center justify-center rounded-[7px] text-[var(--neutral-soft-400)] transition-colors hover:bg-[var(--neutral-weak-50)] hover:text-[var(--neutral-strong-950)]"
                      >
                        <Pencil className="h-3.5 w-3.5" strokeWidth={2} />
                      </button>
                    )}
                  </div>

                  <div className="px-4 py-4 sm:px-5">
                    {isEditing ? (
                      <textarea
                        autoFocus
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                        rows={5}
                        className={cn(
                          'w-full resize-y rounded-[8px] border border-[var(--stroke-soft-200)] bg-white px-3 py-2.5',
                          'text-[13px] leading-[1.65] text-[var(--neutral-sub-600)] outline-none',
                          'focus:border-[var(--primary-base)]/50 focus:ring-2 focus:ring-[var(--primary-alpha-10)]',
                        )}
                      />
                    ) : (
                      <p className="whitespace-pre-wrap text-[13px] leading-[1.65] text-[var(--neutral-sub-600)]">
                        {prompt.prompt}
                      </p>
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
                          disabled={isSaving || !editText.trim()}
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
            <div className="h-7 w-7 animate-pulse rounded-[7px] bg-[var(--neutral-weak-50)]" />
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
