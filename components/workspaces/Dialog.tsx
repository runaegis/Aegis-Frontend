'use client';

/**
 * Modal shell for the workspace surface.
 *
 * Mirrors the motion, elevation, and dismissal behaviour of
 * `components/ui/ConfirmDialog` so modals feel identical across the
 * product, but accepts arbitrary children for form and disclosure content.
 */

import { useEffect, useRef, type ReactNode } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { X } from 'lucide-react';
import { DUR, EASE } from '@/lib/motion';
import { cn } from '@/lib/utils';

export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  width = 460,
  dismissable = true,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  width?: number;
  dismissable?: boolean;
}) {
  const reduce = useReducedMotion();
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && dismissable) {
        e.preventDefault();
        onOpenChange(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, dismissable, onOpenChange]);

  // Move focus into the panel so keyboard users land in the dialog.
  useEffect(() => {
    if (!open) return;
    const id = window.setTimeout(() => {
      const target = panelRef.current?.querySelector<HTMLElement>(
        'input, textarea, button, [tabindex]:not([tabindex="-1"])',
      );
      target?.focus();
    }, 60);
    return () => window.clearTimeout(id);
  }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="fixed inset-0 z-[70] bg-black/40 backdrop-blur-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: DUR.fast, ease: EASE.emph }}
            onClick={() => dismissable && onOpenChange(false)}
          />
          <div className="fixed inset-0 z-[71] flex items-center justify-center px-4">
            <motion.div
              ref={panelRef}
              role="dialog"
              aria-modal="true"
              aria-label={title}
              style={{ maxWidth: width }}
              className={cn(
                'pointer-events-auto w-full rounded-[14px] border border-[var(--stroke-soft-200)]',
                'bg-[var(--white-0)] shadow-[0_24px_64px_rgba(0,0,0,0.18),0_4px_12px_rgba(0,0,0,0.08)]',
              )}
              initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.96, y: 8 }}
              animate={reduce ? { opacity: 1 } : { opacity: 1, scale: 1, y: 0 }}
              exit={
                reduce
                  ? { opacity: 0 }
                  : { opacity: 0, scale: 0.96, y: 8, transition: { duration: DUR.fast } }
              }
              transition={{ duration: DUR.default, ease: EASE.emph }}
            >
              <div className="flex items-start justify-between gap-4 px-5 pt-5">
                <div className="min-w-0">
                  <h2 className="text-[15px] font-semibold leading-[1.3] tracking-[-0.01em] text-[var(--neutral-strong-950)]">
                    {title}
                  </h2>
                  {description && (
                    <div className="mt-1 text-[13px] leading-[1.5] text-[var(--neutral-sub-600)]">
                      {description}
                    </div>
                  )}
                </div>
                {dismissable && (
                  <button
                    type="button"
                    onClick={() => onOpenChange(false)}
                    aria-label="Close dialog"
                    className="-mr-1 -mt-1 rounded-md p-1 text-[var(--neutral-sub-600)] transition-colors hover:bg-[var(--neutral-weak-50)] hover:text-[var(--neutral-strong-950)]"
                  >
                    <X size={15} />
                  </button>
                )}
              </div>

              {children && <div className="px-5 pt-4">{children}</div>}

              {footer && (
                <div className="mt-5 flex items-center justify-end gap-2 border-t border-[var(--stroke-soft-200)] px-5 py-3.5">
                  {footer}
                </div>
              )}
              {!footer && <div className="pb-5" />}
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
