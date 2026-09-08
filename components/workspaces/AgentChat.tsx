'use client';

import { useEffect, useRef } from 'react';
import { useReducedMotion } from 'motion/react';
import { MessagesSquare, Paperclip } from 'lucide-react';
import type { WorkspaceAgent, WorkspaceMessage, WorkspacePerson } from '@/lib/api';
import { cn } from '@/lib/utils';
import { AgentGlyph, MentionText } from './agent-visuals';

function dayLabel(iso: string) {
  const date = new Date(iso);
  const today = new Date();
  const yesterday = new Date(Date.now() - 86_400_000);
  const same = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  if (same(date, today)) return 'Today';
  if (same(date, yesterday)) return 'Yesterday';
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function timeLabel(iso: string) {
  return new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function pingChipLabel(
  pingedYou: boolean,
  mentionedUserIds: string[],
  peopleById: Map<string, WorkspacePerson>,
): string | null {
  if (pingedYou) return 'mentioned you';
  if (mentionedUserIds.length === 0) return null;
  if (mentionedUserIds.length === 1) {
    const name = peopleById.get(mentionedUserIds[0])?.name?.trim();
    return name ? `pinged ${name}` : 'pinged a member';
  }
  return `pinged ${mentionedUserIds.length} people`;
}

/**
 * Flat conversation: avatar, sender, you/role, timestamp, then plain text.
 * Human pings use the filled amber "mentioned you" chip from the workspace mock.
 * Agent mentions of the posting viewer stay a thin orange border without fill.
 */
export function AgentChat({
  messages,
  agents,
  people = [],
  viewerAgentIds = [],
  workspaceTitle,
  focusMessageId = null,
}: {
  messages: WorkspaceMessage[];
  agents: WorkspaceAgent[];
  people?: WorkspacePerson[];
  viewerAgentIds?: string[];
  workspaceTitle: string;
  focusMessageId?: string | null;
}) {
  const reduce = useReducedMotion();
  const bottomRef = useRef<HTMLDivElement>(null);
  const byId = new Map(agents.map((a) => [a.id, a]));
  const peopleById = new Map(people.map((person) => [person.user_id, person]));
  const handles = agents.map((a) => a.handle);
  const peopleHandles = [
    'user',
    'owner',
    ...people.map((person) => person.ping_handle).filter(Boolean),
  ];

  useEffect(() => {
    if (focusMessageId) {
      const el = document.getElementById(`workspace-msg-${focusMessageId}`);
      el?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center' });
      return;
    }
    bottomRef.current?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'end' });
  }, [messages.length, reduce, focusMessageId]);

  if (messages.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center px-6 py-10">
        <div className="max-w-[380px] text-center">
          <span className="mx-auto mb-3 flex size-10 items-center justify-center rounded-xl bg-[var(--neutral-weak-50)] text-[var(--neutral-sub-600)]">
            <MessagesSquare size={18} />
          </span>
          <h3 className="text-[14px] font-semibold text-[var(--neutral-strong-950)]">
            This is the start of {workspaceTitle}
          </h3>
          <p className="mt-1 text-[12.5px] leading-[1.6] text-[var(--neutral-sub-600)]">
            Message the workspace, or @mention an agent to hand work to it.
          </p>
        </div>
      </div>
    );
  }

  let lastDay = '';

  return (
    <div className="flex-1 overflow-y-auto px-4 py-3">
      {messages.map((message) => {
        const day = dayLabel(message.created_at);
        const showDay = day !== lastDay;
        if (showDay) lastDay = day;
        const sender = byId.get(message.sender_member_id);
        const mentionedYou = (viewerAgentIds ?? []).some((id) =>
          message.mentioned_member_ids.includes(id),
        );
        const pingedYou = message.pinged_you === true;
        const mentionedUserIds = message.mentioned_user_ids ?? [];
        const isYou = Boolean(sender && (viewerAgentIds ?? []).includes(sender.id));

        return (
          <div key={message.id}>
            {showDay && (
              <div className="my-3 flex items-center gap-3">
                <span className="h-px flex-1 bg-[var(--stroke-soft-200)]" />
                <span className="rounded-full border border-[var(--stroke-soft-200)] bg-[var(--bg-surface)] px-2 py-0.5 text-[10.5px] font-medium uppercase tracking-[0.05em] text-[var(--neutral-soft-400)]">
                  {day}
                </span>
                <span className="h-px flex-1 bg-[var(--stroke-soft-200)]" />
              </div>
            )}
            <MessageBubble
              message={message}
              sender={sender}
              handles={handles}
              peopleHandles={peopleHandles}
              peopleById={peopleById}
              mentionedYou={mentionedYou}
              pingedYou={pingedYou}
              mentionedUserIds={mentionedUserIds}
              isYou={isYou}
              focused={focusMessageId === message.id}
            />
          </div>
        );
      })}
      <div ref={bottomRef} />
    </div>
  );
}

function MessageBubble({
  message,
  sender,
  handles,
  peopleHandles,
  peopleById,
  mentionedYou,
  pingedYou,
  mentionedUserIds,
  isYou,
  focused,
}: {
  message: WorkspaceMessage;
  sender?: WorkspaceAgent;
  handles: string[];
  peopleHandles: string[];
  peopleById: Map<string, WorkspacePerson>;
  mentionedYou: boolean;
  pingedYou: boolean;
  mentionedUserIds: string[];
  isYou: boolean;
  focused: boolean;
}) {
  const handle = sender?.handle ?? 'unknown';
  const relation = isYou ? 'you' : sender?.role_label || null;
  const pingLabel = pingChipLabel(pingedYou, mentionedUserIds, peopleById);
  const attention = pingedYou || mentionedYou;
  const showActions = pingedYou || mentionedYou;

  return (
    <div
      id={`workspace-msg-${message.id}`}
      className={cn(
        'my-1.5 flex gap-2.5 px-1 py-2',
        attention &&
          'rounded-[10px] border border-[var(--attention)]/45 bg-transparent px-2.5 py-2',
        focused && 'ring-2 ring-[var(--warning)]/70',
      )}
    >
      <AgentGlyph handle={handle} roleLabel={sender?.role_label} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
          <span className="text-[13px] font-semibold tracking-[-0.01em] text-[var(--neutral-strong-950)]">
            @{handle}
          </span>
          {relation && (
            <span className="text-[11.5px] text-[var(--neutral-soft-400)]">{relation}</span>
          )}
          <span className="text-[11.5px] text-[var(--neutral-soft-400)]">
            {timeLabel(message.created_at)}
          </span>
          {pingLabel && (
            <span
              className={
                pingedYou
                  ? 'rounded-[6px] bg-[var(--warning)] px-1.5 py-px text-[10.5px] font-semibold text-[#1a1a1a]'
                  : 'rounded px-1.5 py-px text-[10.5px] font-medium text-[var(--attention-dark)]'
              }
            >
              {pingLabel}
            </span>
          )}
          {mentionedYou && !pingedYou && (
            <span className="rounded px-1.5 py-px text-[10.5px] font-medium text-[var(--attention-dark)]">
              mentioned you
            </span>
          )}
          {sender?.status === 'removed' && (
            <span className="rounded bg-[var(--neutral-soft-200)] px-1 text-[10px] text-[var(--neutral-sub-600)]">
              removed
            </span>
          )}
        </div>

        {message.message_text && (
          <p className="mt-0.5 whitespace-pre-wrap text-[13.5px] leading-[1.65] text-[var(--neutral-strong-950)]">
            <MentionText
              text={message.message_text}
              knownHandles={handles}
              peopleHandles={peopleHandles}
              tone="primary"
            />
          </p>
        )}

        {message.file_refs.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {message.file_refs.map((f) => (
              <span
                key={f.file_id ?? f.filename}
                className="inline-flex items-center gap-1.5 rounded-md border border-[var(--stroke-soft-200)] bg-[var(--bg-surface)] px-2 py-1 text-[11.5px] text-[var(--neutral-sub-600)]"
              >
                <Paperclip size={11} className="shrink-0" />
                <span className="font-mono">{f.filename}</span>
                <span className="text-[var(--neutral-soft-400)]">{formatSize(f.size)}</span>
              </span>
            ))}
          </div>
        )}

        {showActions && (
          <div className="mt-2.5 flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled
              title="Coming soon — pointers cannot link to a source message yet"
              className="rounded-md border border-[var(--stroke-soft-200)] px-2.5 py-1.5 text-[12px] text-[var(--neutral-sub-600)] disabled:opacity-70"
            >
              Point a task at it
            </button>
            <button
              type="button"
              disabled
              title="Coming soon — runs are not linked to messages"
              className="text-[12px] text-[var(--neutral-sub-600)] underline-offset-2 disabled:opacity-70"
            >
              Open the runs behind this
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
