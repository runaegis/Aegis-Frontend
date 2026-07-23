'use client';

/**
 * Click-to-edit text, in the spirit of editing an issue title or
 * description in Linear: the read state is the layout, and the field
 * appears in place rather than in a modal.
 *
 * Enter commits a single-line field, Escape always reverts, and blur
 * commits so a stray click never silently discards a change.
 */

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

export function InlineEdit({
  value,
  onCommit,
  placeholder,
  multiline = false,
  ariaLabel,
  className,
  readClassName,
  renderRead,
}: {
  value: string;
  onCommit: (next: string) => Promise<void> | void;
  placeholder: string;
  multiline?: boolean;
  ariaLabel: string;
  className?: string;
  readClassName?: string;
  /** Lets the read state render richer content, e.g. mention chips. */
  renderRead?: (value: string) => ReactNode;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);
  const areaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!editing) setDraft(value);
  }, [value, editing]);

  useEffect(() => {
    if (!editing) return;
    const el = multiline ? areaRef.current : inputRef.current;
    el?.focus();
    if (el) el.setSelectionRange(el.value.length, el.value.length);
  }, [editing, multiline]);

  // Grow the textarea to its content while editing.
  useLayoutEffect(() => {
    if (!editing || !multiline) return;
    const el = areaRef.current;
    if (!el) return;
    el.style.height = '0px';
    el.style.height = `${Math.min(Math.max(el.scrollHeight, 40), 220)}px`;
  }, [draft, editing, multiline]);

  const commit = async () => {
    const next = draft.trim();
    setEditing(false);
    if (next === value.trim()) return;
    await onCommit(next);
  };

  const cancel = () => {
    setDraft(value);
    setEditing(false);
  };

  if (!editing) {
    const empty = !value.trim();
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        aria-label={`${ariaLabel}. Click to edit.`}
        className={cn(
          'group/edit -mx-1 rounded px-1 text-left transition-colors hover:bg-[var(--neutral-weak-50)]',
          // `cn` here is a plain join, not tailwind-merge, so width is
          // decided once rather than layered and overridden.
          multiline ? 'block w-full' : 'inline-block max-w-full truncate align-bottom',
          readClassName,
        )}
      >
        {empty ? (
          <span className="text-[var(--neutral-soft-400)]">{placeholder}</span>
        ) : (
          // Only the multiline form preserves newlines; a single-line
          // field must stay on one line so `truncate` can do its job.
          <span className={multiline ? 'whitespace-pre-wrap' : undefined}>
            {renderRead ? renderRead(value) : value}
          </span>
        )}
      </button>
    );
  }

  const shared = cn(
    '-mx-1 w-full rounded border border-[var(--primary-base)] bg-[var(--white-0)] px-1 outline-none',
    'ring-2 ring-[rgba(250,115,25,0.16)]',
    className,
  );

  if (multiline) {
    return (
      <textarea
        ref={areaRef}
        aria-label={ariaLabel}
        value={draft}
        rows={1}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.preventDefault();
            cancel();
          }
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            void commit();
          }
        }}
        className={cn(shared, 'resize-none')}
      />
    );
  }

  return (
    <input
      ref={inputRef}
      aria-label={ariaLabel}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          cancel();
        }
        if (e.key === 'Enter') {
          e.preventDefault();
          void commit();
        }
      }}
      className={shared}
    />
  );
}
