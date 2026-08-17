'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import {
  Bell,
  BellOff,
  CheckCircle2,
  Loader2,
  Settings as SettingsIcon,
} from 'lucide-react';
import { api } from '@/lib/api';
import {
  NOTIFICATION_PREFERENCE_FIELDS,
  normalizeNotificationType,
} from '@/lib/notifications';
import type { UserNotification } from '@/lib/types';
import { Badge } from '@/components/ui/Badge';
import ErrorBanner from '@/components/ui/ErrorBanner';
import { RelativeTime } from '@/components/ui/RelativeTime';
import { Skeleton } from '@/components/ui/Skeleton';

const EASE_EMPH: [number, number, number, number] = [0.2, 0.8, 0.2, 1];
const PANEL_LIMIT = 20;
const REFRESH_INTERVAL_MS = 60_000;

type NotificationView = 'all' | 'unread';

function getNotificationBadgeMeta(type: string) {
  const normalized = normalizeNotificationType(type);
  const fallback = type.trim().toUpperCase() || 'ALLOW';
  const match = NOTIFICATION_PREFERENCE_FIELDS.find((item) => item.type === normalized);

  return {
    label: match?.badgeLabel ?? fallback,
    tone: match?.tone ?? 'neutral',
  } as const;
}

function NotificationsPanelSkeleton() {
  return (
    <div className="space-y-2 p-3">
      {Array.from({ length: 4 }).map((_, index) => (
        <div
          key={index}
          className="rounded-[10px] border border-[var(--stroke-soft-200)] bg-white p-3"
        >
          <div className="flex items-start gap-3">
            <Skeleton variant="circle" className="mt-1 h-2.5 w-2.5" />
            <div className="min-w-0 flex-1 space-y-2">
              <div className="flex items-center gap-2">
                <Skeleton className="h-[13px] w-32" />
                <Skeleton className="h-[19px] w-16 rounded-[6px]" />
              </div>
              <Skeleton className="h-[12px] w-40" />
              <Skeleton className="h-[11px] w-24" />
            </div>
            <Skeleton className="h-[11px] w-14" />
          </div>
        </div>
      ))}
    </div>
  );
}

function NotificationsEmptyState({ unreadOnly }: { unreadOnly: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-10 text-center">
      <div className="flex h-10 w-10 items-center justify-center rounded-full border border-[var(--stroke-soft-200)] bg-[var(--neutral-weak-50)] text-[var(--neutral-soft-400)]">
        <BellOff className="h-4 w-4" strokeWidth={2} />
      </div>
      <h3 className="mt-4 text-[13px] font-semibold text-[var(--neutral-strong-950)]">
        {unreadOnly ? 'No unread notifications' : 'No notifications yet'}
      </h3>
      <p className="mt-1 max-w-[260px] text-[12px] leading-[1.55] text-[var(--neutral-sub-600)]">
        {unreadOnly
          ? 'Everything in the panel has already been read.'
          : 'The bell will show Allow, Deny, Approval, and Rewrite decisions here.'}
      </p>
      <Link
        href="/dashboard/settings#profile"
        className="mt-4 text-[12px] font-medium text-[var(--neutral-sub-600)] underline decoration-[var(--stroke-sub-300)] underline-offset-4 hover:text-[var(--neutral-strong-950)]"
      >
        Manage notification filters
      </Link>
    </div>
  );
}

export function NotificationsPanel() {
  const reduce = useReducedMotion();
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<NotificationView>('all');
  const [notifications, setNotifications] = useState<UserNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [markingAll, setMarkingAll] = useState(false);
  const [markingId, setMarkingId] = useState<string | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const requestIdRef = useRef(0);

  const loadNotifications = useCallback(
    async (
      nextView: NotificationView,
      options: { silent?: boolean } = {},
    ) => {
      const requestId = requestIdRef.current + 1;
      requestIdRef.current = requestId;
      if (!options.silent) {
        setLoading(true);
      }

      try {
        const data = await api.getNotifications({
          unread_only: nextView === 'unread',
          limit: PANEL_LIMIT,
          offset: 0,
        });
        if (requestId !== requestIdRef.current) return;
        setNotifications(data.items);
        setTotal(data.total);
        setUnreadCount(data.unread_count);
        setError(null);
      } catch (err) {
        if (requestId !== requestIdRef.current) return;
        setError(
          err instanceof Error ? err.message : 'Could not load notifications.',
        );
      } finally {
        if (requestId === requestIdRef.current) {
          setLoading(false);
        }
      }
    },
    [],
  );

  useEffect(() => {
    void loadNotifications('all');
  }, [loadNotifications]);

  useEffect(() => {
    if (!open) return;
    void loadNotifications(view);
  }, [open, view, loadNotifications]);

  useEffect(() => {
    const tick = window.setInterval(() => {
      void loadNotifications(open ? view : 'all', { silent: !open });
    }, REFRESH_INTERVAL_MS);
    return () => window.clearInterval(tick);
  }, [open, view, loadNotifications]);

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

  const handleMarkAllRead = useCallback(async () => {
    if (markingAll || unreadCount === 0) return;
    setMarkingAll(true);
    try {
      await api.markAllNotificationsRead();
      setUnreadCount(0);
      setNotifications((prev) =>
        view === 'unread'
          ? []
          : prev.map((item) => ({
              ...item,
              is_read: true,
              read_at: item.read_at ?? new Date().toISOString(),
            })),
      );
      if (view === 'unread') {
        setTotal(0);
      }
      setError(null);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Could not update notifications.',
      );
    } finally {
      setMarkingAll(false);
    }
  }, [markingAll, unreadCount, view]);

  const handleMarkRead = useCallback(
    async (notification: UserNotification) => {
      if (notification.is_read || markingId === notification.id) return;
      setMarkingId(notification.id);
      try {
        const updated = await api.markNotificationRead(notification.id);
        setUnreadCount((prev) => Math.max(0, prev - 1));
        setNotifications((prev) => {
          const next = prev.map((item) =>
            item.id === notification.id ? updated : item,
          );
          return view === 'unread'
            ? next.filter((item) => !item.is_read)
            : next;
        });
        if (view === 'unread') {
          setTotal((prev) => Math.max(0, prev - 1));
        }
        setError(null);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Could not update notifications.',
        );
      } finally {
        setMarkingId(null);
      }
    },
    [markingId, view],
  );

  const showingFooterSummary = useMemo(
    () => total > notifications.length,
    [notifications.length, total],
  );

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="relative flex h-7 w-7 items-center justify-center rounded-[8px] border border-[var(--stroke-sub-300)] bg-white text-[var(--neutral-sub-600)] hover:bg-[var(--neutral-weak-50)] hover:text-[var(--neutral-strong-950)] focus:outline-none focus-visible:ring-[3px] focus-visible:ring-[var(--primary-alpha-16)]"
        aria-label="Notifications"
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <Bell className="h-3.5 w-3.5" strokeWidth={2} />
        {unreadCount > 0 && (
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
            <div className="flex items-center justify-between gap-3 border-b border-[var(--stroke-soft-200)] px-4 py-3">
              <div className="flex items-center gap-2">
                <h2 className="text-[14px] font-semibold tracking-[-0.01em] text-[var(--neutral-strong-950)]">
                  Notifications
                </h2>
                {unreadCount > 0 && (
                  <span className="inline-flex h-[18px] items-center justify-center rounded-[5px] bg-[var(--error-lighter)] px-[6px] text-[10.5px] font-bold text-[var(--error-dark)] tabular-nums">
                    {unreadCount}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => {
                    void handleMarkAllRead();
                  }}
                  disabled={unreadCount === 0 || markingAll}
                  className="inline-flex h-7 items-center gap-1 rounded-[7px] px-2 text-[12px] font-medium text-[var(--neutral-sub-600)] hover:bg-[var(--neutral-weak-50)] hover:text-[var(--neutral-strong-950)] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {markingAll ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={2} />
                  ) : (
                    <CheckCircle2 className="h-3.5 w-3.5" strokeWidth={2} />
                  )}
                  Mark all read
                </button>
                <Link
                  href="/dashboard/settings#profile"
                  onClick={() => setOpen(false)}
                  className="inline-flex h-7 w-7 items-center justify-center rounded-[7px] text-[var(--neutral-soft-400)] hover:bg-[var(--neutral-weak-50)] hover:text-[var(--neutral-strong-950)]"
                  aria-label="Notification settings"
                >
                  <SettingsIcon className="h-3.5 w-3.5" strokeWidth={2} />
                </Link>
              </div>
            </div>

            <div className="flex items-center gap-1 border-b border-[var(--stroke-soft-200)] px-3 py-2">
              {(['all', 'unread'] as const).map((tab) => {
                const active = view === tab;
                return (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setView(tab)}
                    className={
                      active
                        ? 'inline-flex h-6 items-center rounded-[6px] bg-[var(--neutral-weak-50)] px-2.5 text-[12px] font-medium text-[var(--neutral-strong-950)]'
                        : 'inline-flex h-6 items-center rounded-[6px] px-2.5 text-[12px] font-medium text-[var(--neutral-sub-600)] hover:bg-[var(--neutral-weak-50)] hover:text-[var(--neutral-strong-950)]'
                    }
                  >
                    {tab === 'all' ? 'All' : 'Unread'}
                  </button>
                );
              })}
            </div>

            {error ? (
              <div className="p-3">
                <ErrorBanner
                  message={error}
                  onDismiss={() => setError(null)}
                  onRetry={() => {
                    void loadNotifications(view);
                  }}
                />
              </div>
            ) : loading ? (
              <NotificationsPanelSkeleton />
            ) : notifications.length === 0 ? (
              <NotificationsEmptyState unreadOnly={view === 'unread'} />
            ) : (
              <>
                <div className="max-h-[420px] overflow-y-auto p-3">
                  <div className="space-y-2">
                    {notifications.map((notification) => {
                      const typeMeta = getNotificationBadgeMeta(
                        notification.notification_type,
                      );
                      const target = notification.target_descriptor?.trim();
                      const room = notification.room_name?.trim();
                      const isBusy = markingId === notification.id;

                      return (
                        <button
                          key={notification.id}
                          type="button"
                          onClick={() => {
                            void handleMarkRead(notification);
                          }}
                          title={notification.is_read ? 'Read' : 'Mark as read'}
                          className={
                            notification.is_read
                              ? 'w-full rounded-[10px] border border-[var(--stroke-soft-200)] bg-white p-3 text-left transition-colors hover:bg-[var(--neutral-weak-50)]/60 focus:outline-none focus-visible:ring-[3px] focus-visible:ring-[var(--primary-alpha-16)]'
                              : 'w-full rounded-[10px] border border-[var(--stroke-soft-200)] bg-[var(--neutral-weak-50)]/60 p-3 text-left transition-colors hover:bg-[var(--neutral-weak-50)] focus:outline-none focus-visible:ring-[3px] focus-visible:ring-[var(--primary-alpha-16)]'
                          }
                        >
                          <div className="flex items-start gap-3">
                            <span
                              className={
                                notification.is_read
                                  ? 'mt-[6px] h-2.5 w-2.5 rounded-full border border-[var(--stroke-sub-300)] bg-white'
                                  : 'mt-[6px] h-2.5 w-2.5 rounded-full bg-[var(--error)]'
                              }
                              aria-hidden
                            />
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="truncate font-mono text-[12px] font-medium text-[var(--neutral-strong-950)]">
                                  {notification.tool_name}
                                </p>
                                <Badge tone={typeMeta.tone} uppercase>
                                  {typeMeta.label}
                                </Badge>
                              </div>
                              {target && (
                                <p className="mt-1 truncate text-[12px] text-[var(--neutral-sub-600)]">
                                  {target}
                                </p>
                              )}
                              {room && (
                                <p className="mt-1 text-[11px] text-[var(--neutral-soft-400)]">
                                  {room}
                                </p>
                              )}
                            </div>
                            <div className="shrink-0 text-right">
                              <RelativeTime
                                timestamp={notification.created_at}
                                className="text-[11px] text-[var(--neutral-soft-400)]"
                              />
                              {isBusy && (
                                <div className="mt-1 flex justify-end">
                                  <Loader2
                                    className="h-3 w-3 animate-spin text-[var(--neutral-soft-400)]"
                                    strokeWidth={2}
                                  />
                                </div>
                              )}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {showingFooterSummary && (
                  <div className="border-t border-[var(--stroke-soft-200)] px-4 py-2">
                    <p className="text-[11px] text-[var(--neutral-soft-400)]">
                      Showing {notifications.length} of {total} notifications.
                    </p>
                  </div>
                )}
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
