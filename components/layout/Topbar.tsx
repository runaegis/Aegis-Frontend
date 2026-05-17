'use client';

import { useState } from 'react';
import { RefreshCw } from 'lucide-react';
import type { DateRange } from 'react-day-picker';
import { DateRangePicker } from '@/components/ui/DateRangePicker';
import { CommandPaletteTrigger } from '@/components/ui/CommandPaletteTrigger';
import { UserMenu } from '@/components/ui/UserMenu';
import { NotificationsPanel } from '@/components/ui/NotificationsPanel';

interface TopbarProps {
  title: string;
  subtitle?: string;
  lastUpdated?: Date;
  onRefresh?: () => void;
  /** When true, the date filter and notification bell are hidden (useful for setting pages). */
  minimal?: boolean;
  /** Optional unread notification count — when > 0, a dot appears on the bell. */
  unreadCount?: number;
}

function formatRelative(d: Date) {
  const sec = Math.floor((Date.now() - d.getTime()) / 1000);
  if (sec < 5) return 'just now';
  if (sec < 60) return `${sec}s ago`;
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
  return `${Math.floor(sec / 3600)}h ago`;
}

export default function Topbar({
  title,
  subtitle,
  lastUpdated,
  onRefresh,
  minimal = false,
  unreadCount = 0,
}: TopbarProps) {
  const [range, setRange] = useState<DateRange | undefined>(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const start = new Date(today);
    start.setDate(start.getDate() - 6);
    return { from: start, to: today };
  });

  return (
    // Mobile: the Sidebar renders a 48px top bar with the hamburger.
    // The Topbar sticks BELOW it (top-12). On lg+, the sidebar moves to
    // the side and there's no mobile bar — Topbar sticks at top-0.
    <header className="sticky top-12 z-20 flex h-[56px] items-center justify-between border-b border-[var(--stroke-soft-200)] bg-white px-4 sm:px-6 lg:top-0">
      {/* Left — title + subtitle */}
      <div className="flex min-w-0 items-center">
        <h1 className="truncate text-[14px] font-semibold tracking-[-0.02em] text-[var(--neutral-strong-950)]">
          {title}
        </h1>
        {subtitle && (
          <>
            {/* Divider + subtitle hide on small screens — keeps the title
                visible on mobile without clipping. */}
            <span
              className="mx-[10px] hidden h-[14px] w-px bg-[var(--stroke-soft-200)] sm:inline-block"
              aria-hidden
            />
            <p className="hidden truncate text-[12.5px] text-[var(--neutral-soft-400)] sm:block">
              {subtitle}
            </p>
          </>
        )}
      </div>

      {/* Right — controls */}
      <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
        {/* Command palette entry point. Placed first in the right
            cluster so the search-bar look reads as the primary
            navigation affordance — visually answers the "where do
            I search?" question new users arrive with. Click opens
            the palette via a custom event; ⌘K / Ctrl K also still
            works (see CommandPalette's keydown listener). */}
        <CommandPaletteTrigger />

        {/* Date filter — hidden on mobile (limited horizontal room); reappears at sm */}
        {!minimal && (
          <div className="hidden sm:inline-flex">
            <DateRangePicker
              value={range}
              onChange={setRange}
              defaultPreset="last7"
              size="sm"
            />
          </div>
        )}

        {onRefresh && (
          <button
            type="button"
            onClick={onRefresh}
            className="flex h-7 items-center gap-1.5 rounded-lg border border-[var(--stroke-sub-300)] bg-white px-2 text-[12px] font-medium text-[var(--neutral-sub-600)] hover:bg-[var(--neutral-weak-50)] sm:px-2.5"
            title={lastUpdated ? `Updated ${formatRelative(lastUpdated)}` : 'Refresh'}
            aria-label="Refresh"
          >
            <RefreshCw className="h-3.5 w-3.5" strokeWidth={2} />
            <span className="hidden md:inline">
              {lastUpdated ? formatRelative(lastUpdated) : 'Refresh'}
            </span>
          </button>
        )}

        {!minimal && <NotificationsPanel unreadCount={unreadCount} />}

        <UserMenu pendingApprovals={unreadCount} />
      </div>
    </header>
  );
}
