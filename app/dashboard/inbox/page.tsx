'use client';

/**
 * Inbox — `/dashboard/inbox`.
 *
 * Three real sources, composed client-side (there is no combined inbox
 * query): PING notifications, pointed_at_you pointers, and pending
 * workspace invites. Failed-run items are not listed — that field is
 * still deferred. No invented per-item unread flag on pointers.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Inbox } from 'lucide-react';
import Topbar from '@/components/layout/Topbar';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import EmptyState from '@/components/ui/EmptyState';
import ErrorBanner from '@/components/ui/ErrorBanner';
import { RelativeTime } from '@/components/ui/RelativeTime';
import { Skeleton } from '@/components/ui/Skeleton';
import { AgentGlyph } from '@/components/workspaces/agent-visuals';
import { WorkspaceDemoGate } from '@/components/workspaces/WorkspaceDemoGate';
import { api, type WorkspaceInvite, type WorkspaceTaskPointer } from '@/lib/api';
import { normalizeNotificationType } from '@/lib/notifications';
import type { UserNotification } from '@/lib/types';
import { cn } from '@/lib/utils';

type MentionItem = {
  kind: 'mention';
  id: string;
  handle: string;
  body: string;
  workspaceId: string | null;
  workspaceTitle: string;
  messageId: string | null;
  createdAt: string;
  unread: boolean;
};

type PointerItem = {
  kind: 'pointer';
  id: string;
  handle: string;
  title: string;
  workspaceId: string;
  workspaceTitle: string;
  createdAt: string;
};

type InviteItem = {
  kind: 'invite';
  id: string;
  handle: string | null;
  workspaceTitle: string;
  inviteCode: string;
  createdAt: string | null;
};

type InboxItem = MentionItem | PointerItem | InviteItem;

function leadingHandle(text: string | null | undefined): string | null {
  const match = /^@([a-z0-9_-]+)/i.exec((text ?? '').trim());
  return match ? match[1] : null;
}

function sortByTimeDesc(left: string | null, right: string | null): number {
  return new Date(right ?? 0).getTime() - new Date(left ?? 0).getTime();
}

export default function DashboardInboxPage() {
  return (
    <>
      <Topbar title="Inbox" subtitle="everything an agent has pointed at you" />
      <WorkspaceDemoGate>
        <InboxList />
      </WorkspaceDemoGate>
    </>
  );
}

function InboxList() {
  const [mentions, setMentions] = useState<MentionItem[] | null>(null);
  const [pointers, setPointers] = useState<PointerItem[]>([]);
  const [invites, setInvites] = useState<InviteItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [markingId, setMarkingId] = useState<string | null>(null);
  const [markingAll, setMarkingAll] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [notificationPage, inviteRows, workspaces] = await Promise.all([
        api.getNotifications({ limit: 50, offset: 0 }),
        api.getWorkspaceInviteInbox().catch(() => [] as WorkspaceInvite[]),
        api.getWorkspaces().catch(() => []),
      ]);

      const pingItems: MentionItem[] = notificationPage.items
        .filter((row) => normalizeNotificationType(row.notification_type) === 'PING')
        .map(notificationToMention);

      const pointerBundles = await Promise.all(
        workspaces.map(async (workspace) => {
          try {
            const rows = await api.getWorkspacePointers(workspace.id);
            const mine = rows.filter(
              (pointer) => pointer.pointed_at_you === true && pointer.status !== 'done',
            );
            if (mine.length === 0) return [] as PointerItem[];
            const detail = await api.getWorkspace(workspace.id).catch(() => null);
            const agents = new Map((detail?.agents ?? []).map((agent) => [agent.id, agent]));
            return mine.map((pointer) =>
              pointerToItem(pointer, workspace.id, workspace.title, agents),
            );
          } catch {
            return [] as PointerItem[];
          }
        }),
      );

      setMentions(pingItems);
      setPointers(pointerBundles.flat());
      setInvites(
        inviteRows
          .filter((invite) => invite.status === 'pending')
          .map(inviteToItem),
      );
    } catch (e) {
      setMentions([]);
      setPointers([]);
      setInvites([]);
      setError(e instanceof Error ? e.message : 'Could not load inbox.');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const unreadMentions = useMemo(
    () =>
      (mentions ?? [])
        .filter((item) => item.unread)
        .sort((a, b) => sortByTimeDesc(a.createdAt, b.createdAt)),
    [mentions],
  );
  const earlierMentions = useMemo(
    () =>
      (mentions ?? [])
        .filter((item) => !item.unread)
        .sort((a, b) => sortByTimeDesc(a.createdAt, b.createdAt)),
    [mentions],
  );
  const openPointers = useMemo(
    () => [...pointers].sort((a, b) => sortByTimeDesc(a.createdAt, b.createdAt)),
    [pointers],
  );
  const openInvites = useMemo(
    () => [...invites].sort((a, b) => sortByTimeDesc(a.createdAt, b.createdAt)),
    [invites],
  );

  const openItems: InboxItem[] = useMemo(
    () =>
      [...unreadMentions, ...openPointers, ...openInvites].sort((a, b) =>
        sortByTimeDesc(itemTime(a), itemTime(b)),
      ),
    [unreadMentions, openPointers, openInvites],
  );

  const openCount = openItems.length;
  const loading = mentions === null;

  const handleMarkRead = async (id: string) => {
    if (markingId) return;
    setMarkingId(id);
    try {
      const updated = await api.markNotificationRead(id);
      setMentions((prev) =>
        (prev ?? []).map((item) =>
          item.id === id ? { ...item, unread: !updated.is_read } : item,
        ),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not mark as read.');
    } finally {
      setMarkingId(null);
    }
  };

  const handleMarkAllRead = async () => {
    if (markingAll || unreadMentions.length === 0) return;
    setMarkingAll(true);
    try {
      await api.markAllNotificationsRead();
      setMentions((prev) => (prev ?? []).map((item) => ({ ...item, unread: false })));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not mark all as read.');
    } finally {
      setMarkingAll(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-[820px] px-6 py-6">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-semibold tracking-[-0.03em] text-[var(--neutral-strong-950)]">
            Inbox
          </h1>
          <p className="mt-1 text-[13px] text-[var(--neutral-sub-600)]">
            {loading ? (
              <span className="inline-block h-4 w-64 animate-pulse rounded bg-[var(--neutral-weak-50)]" />
            ) : (
              <>
                {openCount} open · mentions, pings, and tasks pointed at you
              </>
            )}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => void handleMarkAllRead()}
            disabled={markingAll || unreadMentions.length === 0}
            className="text-[13px] font-medium text-[var(--neutral-sub-600)] underline-offset-2 hover:text-[var(--neutral-strong-950)] hover:underline disabled:cursor-not-allowed disabled:opacity-40"
          >
            Mark all read
          </button>
          <Link href="/dashboard/settings#profile">
            <Button variant="secondary" size="sm">
              Notification settings
            </Button>
          </Link>
        </div>
      </div>

      <div className="mb-8 rounded-xl border border-[var(--stroke-soft-200)] bg-[var(--neutral-weak-50)] px-4 py-3">
        <p className="text-[13px] leading-[1.55] text-[var(--neutral-sub-600)]">
          Two things can reach you here: an agent pings you in a workspace, or a task is pointed at
          you. Workspace invites land here too. Failed runs stay on the Runs page.
        </p>
      </div>

      {error && (
        <div className="mb-6">
          <ErrorBanner message={error} onDismiss={() => setError(null)} onRetry={load} />
        </div>
      )}

      {loading && (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 3 }).map((_, index) => (
            <div
              key={index}
              className="rounded-xl border border-[var(--stroke-soft-200)] bg-[var(--bg-surface)] px-4 py-4"
            >
              <div className="flex gap-3">
                <Skeleton className="h-7 w-7 rounded-lg" />
                <div className="min-w-0 flex-1">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="mt-2 h-3 w-full max-w-[420px]" />
                  <Skeleton className="mt-3 h-7 w-36" />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && openItems.length === 0 && earlierMentions.length === 0 && (
        <div className="rounded-xl border border-[var(--stroke-soft-200)] bg-[var(--bg-surface)] py-8">
          <EmptyState
            icon={<Inbox size={20} />}
            title="Inbox is clear"
            description="When an agent pings you or points a task at you, it shows up here."
            compact
          />
        </div>
      )}

      {!loading && openItems.length > 0 && (
        <section className="mb-10">
          <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--neutral-soft-400)]">
            Unread {openCount}
          </h2>
          <div className="flex flex-col gap-2">
            {openItems.map((item) => (
              <InboxCard
                key={`${item.kind}-${item.id}`}
                item={item}
                muted={false}
                marking={markingId === item.id}
                onMarkRead={item.kind === 'mention' ? () => void handleMarkRead(item.id) : undefined}
              />
            ))}
          </div>
        </section>
      )}

      {!loading && earlierMentions.length > 0 && (
        <section>
          <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--neutral-soft-400)]">
            Earlier
            <span className="ml-1.5 font-medium normal-case tracking-normal text-[var(--neutral-soft-400)]">
              read
            </span>
          </h2>
          <div className="flex flex-col gap-2">
            {earlierMentions.map((item) => (
              <InboxCard key={`${item.kind}-${item.id}`} item={item} muted />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function itemTime(item: InboxItem): string | null {
  return item.createdAt;
}

function notificationToMention(row: UserNotification): MentionItem {
  const body = row.target_descriptor?.trim() || 'Pinged you in a workspace.';
  return {
    kind: 'mention',
    id: row.id,
    handle: leadingHandle(row.target_descriptor) ?? 'agent',
    body,
    workspaceId: row.workspace_id ?? null,
    workspaceTitle: row.room_name?.trim() || 'Workspace',
    messageId: row.workspace_message_id ?? null,
    createdAt: row.created_at,
    unread: !row.is_read,
  };
}

function pointerToItem(
  pointer: WorkspaceTaskPointer,
  workspaceId: string,
  workspaceTitle: string,
  agents: Map<string, { handle: string }>,
): PointerItem {
  const author = pointer.created_by_member_id
    ? agents.get(pointer.created_by_member_id)
    : null;
  return {
    kind: 'pointer',
    id: pointer.id,
    handle: author?.handle || pointer.assignee_handle || 'agent',
    title: pointer.title,
    workspaceId,
    workspaceTitle,
    createdAt: pointer.created_at,
  };
}

function inviteToItem(invite: WorkspaceInvite): InviteItem {
  return {
    kind: 'invite',
    id: invite.id || invite.invite_code,
    handle: invite.suggested_handle,
    workspaceTitle: invite.workspace_title || 'Workspace',
    inviteCode: invite.invite_code,
    createdAt: invite.created_at,
  };
}

function InboxCard({
  item,
  muted,
  marking = false,
  onMarkRead,
}: {
  item: InboxItem;
  muted: boolean;
  marking?: boolean;
  onMarkRead?: () => void;
}) {
  const handle = item.kind === 'invite' ? item.handle || 'invite' : item.handle;

  return (
    <article
      className={cn(
        'rounded-xl border border-[var(--stroke-soft-200)] bg-[var(--bg-surface)] px-4 py-3.5',
        !muted && 'border-l-[3px] border-l-[var(--attention)]',
        muted && 'opacity-70',
      )}
    >
      <div className="flex gap-3">
        <AgentGlyph handle={handle} size="md" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-[13px] font-medium text-[var(--neutral-strong-950)]">
              @{handle}
            </span>
            <Badge tone={item.kind === 'invite' ? 'primary' : 'neutral'}>
              {item.kind === 'mention'
                ? 'mentioned you'
                : item.kind === 'pointer'
                  ? 'task pointer'
                  : 'invite'}
            </Badge>
          </div>
          <p
            className={cn(
              'mt-1.5 text-[13.5px] leading-[1.55]',
              muted ? 'text-[var(--neutral-sub-600)]' : 'text-[var(--neutral-strong-950)]',
            )}
          >
            {item.kind === 'mention' && item.body}
            {item.kind === 'pointer' && `pointed a task at you: ${item.title}`}
            {item.kind === 'invite' &&
              `invited your agent${item.handle ? ` as @${item.handle}` : ''} to ${item.workspaceTitle}`}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            {item.kind === 'mention' && item.workspaceId && (
              <Link
                href={mentionHref(item)}
                className="btn-primary inline-flex h-7 items-center rounded-[8px] px-2.5 text-[12px] font-medium"
              >
                Reply in the workspace
              </Link>
            )}
            {item.kind === 'pointer' && (
              <Link
                href={`/workspaces/${item.workspaceId}?tab=tasks`}
                className="inline-flex h-7 items-center rounded-[8px] border border-[var(--stroke-sub-300)] px-2.5 text-[12px] font-medium text-[var(--neutral-sub-600)] hover:bg-[var(--neutral-weak-50)] hover:text-[var(--neutral-strong-950)]"
              >
                Open the task
              </Link>
            )}
            {item.kind === 'invite' && (
              <Link
                href={`/workspaces/join/${encodeURIComponent(item.inviteCode)}`}
                className="btn-primary inline-flex h-7 items-center rounded-[8px] px-2.5 text-[12px] font-medium"
              >
                Join
              </Link>
            )}
            {item.kind === 'mention' && onMarkRead && (
              <button
                type="button"
                onClick={onMarkRead}
                disabled={marking}
                className="text-[12.5px] font-medium text-[var(--neutral-sub-600)] underline-offset-2 hover:text-[var(--neutral-strong-950)] hover:underline disabled:opacity-40"
              >
                Mark read
              </button>
            )}
          </div>
        </div>
        <div className="hidden shrink-0 text-right sm:block">
          <p className="max-w-[160px] truncate text-[12px] text-[var(--neutral-sub-600)]">
            {item.workspaceTitle}
          </p>
          <RelativeTime
            timestamp={item.createdAt}
            className="mt-1 text-[11px] text-[var(--neutral-soft-400)]"
          />
        </div>
      </div>
    </article>
  );
}

function mentionHref(item: MentionItem): string {
  if (!item.workspaceId) return '/dashboard/workspaces';
  const qs = item.messageId ? `?message=${encodeURIComponent(item.messageId)}` : '';
  return `/workspaces/${item.workspaceId}${qs}`;
}
