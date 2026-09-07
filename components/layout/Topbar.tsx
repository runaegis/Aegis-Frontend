'use client';

import { useEffect, useRef, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import type { DateRange } from 'react-day-picker';
import { cn } from '@/lib/utils';
import { getDefaultDashboardDateRange } from '@/lib/dashboardDateRange';
import { DateRangePicker } from '@/components/ui/DateRangePicker';
import { UserMenu } from '@/components/ui/UserMenu';

interface TopbarProps {
  title: string;
  /** Optional leading breadcrumb crumb. Defaults to "Aegis". */
  crumb?: string;
  subtitle?: string;
  lastUpdated?: Date;
  onRefresh?: () => void;
  /** When true, the notification bell is hidden (useful for settings pages). */
  minimal?: boolean;
  /** Optional pending approval count surfaced in the user menu quick stat. */
  pendingApprovalsCount?: number;
  /**
   * Render the date-range picker. Default false. Opt in only on pages
   * where time-windowed data is the primary surface (Dashboard, Runs,
   * Sessions, Analytics). Configuration pages (Policies,
   * Rooms, Connectors, Settings, Freeze) hide it because there's no
   * time-bound data to filter.
   */
  showDateRange?: boolean;
  /** Controlled value for pages that wire the picker into real filtering. */
  dateRangeValue?: DateRange | undefined;
  /** Controlled change handler paired with `dateRangeValue`. */
  onDateRangeChange?: (range: DateRange | undefined) => void;
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
  crumb = 'Aegis',
  lastUpdated,
  onRefresh,
  pendingApprovalsCount = 0,
  showDateRange = false,
  dateRangeValue,
  onDateRangeChange,
}: TopbarProps) {
  // Local fallback state so existing pages can keep rendering the picker
  // without opting into shared filtering yet.
  const [localRange, setLocalRange] = useState<DateRange | undefined>(() =>
    getDefaultDashboardDateRange(),
  );
  const range = dateRangeValue ?? localRange;
  const handleDateRangeChange = (next: DateRange | undefined) => {
    if (onDateRangeChange) {
      onDateRangeChange(next);
      return;
    }
    setLocalRange(next);
  };

  // Refresh in-flight state. We track it locally so the icon can
  // spin even when the caller's onRefresh isn't awaitable from here.
  // Two sources signal that a refresh is happening:
  //   1. The user just clicked → set `refreshing` true, await the
  //      promise if onRefresh returns one, else flip back after a
  //      short min-duration so the user perceives the click as
  //      doing something.
  //   2. `lastUpdated` changes — flip refreshing false when the
  //      caller signals fresh data has landed.
  const [refreshing, setRefreshing] = useState(false);
  const minSpinTimerRef = useRef<number | null>(null);

  // When `lastUpdated` ticks forward (caller produced new data),
  // clear the spinner. Guarded by the min-spin timer so a too-fast
  // refresh still spins for a perceptible beat.
  const lastUpdatedRef = useRef<Date | undefined>(lastUpdated);
  useEffect(() => {
    if (lastUpdated && lastUpdated !== lastUpdatedRef.current) {
      lastUpdatedRef.current = lastUpdated;
      // Only stop if no min-spin timer is queued.
      if (!minSpinTimerRef.current) {
        const timer = window.setTimeout(() => {
          setRefreshing(false);
        }, 0);
        return () => window.clearTimeout(timer);
      }
    }
  }, [lastUpdated]);

  // Cleanup any pending timer on unmount.
  useEffect(() => {
    return () => {
      if (minSpinTimerRef.current) {
        window.clearTimeout(minSpinTimerRef.current);
      }
    };
  }, []);

  const handleRefreshClick = async () => {
    if (!onRefresh || refreshing) return;
    setRefreshing(true);
    // Min-spin floor: 500ms. Stops the UI feeling "did anything
    // happen?" on instantaneous refreshes (e.g. cached data).
    minSpinTimerRef.current = window.setTimeout(() => {
      minSpinTimerRef.current = null;
      // If the caller already finished + lastUpdated has changed,
      // turn off now. Otherwise wait for the next lastUpdated tick.
      if (lastUpdatedRef.current !== lastUpdated) {
        setRefreshing(false);
      }
    }, 500);
    try {
      // onRefresh may be sync or async. Awaiting a non-promise is
      // safe (resolves immediately).
      await Promise.resolve(onRefresh());
    } catch {
      // Errors are the caller's concern (they'll typically toast).
      // Just make sure we don't get stuck in refreshing state.
      setRefreshing(false);
    }
  };

  return (
    // Mobile: the Sidebar renders a 48px top bar with the hamburger.
    // The Topbar sticks BELOW it (top-12). On lg+, the sidebar moves to
    // the side and there's no mobile bar — Topbar sticks at top-0.
    <header className="sticky top-12 z-20 flex h-[56px] items-center justify-between border-b border-[var(--stroke-soft-200)] bg-[var(--bg-surface)] px-4 sm:px-6 lg:top-0">
      {/* Left — breadcrumb: "Aegis · Workspaces" */}
      <div className="flex min-w-0 items-center text-[14px] tracking-[-0.02em]">
        <span className="truncate font-medium text-[var(--neutral-soft-400)]">
          {crumb}
        </span>
        <span
          className="mx-[7px] text-[var(--neutral-soft-400)]"
          aria-hidden
        >
          ·
        </span>
        <h1 className="truncate font-semibold text-[var(--neutral-strong-950)]">
          {title}
        </h1>
      </div>

      {/* Right — page-specific controls + account. Search and the
          notification bell were dropped from this chrome; ⌘K still
          opens the command palette. */}
      <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
        {/* Date filter — opt-in per page. Only renders when the page
            actually surfaces time-windowed data (Dashboard, Runs,
            Sessions, Token Spend). Hidden on mobile regardless
            (limited horizontal room); reappears at sm. */}
        {showDateRange && (
          <div className="hidden sm:inline-flex">
            <DateRangePicker
              value={range}
              onChange={handleDateRangeChange}
              defaultPreset="ytd"
              size="sm"
            />
          </div>
        )}

        {onRefresh && (
          <button
            type="button"
            onClick={handleRefreshClick}
            disabled={refreshing}
            className={cn(
              'flex h-7 items-center gap-1.5 rounded-lg border border-[var(--stroke-sub-300)] bg-white px-2 text-[12px] font-medium text-[var(--neutral-sub-600)] sm:px-2.5',
              'transition-colors hover:bg-[var(--neutral-weak-50)]',
              'shadow-[var(--shadow-regular-xs)]',
              // Subtle visual signal while refreshing: muted text +
              // disabled cursor (no double-clicks). The spin on the
              // icon itself does the bulk of the "something is
              // happening" communication.
              refreshing && 'cursor-wait text-[var(--neutral-soft-400)]',
            )}
            title={
              refreshing
                ? 'Refreshing…'
                : lastUpdated
                ? `Updated ${formatRelative(lastUpdated)}`
                : 'Refresh'
            }
            aria-label={refreshing ? 'Refreshing' : 'Refresh'}
            aria-busy={refreshing}
          >
            <RefreshCw
              className={cn(
                'h-3.5 w-3.5 transition-transform',
                refreshing && 'animate-spin',
              )}
              strokeWidth={2}
              aria-hidden
            />
            <span className="hidden md:inline">
              {refreshing
                ? 'Refreshing…'
                : lastUpdated
                ? formatRelative(lastUpdated)
                : 'Refresh'}
            </span>
          </button>
        )}

        <UserMenu pendingApprovals={pendingApprovalsCount} />
      </div>
    </header>
  );
}
