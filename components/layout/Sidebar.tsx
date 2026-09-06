'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Activity,
  FileText,
  Clock,
  Coins,
  Boxes,
  Settings,
  Menu,
  X,
  PanelLeftClose,
  PanelLeftOpen,
  BrainCircuit,
  ScrollText,
  MessagesSquare,
  Inbox,
  type LucideIcon,
} from 'lucide-react';
import { api } from '@/lib/api';
import { AegisLogo } from '@/components/ui/AegisLogo';
import { WorkspaceSwitcher } from '@/components/ui/WorkspaceSwitcher';

/**
 * Sidebar collapse state.
 *
 * State lives on `document.documentElement.dataset.sidebarCollapsed` —
 * NOT in React state. This pattern (mirrored from dark mode) gives us:
 *   • Pure-CSS animation driven by `--sidebar-w` var
 *   • Zero re-renders when toggling
 *   • FOUC-prevention via inline <head> script (app/layout.tsx)
 *   • Single source of truth visible in DevTools
 *
 * The hook below just syncs a local `useState` for icon rotation /
 * conditional rendering; the actual collapse state is the DOM attribute.
 */
function useSidebarCollapsed() {
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    setCollapsed(document.documentElement.dataset.sidebarCollapsed === 'true');
  }, []);

  const toggle = useCallback(() => {
    const next = document.documentElement.dataset.sidebarCollapsed !== 'true';
    if (next) {
      document.documentElement.dataset.sidebarCollapsed = 'true';
      localStorage.setItem('aegis_sidebar_collapsed', 'true');
    } else {
      delete document.documentElement.dataset.sidebarCollapsed;
      localStorage.removeItem('aegis_sidebar_collapsed');
    }
    setCollapsed(next);
  }, []);

  // Cmd+\ (Ctrl+\ on Windows/Linux) — standard sidebar-toggle shortcut
  // in Linear, Cursor, Notion, VS Code. Listening on window keeps it
  // global; no preventDefault needed since browsers don't bind \.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === '\\') {
        e.preventDefault();
        toggle();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [toggle]);

  return { collapsed, toggle };
}

type NavItem = {
  name: string;
  href: string;
  icon: LucideIcon;
  badge?: { value: number | string; tone: 'urgent' | 'neutral' };
};

type NavGroup = {
  label: string;
  items: NavItem[];
};

function buildNavGroups(inboxCount: number): NavGroup[] {
  return [
    {
      label: 'Work',
      items: [
        {
          name: 'Inbox',
          href: '/dashboard/inbox',
          icon: Inbox,
          badge:
            inboxCount > 0 ? { value: inboxCount, tone: 'urgent' } : undefined,
        },
        { name: 'Workspaces', href: '/dashboard/workspaces', icon: MessagesSquare },
      ],
    },
    {
      label: 'Understand',
      items: [
        { name: 'Runs', href: '/dashboard/runs', icon: Activity },
        { name: 'Usage', href: '/dashboard/token-spenditure', icon: Coins },
        { name: 'Audit', href: '/dashboard/audit', icon: FileText },
      ],
    },
    {
      label: 'Library',
      items: [
        { name: 'Memory', href: '/dashboard/memory', icon: BrainCircuit },
        { name: 'Prompts', href: '/dashboard/prompts', icon: ScrollText },
      ],
    },
    {
      label: 'Set up',
      items: [
        { name: 'Connectors', href: '/dashboard/connectors', icon: Boxes },
        { name: 'Freeze Windows', href: '/dashboard/freeze-window', icon: Clock },
        { name: 'Settings', href: '/dashboard/settings', icon: Settings },
      ],
    },
  ];
}

export default function Sidebar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [inboxCount, setInboxCount] = useState(0);
  const { collapsed, toggle } = useSidebarCollapsed();

  useEffect(() => {
    let cancelled = false;
    api
      .getWorkspaceInviteInbox()
      .then((invites) => {
        if (cancelled) return;
        setInboxCount(invites.filter((invite) => invite.status === 'pending').length);
      })
      .catch(() => {
        if (!cancelled) setInboxCount(0);
      });
    return () => {
      cancelled = true;
    };
  }, [pathname]);

  const isActive = (href: string) => {
    if (href === '/dashboard/workspaces') {
      return (
        pathname === href ||
        pathname.startsWith(`${href}/`) ||
        (pathname.startsWith('/workspaces/') && !pathname.startsWith('/workspaces/join/'))
      );
    }
    if (href === '/dashboard') return pathname === '/dashboard';
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  // Nav-row link. `data-sidebar-center` is consumed by globals.css
  // to center the icon when the rail collapses. The label span is
  // marked `data-sidebar-hide` so it disappears with the rail. Badge
  // follows the same pattern; numeric value collapses to a small dot
  // indicator when minimized so urgent state remains visible at a
  // glance.
  const renderNavLink = (item: NavItem) => {
    const active = isActive(item.href);
    const Icon = item.icon;
    return (
      <Link
        key={item.href}
        href={item.href}
        onClick={() => setMobileOpen(false)}
        data-sidebar-center
        className={[
          'group relative flex h-8 items-center gap-2 rounded-[7px] px-2 text-[13px] font-medium tracking-[-0.01em]',
          'transition-colors duration-200 ease-[cubic-bezier(0.2,0.8,0.2,1)]',
          active
            ? 'bg-[var(--neutral-weak-50)] text-[var(--neutral-strong-950)]'
            : 'text-[var(--neutral-sub-600)] hover:bg-[var(--neutral-weak-50)] hover:text-[var(--neutral-strong-950)]',
        ].join(' ')}
      >
        <Icon
          className="h-3.5 w-3.5 shrink-0"
          strokeWidth={active ? 2.25 : 2}
        />
        <span className="flex-1 truncate" data-sidebar-hide>{item.name}</span>
        {item.badge && (
          <span
            data-sidebar-hide
            className={[
              'inline-flex h-[17px] min-w-[17px] items-center justify-center rounded-[5px] px-[5px] text-[10.5px] font-bold tabular-nums',
              item.badge.tone === 'urgent'
                ? 'bg-[var(--error)] text-white'
                : 'bg-[var(--neutral-soft-200)] text-[var(--neutral-sub-600)]',
            ].join(' ')}
          >
            {item.badge.value}
          </span>
        )}
        {item.badge && collapsed && (
          <span
            aria-hidden
            className="absolute right-1.5 top-1.5 h-[6px] w-[6px] rounded-full"
            style={{
              backgroundColor:
                item.badge.tone === 'urgent'
                  ? 'var(--error)'
                  : 'var(--neutral-sub-600)',
            }}
          />
        )}
      </Link>
    );
  };

  const navGroups = buildNavGroups(inboxCount);

  // The `desktop` flag tells NavContent which surface it's rendering
  // into. The mobile drawer always shows the expanded layout (no
  // need to collapse on a phone — the drawer is already off-canvas).
  // Desktop applies all the collapse-aware data attributes.
  const NavContent = ({ desktop = false }: { desktop?: boolean }) => (
    <>
      <div
        data-sidebar-center={desktop ? '' : undefined}
        className="flex h-[56px] items-center justify-between border-b border-[var(--stroke-soft-200)] px-4"
      >
        <Link
          href="/dashboard/workspaces"
          className="inline-flex items-center text-[var(--neutral-strong-950)] transition-opacity hover:opacity-80"
          aria-label="Aegis — Home"
          data-sidebar-hide={desktop ? '' : undefined}
        >
          <AegisLogo style={{ height: 22, width: 'auto' }} />
        </Link>
        {desktop ? (
          <button
            onClick={toggle}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[7px] text-[var(--neutral-sub-600)] transition-colors duration-200 ease-[cubic-bezier(0.2,0.8,0.2,1)] hover:bg-[var(--neutral-weak-50)] hover:text-[var(--neutral-strong-950)]"
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            title={collapsed ? 'Expand sidebar (⌘\\)' : 'Collapse sidebar (⌘\\)'}
          >
            {collapsed ? (
              <PanelLeftOpen className="h-4 w-4" strokeWidth={2} />
            ) : (
              <PanelLeftClose className="h-4 w-4" strokeWidth={2} />
            )}
          </button>
        ) : (
          <button
            className="text-[var(--neutral-soft-400)] hover:text-[var(--neutral-strong-950)] lg:hidden"
            onClick={() => setMobileOpen(false)}
            aria-label="Close menu"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <nav className="flex-1 overflow-x-visible overflow-y-auto px-2 pb-3">
        {navGroups.map((group) => (
          <div key={group.label}>
            <div
              data-sidebar-hide={desktop ? '' : undefined}
              className="px-2 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-[0.07em] text-[var(--neutral-soft-400)]"
            >
              {group.label}
            </div>
            <div className="space-y-0.5">
              {group.items.map((item) => renderNavLink(item))}
            </div>
          </div>
        ))}
      </nav>

      <div className="border-t border-[var(--stroke-soft-200)] px-2 py-[10px]">
        <div
          data-sidebar-center={desktop ? '' : undefined}
          className="w-full"
        >
          <WorkspaceSwitcher />
        </div>
      </div>
    </>
  );

  return (
    <>
      <div className="fixed left-0 right-0 top-0 z-40 flex h-12 items-center justify-between border-b border-[var(--stroke-soft-200)] bg-[var(--bg-surface)] px-4 lg:hidden">
        <Link
          href="/dashboard/workspaces"
          className="inline-flex items-center text-[var(--neutral-strong-950)]"
          aria-label="Aegis — Home"
        >
          <AegisLogo style={{ height: 22, width: 'auto' }} />
        </Link>
        <button
          onClick={() => setMobileOpen(true)}
          className="text-[var(--neutral-soft-400)] hover:text-[var(--neutral-strong-950)]"
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5" />
        </button>
      </div>

      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside
        className={[
          'fixed left-0 top-0 z-50 flex h-dvh w-[220px] flex-col bg-[var(--bg-surface)] transition-transform duration-200 lg:hidden',
          'border-r border-[var(--stroke-soft-200)]',
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
        ].join(' ')}
      >
        <NavContent />
      </aside>

      <aside
        className="fixed left-0 top-0 z-30 hidden h-dvh flex-col border-r border-[var(--stroke-soft-200)] bg-[var(--bg-surface)] lg:flex"
        style={{
          width: 'var(--sidebar-w)',
          transition: 'width var(--sidebar-transition)',
        }}
      >
        <NavContent desktop />
      </aside>
    </>
  );
}
