/**
 * Shared height for the context rail's bottom bar.
 *
 * The room has two bottom bars side by side: the composer in the centre
 * column and the rail's footer on the right. If their heights differ the
 * horizontal rule across the room breaks, which reads as sloppy. Every
 * tab therefore uses this one class so the rule stays continuous no
 * matter which tab is open, and it is defined once so the two sides
 * cannot drift apart.
 *
 * Measured against the composer at rest: composer 103px, shortcuts bar
 * 34px, leaving 69px for the tab footer.
 */
export const RAIL_FOOTER =
  'flex min-h-[69px] items-center border-t border-[var(--stroke-soft-200)] px-2';
