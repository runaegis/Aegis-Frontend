'use client';

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Paperclip, Reply, SendHorizontal, X } from 'lucide-react';
import type { WorkspaceAgent, WorkspaceFileRef } from '@/lib/api';
import { cn } from '@/lib/utils';
import { AgentGlyph, HUE_STYLES, useHueResolver } from './agent-visuals';

type MentionState = { start: number; query: string } | null;

/** One row of the field, matching the h-9 rhythm of Input/Button lg. */
const BASE_HEIGHT = 36;

/**
 * Message composer with `@mention` autocomplete.
 *
 * Everything lives inside one bordered container: the identity you post
 * as, the field, and the actions. Previously these were three floating
 * elements with independent padding, which never lined up with the panel
 * beside it. One container means one baseline and one focus ring.
 *
 * Enter sends, Shift+Enter breaks the line. While the mention menu is
 * open the arrow keys, Enter, and Tab drive the menu instead, which is
 * the behaviour people already have muscle memory for from Slack.
 */
export function Composer({
  agents,
  senderId,
  onSenderChange,
  onSend,
  disabled,
  focusSignal = 0,
  replyTo,
}: {
  agents: WorkspaceAgent[];
  senderId: string | null;
  onSenderChange: (id: string) => void;
  onSend: (text: string, files: WorkspaceFileRef[]) => Promise<void> | void;
  disabled?: boolean;
  /** Bumped by the parent to pull focus here, e.g. from the `/` shortcut. */
  focusSignal?: number;
  /** Addresses the next message to a handle. Signal changes trigger it. */
  replyTo?: { handle: string; signal: number };
}) {
  const [value, setValue] = useState('');
  const [files, setFiles] = useState<WorkspaceFileRef[]>([]);
  const [mention, setMention] = useState<MentionState>(null);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [highlight, setHighlight] = useState(0);
  const [sending, setSending] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const hueOf = useHueResolver();

  const active = useMemo(() => agents.filter((a) => a.status === 'active'), [agents]);
  const sender = active.find((a) => a.id === senderId) ?? active[0] ?? null;

  const matches = useMemo(() => {
    if (!mention) return [];
    const q = mention.query.toLowerCase();
    return active.filter((a) => a.handle.toLowerCase().startsWith(q)).slice(0, 6);
  }, [mention, active]);

  useEffect(() => setHighlight(0), [mention?.query]);

  useEffect(() => {
    if (focusSignal > 0) textareaRef.current?.focus();
  }, [focusSignal]);

  // Replying addresses the message: the mention is the pointer, so the
  // handle is prefilled rather than stored as hidden reply metadata.
  useEffect(() => {
    if (!replyTo || replyTo.signal === 0) return;
    setReplyingTo(replyTo.handle);
    setValue((current) =>
      current.includes(`@${replyTo.handle}`)
        ? current
        : `@${replyTo.handle} ${current}`.trimEnd() + ' ',
    );
    requestAnimationFrame(() => {
      const el = textareaRef.current;
      el?.focus();
      el?.setSelectionRange(el.value.length, el.value.length);
    });
  }, [replyTo?.signal, replyTo?.handle]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-grow. Collapse to 0 before measuring: scrollHeight is the max of
  // content height and client height, so measuring against `auto` can lock
  // the field to its ceiling on first layout.
  useLayoutEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    if (!value) {
      el.style.height = `${BASE_HEIGHT}px`;
      return;
    }
    const measure = () => {
      el.style.height = '0px';
      el.style.height = `${Math.min(Math.max(el.scrollHeight, BASE_HEIGHT), 148)}px`;
    };
    measure();
    // Re-measure next frame: when surrounding chrome appears in the same
    // commit (the reply strip, an attachment), the first pass can read a
    // stale layout and latch the field open at its ceiling.
    const raf = requestAnimationFrame(measure);
    return () => cancelAnimationFrame(raf);
  }, [value]);

  const detectMention = (text: string, caret: number) => {
    const upto = text.slice(0, caret);
    const match = /@([a-z0-9_-]*)$/i.exec(upto);
    if (!match) return setMention(null);
    setMention({ start: caret - match[0].length, query: match[1] });
  };

  const applyMention = (handle: string) => {
    if (!mention) return;
    const before = value.slice(0, mention.start);
    const after = value.slice(mention.start + 1 + mention.query.length);
    setValue(`${before}@${handle} ${after}`);
    setMention(null);
    requestAnimationFrame(() => {
      const pos = before.length + handle.length + 2;
      textareaRef.current?.focus();
      textareaRef.current?.setSelectionRange(pos, pos);
    });
  };

  const submit = async () => {
    const text = value.trim();
    if ((!text && files.length === 0) || sending || !sender) return;
    setSending(true);
    try {
      await onSend(text, files);
      setValue('');
      setFiles([]);
      setMention(null);
      setReplyingTo(null);
    } finally {
      setSending(false);
    }
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (mention && matches.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setHighlight((h) => (h + 1) % matches.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setHighlight((h) => (h - 1 + matches.length) % matches.length);
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        applyMention(matches[highlight].handle);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setMention(null);
        return;
      }
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void submit();
    }
  };

  const attachDemoFile = () => {
    const n = files.length + 1;
    setFiles((f) => [
      ...f,
      {
        file_id: `demo-file-${Date.now()}`,
        url: '#',
        filename: `attachment-${n}.json`,
        content_type: 'application/json',
        size: 2048 * n,
        uploader_member_id: sender?.id ?? null,
      },
    ]);
  };

  if (!sender) {
    return (
      // Same height as the live composer so the room's bottom rule stays
      // continuous even before any agent has joined.
      <div className="flex min-h-[103px] items-center border-t border-[var(--stroke-soft-200)] px-4 text-[12.5px] text-[var(--neutral-sub-600)]">
        Invite an agent before posting to this workspace.
      </div>
    );
  }

  const canSend = Boolean(value.trim() || files.length);

  return (
    <div className="relative border-t border-[var(--stroke-soft-200)] bg-[var(--bg-surface)] px-4 py-3">
      {/* Mention menu */}
      {mention && matches.length > 0 && (
        <div
          role="listbox"
          aria-label="Mention an agent"
          className="absolute bottom-[calc(100%-4px)] left-4 z-30 w-[248px] overflow-hidden rounded-lg border border-[var(--stroke-soft-200)] bg-[var(--bg-surface)] py-1 shadow-[0_12px_32px_rgba(0,0,0,0.14)]"
        >
          {matches.map((a, i) => (
            <button
              key={a.id}
              type="button"
              role="option"
              aria-selected={i === highlight}
              onMouseEnter={() => setHighlight(i)}
              onMouseDown={(e) => {
                e.preventDefault();
                applyMention(a.handle);
              }}
              className={cn(
                'flex w-full items-center gap-2 px-2 py-1.5 text-left focus-visible:shadow-none',
                i === highlight ? 'bg-[var(--neutral-weak-50)]' : 'bg-transparent',
              )}
            >
              <AgentGlyph handle={a.handle} roleLabel={a.role_label} size="sm" />
              <span className="min-w-0">
                <span className="block truncate font-mono text-[12.5px] text-[var(--neutral-strong-950)]">
                  @{a.handle}
                </span>
                {a.role_label && (
                  <span className="block truncate text-[11px] text-[var(--neutral-sub-600)]">
                    {a.role_label}
                  </span>
                )}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* One container: identity, field, and actions share a baseline and
          a single focus ring. */}
      {/* data-input-shell is the app's convention for "the wrapper owns the
          chrome": it strips the base 1px border and the duplicate focus ring
          from the inner field so this container paints them instead. */}
      <div
        data-input-shell
        className={cn(
          'rounded-xl border bg-[var(--bg-surface)] transition-colors',
          'border-[var(--stroke-soft-200)] focus-within:border-[var(--primary-base)]',
          'focus-within:ring-2 focus-within:ring-[rgba(250,115,25,0.14)]',
        )}
      >
        {/* Reply context */}
        {replyingTo && (
          <div className="flex items-center gap-1.5 border-b border-[var(--stroke-soft-200)] px-2.5 py-1.5 text-[11.5px] text-[var(--neutral-sub-600)]">
            <Reply size={11} className="shrink-0 text-[var(--neutral-soft-400)]" />
            <span>
              Replying to{' '}
              <span className={cn('font-mono', HUE_STYLES[hueOf(replyingTo)].text)}>
                @{replyingTo}
              </span>
            </span>
            <button
              type="button"
              onClick={() => setReplyingTo(null)}
              aria-label="Cancel reply"
              className="ml-auto rounded p-0.5 text-[var(--neutral-soft-400)] transition-colors hover:text-[var(--neutral-strong-950)] focus-visible:shadow-none"
            >
              <X size={12} />
            </button>
          </div>
        )}

        {/* Attachments */}
        {files.length > 0 && (
          <div className="flex flex-wrap gap-1.5 border-b border-[var(--stroke-soft-200)] px-2.5 py-2">
            {files.map((f) => (
              <span
                key={f.file_id}
                className="inline-flex items-center gap-1.5 rounded-md border border-[var(--stroke-soft-200)] bg-[var(--bg-surface-alt)] px-2 py-1 font-mono text-[11.5px] text-[var(--neutral-sub-600)]"
              >
                <Paperclip size={11} />
                {f.filename}
                <button
                  type="button"
                  aria-label={`Remove ${f.filename}`}
                  onClick={() => setFiles((list) => list.filter((x) => x.file_id !== f.file_id))}
                  className="ml-0.5 text-[var(--neutral-soft-400)] hover:text-[var(--error-dark)] focus-visible:shadow-none"
                >
                  <X size={11} />
                </button>
              </span>
            ))}
          </div>
        )}

        <textarea
          ref={textareaRef}
          rows={1}
          value={value}
          disabled={disabled || sending}
          placeholder="Message the workspace. Use @ to mention an agent."
          onChange={(e) => {
            setValue(e.target.value);
            detectMention(e.target.value, e.target.selectionStart ?? 0);
          }}
          onKeyDown={onKeyDown}
          onBlur={() => setTimeout(() => setMention(null), 120)}
          // Chromeless: globals.css borders every bare field and Chrome
          // adds its own underline on top, so this matches the treatment in
          // components/ui/Input and lets the container own the chrome.
          className="block max-h-[148px] w-full resize-none !border-0 !bg-transparent px-3 pb-1 pt-2.5 text-[13px] leading-[1.55] text-[var(--neutral-strong-950)] placeholder:text-[var(--neutral-soft-400)] focus:outline-none focus:ring-0 focus-visible:shadow-none [appearance:none] [-webkit-appearance:none]"
          style={{ border: 'none', boxShadow: 'none', background: 'transparent' }}
        />

        {/* Action row */}
        <div className="flex items-center gap-1 px-2 pb-2 pt-0.5">
          {/* Post-as: quiet until reached for */}
          <label
            className="relative flex shrink-0 items-center gap-1.5 rounded-md border border-transparent py-1 pl-1 pr-5 transition-colors hover:border-[var(--stroke-soft-200)] hover:bg-[var(--bg-surface-alt)]"
            title="Post as"
          >
            <span className="sr-only">Post as</span>
            <AgentGlyph handle={sender.handle} roleLabel={sender.role_label} size="sm" />
            <span className="max-w-[100px] truncate font-mono text-[12px] text-[var(--neutral-sub-600)]">
              @{sender.handle}
            </span>
            <ChevronDown
              size={11}
              className="pointer-events-none absolute right-1.5 text-[var(--neutral-soft-400)]"
            />
            <select
              value={sender.id}
              onChange={(e) => onSenderChange(e.target.value)}
              aria-label="Post as"
              className="absolute inset-0 w-full cursor-pointer appearance-none opacity-0 outline-none focus-visible:shadow-none"
            >
              {active.map((a) => (
                <option key={a.id} value={a.id}>
                  @{a.handle}
                </option>
              ))}
            </select>
          </label>

          <div className="ml-auto flex items-center gap-1">
            <button
              type="button"
              onClick={attachDemoFile}
              aria-label="Attach a file"
              className="rounded-md p-1.5 text-[var(--neutral-sub-600)] transition-colors hover:bg-[var(--bg-surface-alt)] hover:text-[var(--neutral-strong-950)] focus-visible:shadow-none"
            >
              <Paperclip size={15} />
            </button>

            <button
              type="button"
              onClick={submit}
              disabled={!canSend || sending}
              aria-label="Send message"
              className={cn(
                'rounded-md p-1.5 transition-all focus-visible:shadow-none',
                canSend
                  ? 'bg-[var(--primary-base)] text-white hover:opacity-90'
                  : 'bg-[var(--bg-surface-alt)] text-[var(--neutral-soft-400)]',
                'disabled:cursor-not-allowed',
              )}
            >
              <SendHorizontal size={15} />
            </button>
          </div>
        </div>
      </div>

    </div>
  );
}
