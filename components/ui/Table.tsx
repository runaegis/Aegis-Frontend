'use client';

import {
  type HTMLAttributes,
  type TableHTMLAttributes,
  type ThHTMLAttributes,
  type TdHTMLAttributes,
} from 'react';
import { motion } from 'motion/react';
import { cn } from '@/lib/utils';

// Emphasized-decelerate easing — matches the rest of the dashboard's motion language.
const EASE_EMPH: [number, number, number, number] = [0.2, 0.8, 0.2, 1];

/**
 * Premium data table — Linear / Resend pattern.
 * - Card wrapper with subtle shadow, 12px radius.
 * - Sticky header that stays visible while rows scroll.
 * - 1px dividers, no zebra. Hover state is a soft warm tint.
 * - Row interactivity signaled by `clickable` — adds cursor + chevron-friendly group.
 */

export function Table({
  className,
  children,
  ...props
}: TableHTMLAttributes<HTMLTableElement>) {
  // `overflow: clip` clips children to the rounded rect WITHOUT creating
  // a new scroll/containing context — so position:sticky on <thead> still
  // anchors against the page scroll and pins under the topbar.
  // (overflow:hidden would establish a scroll container and break this;
  //  clip-path would clip the wrapper's own border at the corners.)
  //
  // On mobile, the table can be wider than the viewport. Wrap in a
  // horizontal scroll container so it stays usable without forcing
  // the entire page to scroll horizontally.
  return (
    <div className="rounded-[12px] border border-[var(--stroke-soft-200)] bg-white shadow-[0_1px_2px_rgba(23,23,23,0.04)] [overflow:clip]">
      {/* Below lg: enable horizontal scroll so wide tables stay usable on
          mobile/tablet. At lg+: clear the scroll container so the thead's
          page-level sticky positioning works again (sticky anchors against
          the nearest scrolling ancestor — we don't want that to be this
          wrapper on desktop). */}
      <div className="overflow-x-auto lg:overflow-x-visible">
        <table
          className={cn(
            'w-full min-w-[760px] border-collapse text-[13px] [border-spacing:0] lg:min-w-0',
            className,
          )}
          {...props}
        >
          {children}
        </table>
      </div>
    </div>
  );
}

export function THead({
  className,
  children,
  ...props
}: HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <thead
      className={cn(
        // Desktop (lg+): the table wrapper is overflow-visible, so sticky
        // anchors against the page — pin under the 56px Topbar.
        // Below lg: the wrapper is a horizontal scroll container, so
        // sticky anchors within it; top-0 keeps the header flush with
        // the wrapper edge instead of leaving a 56px gap.
        'sticky top-0 z-10 bg-[var(--neutral-weak-50)] backdrop-blur-sm lg:top-[56px]',
        // Subtle bottom border matching the table's outer stroke — just
        // enough to anchor the header without competing with the card edge.
        '[&_tr]:shadow-[inset_0_-1px_0_0_var(--stroke-soft-200)]',
        '[&_tr]:border-b-0',
        className,
      )}
      {...props}
    >
      {children}
    </thead>
  );
}

export function TH({
  className,
  children,
  ...props
}: ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      className={cn(
        'whitespace-nowrap px-[18px] py-[10px] text-left text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[var(--neutral-soft-400)]',
        // First / last cells get a touch more breathing room from the card edge
        'first:pl-5 last:pr-5',
        className,
      )}
      {...props}
    >
      {children}
    </th>
  );
}

export function TBody({
  className,
  children,
  ...props
}: HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <tbody className={cn('', className)} {...props}>
      {children}
    </tbody>
  );
}

interface TRProps extends HTMLAttributes<HTMLTableRowElement> {
  /** When true, applies pointer cursor + group hover so child chevron animates. */
  clickable?: boolean;
  /** Mark a row as expanded so the hover state is "stuck open". */
  isExpanded?: boolean;
}

export function TR({ className, clickable, isExpanded, children, ...props }: TRProps) {
  return (
    <tr
      className={cn(
        'group border-b border-[var(--stroke-soft-200)] transition-colors last:border-b-0',
        // Hover-orange ONLY when not expanded — once the row is open, the
        // gradient owns the bg and we don't want a second tint to fight it.
        clickable && !isExpanded && 'cursor-pointer hover:bg-[var(--primary-lighter)]/60',
        clickable && isExpanded && 'cursor-pointer',
        // When expanded: suppress the row-divider AND apply a top-to-bottom
        // warm gradient that hands off into TRExpanded's panel below.
        // Stops are tuned so this row's end-color matches TRExpanded's
        // start-color (/45), producing one continuous orange→white wash.
        // Applied per-cell because border-collapse can swallow <tr> bg.
        isExpanded &&
          '!border-b-0 [&>td]:bg-gradient-to-b [&>td]:from-[var(--primary-lighter)]/55 [&>td]:to-[var(--primary-lighter)]/45',
        className,
      )}
      {...props}
    >
      {children}
    </tr>
  );
}

export function TD({
  className,
  children,
  ...props
}: TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td
      className={cn(
        'px-[18px] py-[12px] align-middle text-[13px] text-[var(--neutral-strong-950)]',
        'first:pl-5 last:pr-5',
        className,
      )}
      {...props}
    >
      {children}
    </td>
  );
}

/**
 * Expanded-row insert — spans all columns. Carries the bottom half of the
 * warm orange → white gradient that started on the trigger row above.
 * Start-stop (primary-lighter/45) matches the trigger row's end-stop so
 * the two render as one continuous wash. The inner card is pure white,
 * sitting on the gradient like a clean detail surface.
 *
 * Motion: a height-collapsing inner div produces a smooth, no-layout-jolt
 * expand. Use inside <AnimatePresence initial={false}> so the row exits
 * smoothly too. The <tr> itself fades opacity in/out so the gradient
 * appears/disappears in sync with the panel rather than snapping.
 */
export function TRExpanded({
  colSpan,
  className,
  children,
}: {
  colSpan: number;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <motion.tr
      className={cn(className)}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18, ease: EASE_EMPH }}
    >
      <td
        colSpan={colSpan}
        className="border-b border-[var(--stroke-soft-200)] bg-gradient-to-b from-[var(--primary-lighter)]/45 to-white p-0"
      >
        <motion.div
          initial={{ height: 0 }}
          animate={{ height: 'auto' }}
          exit={{ height: 0 }}
          transition={{ duration: 0.24, ease: EASE_EMPH }}
          style={{ overflow: 'hidden', willChange: 'height' }}
        >
          <div className="px-5 pb-5 pt-1">
            <div className="rounded-[10px] border border-[var(--stroke-soft-200)] bg-white p-4 shadow-[0_1px_2px_rgba(23,23,23,0.04)]">
              {children}
            </div>
          </div>
        </motion.div>
      </td>
    </motion.tr>
  );
}
