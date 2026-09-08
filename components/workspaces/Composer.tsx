'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowUp, Paperclip, X } from 'lucide-react';
import type { WorkspaceAgent, WorkspaceFileRef, WorkspacePerson } from '@/lib/api';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { GenerativeAvatar } from '@/components/ui/GenerativeAvatar';
import { AgentGlyph, RESERVED_PING_HANDLES } from './agent-visuals';

type MentionState = { start: number; query: string } | null;

type MentionOption =
  | {
      key: string;
      kind: 'person';
      token: string;
      title: string;
      subtitle: string;
      userId: string;
    }
  | {
      key: string;
      kind: 'agent';
      token: string;
      title: string;
      subtitle: string;
    };

/**
 * Single-line composer. Targeting is typed @mention — people and agents
 * are listed separately. `user` and `owner` are reserved ping handles.
 */
export function Composer({
  agents,
  people = [],
  senderId,
  onSend,
  disabled,
  focusSignal = 0,
}: {
  agents: WorkspaceAgent[];
  people?: WorkspacePerson[];
  senderId: string | null;
  onSend: (
    text: string,
    files: WorkspaceFileRef[],
    pingUserIds: string[],
  ) => Promise<void> | void;
  disabled?: boolean;
  /** Bumped by the parent to pull focus here, e.g. from the `/` shortcut. */
  focusSignal?: number;
}) {
  const [value, setValue] = useState('');
  const [files, setFiles] = useState<WorkspaceFileRef[]>([]);
  const [mention, setMention] = useState<MentionState>(null);
  const [highlight, setHighlight] = useState(0);
  const [sending, setSending] = useState(false);
  const [pickedPingIds, setPickedPingIds] = useState<string[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const roster = useMemo(
    () => agents.filter((a) => a.status === 'active'),
    [agents],
  );
  const sender = roster.find((a) => a.id === senderId) ?? roster[0] ?? null;
  const active = useMemo(
    () =>
      roster.filter((a) => !RESERVED_PING_HANDLES.has(a.handle.toLowerCase())),
    [roster],
  );

  const matches = useMemo(() => {
    if (!mention) return [];
    const q = mention.query.toLowerCase();
    const peopleOpts: MentionOption[] = [];
    const seenPeople = new Set<string>();

    const pushPerson = (
      person: WorkspacePerson,
      token: string,
      title: string,
      subtitle: string,
    ) => {
      const key = `person:${token || person.user_id}`;
      if (seenPeople.has(key)) return;
      const haystack = `${token} ${person.name} ${person.email ?? ''}`.toLowerCase();
      if (q && !haystack.includes(q)) return;
      seenPeople.add(key);
      peopleOpts.push({
        key,
        kind: 'person',
        token,
        title,
        subtitle,
        userId: person.user_id,
      });
    };

    const owner = people.find((person) => person.is_owner);
    if (owner) {
      pushPerson(owner, 'owner', owner.name || 'Owner', 'Workspace owner');
    }
    const self =
      people.find((person) => person.user_id === sender?.user_id) ??
      people.find((person) => person.ping_handle === 'user');
    if (self) {
      pushPerson(self, 'user', self.name || 'You', 'You');
    }
    for (const person of people) {
      const handle = person.ping_handle.trim();
      if (!handle || RESERVED_PING_HANDLES.has(handle.toLowerCase())) continue;
      pushPerson(
        person,
        handle,
        person.name || 'Member',
        person.is_owner ? 'Workspace owner' : 'Person',
      );
    }

    const agentOpts: MentionOption[] = active
      .filter((a) => a.handle.toLowerCase().startsWith(q))
      .slice(0, 6)
      .map((a) => ({
        key: `agent:${a.id}`,
        kind: 'agent',
        token: a.handle,
        title: `@${a.handle}`,
        subtitle: a.role_label ?? 'Agent',
      }));

    return [...peopleOpts, ...agentOpts].slice(0, 10);
  }, [mention, active, people, sender?.user_id]);

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

  const replaceMention = (insert: string) => {
    if (!mention) return;
    const before = value.slice(0, mention.start);
    const after = value.slice(mention.start + 1 + mention.query.length);
    const next = `${before}${insert}${after}`;
    setValue(next);
    setMention(null);
    requestAnimationFrame(() => {
      const pos = before.length + insert.length;
      textareaRef.current?.focus();
      textareaRef.current?.setSelectionRange(pos, pos);
    });
  };

  const applyOption = (option: MentionOption) => {
    if (option.kind === 'person') {
      setPickedPingIds((ids) =>
        ids.includes(option.userId) ? ids : [...ids, option.userId],
      );
      if (option.token) {
        replaceMention(`@${option.token} `);
        return;
      }
      replaceMention(`${option.title} `);
      return;
    }
    replaceMention(`@${option.token} `);
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
      await onSend(text, files, pickedPingIds);
      setValue('');
      setFiles([]);
      setMention(null);
      setPickedPingIds([]);
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
        applyOption(matches[highlight]);
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
  const peopleMatches = matches.filter((item) => item.kind === 'person');
  const agentMatches = matches.filter((item) => item.kind === 'agent');

  return (
    <div className="relative border-t border-[var(--stroke-soft-200)] bg-[var(--bg-surface)] px-4 py-3">
      {mention && matches.length > 0 && (
        <div
          role="listbox"
          aria-label="Mention a person or agent"
          className="absolute bottom-[calc(100%-4px)] left-4 z-30 w-[268px] overflow-hidden rounded-lg border border-[var(--stroke-soft-200)] bg-[var(--bg-surface)] py-1 shadow-[0_12px_32px_rgba(0,0,0,0.14)]"
        >
          {peopleMatches.length > 0 && (
            <p className="px-2.5 pb-1 pt-1.5 text-[10.5px] font-medium uppercase tracking-[0.06em] text-[var(--neutral-soft-400)]">
              People
            </p>
          )}
          {matches.map((option, i) => (
            <div key={option.key}>
              {option.kind === 'agent' && i === peopleMatches.length && agentMatches.length > 0 && (
                <p className="px-2.5 pb-1 pt-1.5 text-[10.5px] font-medium uppercase tracking-[0.06em] text-[var(--neutral-soft-400)]">
                  Agents
                </p>
              )}
              <button
                type="button"
                role="option"
                aria-selected={i === highlight}
                onMouseEnter={() => setHighlight(i)}
                onMouseDown={(e) => {
                  e.preventDefault();
                  applyOption(option);
                }}
                className={cn(
                  'flex w-full items-center gap-2 px-2 py-1.5 text-left focus-visible:shadow-none',
                  i === highlight ? 'bg-[var(--neutral-weak-50)]' : 'bg-transparent',
                )}
              >
                {option.kind === 'person' ? (
                  <GenerativeAvatar
                    seed={`person:${option.userId}`}
                    variant="user"
                    size={20}
                    radius={6}
                  />
                ) : (
                  <AgentGlyph handle={option.token} size="sm" />
                )}
                <span className="min-w-0">
                  <span className="block truncate font-mono text-[12.5px] text-[var(--neutral-strong-950)]">
                    {option.kind === 'person' && option.token
                      ? `@${option.token}`
                      : option.title}
                  </span>
                  <span className="block truncate text-[11px] text-[var(--neutral-sub-600)]">
                    {option.kind === 'person' && option.token
                      ? option.title
                      : option.subtitle}
                  </span>
                </span>
              </button>
            </div>
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
