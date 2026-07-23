'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useReducedMotion } from 'motion/react';
import {
  CheckCircle2,
  CornerDownRight,
  ListPlus,
  MessagesSquare,
  Paperclip,
  Plus,
  Reply,
  Sparkles,
  UserPlus,
  type LucideIcon,
} from 'lucide-react';
import type { WorkspaceAgent, WorkspaceMessage, WorkspaceTaskPointer } from '@/lib/api';
import { cn } from '@/lib/utils';
import { AgentGlyph, MentionText, useHueResolver, HUE_STYLES } from './agent-visuals';

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

/** Drops leading @handles so a quoted preview shows substance, not routing. */
function previewText(text: string | null) {
  if (!text) return 'shared a file';
  return text.replace(/^(\s*@[a-z0-9_-]+[,\s]*)+/i, '').trim() || text.trim();
}

/**
 * Derives what each message is answering. The API has no
 * `reply_to_message_id`, but in a directed room the mention is the
 * pointer: if B mentions A, and the nearest earlier message from A
 * mentioned B, B is answering it. Quotes are suppressed when the parent
 * is directly above, or already quoted, so they only ever add information.
 */
function buildAnswerMap(messages: WorkspaceMessage[]): Record<string, WorkspaceMessage> {
  const map: Record<string, WorkspaceMessage> = {};
  const quoted = new Set<string>();
  messages.forEach((message, index) => {
    if (message.mentioned_member_ids.length === 0) return;
    for (let i = index - 1; i >= 0; i -= 1) {
      const candidate = messages[i];
      if (
        !message.mentioned_member_ids.includes(candidate.sender_member_id) ||
        !candidate.mentioned_member_ids.includes(message.sender_member_id)
      )
        continue;
      if (i !== index - 1 && !quoted.has(candidate.id)) {
        map[message.id] = candidate;
        quoted.add(candidate.id);
      }
      return;
    }
  });
  return map;
}

type Entry =
  | { kind: 'message'; at: string; message: WorkspaceMessage }
  | { kind: 'event'; at: string; id: string; icon: LucideIcon; tone: EventTone; body: React.ReactNode };

type EventTone = 'neutral' | 'success' | 'info';

const TONE: Record<EventTone, { node: string; icon: string }> = {
  neutral: {
    node: 'border-[var(--stroke-soft-200)] bg-[var(--bg-surface-alt)]',
    icon: 'text-[var(--neutral-soft-400)]',
  },
  success: {
    node: 'border-[rgba(31,193,107,0.35)] bg-[rgba(31,193,107,0.12)]',
    icon: 'text-[var(--success-dark)]',
  },
  info: {
    node: 'border-[rgba(51,92,255,0.28)] bg-[rgba(51,92,255,0.10)]',
    icon: 'text-[var(--info-dark)]',
  },
};

/**
 * The room as a governed activity timeline.
 *
 * Modelled on a GitHub pull request: conversation and system events share
 * one rail, so the room reads as a record of work rather than a flat chat
 * log. Messages are cards; events are quiet inline rows. Every event here
 * is derived from real data, never invented, which is the whole point of
 * a surface that claims to be an audit trail.
 */
export function AgentChat({
  messages,
  agents,
  pointers = [],
  workspaceCreatedAt,
  viewerAgentId,
  workspaceTitle,
  onCreateTask,
  onReply,
}: {
  messages: WorkspaceMessage[];
  agents: WorkspaceAgent[];
  pointers?: WorkspaceTaskPointer[];
  workspaceCreatedAt?: string;
  viewerAgentId: string | null;
  workspaceTitle: string;
  onCreateTask?: (text: string) => void;
  onReply?: (handle: string) => void;
}) {
  const reduce = useReducedMotion();
  const hueOf = useHueResolver();
  const bottomRef = useRef<HTMLDivElement>(null);
  const byId = new Map(agents.map((a) => [a.id, a]));
  const handles = agents.map((a) => a.handle);
  const answering = useMemo(() => buildAnswerMap(messages), [messages]);

  const entries = useMemo<Entry[]>(() => {
    const list: Entry[] = messages.map((m) => ({ kind: 'message', at: m.created_at, message: m }));

    if (workspaceCreatedAt) {
      list.push({
        kind: 'event',
        at: workspaceCreatedAt,
        id: 'ws-created',
        icon: Sparkles,
        tone: 'info',
        body: <>Workspace created</>,
      });
    }

    agents.forEach((a) => {
      list.push({
        kind: 'event',
        at: a.created_at,
        id: `join-${a.id}`,
        icon: UserPlus,
        tone: 'neutral',
        body: (
          <>
            <span className={cn('font-mono', HUE_STYLES[hueOf(a.handle)].text)}>@{a.handle}</span>{' '}
            joined{a.role_label ? ` as ${a.role_label.toLowerCase()}` : ''}
          </>
        ),
      });
    });

    pointers.forEach((p) => {
      list.push({
        kind: 'event',
        at: p.created_at,
        id: `task-new-${p.id}`,
        icon: Plus,
        tone: 'neutral',
        body: (
          <>
            Task added <span className="text-[var(--neutral-strong-950)]">{p.title}</span>
          </>
        ),
      });
      if (p.status === 'done') {
        list.push({
          kind: 'event',
          at: p.updated_at,
          id: `task-done-${p.id}`,
          icon: CheckCircle2,
          tone: 'success',
          body: (
            <>
              Completed <span className="text-[var(--neutral-strong-950)]">{p.title}</span>
            </>
          ),
        });
      }
    });

    return list.sort((a, b) => a.at.localeCompare(b.at));
  }, [messages, agents, pointers, workspaceCreatedAt, hueOf]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'end' });
  }, [messages.length, reduce]);

  if (entries.length === 0) {
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
            Post the first message to kick things off. Mention an agent with @ to hand work to it,
            and every exchange here is governed and logged.
          </p>
        </div>
      </div>
    );
  }

  let lastDay = '';

  return (
    <div className="flex-1 overflow-y-auto px-4 py-3">
      {/* Wrapper is content-sized, so the rail spans exactly the entries
          rather than the full scroller. Its left edge sits inside the
          px-4, which is why the rail lands on 27px to match node centres. */}
      <div className="relative">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-1 left-[27px] w-px bg-[var(--stroke-soft-200)]"
      />

      {entries.map((entry, index) => {
        const day = dayLabel(entry.at);
        const showDay = day !== lastDay;
        if (showDay) lastDay = day;

        return (
          <div key={entry.kind === 'message' ? entry.message.id : entry.id}>
            {showDay && (
              <div className="relative z-10 my-3 flex items-center gap-3">
                <span className="h-px flex-1 bg-[var(--stroke-soft-200)]" />
                <span className="rounded-full border border-[var(--stroke-soft-200)] bg-[var(--bg-surface)] px-2 py-0.5 text-[10.5px] font-medium uppercase tracking-[0.05em] text-[var(--neutral-soft-400)]">
                  {day}
                </span>
                <span className="h-px flex-1 bg-[var(--stroke-soft-200)]" />
              </div>
            )}

            {/* Static rows: a timeline is reference material, and a staggered
                entry animation here only risked leaving items mid-flight. */}
            <div className="relative pl-[46px]">
              {entry.kind === 'event' ? (
                <EventRow entry={entry} />
              ) : (
                <MessageCard
                  message={entry.message}
                  sender={byId.get(entry.message.sender_member_id)}
                  agents={agents}
                  byId={byId}
                  handles={handles}
                  parent={answering[entry.message.id]}
                  parentSender={
                    answering[entry.message.id]
                      ? byId.get(answering[entry.message.id].sender_member_id)
                      : undefined
                  }
                  addressedToViewer={
                    viewerAgentId
                      ? entry.message.mentioned_member_ids.includes(viewerAgentId)
                      : false
                  }
                  hueOf={hueOf}
                  onCreateTask={onCreateTask}
                  onReply={onReply}
                />
              )}
            </div>
          </div>
        );
      })}
      </div>
      <div ref={bottomRef} />
    </div>
  );
}

function EventRow({ entry }: { entry: Extract<Entry, { kind: 'event' }> }) {
  const Icon = entry.icon;
  const tone = TONE[entry.tone];
  return (
    <div className="flex items-center gap-2 py-1">
      <span
        className={cn(
          'absolute left-[18px] flex size-[19px] items-center justify-center rounded-full border ring-4 ring-[var(--bg-surface)]',
          tone.node,
        )}
      >
        <Icon size={10.5} strokeWidth={2.4} className={tone.icon} />
      </span>
      <p className="text-[12px] leading-[1.5] text-[var(--neutral-sub-600)]">{entry.body}</p>
      <span className="shrink-0 font-mono text-[10.5px] text-[var(--neutral-soft-400)]">
        {timeLabel(entry.at)}
      </span>
    </div>
  );
}

function MessageCard({
  message,
  sender,
  byId,
  handles,
  parent,
  parentSender,
  addressedToViewer,
  hueOf,
  onCreateTask,
  onReply,
}: {
  message: WorkspaceMessage;
  sender?: WorkspaceAgent;
  agents: WorkspaceAgent[];
  byId: Map<string, WorkspaceAgent>;
  handles: string[];
  parent?: WorkspaceMessage;
  parentSender?: WorkspaceAgent;
  addressedToViewer: boolean;
  hueOf: (handle: string) => keyof typeof HUE_STYLES;
  onCreateTask?: (text: string) => void;
  onReply?: (handle: string) => void;
}) {
  const handle = sender?.handle ?? 'unknown';
  const addressees = message.mentioned_member_ids
    .map((id) => byId.get(id))
    .filter((a): a is WorkspaceAgent => Boolean(a));

  return (
    <div className="group relative my-1.5">
      {/* Node punches through the rail. Offset centres the 24px glyph on
          the rail at x=27.5, matching the 19px event nodes exactly. */}
      <span className="absolute -left-[30.5px] top-1.5 rounded-md ring-4 ring-[var(--bg-surface)]">
        <AgentGlyph handle={handle} roleLabel={sender?.role_label} />
      </span>

      <div
        className={cn(
          'overflow-hidden rounded-lg border transition-colors',
          addressedToViewer
            ? 'border-[rgba(250,115,25,0.35)]'
            : 'border-[var(--stroke-soft-200)] group-hover:border-[var(--stroke-sub-300)]',
        )}
      >
        {/* Header bar */}
        <div
          className={cn(
            'flex flex-wrap items-center gap-x-1.5 border-b px-3 py-1.5',
            addressedToViewer
              ? 'border-[rgba(250,115,25,0.25)] bg-[rgba(250,115,25,0.07)]'
              : 'border-[var(--stroke-soft-200)] bg-[var(--bg-surface-alt)]',
          )}
        >
          <span className={cn('font-mono text-[12.5px] font-semibold', HUE_STYLES[hueOf(handle)].text)}>
            @{handle}
          </span>

          {addressees.length > 0 && (
            <span className="inline-flex items-baseline gap-1 text-[11px] text-[var(--neutral-soft-400)]">
              <span aria-hidden="true">→</span>
              {addressees.map((a, i) => (
                <span key={a.id} className={cn('font-mono', HUE_STYLES[hueOf(a.handle)].text)}>
                  @{a.handle}
                  {i < addressees.length - 1 && <span className="text-[var(--neutral-soft-400)]">,</span>}
                </span>
              ))}
            </span>
          )}

          <span className="font-mono text-[10.5px] text-[var(--neutral-soft-400)]">
            {timeLabel(message.created_at)}
          </span>
          {sender?.status === 'removed' && (
            <span className="rounded bg-[var(--neutral-soft-200)] px-1 text-[10px] text-[var(--neutral-sub-600)]">
              removed
            </span>
          )}

          {/* Actions */}
          {(onReply || onCreateTask) && message.message_text && (
            <span className="ml-auto flex items-center gap-1 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
              {onReply && (
                <button
                  type="button"
                  onClick={() => onReply(handle)}
                  title={`Reply to @${handle}`}
                  aria-label={`Reply to @${handle}`}
                  className="rounded p-1 text-[var(--neutral-sub-600)] transition-colors hover:bg-[var(--bg-surface)] hover:text-[var(--neutral-strong-950)]"
                >
                  <Reply size={12} />
                </button>
              )}
              {onCreateTask && (
                <button
                  type="button"
                  onClick={() => onCreateTask(message.message_text ?? '')}
                  title="Turn this message into a task"
                  aria-label="Turn this message into a task"
                  className="rounded p-1 text-[var(--neutral-sub-600)] transition-colors hover:bg-[var(--bg-surface)] hover:text-[var(--neutral-strong-950)]"
                >
                  <ListPlus size={12} />
                </button>
              )}
            </span>
          )}
        </div>

        {/* Body */}
        <div className="bg-[var(--bg-surface)] px-3 py-2.5">
          {parent && parentSender && (
            <div className="mb-1.5 flex items-start gap-1.5 border-l-2 border-[var(--stroke-sub-300)] pl-2 text-[11.5px] leading-[1.45]">
              <CornerDownRight size={11} className="mt-[3px] shrink-0 text-[var(--neutral-soft-400)]" />
              <p className="min-w-0 truncate text-[var(--neutral-soft-400)]">
                <span className={cn('font-mono', HUE_STYLES[hueOf(parentSender.handle)].text)}>
                  @{parentSender.handle}
                </span>{' '}
                {previewText(parent.message_text)}
              </p>
            </div>
          )}

          {message.message_text && (
            <p className="whitespace-pre-wrap text-[13px] leading-[1.6] text-[var(--neutral-strong-950)]">
              <MentionText text={message.message_text} knownHandles={handles} />
            </p>
          )}

          {message.file_refs.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {message.file_refs.map((f) => (
                <span
                  key={f.file_id ?? f.filename}
                  className="inline-flex items-center gap-1.5 rounded-md border border-[var(--stroke-soft-200)] bg-[var(--bg-surface-alt)] px-2 py-1 text-[11.5px] text-[var(--neutral-sub-600)] transition-colors hover:border-[var(--stroke-sub-300)]"
                >
                  <Paperclip size={11} className="shrink-0" />
                  <span className="font-mono">{f.filename}</span>
                  <span className="text-[var(--neutral-soft-400)]">{formatSize(f.size)}</span>
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
