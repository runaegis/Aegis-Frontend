'use client';

/**
 * <RelativeTime> — drop-in replacement for inline `formatRelativeTime`
 * calls. Renders the relative string ("2h ago") with the full local
 * timestamp as a native browser tooltip (via the `title` attribute on
 * a semantic `<time>` element).
 *
 * Why a tooltip: relative times are scannable but lossy. Power users
 * (engineers reviewing audit logs, approvals etc.) often need the
 * exact wall-clock + timezone. Native `title` is zero-bundle-cost and
 * works with hover, focus, and assistive tech. No custom tooltip
 * library needed.
 */

import { formatRelativeTime, normalizeApiTimestamp, parseApiUtcTimestamp } from '@/lib/utils';

interface RelativeTimeProps {
  timestamp: string | null | undefined;
  className?: string;
}

export function RelativeTime({ timestamp, className }: RelativeTimeProps) {
  if (!timestamp) return null;

  // Ensure timestamp is parsed as UTC: if it lacks a timezone offset, append +00:00
  const normalizedTimestamp = timestamp.includes('+') || timestamp.includes('Z')
    ? timestamp
    : `${timestamp}+00:00`;

  const parsed = new Date(normalizedTimestamp);
  const isValid = !Number.isNaN(parsed.getTime());

  // Full local timestamp with timezone for the tooltip. Example:
  // "Nov 4, 2025, 3:42:18 PM PST".
  const fullLocal = isValid
    ? parsed.toLocaleString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        second: '2-digit',
        timeZoneName: 'short',
      })
    : 'Unknown time';

  return (
    <time
      dateTime={normalizedTimestamp}
      title={fullLocal}
      className={className}
    >
      {formatRelativeTime(normalizedTimestamp)}
    </time>
  );
}
