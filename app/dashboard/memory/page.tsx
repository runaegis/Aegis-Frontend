'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import {
  BookMarked,
  Pencil,
  Trash2,
  Check,
  X,
  Clock,
  Search,
  ArrowUpRight,
  Pin,
  PinOff,
} from 'lucide-react';
import { api } from '@/lib/api';
import { Memory } from '@/lib/types';
import { useAutoRefresh, useUser } from '@/lib/hooks';
import Topbar from '@/components/layout/Topbar';
import EmptyState from '@/components/ui/EmptyState';
import ErrorBanner from '@/components/ui/ErrorBanner';
import { Button } from '@/components/ui/Button';
import { RelativeTime } from '@/components/ui/RelativeTime';
import { useToast } from '@/components/ui/Toast';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { cn } from '@/lib/utils';
import { DUR, EASE, fadeUp, staggerContainer } from '@/lib/motion';

const EASE_EMPH: [number, number, number, number] = [0.2, 0.8, 0.2, 1];

export default function MemoryPage() {
  const { user, isLoading: userLoading } = useUser();
  const reduce = useReducedMotion();
  const toast = useToast();

  const [memories, setMemories] = useState<Memory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  // Detail slide-over
  const [detailMemory, setDetailMemory] = useState<Memory | null>(null);

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editMemory, setEditMemory] = useState('');
  const [savingId, setSavingId] = useState<string | null>(null);

  // Delete state
  const [pendingDelete, setPendingDelete] = useState<Memory | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Pin state
  const [pinningId, setPinningId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!user?.id) {
      if (!userLoading) {
        setMemories([]);
        setLoading(false);
      }
      return;
    }
    try {
      const raw = await api.getMemories(user.id);
      // Sort: pinned first, then most recently touched
      const data = [...raw].sort((a, b) => {
        if (a.is_pinned && !b.is_pinned) return -1;
        if (!a.is_pinned && b.is_pinned) return 1;
        const ta = new Date(a.updated_at ?? a.created_at ?? 0).getTime();
        const tb = new Date(b.updated_at ?? b.created_at ?? 0).getTime();
        return tb - ta;
      });
      setMemories(data);
      setError(null);
      // Keep detail panel in sync if the open memory was updated
      setDetailMemory((prev) => {
        if (!prev) return null;
        return data.find((m) => m.id === prev.id) ?? null;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load memories');
    } finally {
      setLoading(false);
    }
  }, [user?.id, userLoading]);

  useEffect(() => {
    if (user?.id) fetchData();
    else if (!userLoading) {
      setMemories([]);
      setLoading(false);
    }
  }, [user?.id, userLoading, fetchData]);

  const { lastUpdated } = useAutoRefresh(fetchData, 60000);

  const startEdit = (memory: Memory) => {
    setEditingId(memory.id);
    setEditTitle(memory.title);
    setEditMemory(memory.memory);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditTitle('');
    setEditMemory('');
  };

  const handleSave = async (memory: Memory) => {
    if (!editTitle.trim() && !editMemory.trim()) return;
    if (!user?.id) return;
    setSavingId(memory.id);
    try {
      const updated = await api.updateMemory(memory.id, user.id, {
        title: editTitle.trim() || memory.title,
        memory: editMemory.trim() || memory.memory,
      });
      setMemories((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
      setDetailMemory((prev) => (prev?.id === updated.id ? updated : prev));
      setEditingId(null);
      toast.success('Memory updated');
    } catch (err) {
      toast.error('Failed to update memory', {
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setSavingId(null);
    }
  };

  const handleDelete = async () => {
    if (!pendingDelete || !user?.id) return;
    const mem = pendingDelete;
    setPendingDelete(null);
    setDeletingId(mem.id);
    try {
      await api.deleteMemory(mem.id, user.id);
      setMemories((prev) => prev.filter((m) => m.id !== mem.id));
      if (detailMemory?.id === mem.id) setDetailMemory(null);
      toast.success('Memory deleted');
    } catch (err) {
      toast.error('Failed to delete memory', {
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setDeletingId(null);
    }
  };

  const handlePin = async (memory: Memory) => {
    if (!user?.id) return;
    const newPinned = !memory.is_pinned;
    setPinningId(memory.id);
    // Optimistic update
    const applyPin = (list: Memory[]) =>
      list
        .map((m) => (m.id === memory.id ? { ...m, is_pinned: newPinned } : m))
        .sort((a, b) => {
          if (a.is_pinned && !b.is_pinned) return -1;
          if (!a.is_pinned && b.is_pinned) return 1;
          const ta = new Date(a.updated_at ?? a.created_at ?? 0).getTime();
          const tb = new Date(b.updated_at ?? b.created_at ?? 0).getTime();
          return tb - ta;
        });
    setMemories((prev) => applyPin(prev));
    setDetailMemory((prev) =>
      prev?.id === memory.id ? { ...prev, is_pinned: newPinned } : prev,
    );
    try {
      const updated = await api.updateMemory(memory.id, user.id, {
        is_pinned: newPinned,
      });
      setMemories((prev) =>
        prev
          .map((m) => (m.id === updated.id ? updated : m))
          .sort((a, b) => {
            if (a.is_pinned && !b.is_pinned) return -1;
            if (!a.is_pinned && b.is_pinned) return 1;
            const ta = new Date(a.updated_at ?? a.created_at ?? 0).getTime();
            const tb = new Date(b.updated_at ?? b.created_at ?? 0).getTime();
            return tb - ta;
          }),
      );
      setDetailMemory((prev) => (prev?.id === updated.id ? updated : prev));
      toast.success(newPinned ? 'Memory pinned' : 'Memory unpinned');
    } catch (err) {
      // Revert optimistic update on failure
      setMemories((prev) =>
        prev
          .map((m) => (m.id === memory.id ? { ...m, is_pinned: !newPinned } : m))
          .sort((a, b) => {
            if (a.is_pinned && !b.is_pinned) return -1;
            if (!a.is_pinned && b.is_pinned) return 1;
            const ta = new Date(a.updated_at ?? a.created_at ?? 0).getTime();
            const tb = new Date(b.updated_at ?? b.created_at ?? 0).getTime();
            return tb - ta;
          }),
      );
      setDetailMemory((prev) =>
        prev?.id === memory.id ? { ...prev, is_pinned: !newPinned } : prev,
      );
      toast.error('Failed to update pin', {
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setPinningId(null);
    }
  };

  const filtered = memories.filter((m) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return m.title.toLowerCase().includes(q) || m.memory.toLowerCase().includes(q);
  });

  return (
    <>
      <Topbar
        title="Memory"
        subtitle="What your agents remember"
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

        {/* ─── Header ─────────────────────────────────────────────── */}
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
            Agent memory · {memories.length.toLocaleString()}{' '}
            {memories.length === 1 ? 'entry' : 'entries'}
          </motion.p>
          <motion.h1
            variants={fadeUp}
            className="max-w-[620px] text-[28px] font-semibold leading-[1.1] tracking-[-0.03em] text-[var(--neutral-strong-950)] sm:text-[34px]"
          >
            Everything your agents know.
          </motion.h1>
          <motion.p
            variants={fadeUp}
            className="mt-3 max-w-[500px] text-[14px] leading-[1.6] text-[var(--neutral-sub-600)]"
          >
            Persisted context that agents carry between sessions — edit or remove
            entries to steer their behavior.
          </motion.p>
        </motion.header>

        {/* ─── Search bar ─────────────────────────────────────────── */}
        {memories.length > 0 && (
          <motion.div
            initial={reduce ? false : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: DUR.default, ease: EASE.out, delay: 0.18 }}
            className="mb-6"
          >
            <div className="relative max-w-[400px]">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--neutral-soft-400)]"
                strokeWidth={2}
              />
              <input
                type="text"
                placeholder="Search memories…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className={cn(
                  'h-8 w-full rounded-[8px] border border-[var(--stroke-soft-200)] bg-white pl-8 pr-3 text-[13px]',
                  'text-[var(--neutral-strong-950)] placeholder:text-[var(--neutral-soft-400)]',
                  'shadow-[0_1px_2px_rgba(23,23,23,0.04)] outline-none',
                  'transition-colors focus:border-[var(--primary-base)]/50 focus:ring-2 focus:ring-[var(--primary-alpha-10)]',
                )}
              />
            </div>
          </motion.div>
        )}

        {/* ─── Content ────────────────────────────────────────────── */}
        {loading ? (
          <MemorySkeleton />
        ) : filtered.length === 0 ? (
          <div className="overflow-hidden rounded-[12px] border border-[var(--stroke-soft-200)] bg-white shadow-[0_1px_2px_rgba(23,23,23,0.04)]">
            <EmptyState
              icon={<BookMarked className="h-5 w-5" />}
              title={search ? 'No matches' : 'No memories yet'}
              description={
                search
                  ? 'No memory entries match your search.'
                  : 'Agents will store context here as they work.'
              }
            />
          </div>
        ) : (
          <motion.div
            variants={staggerContainer(0.04, 0.2)}
            initial={reduce ? false : 'hidden'}
            animate="show"
            className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
          >
            {filtered.map((memory) => (
              <MemoryCard
                key={memory.id}
                memory={memory}
                isEditing={editingId === memory.id}
                isSaving={savingId === memory.id}
                isDeleting={deletingId === memory.id}
                isPinning={pinningId === memory.id}
                editTitle={editTitle}
                editMemory={editMemory}
                onEditTitleChange={setEditTitle}
                onEditMemoryChange={setEditMemory}
                onOpen={() => setDetailMemory(memory)}
                onEdit={() => startEdit(memory)}
                onCancel={cancelEdit}
                onSave={() => handleSave(memory)}
                onDelete={() => setPendingDelete(memory)}
                onPin={() => handlePin(memory)}
              />
            ))}
          </motion.div>
        )}

        {/* ─── Footer ─────────────────────────────────────────────── */}
        {memories.length > 0 && (
          <motion.p
            initial={reduce ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: DUR.slow, ease: EASE.out, delay: 0.5 }}
            className="mt-10 text-center text-[12px] text-[var(--neutral-soft-400)]"
          >
            Memory entries are agent-scoped and persisted across sessions.
          </motion.p>
        )}
      </div>

      {/* ─── Detail slide-over ──────────────────────────────────── */}
      <MemorySlideOver
        memory={detailMemory}
        isEditing={editingId === detailMemory?.id}
        isSaving={savingId === detailMemory?.id}
        isPinning={pinningId === detailMemory?.id}
        editTitle={editTitle}
        editMemory={editMemory}
        onEditTitleChange={setEditTitle}
        onEditMemoryChange={setEditMemory}
        onClose={() => {
          setDetailMemory(null);
          cancelEdit();
        }}
        onEdit={() => detailMemory && startEdit(detailMemory)}
        onCancel={cancelEdit}
        onSave={() => detailMemory && handleSave(detailMemory)}
        onDelete={() => {
          if (detailMemory) setPendingDelete(detailMemory);
        }}
        onPin={() => detailMemory && handlePin(detailMemory)}
      />

      {/* ─── Delete confirm ─────────────────────────────────────── */}
      <ConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
        }}
        variant="danger"
        title="Delete this memory?"
        description={
          pendingDelete ? (
            <>
              The entry{' '}
              <span className="font-semibold text-[var(--neutral-strong-950)]">
                &ldquo;{pendingDelete.title}&rdquo;
              </span>{' '}
              will be permanently removed. Agents will no longer have access to
              this context.
            </>
          ) : null
        }
        confirmLabel="Delete memory"
        loading={!!deletingId}
        onConfirm={handleDelete}
      />
    </>
  );
}

// ─── Memory card ──────────────────────────────────────────────────────
function MemoryCard({
  memory,
  isEditing,
  isSaving,
  isDeleting,
  isPinning,
  editTitle,
  editMemory,
  onEditTitleChange,
  onEditMemoryChange,
  onOpen,
  onEdit,
  onCancel,
  onSave,
  onDelete,
  onPin,
}: {
  memory: Memory;
  isEditing: boolean;
  isSaving: boolean;
  isDeleting: boolean;
  isPinning: boolean;
  editTitle: string;
  editMemory: string;
  onEditTitleChange: (v: string) => void;
  onEditMemoryChange: (v: string) => void;
  onOpen: () => void;
  onEdit: () => void;
  onCancel: () => void;
  onSave: () => void;
  onDelete: () => void;
  onPin: () => void;
}) {
  const isTruncated = memory.memory.length > 220;

  return (
    <motion.article
      variants={fadeUp}
      whileHover={
        !isEditing
          ? { y: -2, transition: { duration: 0.26, ease: [0.32, 0.72, 0.32, 1] } }
          : undefined
      }
      className={cn(
        'group relative flex flex-col overflow-hidden rounded-[14px] border bg-white',
        'shadow-[0_1px_2px_rgba(23,23,23,0.04)]',
        'transition-[box-shadow,border-color] duration-[220ms] ease-[cubic-bezier(0.2,0.8,0.2,1)]',
        isEditing
          ? 'border-[var(--primary-base)]/40 ring-1 ring-[var(--primary-alpha-10)]'
          : memory.is_pinned
            ? 'border-[var(--primary-base)]/30 shadow-[0_4px_12px_rgba(250,115,25,0.08)] hover:shadow-[0_10px_24px_rgba(23,23,23,0.07),0_2px_6px_rgba(250,115,25,0.08)]'
            : 'border-[var(--stroke-soft-200)] hover:border-[var(--primary-base)]/30 hover:shadow-[0_10px_24px_rgba(23,23,23,0.07),0_2px_6px_rgba(250,115,25,0.05)]',
        (isDeleting || isPinning) && 'pointer-events-none opacity-50',
      )}
    >
      {/* Inset gradient signature */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-1 rounded-[10px]"
        style={{
          background:
            'linear-gradient(180deg, rgba(250, 115, 25, 0.07) 0%, rgba(250, 115, 25, 0.03) 28%, rgba(255,255,255,0) 60%)',
        }}
      />

      {/* Card body — clicking opens the slide-over (unless editing) */}
      <div
        className={cn('relative flex flex-1 flex-col p-4', !isEditing && 'cursor-pointer')}
        onClick={!isEditing ? onOpen : undefined}
      >
        {/* Icon + action buttons row */}
        <div className="mb-3 flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] bg-[var(--primary-alpha-10)]">
              <BookMarked className="h-4 w-4 text-[var(--primary-base)]" strokeWidth={2} />
            </div>
            {memory.is_pinned && (
              <span className="inline-flex items-center gap-1 rounded-full bg-[var(--primary-alpha-10)] px-2 py-0.5 text-[10px] font-semibold text-[var(--primary-base)]">
                <Pin className="h-2.5 w-2.5" strokeWidth={2.5} />
                Pinned
              </span>
            )}
          </div>
          {!isEditing && (
            <div
              className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={onPin}
                aria-label={memory.is_pinned ? 'Unpin memory' : 'Pin memory'}
                className={cn(
                  'flex h-7 w-7 items-center justify-center rounded-[7px] transition-colors',
                  memory.is_pinned
                    ? 'text-[var(--primary-base)] hover:bg-[var(--primary-alpha-10)]'
                    : 'text-[var(--neutral-soft-400)] hover:bg-[var(--neutral-weak-50)] hover:text-[var(--neutral-strong-950)]',
                )}
              >
                {memory.is_pinned ? (
                  <PinOff className="h-3.5 w-3.5" strokeWidth={2} />
                ) : (
                  <Pin className="h-3.5 w-3.5" strokeWidth={2} />
                )}
              </button>
              <button
                onClick={onEdit}
                aria-label="Edit memory"
                className="flex h-7 w-7 items-center justify-center rounded-[7px] text-[var(--neutral-soft-400)] transition-colors hover:bg-[var(--neutral-weak-50)] hover:text-[var(--neutral-strong-950)]"
              >
                <Pencil className="h-3.5 w-3.5" strokeWidth={2} />
              </button>
              <button
                onClick={onDelete}
                aria-label="Delete memory"
                className="flex h-7 w-7 items-center justify-center rounded-[7px] text-[var(--neutral-soft-400)] transition-colors hover:bg-[var(--error-lighter)] hover:text-[var(--error)]"
              >
                <Trash2 className="h-3.5 w-3.5" strokeWidth={2} />
              </button>
            </div>
          )}
        </div>

        {/* Title */}
        {isEditing ? (
          <input
            autoFocus
            value={editTitle}
            onChange={(e) => onEditTitleChange(e.target.value)}
            placeholder="Title (max 4 words)"
            onClick={(e) => e.stopPropagation()}
            className={cn(
              'mb-2 w-full rounded-[6px] border border-[var(--stroke-soft-200)] bg-white px-2.5 py-1.5',
              'text-[14px] font-semibold text-[var(--neutral-strong-950)] outline-none',
              'focus:border-[var(--primary-base)]/50 focus:ring-2 focus:ring-[var(--primary-alpha-10)]',
            )}
          />
        ) : (
          <h2 className="mb-1.5 text-[14.5px] font-semibold leading-[1.25] tracking-[-0.015em] text-[var(--neutral-strong-950)]">
            {memory.title}
          </h2>
        )}

        {/* Memory text */}
        {isEditing ? (
          <textarea
            value={editMemory}
            onChange={(e) => onEditMemoryChange(e.target.value)}
            placeholder="Memory content…"
            rows={4}
            onClick={(e) => e.stopPropagation()}
            className={cn(
              'w-full flex-1 resize-none rounded-[6px] border border-[var(--stroke-soft-200)] bg-white px-2.5 py-1.5',
              'text-[12.5px] leading-[1.55] text-[var(--neutral-sub-600)] outline-none',
              'focus:border-[var(--primary-base)]/50 focus:ring-2 focus:ring-[var(--primary-alpha-10)]',
            )}
          />
        ) : (
          <div>
            <p className="text-[12.5px] leading-[1.6] text-[var(--neutral-sub-600)] line-clamp-4">
              {memory.memory}
            </p>
            {isTruncated && (
              <span className="mt-1 inline-flex items-center gap-1 text-[11.5px] font-medium text-[var(--primary-base)]">
                Read more <ArrowUpRight className="h-3 w-3" strokeWidth={2.25} />
              </span>
            )}
          </div>
        )}
      </div>

      {/* Card footer */}
      <div className="relative flex min-h-[42px] items-center justify-between gap-2 border-t border-[var(--stroke-soft-200)] bg-[var(--neutral-weak-50)]/70 px-4 py-2 backdrop-blur-[2px]">
        {isEditing ? (
          <div className="flex w-full items-center justify-end gap-2">
            <Button
              size="sm"
              variant="secondary"
              onClick={onCancel}
              disabled={isSaving}
              leadingIcon={<X className="h-3.5 w-3.5" strokeWidth={2} />}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              variant="primary"
              onClick={onSave}
              disabled={isSaving}
              leadingIcon={<Check className="h-3.5 w-3.5" strokeWidth={2.25} />}
            >
              {isSaving ? 'Saving…' : 'Save'}
            </Button>
          </div>
        ) : (
          <span className="inline-flex items-center gap-1.5 text-[11px] text-[var(--neutral-soft-400)]">
            <Clock className="h-3 w-3" strokeWidth={2} />
            {memory.updated_at ?? memory.created_at ? (
              <RelativeTime
                timestamp={(memory.updated_at ?? memory.created_at) as string}
              />
            ) : (
              <span>Memory</span>
            )}
          </span>
        )}
      </div>
    </motion.article>
  );
}

// ─── Detail slide-over panel ──────────────────────────────────────────
function MemorySlideOver({
  memory,
  isEditing,
  isSaving,
  isPinning,
  editTitle,
  editMemory,
  onEditTitleChange,
  onEditMemoryChange,
  onClose,
  onEdit,
  onCancel,
  onSave,
  onDelete,
  onPin,
}: {
  memory: Memory | null;
  isEditing: boolean;
  isSaving: boolean;
  isPinning: boolean;
  editTitle: string;
  editMemory: string;
  onEditTitleChange: (v: string) => void;
  onEditMemoryChange: (v: string) => void;
  onClose: () => void;
  onEdit: () => void;
  onCancel: () => void;
  onSave: () => void;
  onDelete: () => void;
  onPin: () => void;
}) {
  const reduce = useReducedMotion();
  const panelRef = useRef<HTMLDivElement>(null);
  const open = memory !== null;

  // Escape to close
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  // Focus panel on open
  useEffect(() => {
    if (open) {
      const id = window.setTimeout(() => panelRef.current?.focus(), 60);
      return () => window.clearTimeout(id);
    }
  }, [open]);

  return (
    <AnimatePresence>
      {open && memory && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 z-[60] bg-black/30 backdrop-blur-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18, ease: EASE_EMPH }}
            onClick={onClose}
          />

          {/* Slide-over panel */}
          <motion.div
            ref={panelRef}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-label={memory.title}
            className="fixed bottom-0 right-0 top-0 z-[61] flex w-full max-w-[480px] flex-col bg-white shadow-[−24px_0_64px_rgba(0,0,0,0.12)] outline-none"
            style={{ borderLeft: '1px solid var(--stroke-soft-200)' }}
            initial={reduce ? { opacity: 0 } : { x: '100%' }}
            animate={reduce ? { opacity: 1 } : { x: 0 }}
            exit={reduce ? { opacity: 0 } : { x: '100%' }}
            transition={{ duration: 0.28, ease: EASE_EMPH }}
          >
            {/* ── Header ── */}
            <div className="flex items-center justify-between border-b border-[var(--stroke-soft-200)] px-5 py-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-7 w-7 items-center justify-center rounded-[7px] bg-[var(--primary-alpha-10)]">
                  <BookMarked
                    className="h-3.5 w-3.5 text-[var(--primary-base)]"
                    strokeWidth={2}
                  />
                </div>
                <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--neutral-soft-400)]">
                  Memory
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                {!isEditing && (
                  <>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={onPin}
                      disabled={isPinning}
                      leadingIcon={
                        memory.is_pinned ? (
                          <PinOff className="h-3.5 w-3.5" strokeWidth={2} />
                        ) : (
                          <Pin className="h-3.5 w-3.5" strokeWidth={2} />
                        )
                      }
                      className={
                        memory.is_pinned
                          ? 'text-[var(--primary-base)] hover:bg-[var(--primary-alpha-10)] hover:text-[var(--primary-base)]'
                          : undefined
                      }
                    >
                      {memory.is_pinned ? 'Unpin' : 'Pin'}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={onEdit}
                      leadingIcon={<Pencil className="h-3.5 w-3.5" strokeWidth={2} />}
                    >
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={onDelete}
                      leadingIcon={<Trash2 className="h-3.5 w-3.5" strokeWidth={2} />}
                      className="text-[var(--error)] hover:bg-[var(--error-lighter)] hover:text-[var(--error)]"
                    >
                      Delete
                    </Button>
                  </>
                )}
                <button
                  onClick={onClose}
                  aria-label="Close panel"
                  className="flex h-7 w-7 items-center justify-center rounded-[7px] text-[var(--neutral-soft-400)] transition-colors hover:bg-[var(--neutral-weak-50)] hover:text-[var(--neutral-strong-950)]"
                >
                  <X className="h-4 w-4" strokeWidth={2} />
                </button>
              </div>
            </div>

            {/* ── Body ── */}
            <div className="flex flex-1 flex-col overflow-y-auto px-5 py-5">
              {/* Inset gradient */}
              <div
                aria-hidden
                className="pointer-events-none absolute inset-x-0 top-0 h-40"
                style={{
                  background:
                    'linear-gradient(180deg, rgba(250, 115, 25, 0.05) 0%, rgba(255,255,255,0) 100%)',
                }}
              />

              {/* Title */}
              {isEditing ? (
                <input
                  autoFocus
                  value={editTitle}
                  onChange={(e) => onEditTitleChange(e.target.value)}
                  placeholder="Title (max 4 words)"
                  className={cn(
                    'mb-4 w-full rounded-[8px] border border-[var(--stroke-soft-200)] bg-white px-3 py-2',
                    'text-[17px] font-semibold text-[var(--neutral-strong-950)] outline-none',
                    'focus:border-[var(--primary-base)]/50 focus:ring-2 focus:ring-[var(--primary-alpha-10)]',
                  )}
                />
              ) : (
                <h2 className="mb-4 text-[19px] font-semibold leading-[1.2] tracking-[-0.02em] text-[var(--neutral-strong-950)]">
                  {memory.title}
                </h2>
              )}

              {/* Memory text */}
              {isEditing ? (
                <textarea
                  value={editMemory}
                  onChange={(e) => onEditMemoryChange(e.target.value)}
                  placeholder="Memory content…"
                  className={cn(
                    'min-h-[260px] w-full flex-1 resize-none rounded-[8px] border border-[var(--stroke-soft-200)] bg-white px-3 py-2.5',
                    'text-[13.5px] leading-[1.65] text-[var(--neutral-sub-600)] outline-none',
                    'focus:border-[var(--primary-base)]/50 focus:ring-2 focus:ring-[var(--primary-alpha-10)]',
                  )}
                />
              ) : (
                <p className="whitespace-pre-wrap text-[13.5px] leading-[1.7] text-[var(--neutral-sub-600)]">
                  {memory.memory}
                </p>
              )}
            </div>

            {/* ── Footer ── */}
            <div className="border-t border-[var(--stroke-soft-200)] bg-[var(--neutral-weak-50)]/60 px-5 py-3">
              {isEditing ? (
                <div className="flex items-center justify-end gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={onCancel}
                    disabled={isSaving}
                    leadingIcon={<X className="h-3.5 w-3.5" strokeWidth={2} />}
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    variant="primary"
                    onClick={onSave}
                    disabled={isSaving}
                    leadingIcon={<Check className="h-3.5 w-3.5" strokeWidth={2.25} />}
                  >
                    {isSaving ? 'Saving…' : 'Save changes'}
                  </Button>
                </div>
              ) : (
                <span className="inline-flex items-center gap-1.5 text-[11px] text-[var(--neutral-soft-400)]">
                  <Clock className="h-3 w-3" strokeWidth={2} />
                  {memory.updated_at ?? memory.created_at ? (
                    <RelativeTime
                      timestamp={(memory.updated_at ?? memory.created_at) as string}
                    />
                  ) : (
                    <span>Saved</span>
                  )}
                </span>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// ─── Loading skeleton ─────────────────────────────────────────────────
function MemorySkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="flex flex-col overflow-hidden rounded-[14px] border border-[var(--stroke-soft-200)] bg-white shadow-[0_1px_2px_rgba(23,23,23,0.04)]"
        >
          <div className="flex flex-1 flex-col gap-3 p-4">
            <div className="h-8 w-8 animate-pulse rounded-[8px] bg-[var(--neutral-weak-50)]" />
            <div className="h-4 w-2/3 animate-pulse rounded-[6px] bg-[var(--neutral-weak-50)]" />
            <div className="space-y-2">
              <div className="h-3 w-full animate-pulse rounded-[6px] bg-[var(--neutral-weak-50)]" />
              <div className="h-3 w-5/6 animate-pulse rounded-[6px] bg-[var(--neutral-weak-50)]" />
              <div className="h-3 w-3/4 animate-pulse rounded-[6px] bg-[var(--neutral-weak-50)]" />
            </div>
          </div>
          <div className="flex h-[42px] items-center border-t border-[var(--stroke-soft-200)] bg-[var(--neutral-weak-50)]/70 px-4">
            <div className="h-3 w-24 animate-pulse rounded-[6px] bg-[var(--neutral-weak-50)]" />
          </div>
        </div>
      ))}
    </div>
  );
}
