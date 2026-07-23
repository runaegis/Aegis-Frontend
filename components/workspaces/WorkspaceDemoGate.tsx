'use client';

/**
 * Chooses between the real workspace API and the in-memory demo layer.
 *
 * Production-safe by design: the demo layer is installed ONLY when demo
 * mode is on, using the same signals the dashboard already uses
 * (`?demo=1`, the dev-only `?preview=1` alias, or the persisted
 * `aegis_demo` flag). `?real=1` clears that persisted demo flag for
 * this browser. With demo off, every component talks to the real `api.*`
 * and the surface behaves like any other page, including its error state
 * when the backend is not reachable.
 *
 * That matters because these routes live outside `/dashboard`, so they
 * never run the dashboard layout's `installPreviewApi()` and have to
 * make this decision themselves.
 */

import { createContext, useContext, useState, type ReactNode } from 'react';
import { installWorkspacePreviewApi } from '@/lib/workspace-preview';

const WorkspaceDemoContext = createContext(false);

export function isWorkspaceDemoMode(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const params = new URLSearchParams(window.location.search);
    if (params.get('real') === '1') {
      localStorage.setItem('aegis_demo', 'false');
      return false;
    }
    if (params.get('demo') === '1') {
      localStorage.setItem('aegis_demo', 'true');
      return true;
    }
    // Dev-only alias, kept for parity with the dashboard.
    if (process.env.NODE_ENV !== 'production' && params.get('preview') === '1') {
      return true;
    }
    return localStorage.getItem('aegis_demo') === 'true';
  } catch {
    // localStorage can throw in embedded contexts.
    return false;
  }
}

export function WorkspaceDemoGate({ children }: { children: ReactNode }) {
  // useState initialiser runs once, during the first render, which is
  // before children mount and therefore before they call the api.
  const [demo] = useState(() => {
    const on = isWorkspaceDemoMode();
    if (on) installWorkspacePreviewApi();
    return on;
  });

  return <WorkspaceDemoContext.Provider value={demo}>{children}</WorkspaceDemoContext.Provider>;
}

/** True when the surface is rendering sample data. */
export function useIsDemo() {
  return useContext(WorkspaceDemoContext);
}

/** Shown only in demo mode, so real data is never mislabelled. */
export function SampleDataChip({ className }: { className?: string }) {
  const demo = useIsDemo();
  if (!demo) return null;
  return (
    <span
      className={
        'inline-flex items-center gap-1.5 rounded-full border border-[var(--stroke-soft-200)] bg-[var(--neutral-weak-50)] px-2 py-0.5 text-[11px] font-medium text-[var(--neutral-sub-600)] ' +
        (className ?? '')
      }
    >
      <span className="size-1.5 rounded-full bg-[var(--primary-base)]" />
      Sample data
    </span>
  );
}
