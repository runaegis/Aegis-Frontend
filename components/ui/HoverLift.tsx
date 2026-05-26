'use client';

/**
 * HoverLift — the canonical hover micro-interaction used across
 * clickable cards in the dashboard.
 *
 * Wraps any child in a `motion.div` that animates `y: -3` on hover
 * and `y: -1` on tap. The easing curve `[0.32, 0.72, 0.32, 1]` is
 * an emphasized-decelerate spec; 260ms duration reads as confident
 * but not bouncy.
 *
 * Reasons for a wrapper component instead of inlining the props
 * everywhere:
 *   • Single source of truth for the curve, duration, and lift
 *     distance. Tweak once, the whole product updates together.
 *   • The motion.div sits OUTSIDE the click target (the Link or
 *     Button inside), so focus styling still lands on the actual
 *     focus target. Putting `whileHover` directly on the Link would
 *     animate the focus ring too, which reads as buggy.
 *   • Respects `prefers-reduced-motion` via `useReducedMotion` so
 *     the lift is suppressed for users who've opted out of motion.
 *
 * Pattern:
 *   <HoverLift>
 *     <Link href="/dashboard/runs" className="...">card body</Link>
 *   </HoverLift>
 *
 * The Link (not the wrapper) is the click target. The wrapper is
 * purely visual.
 *
 * `disabled` opts out of the lift without removing the wrapper —
 * useful for cards that are sometimes interactive and sometimes
 * informational (e.g. an active filter pill that shouldn't lift
 * when already selected).
 */

import { motion, useReducedMotion } from 'motion/react';
import type { ReactNode } from 'react';

interface HoverLiftProps {
  children: ReactNode;
  /** Suppress the hover lift. Useful when a card is in a "pressed"
   *  or "selected" state and shouldn't animate. */
  disabled?: boolean;
  /** Optional class names on the motion wrapper. Most callers won't
   *  need this — let the inner Link/Button handle layout. */
  className?: string;
}

export function HoverLift({
  children,
  disabled = false,
  className,
}: HoverLiftProps) {
  const reduce = useReducedMotion();
  const inert = disabled || reduce;

  return (
    <motion.div
      className={className}
      whileHover={
        inert
          ? undefined
          : {
              y: -3,
              transition: { duration: 0.26, ease: [0.32, 0.72, 0.32, 1] },
            }
      }
      whileTap={
        inert
          ? undefined
          : {
              y: -1,
              transition: { duration: 0.12, ease: [0.32, 0.72, 0.32, 1] },
            }
      }
    >
      {children}
    </motion.div>
  );
}
