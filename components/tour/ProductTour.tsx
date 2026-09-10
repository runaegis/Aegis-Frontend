'use client';

/**
 * Optional product tour for new users (driver.js).
 *
 * After the demo/empty welcome choice, we offer a skippable walkthrough:
 * workspace → connect an agent → how to use it → Memory → Prompts.
 * Replay from Settings or ⌘K. Nothing is required.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { driver, type Driver } from 'driver.js';
import 'driver.js/dist/driver.css';
import './driver-theme.css';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { AegisLogo } from '@/components/ui/AegisLogo';
import { Button } from '@/components/ui/Button';
import {
  PRODUCT_TOUR_RESUME_KEY,
  PRODUCT_TOUR_START_EVENT,
  PRODUCT_TOUR_STEPS,
  getProductTourStatus,
  hasChosenWorkspaceMode,
  routeMatches,
  setProductTourStatus,
} from '@/lib/productTour';

const EASE_EMPH: [number, number, number, number] = [0.2, 0.8, 0.2, 1];

function expandSidebar(): boolean {
  const wasCollapsed = document.documentElement.dataset.sidebarCollapsed === 'true';
  if (wasCollapsed) {
    delete document.documentElement.dataset.sidebarCollapsed;
  }
  return wasCollapsed;
}

function restoreSidebar(wasCollapsed: boolean) {
  if (wasCollapsed) {
    document.documentElement.dataset.sidebarCollapsed = 'true';
  }
}

function toDriveSteps() {
  return PRODUCT_TOUR_STEPS.map((step) => ({
    element: step.element,
    disableActiveInteraction: true,
    skipMissingElement: true,
    waitForElement: step.element ? 2500 : undefined,
    popover: {
      title: step.title,
      description: step.description,
      side: step.side,
      align: 'start' as const,
    },
  }));
}

export function ProductTour({ welcomeOpen = false }: { welcomeOpen?: boolean }) {
  const pathname = usePathname();
  const router = useRouter();
  const reduce = useReducedMotion();
  const [inviteOpen, setInviteOpen] = useState(false);

  const driverRef = useRef<Driver | null>(null);
  const completedRef = useRef(false);
  const navigatingRef = useRef(false);
  const collapsedWasRef = useRef(false);
  const startAtRef = useRef<(index: number) => void>(() => {});

  const stopDriver = useCallback(() => {
    const instance = driverRef.current;
    driverRef.current = null;
    instance?.destroy();
  }, []);

  const startAt = useCallback(
    (index: number) => {
      const clamped = Math.min(Math.max(index, 0), PRODUCT_TOUR_STEPS.length - 1);
      const step = PRODUCT_TOUR_STEPS[clamped];
      if (step.route && !routeMatches(window.location.pathname, step.route)) {
        navigatingRef.current = true;
        try {
          sessionStorage.setItem(PRODUCT_TOUR_RESUME_KEY, String(clamped));
        } catch {
          /* ignore */
        }
        stopDriver();
        router.push(step.route);
        return;
      }

      stopDriver();
      completedRef.current = false;
      collapsedWasRef.current = expandSidebar();

      const instance = driver({
        animate: !reduce,
        overlayColor: '#000000',
        overlayOpacity: 0.48,
        smoothScroll: true,
        allowClose: true,
        stagePadding: 8,
        stageRadius: 10,
        popoverOffset: 12,
        popoverClass: 'aegis-tour-popover',
        showProgress: true,
        progressText: '{{current}} / {{total}}',
        nextBtnText: 'Next',
        prevBtnText: 'Back',
        doneBtnText: 'Done',
        showButtons: ['next', 'previous', 'close'],
        steps: toDriveSteps(),
        onPopoverRender: (popover) => {
          popover.closeButton.setAttribute('aria-label', 'Skip tour');
          popover.closeButton.title = 'Skip tour';
        },
        onNextClick: (_element, _step, { driver: active, index: current }) => {
          const i = current ?? 0;
          if (i >= PRODUCT_TOUR_STEPS.length - 1) {
            completedRef.current = true;
            setProductTourStatus('done');
            active.destroy();
            return;
          }
          const next = PRODUCT_TOUR_STEPS[i + 1];
          if (next.route && !routeMatches(window.location.pathname, next.route)) {
            navigatingRef.current = true;
            try {
              sessionStorage.setItem(PRODUCT_TOUR_RESUME_KEY, String(i + 1));
            } catch {
              /* ignore */
            }
            active.destroy();
            router.push(next.route);
            return;
          }
          active.moveNext();
        },
        onPrevClick: (_element, _step, { driver: active, index: current }) => {
          const i = current ?? 0;
          if (i <= 0) return;
          const prev = PRODUCT_TOUR_STEPS[i - 1];
          const prevNeedsRoute = prev.route && !routeMatches(window.location.pathname, prev.route);
          if (prevNeedsRoute && prev.route) {
            navigatingRef.current = true;
            try {
              sessionStorage.setItem(PRODUCT_TOUR_RESUME_KEY, String(i - 1));
            } catch {
              /* ignore */
            }
            active.destroy();
            router.push(prev.route);
            return;
          }
          active.movePrevious();
        },
        onCloseClick: (_element, _step, { driver: active }) => {
          if (getProductTourStatus() === 'pending') {
            setProductTourStatus('skipped');
          }
          active.destroy();
        },
        onDestroyed: () => {
          restoreSidebar(collapsedWasRef.current);
          driverRef.current = null;
          if (navigatingRef.current) return;
          if (!completedRef.current && getProductTourStatus() === 'pending') {
            setProductTourStatus('skipped');
          }
        },
      });

      driverRef.current = instance;
      instance.drive(clamped);
    },
    [reduce, router, stopDriver],
  );

  startAtRef.current = startAt;

  useEffect(() => {
    return () => {
      navigatingRef.current = true;
      stopDriver();
    };
  }, [stopDriver]);

  useEffect(() => {
    let resume: string | null = null;
    try {
      resume = sessionStorage.getItem(PRODUCT_TOUR_RESUME_KEY);
    } catch {
      resume = null;
    }
    if (resume == null) return;
    const index = Number(resume);
    if (!Number.isFinite(index)) return;
    try {
      sessionStorage.removeItem(PRODUCT_TOUR_RESUME_KEY);
    } catch {
      /* ignore */
    }
    navigatingRef.current = false;
    const timer = window.setTimeout(() => startAtRef.current(index), 280);
    return () => window.clearTimeout(timer);
  }, [pathname]);

  useEffect(() => {
    const onStart = () => {
      setInviteOpen(false);
      startAtRef.current(0);
    };
    window.addEventListener(PRODUCT_TOUR_START_EVENT, onStart);
    return () => window.removeEventListener(PRODUCT_TOUR_START_EVENT, onStart);
  }, []);

  useEffect(() => {
    if (welcomeOpen) return;

    const params = new URLSearchParams(window.location.search);
    if (params.get('tour') === '1') {
      startAtRef.current(0);
      params.delete('tour');
      const next = `${window.location.pathname}${params.toString() ? `?${params}` : ''}${window.location.hash}`;
      window.history.replaceState(null, '', next);
      return;
    }

    if (!hasChosenWorkspaceMode()) return;
    if (getProductTourStatus() !== 'pending') return;
    try {
      if (sessionStorage.getItem(PRODUCT_TOUR_RESUME_KEY)) return;
    } catch {
      /* ignore */
    }

    const timer = window.setTimeout(() => setInviteOpen(true), 700);
    return () => window.clearTimeout(timer);
  }, [welcomeOpen]);

  const skipInvite = () => {
    setInviteOpen(false);
    setProductTourStatus('skipped');
  };

  const startInvite = () => {
    setInviteOpen(false);
    startAt(0);
  };

  return (
    <AnimatePresence>
      {inviteOpen ? (
        <TourInvite
          reduce={!!reduce}
          onSkip={skipInvite}
          onStart={startInvite}
        />
      ) : null}
    </AnimatePresence>
  );
}

function TourInvite({
  reduce,
  onSkip,
  onStart,
}: {
  reduce: boolean;
  onSkip: () => void;
  onStart: () => void;
}) {
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onSkip();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [onSkip]);

  return (
    <>
      <motion.div
        className="fixed inset-0 z-[90] bg-black/40 backdrop-blur-[3px]"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.18, ease: EASE_EMPH }}
        aria-hidden
        onClick={onSkip}
      />
      <div
        className="fixed inset-0 z-[91] flex items-center justify-center px-4"
        role="dialog"
        aria-modal="true"
        aria-labelledby="product-tour-invite-title"
        onClick={onSkip}
      >
        <motion.div
          className="w-full max-w-[440px] overflow-hidden rounded-[16px] border border-[var(--stroke-soft-200)] bg-[var(--white-0)] shadow-[0_24px_72px_rgba(0,0,0,0.18),0_4px_16px_rgba(0,0,0,0.08)]"
          initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.96, y: 12 }}
          animate={reduce ? { opacity: 1 } : { opacity: 1, scale: 1, y: 0 }}
          exit={
            reduce
              ? { opacity: 0 }
              : { opacity: 0, scale: 0.97, y: 6, transition: { duration: 0.14 } }
          }
          transition={{ duration: 0.22, ease: EASE_EMPH }}
          onClick={(event) => event.stopPropagation()}
        >
          <div className="px-7 pt-7">
            <div className="mb-6 flex items-center gap-2.5 text-[var(--neutral-strong-950)]">
              <AegisLogo style={{ height: 20, width: 'auto' }} />
            </div>
            <h2
              id="product-tour-invite-title"
              className="text-[22px] font-semibold leading-[1.2] tracking-[-0.02em] text-[var(--neutral-strong-950)]"
            >
              Take a quick tour?
            </h2>
            <p className="mt-2 text-[14px] leading-[1.5] text-[var(--neutral-sub-600)]">
              Optional. About two minutes — how to make a workspace agent, how to
              use it, then Memory and Prompts. Skip now or on any step.
            </p>
          </div>
          <div className="flex items-center justify-end gap-2 px-7 py-5">
            <Button variant="ghost" size="md" onClick={onSkip}>
              Skip
            </Button>
            <Button variant="primary" size="md" onClick={onStart}>
              Start tour
            </Button>
          </div>
        </motion.div>
      </div>
    </>
  );
}
