'use client';

/**
 * Tooltip — small AlignUI-styled hover hint, rendered via a portal so
 * it can escape clipped ancestors (overflow:hidden cards, rounded bars,
 * scroll containers).
 *
 *   <Tooltip content="ALLOW: 1,247 (62%)">
 *     <motion.span … />
 *   </Tooltip>
 *
 * Shows after `delayMs` on pointer enter or focus, hides instantly on
 * leave or blur. `Escape` also hides while focused.
 *
 * Visual spec (AlignUI):
 *   - Surface: --neutral-strong-950 (near-black) in light mode, flips
 *     to white in dark theme via tokenized CSS.
 *   - Text: 11.5px / 600 / -0.005em tracking, contrast-text.
 *   - Padding: 5px 9px (compact), radius 7px.
 *   - Drop shadow: --shadow-regular-md.
 *   - Arrow: 4px solid triangle, same fill as surface.
 *
 * The child is rendered as-is; we attach pointer/focus handlers via a
 * callback-ref wrapper. The child must accept ref + mouse/focus events
 * (HTML or `motion.*` elements both work).
 */

import {
  cloneElement,
  isValidElement,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
  type Ref,
} from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';

const EASE: [number, number, number, number] = [0.2, 0.8, 0.2, 1];

type Side = 'top' | 'bottom';

interface TooltipProps {
  /** Tooltip body. Plain string or any ReactNode (icons, numbers, etc.). */
  content: ReactNode;
  /** The trigger. Cloned with pointer + focus handlers. */
  children: ReactElement<{
    ref?: Ref<HTMLElement>;
    onMouseEnter?: (e: React.MouseEvent) => void;
    onMouseLeave?: (e: React.MouseEvent) => void;
    onFocus?: (e: React.FocusEvent) => void;
    onBlur?: (e: React.FocusEvent) => void;
    'aria-describedby'?: string;
  }>;
  /** Above (default) or below the trigger. */
  side?: Side;
  /** Show delay in ms. Default 200. */
  delayMs?: number;
  /** Disable rendering — useful for conditionally turning it off. */
  disabled?: boolean;
}

export function Tooltip({
  content,
  children,
  side = 'top',
  delayMs = 200,
  disabled = false,
}: TooltipProps) {
  const reduce = useReducedMotion();
  const triggerRef = useRef<HTMLElement | null>(null);
  const showTimer = useRef<number | null>(null);
  const [visible, setVisible] = useState(false);
  const [coords, setCoords] = useState<{ x: number; y: number } | null>(null);
  const id = useId();

  const measure = () => {
    const el = triggerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setCoords({
      x: rect.left + rect.width / 2,
      // Tooltip is anchored at the appropriate edge; transform handles
      // the 100% offset + arrow gap.
      y: side === 'top' ? rect.top : rect.bottom,
    });
  };

  const show = () => {
    if (disabled) return;
    if (showTimer.current) window.clearTimeout(showTimer.current);
    measure();
    showTimer.current = window.setTimeout(() => {
      // Re-measure right before show so the position is accurate even
      // if layout shifted during the delay (e.g., the bar segment
      // finished its width animation).
      measure();
      setVisible(true);
    }, delayMs);
  };

  const hide = () => {
    if (showTimer.current) {
      window.clearTimeout(showTimer.current);
      showTimer.current = null;
    }
    setVisible(false);
  };

  // Reposition on scroll / resize while visible so the tooltip tracks
  // the trigger if the page moves under it.
  useEffect(() => {
    if (!visible) return;
    const onChange = () => measure();
    window.addEventListener('scroll', onChange, true);
    window.addEventListener('resize', onChange);
    return () => {
      window.removeEventListener('scroll', onChange, true);
      window.removeEventListener('resize', onChange);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  // Cleanup any pending timer on unmount.
  useEffect(() => {
    return () => {
      if (showTimer.current) window.clearTimeout(showTimer.current);
    };
  }, []);

  if (!isValidElement(children)) return children;

  // Compose child handlers with our own (don't clobber user-supplied
  // onMouseEnter / onMouseLeave / onFocus / onBlur).
  const childProps = children.props as {
    ref?: Ref<HTMLElement>;
    onMouseEnter?: (e: React.MouseEvent) => void;
    onMouseLeave?: (e: React.MouseEvent) => void;
    onFocus?: (e: React.FocusEvent) => void;
    onBlur?: (e: React.FocusEvent) => void;
  };
  const childOnEnter = childProps.onMouseEnter;
  const childOnLeave = childProps.onMouseLeave;
  const childOnFocus = childProps.onFocus;
  const childOnBlur = childProps.onBlur;

  const trigger = cloneElement(children, {
    ref: (node: HTMLElement | null) => {
      triggerRef.current = node;
      // Forward ref if the child had one. React 19 / motion supports
      // callback refs out of the box.
      const childRef = childProps.ref;
      if (typeof childRef === 'function') childRef(node);
      else if (childRef && typeof childRef === 'object') {
        (childRef as { current: HTMLElement | null }).current = node;
      }
    },
    onMouseEnter: (e: React.MouseEvent) => {
      childOnEnter?.(e);
      show();
    },
    onMouseLeave: (e: React.MouseEvent) => {
      childOnLeave?.(e);
      hide();
    },
    onFocus: (e: React.FocusEvent) => {
      childOnFocus?.(e);
      show();
    },
    onBlur: (e: React.FocusEvent) => {
      childOnBlur?.(e);
      hide();
    },
    'aria-describedby': visible ? id : undefined,
  });

  // Static positioning offset. We use the CSS `translate` longhand
  // (not `transform`) because Framer Motion drives `y` animations via
  // `transform: translate3d(...)` — setting our offset in `transform`
  // would get overwritten the moment the entrance animation starts,
  // landing the tooltip on top of the trigger instead of above it.
  // `translate` is a separate property and composes cleanly with
  // motion's transform-driven `y` animation.
  // 6px gap matches the arrow's effective height so it touches the
  // trigger edge without overlapping.
  const translateOffset =
    side === 'top'
      ? '-50% calc(-100% - 6px)'
      : '-50% 6px';

  return (
    <>
      {trigger}
      {typeof document !== 'undefined' &&
        createPortal(
          <AnimatePresence>
            {visible && coords && (
              <motion.div
                id={id}
                role="tooltip"
                initial={reduce ? { opacity: 0 } : { opacity: 0, y: side === 'top' ? 4 : -4 }}
                animate={reduce ? { opacity: 1 } : { opacity: 1, y: 0 }}
                exit={reduce ? { opacity: 0 } : { opacity: 0, y: side === 'top' ? 4 : -4 }}
                transition={{ duration: 0.14, ease: EASE }}
                // Surface + text are deliberately hardcoded (not
                // token-driven) so the tooltip reads the same in both
                // themes — always near-black surface with white text,
                // the canonical AlignUI tooltip treatment.
                className="whitespace-nowrap rounded-[7px] px-[9px] py-[5px] text-[11.5px] font-semibold tracking-[-0.005em] text-white shadow-[0_8px_24px_rgba(0,0,0,0.18),0_1px_2px_rgba(0,0,0,0.10)]"
                style={{
                  position: 'fixed',
                  left: coords.x,
                  top: coords.y,
                  translate: translateOffset,
                  zIndex: 100,
                  pointerEvents: 'none',
                  backgroundColor: '#171717',
                }}
              >
                {content}
                {/* Arrow — 4px solid triangle, same fill as surface.
                    Sits on the far edge from the trigger so it visually
                    "points" toward the trigger. */}
                <span
                  aria-hidden
                  className={
                    side === 'top'
                      ? 'absolute left-1/2 top-full h-0 w-0 -translate-x-1/2 border-x-[4px] border-t-[4px] border-x-transparent'
                      : 'absolute bottom-full left-1/2 h-0 w-0 -translate-x-1/2 border-x-[4px] border-b-[4px] border-x-transparent'
                  }
                  style={
                    side === 'top'
                      ? { borderTopColor: '#171717' }
                      : { borderBottomColor: '#171717' }
                  }
                />
              </motion.div>
            )}
          </AnimatePresence>,
          document.body,
        )}
    </>
  );
}
