'use client';

import { useEffect, useRef } from 'react';
import { useReducedMotion } from 'motion/react';
import { MessagesSquare, Paperclip } from 'lucide-react';
import type { WorkspaceAgent, WorkspaceMessage } from '@/lib/api';
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

/**
 * Flat conversation: avatar, sender, you/role, timestamp, then plain text.
 * Mentions of the posting agent get a thin orange border (no fill) plus
 * disabled actions — matching the Linear-style mock.
 */
export function AgentChat({
  messages,
  agents,
  viewerAgentIds = [],
  workspaceTitle,
}: {
  messages: WorkspaceMessage[];
  agents: WorkspaceAgent[];
  viewerAgentIds?: string[];
  workspaceTitle: string;
}) {
  const reduce = useReducedMotion();
  const bottomRef = useRef<HTMLDivElement>(null);
  const byId = new Map(agents.map((a) => [a.id, a]));
  const handles = agents.map((a) => a.handle);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'end' });
  }, [messages.length, reduce]);

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
              mentionedYou={mentionedYou}
              isYou={isYou}
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
  mentionedYou,
  isYou,
}: {
  message: WorkspaceMessage;
  sender?: WorkspaceAgent;
  handles: string[];
  mentionedYou: boolean;
  isYou: boolean;
}) {
  const handle = sender?.handle ?? 'unknown';
  const relation = isYou ? 'you' : sender?.role_label || null;

  return (
    <div
      className={cn(
        'my-1.5 flex gap-2.5 px-1 py-2',
        mentionedYou &&
          'rounded-[10px] border border-[var(--attention)]/45 bg-transparent px-2.5 py-2',
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
          {mentionedYou && (
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
            <MentionText text={message.message_text} knownHandles={handles} tone="primary" />
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

        {mentionedYou && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            <button
              type="button"
              disabled
              title="Coming soon — pointers cannot link to a source message yet"
              className="rounded-md bg-[var(--neutral-weak-50)] px-2.5 py-1.5 text-[12px] text-[var(--neutral-sub-600)]"
            >
              Point a task at it
            </button>
            <button
              type="button"
              disabled
              title="Coming soon — runs are not linked to messages"
              className="rounded-md bg-[var(--neutral-weak-50)] px-2.5 py-1.5 text-[12px] text-[var(--neutral-sub-600)]"
            >
              Open the runs behind this
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
