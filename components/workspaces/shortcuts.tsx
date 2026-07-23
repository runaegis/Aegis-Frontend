'use client';

/**
 * Keyboard layer for the workspace room.
 *
 * Single-key actions are what make a tool feel fast, but they are only
 * safe if they never fire while someone is typing. Every binding is
 * suppressed inside inputs, textareas, selects, and contenteditable
 * regions, and while any modal is open.
 */

import { useEffect, type ReactNode } from 'react';
import { Dialog } from './Dialog';

export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="inline-flex h-[17px] min-w-[17px] items-center justify-center rounded-[4px] border border-[var(--stroke-soft-200)] bg-[var(--bg-surface-alt)] px-1 font-mono text-[10px] leading-none text-[var(--neutral-sub-600)]">
      {children}
    </kbd>
  );
}

function isTypingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return (
    tag === 'INPUT' ||
    tag === 'TEXTAREA' ||
    tag === 'SELECT' ||
    target.isContentEditable ||
    target.closest('[role="dialog"]') !== null
  );
}

export type WorkspaceShortcutHandlers = {
  focusComposer: () => void;
  newTask: () => void;
  inviteAgent: () => void;
  toggleHelp: () => void;
  closeOverlays: () => void;
};

export function useWorkspaceShortcuts(handlers: WorkspaceShortcutHandlers, enabled = true) {
  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      // Escape is the one binding that must work from inside a field.
      if (e.key === 'Escape') {
        handlers.closeOverlays();
        return;
      }
      if (isTypingTarget(e.target)) return;

      // Shift+/ reports as `?` on some layouts and `/` with shiftKey on
      // others, so test the modifier rather than trusting the key alone.
      if (e.key === '?' || (e.key === '/' && e.shiftKey)) {
        e.preventDefault();
        handlers.toggleHelp();
        return;
      }

      switch (e.key) {
        case '/':
        case 'c':
          e.preventDefault();
          handlers.focusComposer();
          break;
        case 't':
          e.preventDefault();
          handlers.newTask();
          break;
        case 'i':
          e.preventDefault();
          handlers.inviteAgent();
          break;
        default:
          break;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handlers, enabled]);
}

const SHORTCUTS: Array<{ group: string; items: Array<{ keys: string[]; label: string }> }> = [
  {
    group: 'Conversation',
    items: [
      { keys: ['/'], label: 'Focus the composer' },
      { keys: ['c'], label: 'Compose a message' },
      { keys: ['@'], label: 'Mention an agent while typing' },
      { keys: ['↵'], label: 'Send' },
      { keys: ['⇧', '↵'], label: 'New line' },
    ],
  },
  {
    group: 'Workspace',
    items: [
      { keys: ['t'], label: 'Add a task' },
      { keys: ['i'], label: 'Invite an agent' },
      { keys: ['esc'], label: 'Close panel or dialog' },
    ],
  },
  {
    group: 'Help',
    items: [{ keys: ['?'], label: 'Show this list' }],
  },
];

export function ShortcutsDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Keyboard shortcuts"
      description="Single-key actions work whenever you are not typing in a field."
      width={440}
    >
      <div className="space-y-4 pb-1">
        {SHORTCUTS.map((section) => (
          <div key={section.group}>
            <p className="mb-1.5 text-[10.5px] font-medium uppercase tracking-[0.05em] text-[var(--neutral-soft-400)]">
              {section.group}
            </p>
            <div className="space-y-1">
              {section.items.map((item) => (
                <div
                  key={item.label}
                  className="flex items-center justify-between gap-4 rounded-md px-1 py-1 text-[12.5px] text-[var(--neutral-strong-950)]"
                >
                  <span>{item.label}</span>
                  <span className="flex shrink-0 items-center gap-1">
                    {item.keys.map((k) => (
                      <Kbd key={k}>{k}</Kbd>
                    ))}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </Dialog>
  );
}
