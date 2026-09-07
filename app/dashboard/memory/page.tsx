'use client';

/**
 * Memory — `/dashboard/memory`.
 *
 * List: PINNED / EVERYTHING ELSE. Body is Markdown (GFM). Share counts
 * come from GET /shares, not an invented field on the memory row.
 */

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import {
  FileText,
  MoreHorizontal,
  Pencil,
  Pin,
  PinOff,
  Share2,
  Trash2,
  Zap,
} from 'lucide-react';
import Topbar from '@/components/layout/Topbar';
import { ShareMemoryDialog } from '@/components/memory/ShareMemoryDialog';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import EmptyState from '@/components/ui/EmptyState';
import ErrorBanner from '@/components/ui/ErrorBanner';
import { Input } from '@/components/ui/Input';
import { MarkdownContent } from '@/components/ui/MarkdownContent';
import { Skeleton } from '@/components/ui/Skeleton';
import { useToast } from '@/components/ui/Toast';
import { Dialog } from '@/components/workspaces/Dialog';
import { api } from '@/lib/api';
import { useUser } from '@/lib/hooks';
import type { Memory, MemoryShare } from '@/lib/types';
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

function wordCount(value: string): number {
  return value.trim().split(/\s+/).filter(Boolean).length;
}

function isActiveShare(share: MemoryShare): boolean {
  return !share.status || share.status === 'pending';
}

function shareCountLabel(count: number | undefined): string | null {
  if (count == null) return null;
  if (count === 0) return 'no shares';
  if (count === 1) return '1 share';
  return `${count} shares`;
}

/** List rows show one line of plain text — never rendered Markdown. */
function plainTextFromMarkdown(source: string): string {
  return source
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/!\[[^\]]*]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^\s*[-*+]\s+/gm, '')
    .replace(/^\s*\d+\.\s+/gm, '')
    .replace(/[*_~]+/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function sortMemories(list: Memory[]): Memory[] {
  return [...list].sort((a, b) => {
    if (Boolean(a.is_pinned) !== Boolean(b.is_pinned)) return a.is_pinned ? -1 : 1;
    const ta = new Date(a.updated_at ?? a.created_at ?? 0).getTime();
    const tb = new Date(b.updated_at ?? b.created_at ?? 0).getTime();
    return tb - ta;
  });
}

export default function MemoryPage() {
  const { user, isLoading: userLoading } = useUser();
  const toast = useToast();
  const router = useRouter();
  const demo = useMemo(() => isDemoMode(), []);
  const effectiveUserId = user?.id ?? (demo ? 'preview-user' : null);

  const [memories, setMemories] = useState<Memory[]>([]);
  const [shareCounts, setShareCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [shareMemory, setShareMemory] = useState<Memory | null>(null);
  const [openMemory, setOpenMemory] = useState<Memory | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Memory | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [pinningId, setPinningId] = useState<string | null>(null);
  const [menuId, setMenuId] = useState<string | null>(null);

  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<Memory | null>(null);
  const [draftTitle, setDraftTitle] = useState('');
  const [draftBody, setDraftBody] = useState('');
  const [saving, setSaving] = useState(false);

  const [redeemOpen, setRedeemOpen] = useState(false);
  const [redeemCode, setRedeemCode] = useState('');

  const loadShareCounts = useCallback(async (rows: Memory[]) => {
    const entries = await Promise.all(
      rows.map(async (row) => {
        try {
          const shares = await api.getMemoryShares(row.id);
          return [row.id, shares.filter(isActiveShare).length] as const;
        } catch {
          return [row.id, undefined] as const;
        }
      }),
    );
    const next: Record<string, number> = {};
    for (const [id, count] of entries) {
      if (typeof count === 'number') next[id] = count;
    }
    setShareCounts((prev) => ({ ...prev, ...next }));
  }, []);

  const fetchData = useCallback(async () => {
    if (!effectiveUserId) {
      if (!userLoading) {
        setMemories([]);
        setLoading(false);
      }
      return;
    }
    try {
      const raw = await api.getMemories(effectiveUserId);
      const data = sortMemories(raw);
      setMemories(data);
      setError(null);
      void loadShareCounts(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load memories');
    } finally {
      setLoading(false);
    }
  }, [effectiveUserId, userLoading, loadShareCounts]);

  useEffect(() => {
    if (effectiveUserId) void fetchData();
    else if (!userLoading) {
      setMemories([]);
      setLoading(false);
    }
  }, [effectiveUserId, userLoading, fetchData]);

  const pinned = memories.filter((m) => m.is_pinned);
  const rest = memories.filter((m) => !m.is_pinned);

  const openCreate = () => {
    setEditing(null);
    setDraftTitle('');
    setDraftBody('');
    setEditorOpen(true);
    setMenuId(null);
  };

  const openEdit = (memory: Memory) => {
    setEditing(memory);
    setDraftTitle(memory.title);
    setDraftBody(memory.memory);
    setEditorOpen(true);
    setMenuId(null);
  };

  const titleWords = wordCount(draftTitle);
  const titleTooLong = titleWords > 4;
  const canSave = draftTitle.trim().length > 0 && draftBody.trim().length > 0 && !titleTooLong;

  const handleSave = async () => {
    if (!canSave || !effectiveUserId || saving) return;
    setSaving(true);
    try {
      const payload = { title: draftTitle.trim(), memory: draftBody.trim() };
      if (editing) {
        const updated = await api.updateMemory(editing.id, effectiveUserId, payload);
        setMemories((prev) => sortMemories(prev.map((m) => (m.id === updated.id ? updated : m))));
        setOpenMemory((prev) => (prev?.id === updated.id ? updated : prev));
        toast.success('Memory updated');
      } else {
        const created = await api.createMemory(payload);
        setMemories((prev) => sortMemories([created, ...prev]));
        setShareCounts((prev) => ({ ...prev, [created.id]: 0 }));
        toast.success('Memory added');
      }
      setEditorOpen(false);
    } catch (err) {
      toast.error(editing ? 'Failed to update memory' : 'Failed to add memory', {
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!pendingDelete || !effectiveUserId) return;
    const mem = pendingDelete;
    setPendingDelete(null);
    setDeletingId(mem.id);
    try {
      await api.deleteMemory(mem.id, effectiveUserId);
      setMemories((prev) => prev.filter((m) => m.id !== mem.id));
      if (openMemory?.id === mem.id) setOpenMemory(null);
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
    if (!effectiveUserId) return;
    const nextPinned = !memory.is_pinned;
    setPinningId(memory.id);
    setMenuId(null);
    setMemories((prev) =>
      sortMemories(prev.map((m) => (m.id === memory.id ? { ...m, is_pinned: nextPinned } : m))),
    );
    try {
      const updated = await api.updateMemory(memory.id, effectiveUserId, { is_pinned: nextPinned });
      setMemories((prev) => sortMemories(prev.map((m) => (m.id === updated.id ? updated : m))));
      setOpenMemory((prev) => (prev?.id === updated.id ? updated : prev));
    } catch (err) {
      setMemories((prev) =>
        sortMemories(prev.map((m) => (m.id === memory.id ? { ...m, is_pinned: !nextPinned } : m))),
      );
      toast.error('Failed to update pin', {
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setPinningId(null);
    }
  };

  const handleRedeem = () => {
    const code = redeemCode.trim();
    if (!code) return;
    setRedeemOpen(false);
    setRedeemCode('');
    router.push(`/memory/share/${encodeURIComponent(code)}`);
  };

  return (
    <>
      <Topbar title="Memory" subtitle="your own library, shareable by link" />

      <div className="mx-auto w-full max-w-[780px] px-6 py-6">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-[22px] font-semibold tracking-[-0.03em] text-[var(--neutral-strong-950)]">
              Memory
            </h1>
            <p className="mt-1 text-[13px] text-[var(--neutral-sub-600)]">
              {loading ? (
                <span className="inline-block h-4 w-56 animate-pulse rounded bg-[var(--neutral-weak-50)]" />
              ) : (
                <>
                  {memories.length} · your own library, shareable by link
                </>
              )}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setRedeemOpen(true)}
              className="text-[13px] font-medium text-[var(--neutral-sub-600)] underline-offset-2 hover:text-[var(--neutral-strong-950)] hover:underline"
            >
              Redeem a share code
            </button>
            <Button variant="primary" onClick={openCreate}>
              New memory
            </Button>
          </div>
        </div>

        <div className="mb-8 flex gap-3 rounded-xl border border-[var(--stroke-soft-200)] bg-[var(--neutral-weak-50)] px-4 py-3">
          <FileText className="mt-0.5 h-4 w-4 shrink-0 text-[var(--neutral-soft-400)]" strokeWidth={2} />
          <p className="text-[13px] leading-[1.55] text-[var(--neutral-sub-600)]">
            A memory is a title of four words or fewer and a body you write in Markdown.
            Agents do not create them and nothing decays. Sharing is a link you can revoke.
          </p>
        </div>

        {error && (
          <div className="mb-6">
            <ErrorBanner message={error} onDismiss={() => setError(null)} onRetry={fetchData} />
          </div>
        )}

        {loading && <MemorySkeleton />}

        {!loading && memories.length === 0 && (
          <EmptyState
            icon={<FileText className="h-5 w-5" />}
            title="No memories yet"
            description="Write a short title and a Markdown body. Agents carry it between sessions."
          />
        )}

        {!loading && pinned.length > 0 && (
          <section className="mb-8">
            <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--neutral-soft-400)]">
              Pinned {pinned.length}
            </h2>
            <div className="flex flex-col gap-3">
              {pinned.map((memory) => (
                <MemoryRow
                  key={memory.id}
                  memory={memory}
                  shareCount={shareCounts[memory.id]}
                  pinned
                  busy={pinningId === memory.id || deletingId === memory.id}
                  menuOpen={menuId === memory.id}
                  onOpen={() => setOpenMemory(memory)}
                  onToggleMenu={() => setMenuId((id) => (id === memory.id ? null : memory.id))}
                  onCloseMenu={() => setMenuId(null)}
                  onPin={() => void handlePin(memory)}
                  onShare={() => {
                    setMenuId(null);
                    setShareMemory(memory);
                  }}
                  onEdit={() => openEdit(memory)}
                  onDelete={() => {
                    setMenuId(null);
                    setPendingDelete(memory);
                  }}
                />
              ))}
            </div>
          </section>
        )}

        {!loading && rest.length > 0 && (
          <section>
            <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--neutral-soft-400)]">
              Everything else {rest.length}
            </h2>
            <div className="flex flex-col gap-1">
              {rest.map((memory) => (
                <MemoryRow
                  key={memory.id}
                  memory={memory}
                  shareCount={shareCounts[memory.id]}
                  pinned={false}
                  busy={pinningId === memory.id || deletingId === memory.id}
                  menuOpen={menuId === memory.id}
                  onOpen={() => setOpenMemory(memory)}
                  onToggleMenu={() => setMenuId((id) => (id === memory.id ? null : memory.id))}
                  onCloseMenu={() => setMenuId(null)}
                  onPin={() => void handlePin(memory)}
                  onShare={() => {
                    setMenuId(null);
                    setShareMemory(memory);
                  }}
                  onEdit={() => openEdit(memory)}
                  onDelete={() => {
                    setMenuId(null);
                    setPendingDelete(memory);
                  }}
                />
              ))}
            </div>
          </section>
        )}
      </div>

      <Dialog
        open={openMemory !== null}
        onOpenChange={(next) => {
          if (!next) setOpenMemory(null);
        }}
        title={openMemory?.title ?? 'Memory'}
        width={640}
        footer={
          openMemory ? (
            <div className="flex flex-wrap justify-end gap-2">
              <Button
                variant="secondary"
                onClick={() => {
                  const mem = openMemory;
                  setOpenMemory(null);
                  openEdit(mem);
                }}
              >
                Edit
              </Button>
              <Button variant="primary" onClick={() => setOpenMemory(null)}>
                Close
              </Button>
            </div>
          ) : null
        }
      >
        {openMemory ? (
          <div className="max-h-[60vh] overflow-y-auto pr-1">
            <MarkdownContent content={openMemory.memory} />
          </div>
        ) : null}
      </Dialog>

      <Dialog
        open={editorOpen}
        onOpenChange={setEditorOpen}
        title={editing ? 'Edit memory' : 'New memory'}
        description="Title is four words or fewer. The body is Markdown."
        width={560}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setEditorOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button variant="primary" onClick={() => void handleSave()} disabled={!canSave || saving}>
              {saving ? 'Saving…' : editing ? 'Save' : 'Create'}
            </Button>
          </div>
        }
      >
        <div className="space-y-3">
          <div>
            <label className="mb-1.5 block text-[12px] font-medium text-[var(--neutral-sub-600)]">
              Title
            </label>
            <Input
              value={draftTitle}
              onChange={(e) => setDraftTitle(e.target.value)}
              placeholder="Four words or fewer"
            />
            <p
              className={cn(
                'mt-1 text-[11.5px]',
                titleTooLong ? 'text-[var(--error)]' : 'text-[var(--neutral-soft-400)]',
              )}
            >
              {titleWords}/4 words
            </p>
          </div>
          <div>
            <label className="mb-1.5 block text-[12px] font-medium text-[var(--neutral-sub-600)]">
              Body
            </label>
            <textarea
              value={draftBody}
              onChange={(e) => setDraftBody(e.target.value)}
              placeholder={'Markdown is supported.\n\nNever push to `main`.'}
              rows={8}
              className="w-full resize-y rounded-[8px] border border-[var(--stroke-sub-300)] bg-[var(--white-0)] px-3 py-2.5 text-[13px] leading-[1.6] text-[var(--neutral-strong-950)] placeholder:text-[var(--neutral-soft-400)] outline-none focus:border-[var(--primary-base)] focus:ring-[3px] focus:ring-[var(--primary-alpha-16)]"
            />
          </div>
        </div>
      </Dialog>

      <Dialog
        open={redeemOpen}
        onOpenChange={setRedeemOpen}
        title="Redeem a share code"
        description="Paste the code from a memory share link. You will get your own copy."
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setRedeemOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleRedeem} disabled={!redeemCode.trim()}>
              Open share
            </Button>
          </div>
        }
      >
        <Input
          value={redeemCode}
          onChange={(e) => setRedeemCode(e.target.value)}
          placeholder="Share code"
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleRedeem();
          }}
        />
      </Dialog>

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
              will be permanently removed.
            </>
          ) : null
        }
        confirmLabel="Delete memory"
        loading={!!deletingId}
        onConfirm={handleDelete}
      />

      <ShareMemoryDialog
        memory={shareMemory}
        open={shareMemory !== null}
        onOpenChange={(next) => {
          if (!next) {
            if (shareMemory) void loadShareCounts([shareMemory]);
            setShareMemory(null);
          }
        }}
      />
    </>
  );
}

function MemoryRow({
  memory,
  shareCount,
  pinned,
  busy,
  menuOpen,
  onOpen,
  onToggleMenu,
  onCloseMenu,
  onPin,
  onShare,
  onEdit,
  onDelete,
}: {
  memory: Memory;
  shareCount?: number;
  pinned: boolean;
  busy: boolean;
  menuOpen: boolean;
  onOpen: () => void;
  onToggleMenu: () => void;
  onCloseMenu: () => void;
  onPin: () => void;
  onShare: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const menuRef = useRef<HTMLDivElement>(null);
  const shares = shareCountLabel(shareCount);
  const preview = plainTextFromMarkdown(memory.memory);

  useEffect(() => {
    if (!menuOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) onCloseMenu();
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [menuOpen, onCloseMenu]);

  return (
    <article
      className={cn(
        'group relative flex cursor-pointer gap-3 rounded-xl',
        pinned
          ? 'border border-[var(--stroke-soft-200)] bg-[var(--bg-surface)] px-3 py-3'
          : 'px-1 py-2 hover:bg-[var(--neutral-weak-50)]',
        busy && 'pointer-events-none opacity-50',
      )}
      onClick={onOpen}
    >
      {pinned ? (
        <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[var(--primary-alpha-10)]">
          <Zap className="h-3.5 w-3.5 text-[var(--primary-base)]" strokeWidth={2.25} fill="currentColor" />
        </span>
      ) : null}
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <h3 className="truncate text-[14.5px] font-semibold tracking-[-0.015em] text-[var(--neutral-strong-950)]">
            {memory.title}
          </h3>
          <div className="flex shrink-0 items-center gap-2">
            {shares && (
              <span className="text-[12px] font-medium text-[var(--neutral-soft-400)]">{shares}</span>
            )}
            <div className="relative" ref={menuRef}>
              <button
                type="button"
                aria-label={`More actions for ${memory.title}`}
                aria-expanded={menuOpen}
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleMenu();
                }}
                className="rounded-md p-1 text-[var(--neutral-soft-400)] hover:bg-[var(--neutral-weak-50)] hover:text-[var(--neutral-strong-950)]"
              >
                <MoreHorizontal className="h-4 w-4" strokeWidth={2} />
              </button>
              {menuOpen && (
                <div
                  className="absolute right-0 z-20 mt-1 w-[180px] overflow-hidden rounded-lg border border-[var(--stroke-soft-200)] bg-[var(--bg-surface)] py-1 shadow-[0_12px_32px_rgba(0,0,0,0.16)]"
                  onClick={(e) => e.stopPropagation()}
                >
                  <MenuItem
                    icon={pinned ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}
                    label={pinned ? 'Unpin' : 'Pin'}
                    onClick={onPin}
                  />
                  <MenuItem icon={<Share2 className="h-3.5 w-3.5" />} label="Share" onClick={onShare} />
                  <MenuItem icon={<Pencil className="h-3.5 w-3.5" />} label="Edit" onClick={onEdit} />
                  <MenuItem
                    icon={<Trash2 className="h-3.5 w-3.5" />}
                    label="Delete"
                    onClick={onDelete}
                    danger
                  />
                </div>
              )}
            </div>
          </div>
        </div>
        {preview ? (
          <p className="mt-0.5 truncate text-[13px] leading-[1.45] text-[var(--neutral-sub-600)]">
            {preview}
          </p>
        ) : null}
      </div>
    </article>
  );
}

function MenuItem({
  icon,
  label,
  onClick,
  danger,
}: {
  icon: ReactNode;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-[12.5px]',
        danger
          ? 'text-[var(--error)] hover:bg-[var(--error-lighter)]'
          : 'text-[var(--neutral-sub-600)] hover:bg-[var(--neutral-weak-50)] hover:text-[var(--neutral-strong-950)]',
      )}
    >
      {icon}
      {label}
    </button>
  );
}

function MemorySkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="rounded-xl border border-[var(--stroke-soft-200)] px-4 py-3">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="mt-2 h-3 w-full" />
          <Skeleton className="mt-1.5 h-3 w-2/3" />
        </div>
      ))}
    </div>
  );
}
