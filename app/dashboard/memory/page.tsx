'use client';

/**
 * Memory — agent belief-state oversight.
 *
 * Reframed from a note-card grid into an oversight surface: a memory is a
 * durable claim the agent will act on in every future session, so the page's
 * job is trust and triage, not note-keeping. Default view is a dense,
 * sortable table (matching Runs / Audit) with client-derived signals
 * (possible secret / stale / duplicate) so risky context surfaces at a
 * glance. Jenil's card grid is preserved as an optional Gallery view for
 * reading. All signals are derived from the existing row — no fabricated
 * provenance, no backend change. Provenance ("which agent wrote this") and a
 * trust lifecycle are the v2 additions that need the audit-log join.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import Link from 'next/link';
import {
  BookMarked,
  Pencil,
  Trash2,
  Check,
  X,
  Clock,
  Search,
  ArrowUpRight,
  LayoutGrid,
  Rows3,
  KeyRound,
  Hourglass,
} from 'lucide-react';
import { api } from '@/lib/api';
import { Memory } from '@/lib/types';
import { useAutoRefresh, useUser } from '@/lib/hooks';
import {
  computeSignalMap,
  computeRollups,
  daysSince,
  lastTouched,
  type MemorySignal,
  type MemorySignalKey,
} from '@/lib/memorySignals';
import Topbar from '@/components/layout/Topbar';
import EmptyState from '@/components/ui/EmptyState';
import ErrorBanner from '@/components/ui/ErrorBanner';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { FilterChip } from '@/components/ui/FilterChip';
import { Table, THead, TH, TBody, TR, TD, type SortDirection } from '@/components/ui/Table';
import { RelativeTime } from '@/components/ui/RelativeTime';
import { useToast } from '@/components/ui/Toast';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { cn } from '@/lib/utils';
import { DUR, EASE, fadeUp, staggerContainer } from '@/lib/motion';

const EASE_EMPH: [number, number, number, number] = [0.2, 0.8, 0.2, 1];

type ViewMode = 'table' | 'gallery';
type SortKey = 'title' | 'updated' | 'created';

const SIGNAL_FILTER_OPTIONS = [
  { value: 'secret', label: 'Possible secret' },
  { value: 'stale', label: 'Stale' },
  { value: 'duplicate', label: 'Duplicate title' },
];

export default function MemoryPage() {
  const { user, isLoading: userLoading } = useUser();
  const reduce = useReducedMotion();
  const toast = useToast();

  const [memories, setMemories] = useState<Memory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [view, setView] = useState<ViewMode>('table');
  const [signalFilter, setSignalFilter] = useState<string[]>([]);
  const [sortKey, setSortKey] = useState<SortKey>('updated');
  const [sortDir, setSortDir] = useState<Exclude<SortDirection, null>>('desc');

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
      setMemories(raw);
      setError(null);
      setDetailMemory((prev) => {
        if (!prev) return null;
        return raw.find((m) => m.id === prev.id) ?? null;
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

  // ── Derived: signals + rollups ──────────────────────────────────────
  const signalMap = useMemo(() => computeSignalMap(memories), [memories]);
  const rollups = useMemo(() => computeRollups(memories, signalMap), [memories, signalMap]);

  // ── Derived: filtered + sorted list ─────────────────────────────────
  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    const rows = memories.filter((m) => {
      if (q && !(m.title.toLowerCase().includes(q) || m.memory.toLowerCase().includes(q))) {
        return false;
      }
      if (signalFilter.length) {
        const keys = new Set((signalMap[m.id] ?? []).map((s) => s.key));
        if (!signalFilter.some((f) => keys.has(f as MemorySignalKey))) return false;
      }
      return true;
    });

    const dir = sortDir === 'asc' ? 1 : -1;
    const ts = (m: Memory, which: 'updated' | 'created') =>
      new Date((which === 'updated' ? lastTouched(m) : m.created_at) ?? 0).getTime();

    return [...rows].sort((a, b) => {
      if (sortKey === 'title') return dir * a.title.localeCompare(b.title);
      if (sortKey === 'created') return dir * (ts(a, 'created') - ts(b, 'created'));
      return dir * (ts(a, 'updated') - ts(b, 'updated'));
    });
  }, [memories, search, signalFilter, signalMap, sortKey, sortDir]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'));
    } else {
      setSortKey(key);
      setSortDir(key === 'title' ? 'asc' : 'desc');
    }
  };
  const dirFor = (key: SortKey): SortDirection => (sortKey === key ? sortDir : null);

  // ── Edit / delete ───────────────────────────────────────────────────
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

  const hasFilters = search.trim().length > 0 || signalFilter.length > 0;

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
            <ErrorBanner message={error} onDismiss={() => setError(null)} onRetry={fetchData} />
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
            className="max-w-[640px] text-[28px] font-semibold leading-[1.1] tracking-[-0.03em] text-[var(--neutral-strong-950)] sm:text-[34px]"
          >
            Everything your agents believe.
          </motion.h1>
          <motion.p
            variants={fadeUp}
            className="mt-3 max-w-[540px] text-[14px] leading-[1.6] text-[var(--neutral-sub-600)]"
          >
            Durable context your agents carry between sessions and act on. Review
            what they know, flag anything sensitive, and prune what is stale.
          </motion.p>
        </motion.header>

        {/* ─── Oversight strip ────────────────────────────────────── */}
        {memories.length > 0 && (
          <motion.div
            initial={reduce ? false : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: DUR.default, ease: EASE.out, delay: 0.12 }}
            className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4"
          >
            <StatTile icon={<BookMarked className="h-4 w-4" strokeWidth={2} />} label="Total" value={rollups.total} />
            <StatTile
              icon={<Clock className="h-4 w-4" strokeWidth={2} />}
              label="Updated this week"
              value={rollups.updatedThisWeek}
            />
            <StatTile
              icon={<KeyRound className="h-4 w-4" strokeWidth={2} />}
              label="Possible secrets"
              value={rollups.secrets}
              tone={rollups.secrets > 0 ? 'error' : 'neutral'}
              active={signalFilter.includes('secret')}
              onClick={() =>
                setSignalFilter((prev) =>
                  prev.includes('secret') ? prev.filter((v) => v !== 'secret') : [...prev, 'secret'],
                )
              }
            />
            <StatTile
              icon={<Hourglass className="h-4 w-4" strokeWidth={2} />}
              label="Stale"
              value={rollups.stale}
              tone={rollups.stale > 0 ? 'warning' : 'neutral'}
              active={signalFilter.includes('stale')}
              onClick={() =>
                setSignalFilter((prev) =>
                  prev.includes('stale') ? prev.filter((v) => v !== 'stale') : [...prev, 'stale'],
                )
              }
            />
          </motion.div>
        )}

        {/* ─── Toolbar ────────────────────────────────────────────── */}
        {memories.length > 0 && (
          <motion.div
            initial={reduce ? false : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: DUR.default, ease: EASE.out, delay: 0.18 }}
            className="mb-5 flex flex-wrap items-center gap-2.5"
          >
            <div className="relative w-full max-w-[320px] sm:w-auto sm:flex-1">
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
                  'h-7 w-full rounded-[8px] border border-[var(--stroke-sub-300)] bg-white pl-8 pr-3 text-[12px]',
                  'text-[var(--neutral-strong-950)] placeholder:text-[var(--neutral-soft-400)]',
                  'shadow-[var(--shadow-regular-xs)] outline-none',
                  'transition-colors focus:border-[var(--primary-base)]/50 focus:ring-2 focus:ring-[var(--primary-alpha-10)]',
                )}
              />
            </div>

            <FilterChip
              label="Signal"
              options={SIGNAL_FILTER_OPTIONS}
              value={signalFilter}
              onChange={setSignalFilter}
            />

            <div className="ml-auto">
              <ViewToggle view={view} onChange={setView} />
            </div>
          </motion.div>
        )}

        {/* ─── Content ────────────────────────────────────────────── */}
        {loading ? (
          <MemorySkeleton view={view} />
        ) : visible.length === 0 ? (
          <div className="overflow-hidden rounded-[12px] border border-[var(--stroke-soft-200)] bg-white shadow-[0_1px_2px_rgba(23,23,23,0.04)]">
            <EmptyState
              icon={<BookMarked className="h-5 w-5" />}
              title={hasFilters ? 'No matches' : 'No memories yet'}
              description={
                hasFilters
                  ? 'No memory entries match the current search or filters.'
                  : 'Agents will store context here as they work.'
              }
            />
          </div>
        ) : view === 'table' ? (
          <motion.div
            initial={reduce ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: DUR.default, ease: EASE.out }}
          >
            <Table>
              <THead>
                <tr>
                  <TH sortable sortDirection={dirFor('title')} onSort={() => toggleSort('title')}>
                    Memory
                  </TH>
                  <TH>Signals</TH>
                  <TH sortable sortDirection={dirFor('updated')} onSort={() => toggleSort('updated')}>
                    Updated
                  </TH>
                  <TH sortable sortDirection={dirFor('created')} onSort={() => toggleSort('created')}>
                    Created
                  </TH>
                </tr>
              </THead>
              <TBody>
                {visible.map((memory) => (
                  <MemoryRow
                    key={memory.id}
                    memory={memory}
                    signals={signalMap[memory.id] ?? []}
                    isDeleting={deletingId === memory.id}
                    onOpen={() => setDetailMemory(memory)}
                  />
                ))}
              </TBody>
            </Table>
          </motion.div>
        ) : (
          <motion.div
            variants={staggerContainer(0.04, 0.15)}
            initial={reduce ? false : 'hidden'}
            animate="show"
            className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
          >
            {visible.map((memory) => (
              <MemoryCard
                key={memory.id}
                memory={memory}
                signals={signalMap[memory.id] ?? []}
                isEditing={editingId === memory.id}
                isSaving={savingId === memory.id}
                isDeleting={deletingId === memory.id}
                editTitle={editTitle}
                editMemory={editMemory}
                onEditTitleChange={setEditTitle}
                onEditMemoryChange={setEditMemory}
                onOpen={() => setDetailMemory(memory)}
                onEdit={() => startEdit(memory)}
                onCancel={cancelEdit}
                onSave={() => handleSave(memory)}
                onDelete={() => setPendingDelete(memory)}
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
            Signals are derived from each entry. Which agent wrote a memory is on
            the roadmap, tracked in the Audit trail today.
          </motion.p>
        )}
      </div>

      {/* ─── Detail slide-over ──────────────────────────────────── */}
      <MemorySlideOver
        memory={detailMemory}
        signals={detailMemory ? signalMap[detailMemory.id] ?? [] : []}
        isEditing={editingId === detailMemory?.id}
        isSaving={savingId === detailMemory?.id}
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
              will be permanently removed. Agents will no longer have access to this context.
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

// ─── Oversight stat tile ──────────────────────────────────────────────
function StatTile({
  icon,
  label,
  value,
  tone = 'neutral',
  active = false,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  tone?: 'neutral' | 'error' | 'warning';
  active?: boolean;
  onClick?: () => void;
}) {
  const toneStyles =
    tone === 'error'
      ? { icon: 'bg-[var(--error-lighter)] text-[var(--error)]', value: 'text-[var(--error-dark)]' }
      : tone === 'warning'
        ? { icon: 'bg-[var(--warning-lighter)] text-[var(--warning-dark)]', value: 'text-[var(--warning-dark)]' }
        : { icon: 'bg-[var(--primary-alpha-10)] text-[var(--primary-base)]', value: 'text-[var(--neutral-strong-950)]' };

  const interactive = !!onClick;
  const Comp: React.ElementType = interactive ? 'button' : 'div';

  return (
    <Comp
      onClick={onClick}
      className={cn(
        'flex items-center gap-3 rounded-[12px] border bg-white px-4 py-3 text-left shadow-[0_1px_2px_rgba(23,23,23,0.04)]',
        'transition-[border-color,box-shadow] duration-200 ease-[cubic-bezier(0.2,0.8,0.2,1)]',
        active
          ? 'border-[var(--primary-base)]/40 ring-1 ring-[var(--primary-alpha-10)]'
          : 'border-[var(--stroke-soft-200)]',
        interactive && !active && 'hover:border-[var(--stroke-sub-300)] hover:shadow-[0_4px_12px_rgba(23,23,23,0.06)]',
      )}
    >
      <span className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px]', toneStyles.icon)}>
        {icon}
      </span>
      <span className="min-w-0">
        <span className={cn('block text-[20px] font-semibold leading-none tracking-[-0.02em] tabular-nums', toneStyles.value)}>
          {value.toLocaleString()}
        </span>
        <span className="mt-1 block truncate text-[11.5px] font-medium text-[var(--neutral-sub-600)]">
          {label}
        </span>
      </span>
    </Comp>
  );
}

// ─── View toggle (Table / Gallery) ────────────────────────────────────
function ViewToggle({ view, onChange }: { view: ViewMode; onChange: (v: ViewMode) => void }) {
  return (
    <div className="inline-flex h-7 items-center gap-0.5 rounded-[8px] border border-[var(--stroke-sub-300)] bg-white p-0.5 shadow-[var(--shadow-regular-xs)]">
      {([
        { key: 'table', icon: <Rows3 className="h-3.5 w-3.5" strokeWidth={2} />, label: 'Table' },
        { key: 'gallery', icon: <LayoutGrid className="h-3.5 w-3.5" strokeWidth={2} />, label: 'Gallery' },
      ] as const).map((opt) => (
        <button
          key={opt.key}
          type="button"
          onClick={() => onChange(opt.key)}
          aria-pressed={view === opt.key}
          title={`${opt.label} view`}
          className={cn(
            'inline-flex h-6 items-center gap-1.5 rounded-[6px] px-2 text-[12px] font-medium transition-colors',
            view === opt.key
              ? 'bg-[var(--primary-alpha-10)] text-[var(--primary-base)]'
              : 'text-[var(--neutral-sub-600)] hover:text-[var(--neutral-strong-950)]',
          )}
        >
          {opt.icon}
          <span className="hidden sm:inline">{opt.label}</span>
        </button>
      ))}
    </div>
  );
}

// ─── Signal chips ─────────────────────────────────────────────────────
function SignalChips({ signals, className }: { signals: MemorySignal[]; className?: string }) {
  if (!signals.length) return null;
  return (
    <span className={cn('inline-flex flex-wrap items-center gap-1.5', className)}>
      {signals.map((s) => (
        <Badge key={s.key} tone={s.tone} uppercase leadingDot title={s.hint}>
          {s.label}
        </Badge>
      ))}
    </span>
  );
}

// ─── Table row ────────────────────────────────────────────────────────
function MemoryRow({
  memory,
  signals,
  isDeleting,
  onOpen,
}: {
  memory: Memory;
  signals: MemorySignal[];
  isDeleting: boolean;
  onOpen: () => void;
}) {
  const stamp = lastTouched(memory);
  return (
    <TR clickable onClick={onOpen} className={cn(isDeleting && 'pointer-events-none opacity-50')}>
      <TD className="max-w-0">
        <div className="flex items-center gap-3">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[7px] bg-[var(--primary-alpha-10)]">
            <BookMarked className="h-3.5 w-3.5 text-[var(--primary-base)]" strokeWidth={2} />
          </span>
          <span className="min-w-0">
            <span className="block truncate text-[13px] font-semibold text-[var(--neutral-strong-950)]">
              {memory.title}
            </span>
            <span className="mt-0.5 block truncate text-[12px] text-[var(--neutral-sub-600)]">
              {memory.memory}
            </span>
          </span>
        </div>
      </TD>
      <TD>
        {signals.length ? (
          <SignalChips signals={signals} />
        ) : (
          <span className="text-[12px] text-[var(--neutral-soft-400)]">Clean</span>
        )}
      </TD>
      <TD className="whitespace-nowrap text-[12px] text-[var(--neutral-sub-600)]">
        {stamp ? <RelativeTime timestamp={stamp} /> : null}
      </TD>
      <TD className="whitespace-nowrap text-[12px] text-[var(--neutral-sub-600)]">
        {memory.created_at ? <RelativeTime timestamp={memory.created_at} /> : null}
      </TD>
    </TR>
  );
}

// ─── Memory card (Gallery view) ───────────────────────────────────────
function MemoryCard({
  memory,
  signals,
  isEditing,
  isSaving,
  isDeleting,
  editTitle,
  editMemory,
  onEditTitleChange,
  onEditMemoryChange,
  onOpen,
  onEdit,
  onCancel,
  onSave,
  onDelete,
}: {
  memory: Memory;
  signals: MemorySignal[];
  isEditing: boolean;
  isSaving: boolean;
  isDeleting: boolean;
  editTitle: string;
  editMemory: string;
  onEditTitleChange: (v: string) => void;
  onEditMemoryChange: (v: string) => void;
  onOpen: () => void;
  onEdit: () => void;
  onCancel: () => void;
  onSave: () => void;
  onDelete: () => void;
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
          : 'border-[var(--stroke-soft-200)] hover:border-[var(--primary-base)]/30 hover:shadow-[0_10px_24px_rgba(23,23,23,0.07),0_2px_6px_rgba(250,115,25,0.05)]',
        isDeleting && 'pointer-events-none opacity-50',
      )}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-1 rounded-[10px]"
        style={{
          background:
            'linear-gradient(180deg, rgba(250, 115, 25, 0.07) 0%, rgba(250, 115, 25, 0.03) 28%, rgba(255,255,255,0) 60%)',
        }}
      />

      <div
        className={cn('relative flex flex-1 flex-col p-4', !isEditing && 'cursor-pointer')}
        onClick={!isEditing ? onOpen : undefined}
      >
        <div className="mb-3 flex items-start justify-between gap-2">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] bg-[var(--primary-alpha-10)]">
            <BookMarked className="h-4 w-4 text-[var(--primary-base)]" strokeWidth={2} />
          </div>
          {!isEditing && (
            <div
              className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100"
              onClick={(e) => e.stopPropagation()}
            >
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

        {isEditing ? (
          <input
            autoFocus
            value={editTitle}
            onChange={(e) => onEditTitleChange(e.target.value)}
            placeholder="Title"
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
            {signals.length > 0 && <SignalChips signals={signals} className="mb-2" />}
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

      <div className="relative flex min-h-[42px] items-center justify-between gap-2 border-t border-[var(--stroke-soft-200)] bg-[var(--neutral-weak-50)]/70 px-4 py-2 backdrop-blur-[2px]">
        {isEditing ? (
          <div className="flex w-full items-center justify-end gap-2">
            <Button size="sm" variant="secondary" onClick={onCancel} disabled={isSaving} leadingIcon={<X className="h-3.5 w-3.5" strokeWidth={2} />}>
              Cancel
            </Button>
            <Button size="sm" variant="primary" onClick={onSave} disabled={isSaving} leadingIcon={<Check className="h-3.5 w-3.5" strokeWidth={2.25} />}>
              {isSaving ? 'Saving…' : 'Save'}
            </Button>
          </div>
        ) : (
          <span className="inline-flex items-center gap-1.5 text-[11px] text-[var(--neutral-soft-400)]">
            <Clock className="h-3 w-3" strokeWidth={2} />
            {lastTouched(memory) ? <RelativeTime timestamp={lastTouched(memory) as string} /> : <span>Memory</span>}
          </span>
        )}
      </div>
    </motion.article>
  );
}

// ─── Detail slide-over ────────────────────────────────────────────────
function MemorySlideOver({
  memory,
  signals,
  isEditing,
  isSaving,
  editTitle,
  editMemory,
  onEditTitleChange,
  onEditMemoryChange,
  onClose,
  onEdit,
  onCancel,
  onSave,
  onDelete,
}: {
  memory: Memory | null;
  signals: MemorySignal[];
  isEditing: boolean;
  isSaving: boolean;
  editTitle: string;
  editMemory: string;
  onEditTitleChange: (v: string) => void;
  onEditMemoryChange: (v: string) => void;
  onClose: () => void;
  onEdit: () => void;
  onCancel: () => void;
  onSave: () => void;
  onDelete: () => void;
}) {
  const reduce = useReducedMotion();
  const panelRef = useRef<HTMLDivElement>(null);
  const open = memory !== null;

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  useEffect(() => {
    if (open) {
      const id = window.setTimeout(() => panelRef.current?.focus(), 60);
      return () => window.clearTimeout(id);
    }
  }, [open]);

  const updatedDays = memory ? daysSince(lastTouched(memory)) : null;

  return (
    <AnimatePresence>
      {open && memory && (
        <>
          <motion.div
            className="fixed inset-0 z-[60] bg-black/30 backdrop-blur-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18, ease: EASE_EMPH }}
            onClick={onClose}
          />

          <motion.div
            ref={panelRef}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-label={memory.title}
            className="fixed bottom-0 right-0 top-0 z-[61] flex w-full max-w-[480px] flex-col bg-white shadow-[-24px_0_64px_rgba(0,0,0,0.12)] outline-none"
            style={{ borderLeft: '1px solid var(--stroke-soft-200)' }}
            initial={reduce ? { opacity: 0 } : { x: '100%' }}
            animate={reduce ? { opacity: 1 } : { x: 0 }}
            exit={reduce ? { opacity: 0 } : { x: '100%' }}
            transition={{ duration: 0.28, ease: EASE_EMPH }}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-[var(--stroke-soft-200)] px-5 py-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-7 w-7 items-center justify-center rounded-[7px] bg-[var(--primary-alpha-10)]">
                  <BookMarked className="h-3.5 w-3.5 text-[var(--primary-base)]" strokeWidth={2} />
                </div>
                <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--neutral-soft-400)]">
                  Memory
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                {!isEditing && (
                  <>
                    <Button size="sm" variant="ghost" onClick={onEdit} leadingIcon={<Pencil className="h-3.5 w-3.5" strokeWidth={2} />}>
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

            {/* Body */}
            <div className="relative flex flex-1 flex-col overflow-y-auto px-5 py-5">
              <div
                aria-hidden
                className="pointer-events-none absolute inset-x-0 top-0 h-40"
                style={{
                  background:
                    'linear-gradient(180deg, rgba(250, 115, 25, 0.05) 0%, rgba(255,255,255,0) 100%)',
                }}
              />

              {isEditing ? (
                <input
                  autoFocus
                  value={editTitle}
                  onChange={(e) => onEditTitleChange(e.target.value)}
                  placeholder="Title"
                  className={cn(
                    'mb-4 w-full rounded-[8px] border border-[var(--stroke-soft-200)] bg-white px-3 py-2',
                    'text-[17px] font-semibold text-[var(--neutral-strong-950)] outline-none',
                    'focus:border-[var(--primary-base)]/50 focus:ring-2 focus:ring-[var(--primary-alpha-10)]',
                  )}
                />
              ) : (
                <>
                  <h2 className="text-[19px] font-semibold leading-[1.2] tracking-[-0.02em] text-[var(--neutral-strong-950)]">
                    {memory.title}
                  </h2>
                  {signals.length > 0 && (
                    <div className="mt-3 flex flex-col gap-2 rounded-[10px] border border-[var(--stroke-soft-200)] bg-[var(--neutral-weak-50)]/60 p-3">
                      {signals.map((s) => (
                        <div key={s.key} className="flex items-start gap-2.5">
                          <Badge tone={s.tone} uppercase leadingDot className="mt-[1px] shrink-0">
                            {s.label}
                          </Badge>
                          <span className="text-[12px] leading-[1.5] text-[var(--neutral-sub-600)]">{s.hint}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}

              {isEditing ? (
                <textarea
                  value={editMemory}
                  onChange={(e) => onEditMemoryChange(e.target.value)}
                  placeholder="Memory content…"
                  className={cn(
                    'mt-4 min-h-[260px] w-full flex-1 resize-none rounded-[8px] border border-[var(--stroke-soft-200)] bg-white px-3 py-2.5',
                    'text-[13.5px] leading-[1.65] text-[var(--neutral-sub-600)] outline-none',
                    'focus:border-[var(--primary-base)]/50 focus:ring-2 focus:ring-[var(--primary-alpha-10)]',
                  )}
                />
              ) : (
                <p className="mt-4 whitespace-pre-wrap text-[13.5px] leading-[1.7] text-[var(--neutral-sub-600)]">
                  {memory.memory}
                </p>
              )}

              {!isEditing && (
                <div className="mt-6 border-t border-[var(--stroke-soft-200)] pt-4">
                  <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
                    <MetaField label="Created" value={memory.created_at ? <RelativeTime timestamp={memory.created_at} /> : null} />
                    <MetaField
                      label="Last updated"
                      value={lastTouched(memory) ? <RelativeTime timestamp={lastTouched(memory) as string} /> : null}
                    />
                    <MetaField label="Length" value={`${memory.memory.length.toLocaleString()} chars`} />
                    <MetaField label="Age" value={updatedDays !== null ? `${updatedDays.toLocaleString()}d` : null} />
                  </dl>
                  <Link
                    href="/dashboard/audit"
                    className="mt-4 inline-flex items-center gap-1.5 text-[12px] font-medium text-[var(--neutral-sub-600)] transition-colors hover:text-[var(--primary-base)]"
                  >
                    Written by an agent and governed. See it in the Audit trail
                    <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={2} />
                  </Link>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="border-t border-[var(--stroke-soft-200)] bg-[var(--neutral-weak-50)]/60 px-5 py-3">
              {isEditing ? (
                <div className="flex items-center justify-end gap-2">
                  <Button size="sm" variant="secondary" onClick={onCancel} disabled={isSaving} leadingIcon={<X className="h-3.5 w-3.5" strokeWidth={2} />}>
                    Cancel
                  </Button>
                  <Button size="sm" variant="primary" onClick={onSave} disabled={isSaving} leadingIcon={<Check className="h-3.5 w-3.5" strokeWidth={2.25} />}>
                    {isSaving ? 'Saving…' : 'Save changes'}
                  </Button>
                </div>
              ) : (
                <span className="inline-flex items-center gap-1.5 text-[11px] text-[var(--neutral-soft-400)]">
                  <Clock className="h-3 w-3" strokeWidth={2} />
                  {lastTouched(memory) ? <RelativeTime timestamp={lastTouched(memory) as string} /> : <span>Saved</span>}
                </span>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

function MetaField({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[var(--neutral-soft-400)]">
        {label}
      </dt>
      <dd className="mt-1 text-[13px] font-medium text-[var(--neutral-strong-950)]">{value}</dd>
    </div>
  );
}

// ─── Loading skeleton ─────────────────────────────────────────────────
function MemorySkeleton({ view }: { view: ViewMode }) {
  if (view === 'table') {
    return (
      <div className="overflow-hidden rounded-[12px] border border-[var(--stroke-soft-200)] bg-white shadow-[0_1px_2px_rgba(23,23,23,0.04)]">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 border-b border-[var(--stroke-soft-200)] px-5 py-3.5 last:border-b-0">
            <div className="h-7 w-7 shrink-0 animate-pulse rounded-[7px] bg-[var(--neutral-weak-50)]" />
            <div className="flex-1 space-y-1.5">
              <div className="h-3.5 w-1/3 animate-pulse rounded-[6px] bg-[var(--neutral-weak-50)]" />
              <div className="h-3 w-2/3 animate-pulse rounded-[6px] bg-[var(--neutral-weak-50)]" />
            </div>
            <div className="h-4 w-20 animate-pulse rounded-[6px] bg-[var(--neutral-weak-50)]" />
          </div>
        ))}
      </div>
    );
  }
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex flex-col overflow-hidden rounded-[14px] border border-[var(--stroke-soft-200)] bg-white shadow-[0_1px_2px_rgba(23,23,23,0.04)]">
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
