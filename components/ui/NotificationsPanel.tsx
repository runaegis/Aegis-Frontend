'use client';

/**
 * NotificationsPanel — bell trigger + popover list.
 *
 * Two modes:
 *
 *   1. REAL (default). The list is empty. The unread badge on the bell
 *      reflects the `unreadCount` prop. This is the engineering hand-off
 *      shape: the panel is wired up but the data layer isn't, so users
 *      always see the empty state in production today.
 *
 *   2. DEMO. When `<html data-demo="true">` is set, the panel seeds
 *      itself with a representative set of governance notifications
 *      (approvals waiting, policy denies, freeze warnings, audit
 *      anomalies, budget alerts, room membership, mentions). Each row
 *      is dismissable; "Mark all read" and "Clear all" work; the
 *      footer offers "Restore demo notifications" so designers can
 *      reset the panel between demos.
 *
 * The demo data doubles as a design reference. The shape engineers
 * should target when wiring real notifications:
 *
 *   {
 *     id: string,                 // stable id (uuid / db pk)
 *     type: NotificationType,     // governance category — drives icon + tone
 *     title: string,              // imperative, specific, exact numbers
 *     body?: string,              // optional second line
 *     meta?: string,              // small footer line ("agent · repo")
 *     timeLabel: string,          // already-relative ("2m", "1h", "Yesterday")
 *     href: string,               // where the click takes you
 *     unread: boolean,
 *   }
 *
 * State (read/dismissed) persists in localStorage so dismissals stick
 * across refreshes, but a Restore button rebuilds the seed.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import {
  AlertTriangle,
  ArrowUpRight,
  AtSign,
  Bell,
  BellOff,
  CheckCircle2,
  Inbox,
  PauseCircle,
  RotateCcw,
  Settings as SettingsIcon,
  ShieldX,
  TrendingUp,
  Trash2,
  UserPlus,
  X,
  type LucideIcon,
} from 'lucide-react';

const EASE_EMPH: [number, number, number, number] = [0.2, 0.8, 0.2, 1];

// ─── Types ─────────────────────────────────────────────────────────────

type NotificationType =
  | 'approval'      // X actions waiting for review (REQUIRE_APPROVAL)
  | 'policy_deny'   // Policy blocked an agent action
  | 'freeze'        // Deploy-freeze window starting / active
  | 'token_budget'  // Token spend approaching budget threshold
  | 'audit'         // Suspicious pattern flagged in audit trail
  | 'member'        // Room membership change
  | 'mention';      // Someone @mentioned you

type Tone = 'primary' | 'success' | 'warning' | 'error' | 'feature';

interface NotificationItem {
  id: string;
  type: NotificationType;
  title: string;
  body?: string;
  meta?: string;
  timeLabel: string;
  href: string;
  /** Whether the row should render with the bold "unread" emphasis. */
  unread: boolean;
}

// ─── Type → icon + tone mapping ────────────────────────────────────────

const TYPE_META: Record<
  NotificationType,
  { icon: LucideIcon; tone: Tone; label: string }
> = {
  approval:     { icon: Inbox,          tone: 'primary',  label: 'Approval' },
  policy_deny:  { icon: ShieldX,        tone: 'error',    label: 'Policy' },
  freeze:       { icon: PauseCircle,    tone: 'warning',  label: 'Freeze' },
  token_budget: { icon: TrendingUp,     tone: 'warning',  label: 'Budget' },
  audit:        { icon: AlertTriangle,  tone: 'error',    label: 'Audit' },
  member:       { icon: UserPlus,       tone: 'success',  label: 'Member' },
  mention:      { icon: AtSign,         tone: 'feature',  label: 'Mention' },
};

const TONE_BG: Record<Tone, string> = {
  primary: 'var(--primary-lighter)',
  success: 'var(--success-lighter)',
  warning: 'var(--warning-lighter)',
  error:   'var(--error-lighter)',
  feature: 'var(--feature-lighter)',
};

const TONE_FG: Record<Tone, string> = {
  primary: 'var(--primary-base)',
  success: 'var(--success)',
  warning: 'var(--warning)',
  error:   'var(--error)',
  feature: 'var(--feature)',
};

// RGB triplets for each tone — used to compose the icon-mark's
// multi-layered colored shadow stack. Keeping these as numeric strings
// (rather than CSS vars) lets us construct rgba() with arbitrary alpha
// without needing per-tone CSS variables for every opacity step.
//
// Sourced from globals.css:
//   --primary-base #fa7319  → 250,115, 25
//   --success      #1fc16b  →  31,193,107
//   --warning      #f6b51e  → 246,181, 30
//   --error        #fb3748  → 251, 55, 72
//   --feature      #7d52f4  → 125, 82,244
const TONE_RGB: Record<Tone, string> = {
  primary: '250, 115, 25',
  success: '31, 193, 107',
  warning: '246, 181, 30',
  error:   '251, 55, 72',
  feature: '125, 82, 244',
};

// ─── Demo seed ─────────────────────────────────────────────────────────
// Designed to span all 7 notification types and lead with the most
// time-sensitive items. Numbers are exact (not rounded) and copy uses
// Aegis vocabulary (agent action, policy, repo, role names).

const DEMO_NOTIFICATIONS: NotificationItem[] = [
  {
    id: 'n-approval-batch',
    type: 'approval',
    title: '4 actions waiting for your review',
    body: 'cursor-agent wants to merge 4 PRs into protected branches.',
    meta: 'aegis/dashboard, aegis/mcp-server · 2m ago',
    timeLabel: '2m',
    href: '/dashboard/approvals',
    unread: true,
  },
  {
    id: 'n-policy-deny-branch',
    type: 'policy_deny',
    title: 'Protected Branch Denial blocked cursor-agent',
    body: 'Direct push to main rewritten into a draft PR.',
    meta: 'aegis/mcp-server · 8m ago',
    timeLabel: '8m',
    href: '/dashboard/audit',
    unread: true,
  },
  {
    id: 'n-freeze-incoming',
    type: 'freeze',
    title: 'Weekend deploy freeze starts in 32 min',
    body: 'Write actions will be denied Sat 18:00 → Mon 09:00 IST.',
    meta: '4 active agents will pause',
    timeLabel: '32m',
    href: '/dashboard/freeze-window',
    unread: true,
  },
  {
    id: 'n-token-budget',
    type: 'token_budget',
    title: 'Weekly AI spend hit 84% of budget',
    body: '$4,219 of $5,000. Forecast to exceed by Saturday at current rate.',
    meta: 'github-copilot accounts for 52% of spend',
    timeLabel: '1h',
    href: '/dashboard/token-spenditure',
    unread: true,
  },
  {
    id: 'n-audit-anomaly',
    type: 'audit',
    title: 'Unusual delete pattern flagged',
    body: 'github-copilot ran 14 file deletes in 2 minutes on aegis/marketing.',
    meta: 'Threshold: 5 deletes / 5 min',
    timeLabel: '3h',
    href: '/dashboard/audit',
    unread: false,
  },
  {
    id: 'n-mention',
    type: 'mention',
    title: 'Kartik mentioned you in an approval thread',
    body: '"Looks good to me — handing back to you for final ack."',
    meta: 'PR #2847 · aegis/dashboard',
    timeLabel: 'Yesterday',
    href: '/dashboard/approvals',
    unread: false,
  },
  {
    id: 'n-member-joined',
    type: 'member',
    title: 'Mujtaba Basheer accepted invite as ADMIN',
    body: 'Can manage policies, freeze windows, and member roles.',
    meta: 'aegis/dashboard',
    timeLabel: 'Yesterday',
    href: '/dashboard/rooms',
    unread: false,
  },
];

// ─── LocalStorage state ────────────────────────────────────────────────
//
// We persist read + dismissed ids so a designer dismissing the panel
// mid-demo doesn't have to redo it after a route navigation. Restore
// nukes the saved state and reseeds.

const STORAGE_KEY = 'aegis_demo_notifications_state';

interface StoredState {
  read: string[];
  dismissed: string[];
}

function loadState(): StoredState {
  if (typeof window === 'undefined') return { read: [], dismissed: [] };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { read: [], dismissed: [] };
    const parsed = JSON.parse(raw) as StoredState;
    return {
      read: Array.isArray(parsed.read) ? parsed.read : [],
      dismissed: Array.isArray(parsed.dismissed) ? parsed.dismissed : [],
    };
  } catch {
    return { read: [], dismissed: [] };
  }
}

function saveState(state: StoredState) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // localStorage might be full / disabled — silently ignore.
  }
}

// ─── Component ─────────────────────────────────────────────────────────

interface NotificationsPanelProps {
  /** Unread count from the real (non-demo) data layer. Used for the
   *  bell badge when demo mode is off. */
  unreadCount?: number;
}

type Tab = 'all' | 'unread' | 'mentions';

export function NotificationsPanel({ unreadCount = 0 }: NotificationsPanelProps) {
  const reduce = useReducedMotion();
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('all');
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);

  // ── Demo-mode detection ─────────────────────────────────────────────
  // Watches the `<html data-demo>` attribute, same pattern as UserMenu
  // and WorkspaceSwitcher. `null` until first effect runs so SSR doesn't
  // flash mismatched state.
  const [demoOn, setDemoOn] = useState<boolean | null>(null);
  useEffect(() => {
    const update = () => {
      setDemoOn(document.documentElement.dataset.demo === 'true');
    };
    update();
    const observer = new MutationObserver(update);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-demo'],
    });
    return () => observer.disconnect();
  }, []);

  // ── Read / dismissed state ──────────────────────────────────────────
  const [readIds, setReadIds] = useState<Set<string>>(() => new Set());
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    const s = loadState();
    setReadIds(new Set(s.read));
    setDismissedIds(new Set(s.dismissed));
  }, []);

  // Persist every state change. Cheap (small payload, few writes).
  useEffect(() => {
    saveState({
      read: Array.from(readIds),
      dismissed: Array.from(dismissedIds),
    });
  }, [readIds, dismissedIds]);

  // ── Outside-click + Escape to close ────────────────────────────────
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (
        panelRef.current &&
        !panelRef.current.contains(e.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  // ── Derived data ───────────────────────────────────────────────────
  // The visible-in-demo list = full seed minus dismissed ids, with the
  // unread flag overlayed from readIds. Outside demo mode, the list is
  // always empty so we show the existing empty state.
  const items: NotificationItem[] = useMemo(() => {
    if (!demoOn) return [];
    return DEMO_NOTIFICATIONS.filter((n) => !dismissedIds.has(n.id)).map(
      (n) => ({
        ...n,
        unread: n.unread && !readIds.has(n.id),
      }),
    );
  }, [demoOn, dismissedIds, readIds]);

  const filtered = useMemo(() => {
    if (activeTab === 'unread') return items.filter((n) => n.unread);
    if (activeTab === 'mentions') return items.filter((n) => n.type === 'mention');
    return items;
  }, [items, activeTab]);

  const internalUnread = items.filter((n) => n.unread).length;
  const mentionsCount = items.filter((n) => n.type === 'mention').length;

  // Bell badge: in demo mode, mirror the internal unread count so the
  // bell stays in sync with the panel state. Outside demo, defer to
  // whatever the page passes in.
  const badge = demoOn ? internalUnread : unreadCount;

  // ── Actions ────────────────────────────────────────────────────────
  const markAllRead = () => {
    setReadIds(new Set(DEMO_NOTIFICATIONS.map((n) => n.id)));
  };
  const dismissOne = (id: string) => {
    setDismissedIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  };
  const clearAll = () => {
    setDismissedIds(new Set(DEMO_NOTIFICATIONS.map((n) => n.id)));
  };
  const restoreAll = () => {
    setDismissedIds(new Set());
    setReadIds(new Set());
  };

  // True when the demo panel has been emptied via dismiss/clear.
  // Differentiates the "designer just cleared it" state from the
  // baseline "no notifications yet" empty state — only the former
  // shows the Restore button.
  const isClearedDemo = demoOn && items.length === 0;

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="relative flex h-7 w-7 items-center justify-center rounded-[8px] border border-[var(--stroke-sub-300)] bg-white text-[var(--neutral-sub-600)] hover:bg-[var(--neutral-weak-50)] hover:text-[var(--neutral-strong-950)] focus:outline-none focus-visible:ring-[3px] focus-visible:ring-[var(--primary-alpha-16)]"
        aria-label="Notifications"
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <Bell className="h-3.5 w-3.5" strokeWidth={2} />
        {badge > 0 && (
          <span
            className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-[var(--error)] ring-2 ring-white"
            aria-hidden
          />
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-label="Notifications"
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: -6, scale: 0.97 }}
            animate={reduce ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.2, ease: EASE_EMPH }}
            style={{ transformOrigin: 'top right' }}
            className="absolute right-0 z-50 mt-2 w-[380px] overflow-hidden rounded-[12px] border border-[var(--stroke-soft-200)] bg-white shadow-[0_12px_32px_rgba(23,23,23,0.10),0_2px_8px_rgba(23,23,23,0.04)]"
          >
            {/* Header */}
            <div className="flex items-center justify-between gap-2 border-b border-[var(--stroke-soft-200)] px-[16px] py-[8px]">
              <div className="flex items-center gap-2">
                <h2 className="text-[14px] font-semibold tracking-[-0.01em] text-[var(--neutral-strong-950)]">
                  Notifications
                </h2>
                {badge > 0 && (
                  <span
                    className="inline-flex h-[18px] items-center justify-center rounded-[5px] px-[6px] text-[10.5px] font-bold text-white tabular-nums"
                    style={{ backgroundColor: 'var(--error)' }}
                  >
                    {badge}
                  </span>
                )}
              </div>
              <div className="-mr-[7px] flex items-center gap-1">
                <button
                  type="button"
                  disabled={internalUnread === 0}
                  onClick={markAllRead}
                  className="inline-flex h-7 items-center gap-1 rounded-[7px] px-2 text-[12px] font-medium text-[var(--neutral-sub-600)] hover:bg-[var(--neutral-weak-50)] hover:text-[var(--neutral-strong-950)] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" strokeWidth={2} />
                  Mark all read
                </button>
                <Link
                  href="/dashboard/settings#notifications"
                  onClick={() => setOpen(false)}
                  className="inline-flex h-7 w-7 items-center justify-center rounded-[7px] text-[var(--neutral-soft-400)] hover:bg-[var(--neutral-weak-50)] hover:text-[var(--neutral-strong-950)]"
                  aria-label="Notification settings"
                >
                  <SettingsIcon className="h-3.5 w-3.5" strokeWidth={2} />
                </Link>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex items-center gap-1 border-b border-[var(--stroke-soft-200)] px-3 py-2">
              {(
                [
                  { id: 'all',      label: 'All',      count: items.length },
                  { id: 'unread',   label: 'Unread',   count: internalUnread },
                  { id: 'mentions', label: 'Mentions', count: mentionsCount },
                ] as { id: Tab; label: string; count: number }[]
              ).map((t) => {
                const active = activeTab === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setActiveTab(t.id)}
                    className={[
                      'inline-flex h-6 items-center gap-1.5 rounded-[6px] px-2.5 text-[12px] font-medium',
                      active
                        ? 'bg-[var(--primary-alpha-10)] text-[var(--primary-base)]'
                        : 'text-[var(--neutral-sub-600)] hover:bg-[var(--neutral-weak-50)] hover:text-[var(--neutral-strong-950)]',
                    ].join(' ')}
                  >
                    {t.label}
                    {t.count > 0 && (
                      <span
                        className="text-[10.5px] font-bold tabular-nums"
                        style={{
                          color: active
                            ? 'var(--primary-base)'
                            : 'var(--neutral-soft-400)',
                        }}
                      >
                        {t.count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* List OR empty state */}
            {filtered.length > 0 ? (
              <ul className="max-h-[420px] overflow-y-auto divide-y divide-[var(--stroke-soft-200)]">
                <AnimatePresence initial={false}>
                  {filtered.map((n) => (
                    <NotificationRow
                      key={n.id}
                      item={n}
                      onDismiss={() => dismissOne(n.id)}
                      onNavigate={() => setOpen(false)}
                    />
                  ))}
                </AnimatePresence>
              </ul>
            ) : (
              <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
                <div className="relative mb-5 flex items-center justify-center" aria-hidden>
                  <div
                    className="absolute h-[88px] w-[88px] rounded-full"
                    style={{
                      background:
                        'radial-gradient(circle, rgba(250,115,25,0.08) 0%, rgba(250,115,25,0) 65%)',
                    }}
                  />
                  <div className="absolute h-[64px] w-[64px] rounded-full border border-[var(--stroke-soft-200)]" />
                  <div className="absolute h-[48px] w-[48px] rounded-full border border-[var(--stroke-soft-200)]" />
                  <div className="relative flex h-9 w-9 items-center justify-center rounded-full bg-white shadow-[0_1px_2px_rgba(23,23,23,0.06)] ring-1 ring-[var(--stroke-soft-200)]">
                    <BellOff
                      className="h-4 w-4"
                      style={{ color: 'var(--primary-base)' }}
                      strokeWidth={2}
                    />
                  </div>
                </div>
                <h3 className="text-[13.5px] font-semibold tracking-[-0.01em] text-[var(--neutral-strong-950)]">
                  {activeTab === 'unread'
                    ? 'No unread notifications'
                    : activeTab === 'mentions'
                      ? 'No mentions'
                      : "You're all caught up"}
                </h3>
                <p className="mt-1 max-w-[260px] text-[12px] leading-[1.55] text-[var(--neutral-sub-600)]">
                  {activeTab === 'all' &&
                    "When agents need approval, hit a block, or trigger an alert, it'll show up here."}
                  {activeTab === 'unread' &&
                    "Everything's been read. Switch to All to see past notifications."}
                  {activeTab === 'mentions' &&
                    'You’ll see a mention when a teammate @-names you in an approval thread.'}
                </p>
                {isClearedDemo && (
                  <button
                    type="button"
                    onClick={restoreAll}
                    className="mt-5 inline-flex h-7 items-center gap-1.5 rounded-[8px] border border-[var(--stroke-sub-300)] bg-white px-2.5 text-[12px] font-medium text-[var(--neutral-sub-600)] shadow-[0_1px_2px_rgba(23,23,23,0.04)] transition-colors hover:bg-[var(--neutral-weak-50)] hover:text-[var(--neutral-strong-950)]"
                  >
                    <RotateCcw className="h-3 w-3" strokeWidth={2.25} />
                    Restore demo notifications
                  </button>
                )}
              </div>
            )}

            {/* Footer */}
            <div className="flex items-center justify-between border-t border-[var(--stroke-soft-200)] bg-[var(--neutral-weak-50)] px-3 py-2">
              <Link
                href="/dashboard/settings#notifications"
                onClick={() => setOpen(false)}
                className="inline-flex items-center gap-1 text-[12px] font-medium text-[var(--neutral-sub-600)] hover:text-[var(--primary-base)]"
              >
                Manage notifications
                <ArrowUpRight className="h-3 w-3" strokeWidth={2} />
              </Link>
              {/* Clear all only renders when there's anything to clear,
                  and only in demo mode (where the action is meaningful
                  given the local seed). Outside demo, this would be a
                  destructive action against real data — keep it gated
                  until the real notifications API is wired. */}
              {demoOn && items.length > 0 && (
                <button
                  type="button"
                  onClick={clearAll}
                  className="inline-flex h-6 items-center gap-1 rounded-[6px] px-2 text-[11.5px] font-medium text-[var(--neutral-sub-600)] transition-colors hover:bg-[var(--error-lighter)] hover:text-[var(--error)]"
                >
                  <Trash2 className="h-3 w-3" strokeWidth={2.25} />
                  Clear all
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Row ───────────────────────────────────────────────────────────────

interface NotificationRowProps {
  item: NotificationItem;
  onDismiss: () => void;
  onNavigate: () => void;
}

function NotificationRow({ item, onDismiss, onNavigate }: NotificationRowProps) {
  const reduce = useReducedMotion();
  const meta = TYPE_META[item.type];
  const Icon = meta.icon;

  return (
    <motion.li
      // Layout animation handles the gap-fill when the row above is
      // dismissed — Framer's `layout` prop animates position changes
      // without us writing keyframes.
      layout={!reduce}
      initial={reduce ? false : { opacity: 0, y: -2 }}
      animate={{ opacity: 1, y: 0 }}
      exit={reduce ? { opacity: 0 } : { opacity: 0, x: 12, height: 0, paddingTop: 0, paddingBottom: 0 }}
      transition={{ duration: 0.18, ease: EASE_EMPH }}
      className="group/notif relative bg-white transition-colors hover:bg-[var(--neutral-weak-50)]"
    >
      <Link
        href={item.href}
        onClick={onNavigate}
        // pr-9 reserves space for the absolute-positioned dismiss
        // button (h-6 w-6 sits flush at top-2 right-2) so long titles
        // wrap before they collide with the X glyph.
        className="block px-3.5 py-3 pr-9"
      >
        <div className="flex items-start gap-2.5">
          {/* Concentric-ring icon mark. Three layers:
              1. Outer halo (36×36) — soft radial glow in the tone color,
                 ~10% at the centre fading to 0. Adds presence and ties
                 the mark to the tone family even at a glance.
              2. Outer ring (36×36) — 1px tone-tinted border at 14%.
                 Picks up the Policies / Freeze concentric-ring pattern
                 but recolors it per tone instead of stroke-soft-200.
              3. Inner sticker (28×28) — white-to-tone-lighter gradient
                 with a top inset highlight, a 1px tone ring at 16%, a
                 small drop shadow, and the tone-colored icon.
              Reads as the same governance-event family as the Policies
              and Freeze rows, with extra depth that justifies its
              presence in a popover next to a busy topbar. */}
          <span
            className="relative mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center"
            aria-hidden
          >
            {/* Outer halo */}
            <span
              className="absolute inset-0 rounded-full"
              style={{
                background: `radial-gradient(circle, rgba(${TONE_RGB[meta.tone]}, 0.10) 0%, rgba(${TONE_RGB[meta.tone]}, 0) 70%)`,
              }}
            />
            {/* Outer ring */}
            <span
              className="absolute inset-0 rounded-full"
              style={{
                borderWidth: '1px',
                borderStyle: 'solid',
                borderColor: `rgba(${TONE_RGB[meta.tone]}, 0.14)`,
              }}
            />
            {/* Inner sticker. The gradient is pushed past 100% (140%)
                so the tone tint only kisses the very bottom edge —
                the icon itself sits on near-white, which keeps the
                stroke crisp regardless of tone. */}
            <span
              className="relative inline-flex h-7 w-7 items-center justify-center rounded-full"
              style={{
                background: `linear-gradient(180deg, #ffffff 0%, ${TONE_BG[meta.tone]} 140%)`,
                boxShadow: [
                  // Top inset highlight — "wet glass" sheen
                  'inset 0 1px 0 rgba(255,255,255,0.65)',
                  // 1px tone-tinted ring (replaces neutral stroke).
                  // Bumped from 0.18 → 0.28 so the ring carries enough
                  // contrast to anchor the sticker without a fill.
                  `0 0 0 1px rgba(${TONE_RGB[meta.tone]}, 0.28)`,
                  // Colored micro-shadow — ties the sticker to its tone
                  // even where the rest of the row is achromatic
                  `0 1px 2px rgba(${TONE_RGB[meta.tone]}, 0.16)`,
                  // Neutral drop shadow for grounding
                  '0 1px 1px rgba(23,23,23,0.04)',
                ].join(','),
              }}
            >
              <Icon
                className="h-[14px] w-[14px]"
                style={{ color: TONE_FG[meta.tone] }}
                strokeWidth={2.5}
              />
            </span>
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              {item.unread && (
                <span
                  className="inline-block h-1.5 w-1.5 shrink-0 rounded-full"
                  style={{ backgroundColor: 'var(--primary-base)' }}
                  aria-label="Unread"
                />
              )}
              <p
                className={[
                  'truncate text-[13px] tracking-[-0.005em]',
                  item.unread
                    ? 'font-semibold text-[var(--neutral-strong-950)]'
                    : 'font-medium text-[var(--neutral-sub-600)]',
                ].join(' ')}
              >
                {item.title}
              </p>
            </div>
            {item.body && (
              <p className="mt-0.5 line-clamp-2 text-[12px] leading-[1.45] text-[var(--neutral-sub-600)]">
                {item.body}
              </p>
            )}
            <div className="mt-1 flex items-center gap-1.5 text-[11px] text-[var(--neutral-soft-400)]">
              <span
                className="inline-flex h-[15px] items-center rounded-[4px] px-1.5 text-[9.5px] font-semibold uppercase tracking-[0.05em]"
                style={{
                  backgroundColor: TONE_BG[meta.tone],
                  color: TONE_FG[meta.tone],
                }}
              >
                {meta.label}
              </span>
              {item.meta && (
                <>
                  <span aria-hidden>·</span>
                  <span className="truncate">{item.meta}</span>
                </>
              )}
              <span className="ml-auto shrink-0 tabular-nums">
                {item.timeLabel}
              </span>
            </div>
          </div>
        </div>
      </Link>

      {/* Dismiss button — sits above the Link's anchor at the row's
          top-right. Stops propagation so clicking X doesn't also
          trigger the row navigation. */}
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onDismiss();
        }}
        aria-label="Dismiss notification"
        className="absolute right-2 top-2.5 inline-flex h-6 w-6 items-center justify-center rounded-[6px] text-[var(--neutral-soft-400)] opacity-0 transition-opacity hover:bg-[var(--neutral-weak-50)] hover:text-[var(--neutral-strong-950)] focus:opacity-100 group-hover/notif:opacity-100"
      >
        <X className="h-3 w-3" strokeWidth={2.25} />
      </button>
    </motion.li>
  );
}
