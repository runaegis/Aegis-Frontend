'use client';

/**
 * Command Palette — ⌘K modal for fast navigation + quick actions.
 *
 * Standard developer-tool affordance (Linear, Cursor, Raycast, Vercel,
 * Stripe Dashboard all ship this). For Aegis it covers:
 *   • Quick nav to any dashboard route
 *   • Toggle dark/light theme
 *   • Toggle sidebar collapsed/expanded
 *   • Sign out
 *   • External links (docs, support)
 *
 * Activation: ⌘K (mac) / Ctrl+K (windows/linux). Also ⌘\ already
 * collapses the sidebar — these are independent and stack fine.
 *
 * Architecture: zero backend touch. Uses Next.js router for nav,
 * existing ThemeToggle's localStorage write for theme, the existing
 * sidebar attribute system for collapse. Search is in-memory fuzzy
 * match across a static command list.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import {
  Activity,
  ArrowRight,
  Bell,
  BookOpen,
  Clock,
  Coins,
  ExternalLink,
  FileText,
  HelpCircle,
  LayoutDashboard,
  Layers,
  LogOut,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  Plug,
  Search,
  Settings,
  Sun,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface Command {
  id: string;
  label: string;
  hint?: string;
  icon: LucideIcon;
  /** Tokens that should match the search query (label + synonyms). */
  keywords: string[];
  /** Visual group in the palette. */
  group: 'Navigate' | 'Actions' | 'External';
  /** Runs when the user picks this command. */
  perform: () => void | Promise<void>;
}

const EASE_EMPH: [number, number, number, number] = [0.2, 0.8, 0.2, 1];

export function CommandPalette() {
  const router = useRouter();
  const pathname = usePathname();
  const reduce = useReducedMotion();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Theme + sidebar state are read on every open so the action label
  // ("Switch to dark" vs "Switch to light") reflects the current
  // state. Cheap — only runs on modal open.
  const getTheme = (): 'light' | 'dark' =>
    typeof document !== 'undefined' &&
    document.documentElement.dataset.theme === 'dark'
      ? 'dark'
      : 'light';
  const getCollapsed = (): boolean =>
    typeof document !== 'undefined' &&
    document.documentElement.dataset.sidebarCollapsed === 'true';

  // ⌘K / Ctrl+K to open. ⌘\ is already used by the sidebar toggle in
  // Sidebar.tsx — these don't conflict.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((v) => !v);
      } else if (e.key === 'Escape' && open) {
        e.preventDefault();
        setOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  // Reset query + focus the input on each open.
  useEffect(() => {
    if (open) {
      setQuery('');
      setActiveIndex(0);
      const id = window.setTimeout(() => inputRef.current?.focus(), 30);
      return () => window.clearTimeout(id);
    }
  }, [open]);

  // Close + navigate helper used by Navigate-group commands.
  const goto = useCallback(
    (href: string) => {
      setOpen(false);
      router.push(href);
    },
    [router],
  );

  const commands: Command[] = useMemo(() => {
    const isCurrent = (href: string) =>
      href === '/dashboard'
        ? pathname === '/dashboard'
        : pathname === href || pathname.startsWith(`${href}/`);

    const navItems: Array<{
      label: string;
      href: string;
      icon: LucideIcon;
      keywords: string[];
    }> = [
      { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, keywords: ['home', 'overview'] },
      { label: 'Runs', href: '/dashboard/runs', icon: Activity, keywords: ['actions', 'history', 'log'] },
      { label: 'Sessions', href: '/dashboard/sessions', icon: Layers, keywords: ['conversations', 'agents'] },
      { label: 'Rooms', href: '/dashboard/rooms', icon: Users, keywords: ['workspaces', 'teams'] },
      { label: 'Approvals', href: '/dashboard/approvals', icon: Bell, keywords: ['pending', 'review'] },
      { label: 'Policies', href: '/dashboard/policies', icon: BookOpen, keywords: ['rules', 'governance'] },
      { label: 'Audit Trail', href: '/dashboard/audit', icon: FileText, keywords: ['events', 'log', 'history'] },
      { label: 'Freeze Windows', href: '/dashboard/freeze-window', icon: Clock, keywords: ['schedule', 'pause'] },
      { label: 'Token Spenditure', href: '/dashboard/token-spenditure', icon: Coins, keywords: ['usage', 'cost', 'billing'] },
      { label: 'Integrations', href: '/dashboard/integrations', icon: Plug, keywords: ['cursor', 'vscode', 'claude code', 'mcp', 'connect'] },
      { label: 'Settings', href: '/dashboard/settings', icon: Settings, keywords: ['account', 'preferences'] },
    ];

    const navCommands: Command[] = navItems.map((item) => ({
      id: `nav-${item.href}`,
      label: item.label,
      hint: isCurrent(item.href) ? 'Current page' : undefined,
      icon: item.icon,
      keywords: [item.label.toLowerCase(), ...item.keywords],
      group: 'Navigate' as const,
      perform: () => goto(item.href),
    }));

    const isDark = getTheme() === 'dark';
    const isCollapsed = getCollapsed();

    const actionCommands: Command[] = [
      {
        id: 'toggle-theme',
        label: isDark ? 'Switch to light mode' : 'Switch to dark mode',
        icon: isDark ? Sun : Moon,
        keywords: ['theme', 'dark', 'light', 'mode', 'appearance'],
        group: 'Actions' as const,
        perform: () => {
          if (isDark) {
            delete document.documentElement.dataset.theme;
            localStorage.removeItem('aegis_theme');
          } else {
            document.documentElement.dataset.theme = 'dark';
            localStorage.setItem('aegis_theme', 'dark');
          }
          setOpen(false);
        },
      },
      {
        id: 'toggle-sidebar',
        label: isCollapsed ? 'Expand sidebar' : 'Collapse sidebar',
        hint: '⌘\\',
        icon: isCollapsed ? PanelLeftOpen : PanelLeftClose,
        keywords: ['sidebar', 'collapse', 'expand', 'nav'],
        group: 'Actions' as const,
        perform: () => {
          if (isCollapsed) {
            delete document.documentElement.dataset.sidebarCollapsed;
            localStorage.removeItem('aegis_sidebar_collapsed');
          } else {
            document.documentElement.dataset.sidebarCollapsed = 'true';
            localStorage.setItem('aegis_sidebar_collapsed', 'true');
          }
          setOpen(false);
        },
      },
      {
        id: 'sign-out',
        label: 'Sign out',
        icon: LogOut,
        keywords: ['logout', 'log out', 'exit'],
        group: 'Actions' as const,
        perform: () => {
          setOpen(false);
          localStorage.removeItem('access_token');
          localStorage.removeItem('refresh_token');
          window.location.href = '/auth';
        },
      },
    ];

    const externalCommands: Command[] = [
      {
        id: 'docs',
        label: 'Documentation',
        icon: BookOpen,
        keywords: ['docs', 'help', 'guide'],
        group: 'External' as const,
        perform: () => {
          setOpen(false);
          window.open('https://docs.runaegis.com', '_blank', 'noopener');
        },
      },
      {
        id: 'support',
        label: 'Contact support',
        icon: HelpCircle,
        keywords: ['help', 'email', 'contact'],
        group: 'External' as const,
        perform: () => {
          setOpen(false);
          window.location.href = 'mailto:support@runaegis.com';
        },
      },
    ];

    return [...navCommands, ...actionCommands, ...externalCommands];
  }, [goto, pathname, open]); // re-read on open via the `open` dep so action labels reflect current state

  // Fuzzy-ish match: split query into tokens, every token must hit
  // either the label or a keyword. Simple, fast, no library needed.
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return commands;
    const tokens = q.split(/\s+/);
    return commands.filter((cmd) => {
      const haystack = [cmd.label, ...cmd.keywords].join(' ').toLowerCase();
      return tokens.every((t) => haystack.includes(t));
    });
  }, [commands, query]);

  // Group for visual sectioning. Order is the order we want sections
  // to appear in the list.
  const grouped = useMemo(() => {
    const groups: Array<{ name: Command['group']; items: Command[] }> = [
      { name: 'Navigate', items: [] },
      { name: 'Actions', items: [] },
      { name: 'External', items: [] },
    ];
    for (const cmd of filtered) {
      groups.find((g) => g.name === cmd.group)?.items.push(cmd);
    }
    return groups.filter((g) => g.items.length > 0);
  }, [filtered]);

  // Flat list (in display order) for keyboard navigation.
  const flat = useMemo(
    () => grouped.flatMap((g) => g.items),
    [grouped],
  );

  // Clamp the active cursor when results shrink.
  useEffect(() => {
    if (activeIndex >= flat.length) setActiveIndex(Math.max(0, flat.length - 1));
  }, [flat.length, activeIndex]);

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, flat.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      flat[activeIndex]?.perform();
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="fixed inset-0 z-[80] bg-black/40 backdrop-blur-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.14, ease: EASE_EMPH }}
            onClick={() => setOpen(false)}
          />
          <div className="fixed inset-0 z-[81] flex items-start justify-center px-4 pt-[12vh]">
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-label="Command palette"
              className="pointer-events-auto w-full max-w-[560px] overflow-hidden rounded-[14px] border border-[var(--stroke-soft-200)] bg-[var(--white-0)] shadow-[0_24px_64px_rgba(0,0,0,0.22),0_4px_12px_rgba(0,0,0,0.08)]"
              initial={
                reduce ? { opacity: 0 } : { opacity: 0, scale: 0.97, y: 8 }
              }
              animate={
                reduce ? { opacity: 1 } : { opacity: 1, scale: 1, y: 0 }
              }
              exit={
                reduce
                  ? { opacity: 0 }
                  : { opacity: 0, scale: 0.97, y: 4, transition: { duration: 0.12 } }
              }
              transition={{ duration: 0.16, ease: EASE_EMPH }}
            >
              {/* Search input */}
              <div className="flex h-12 items-center gap-2.5 border-b border-[var(--stroke-soft-200)] px-4">
                <Search
                  className="h-4 w-4 shrink-0 text-[var(--neutral-soft-400)]"
                  strokeWidth={2}
                />
                <input
                  ref={inputRef}
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={onKeyDown}
                  placeholder="Type a command or search…"
                  className="h-full flex-1 border-0 bg-transparent text-[13.5px] text-[var(--neutral-strong-950)] placeholder:text-[var(--neutral-soft-400)] focus:outline-none focus:ring-0"
                  autoComplete="off"
                  spellCheck={false}
                />
                <kbd className="hidden rounded-[5px] border border-[var(--stroke-soft-200)] bg-[var(--neutral-weak-50)] px-1.5 py-0.5 font-mono text-[10px] text-[var(--neutral-sub-600)] sm:inline-block">
                  esc
                </kbd>
              </div>

              {/* Results */}
              <div className="max-h-[400px] overflow-y-auto p-2">
                {grouped.length === 0 ? (
                  <div className="px-3 py-8 text-center text-[12.5px] text-[var(--neutral-soft-400)]">
                    No commands match &quot;{query}&quot;.
                  </div>
                ) : (
                  grouped.map((group, gi) => {
                    let runningIndex = 0;
                    for (let i = 0; i < gi; i++) {
                      runningIndex += grouped[i].items.length;
                    }
                    return (
                      <div key={group.name} className="mb-1 last:mb-0">
                        <div className="px-2 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--neutral-soft-400)]">
                          {group.name}
                        </div>
                        {group.items.map((cmd, i) => {
                          const flatIdx = runningIndex + i;
                          const isActive = flatIdx === activeIndex;
                          const Icon = cmd.icon;
                          return (
                            <button
                              type="button"
                              key={cmd.id}
                              onMouseEnter={() => setActiveIndex(flatIdx)}
                              onClick={() => cmd.perform()}
                              className={cn(
                                'group flex w-full items-center gap-2.5 rounded-[7px] px-2 py-2 text-left text-[13px] font-medium tracking-[-0.005em] transition-colors',
                                isActive
                                  ? 'bg-[var(--neutral-weak-50)] text-[var(--neutral-strong-950)]'
                                  : 'text-[var(--neutral-sub-600)]',
                              )}
                            >
                              <Icon
                                className={cn(
                                  'h-3.5 w-3.5 shrink-0',
                                  isActive
                                    ? 'text-[var(--neutral-strong-950)]'
                                    : 'text-[var(--neutral-soft-400)]',
                                )}
                                strokeWidth={2}
                              />
                              <span className="flex-1 truncate">{cmd.label}</span>
                              {cmd.hint && (
                                <span className="text-[11px] text-[var(--neutral-soft-400)]">
                                  {cmd.hint}
                                </span>
                              )}
                              {isActive && (
                                <ArrowRight
                                  className="h-3 w-3 shrink-0 text-[var(--neutral-soft-400)]"
                                  strokeWidth={2}
                                />
                              )}
                            </button>
                          );
                        })}
                      </div>
                    );
                  })
                )}
              </div>

              {/* Footer hint row */}
              <div className="flex items-center justify-between border-t border-[var(--stroke-soft-200)] bg-[var(--neutral-weak-50)] px-3 py-2 text-[10.5px] text-[var(--neutral-soft-400)]">
                <div className="flex items-center gap-3">
                  <span className="inline-flex items-center gap-1">
                    <kbd className="rounded border border-[var(--stroke-soft-200)] bg-[var(--white-0)] px-1 font-mono text-[10px]">
                      ↑
                    </kbd>
                    <kbd className="rounded border border-[var(--stroke-soft-200)] bg-[var(--white-0)] px-1 font-mono text-[10px]">
                      ↓
                    </kbd>
                    navigate
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <kbd className="rounded border border-[var(--stroke-soft-200)] bg-[var(--white-0)] px-1 font-mono text-[10px]">
                      ⏎
                    </kbd>
                    select
                  </span>
                </div>
                <span className="inline-flex items-center gap-1">
                  <kbd className="rounded border border-[var(--stroke-soft-200)] bg-[var(--white-0)] px-1 font-mono text-[10px]">
                    ⌘K
                  </kbd>
                  toggle
                </span>
              </div>
            </motion.div>
          </div>
          {/* Suppress unused-import warning until we surface external icons */}
          <span className="hidden">
            <ExternalLink />
          </span>
        </>
      )}
    </AnimatePresence>
  );
}
