'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowUp, Paperclip, X } from 'lucide-react';
import type { WorkspaceAgent, WorkspaceFileRef } from '@/lib/api';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { AgentGlyph } from './agent-visuals';

type MentionState = { start: number; query: string } | null;

/**
 * Single-line composer. Targeting is typed @mention — no post-as dropdown.
 */
export function Composer({
  agents,
  senderId,
  onSend,
  disabled,
  focusSignal = 0,
}: {
  agents: WorkspaceAgent[];
  senderId: string | null;
  onSend: (text: string, files: WorkspaceFileRef[]) => Promise<void> | void;
  disabled?: boolean;
  /** Bumped by the parent to pull focus here, e.g. from the `/` shortcut. */
  focusSignal?: number;
}) {
  const [value, setValue] = useState('');
  const [files, setFiles] = useState<WorkspaceFileRef[]>([]);
  const [mention, setMention] = useState<MentionState>(null);
  const [highlight, setHighlight] = useState(0);
  const [sending, setSending] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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

  const insertMentionTrigger = () => {
    const el = textareaRef.current;
    const start = el?.selectionStart ?? value.length;
    const before = value.slice(0, start);
    const after = value.slice(start);
    const prefix = before.length === 0 || /\s$/.test(before) ? '@' : ' @';
    const next = `${before}${prefix}${after}`;
    setValue(next);
    const caret = before.length + prefix.length;
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(caret, caret);
      detectMention(next, caret);
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
      <div className="flex min-h-[72px] items-center border-t border-[var(--stroke-soft-200)] px-4 text-[12.5px] text-[var(--neutral-sub-600)]">
        Invite an agent before posting to this workspace.
      </div>
    );
  }

  const canSend = Boolean(value.trim() || files.length);

  return (
    <div className="relative border-t border-[var(--stroke-soft-200)] bg-[var(--bg-surface)] px-4 py-3">
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

      <div
        data-input-shell
        className={cn(
          'rounded-xl border bg-[var(--bg-surface)] transition-colors',
          'border-[var(--stroke-soft-200)] focus-within:border-[var(--primary-base)]',
          'focus-within:ring-2 focus-within:ring-[var(--primary-alpha-16)]',
        )}
      >
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
          placeholder="Message the workspace, or @mention an agent…"
          onChange={(e) => {
            setValue(e.target.value);
            detectMention(e.target.value, e.target.selectionStart ?? 0);
          }}
          onKeyDown={onKeyDown}
          onBlur={() => setTimeout(() => setMention(null), 120)}
          className="block h-9 w-full resize-none overflow-y-auto !border-0 !bg-transparent px-3 py-2 text-[13px] leading-[1.4] text-[var(--neutral-strong-950)] placeholder:text-[var(--neutral-soft-400)] focus:outline-none focus:ring-0 focus-visible:shadow-none [appearance:none] [-webkit-appearance:none]"
          style={{ border: 'none', boxShadow: 'none', background: 'transparent' }}
        />

        <div className="flex items-center gap-3 px-3 pb-2 pt-0.5">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={insertMentionTrigger}
              className="text-[12px] text-[var(--neutral-sub-600)] underline-offset-2 hover:text-[var(--neutral-strong-950)] hover:underline focus-visible:shadow-none"
            >
              @mention
            </button>
            <button
              type="button"
              onClick={attachDemoFile}
              className="text-[12px] text-[var(--neutral-sub-600)] underline-offset-2 hover:text-[var(--neutral-strong-950)] hover:underline focus-visible:shadow-none"
            >
              Attach a file
            </button>
          </div>
          <Button
            type="button"
            variant="primary"
            size="sm"
            aria-label={sending ? 'Sending' : 'Send'}
            leadingIcon={<ArrowUp size={14} strokeWidth={2.5} />}
            onClick={() => void submit()}
            disabled={!canSend || sending}
            className="ml-auto size-8 !h-8 !w-8 rounded-full !px-0"
          />
        </div>
      </div>
    </div>
  );
}
