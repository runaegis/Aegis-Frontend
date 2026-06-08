import type { DateRange } from 'react-day-picker';

export type ActionDateFilters = {
  startDate?: string;
  endDate?: string;
};

function startOfLocalDay(date: Date): Date {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function endOfLocalDay(date: Date): Date {
  const next = new Date(date);
  next.setHours(23, 59, 59, 999);
  return next;
}

function isSameLocalDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function getDefaultDashboardDateRange(now = new Date()): DateRange {
  const to = startOfLocalDay(now);
  const from = new Date(to.getFullYear(), 0, 1);
  return { from, to };
}

export function getActionDateFilters(
  range: DateRange | undefined,
): ActionDateFilters {
  if (!range?.from) return {};

  const from = startOfLocalDay(range.from);
  const to = endOfLocalDay(range.to ?? range.from);

  return {
    startDate: from.toISOString(),
    endDate: to.toISOString(),
  };
}

export function matchesActionDateFilters(
  timestamp: string | null | undefined,
  filters: ActionDateFilters,
): boolean {
  if (!timestamp) return false;

  const value = new Date(timestamp).getTime();
  if (!Number.isFinite(value)) return false;

  if (filters.startDate) {
    const start = new Date(filters.startDate).getTime();
    if (Number.isFinite(start) && value < start) return false;
  }

  if (filters.endDate) {
    const end = new Date(filters.endDate).getTime();
    if (Number.isFinite(end) && value > end) return false;
  }

  return true;
}

export function formatDashboardDateRangeLabel(
  range: DateRange | undefined,
  emptyLabel = 'All time',
): string {
  if (!range?.from) return emptyLabel;

  const from = startOfLocalDay(range.from);
  const to = startOfLocalDay(range.to ?? range.from);

  if (isSameLocalDay(from, to)) {
    return formatDate(from);
  }

  return `${formatDate(from)} - ${formatDate(to)}`;
}
