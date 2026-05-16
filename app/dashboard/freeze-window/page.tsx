'use client';

import { useCallback, useEffect, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import {
  Calendar,
  ChevronDown,
  ChevronRight,
  Clock,
  Edit2,
  Plus,
  Trash2,
} from 'lucide-react';
import { api } from '@/lib/api';
import { useUser } from '@/lib/hooks';
import { formatFullTimestamp } from '@/lib/utils';
import Topbar from '@/components/layout/Topbar';
import EmptyState from '@/components/ui/EmptyState';
import ErrorBanner from '@/components/ui/ErrorBanner';
import { FreezeWindowSkeleton } from '@/components/ui/PageSkeletons';
import { useToast } from '@/components/ui/Toast';
import { Button } from '@/components/ui/Button';
import { DUR, EASE, fadeUp, fadeUpSm, staggerContainer } from '@/lib/motion';

interface FreezeWindow {
  id: string;
  user_id: string;
  timezone: string;
  work_days: number[];
  window_start: string;
  window_end: string;
  created_at?: string;
}

interface FreezeWindowFormData {
  timezone: string;
  work_days: number[];
  window_start: string;
  window_end: string;
}

function getDayLabels(days: number[]): string {
  if (days.length === 0) return 'No days selected';
  if (days.length === 7) return 'Every day';
  if (days.length === 5 && days.join(',') === '0,1,2,3,4') return 'Weekdays';
  return days.map((d) => DAYS_OF_WEEK[d].label).join(', ');
}

const DAYS_OF_WEEK = [
  { label: 'Mon', full: 'Monday',   value: 0 },
  { label: 'Tue', full: 'Tuesday',  value: 1 },
  { label: 'Wed', full: 'Wednesday', value: 2 },
  { label: 'Thu', full: 'Thursday',  value: 3 },
  { label: 'Fri', full: 'Friday',    value: 4 },
  { label: 'Sat', full: 'Saturday',  value: 5 },
  { label: 'Sun', full: 'Sunday',    value: 6 },
];

const TIMEZONES = ['UTC', 'America/New_York', 'America/Chicago', 'Asia/Kolkata', 'Australia/Sydney'];

export default function FreezeWindowPage() {
  const { user, isLoading: userLoading } = useUser();
  const reduce = useReducedMotion();
  const toast = useToast();
  const [windows, setWindows] = useState<FreezeWindow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [expandedWindow, setExpandedWindow] = useState<string | null>(null);
  const [editingWindowId, setEditingWindowId] = useState<string | null>(null);
  const [formData, setFormData] = useState<FreezeWindowFormData>({
    timezone: 'UTC',
    work_days: [],
    window_start: '09:00',
    window_end: '17:00',
  });

  const fetchWindows = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const data = await api.getFreezeWindows();
      setWindows(data || []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch freeze windows');
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    if (user?.id) fetchWindows();
    else if (!userLoading) setLoading(false);
  }, [user?.id, userLoading, fetchWindows]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id) return;
    try {
      const payload = {
        timezone: formData.timezone,
        work_days: formData.work_days,
        window_start: `${formData.window_start}:00`,
        window_end: `${formData.window_end}:00`,
      };
      if (editingWindowId) {
        await api.updateFreezeWindow(editingWindowId, payload);
        toast.success('Freeze window updated', {
          description: 'Your schedule is now live.',
        });
      } else {
        await api.createFreezeWindow(payload);
        toast.success('Freeze window created', {
          description: `${formData.window_start} to ${formData.window_end} · ${formData.timezone}`,
        });
      }
      await fetchWindows();
      resetForm();
      setShowForm(false);
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : 'Failed to save freeze window';
      setError(msg);
      toast.error("Couldn't save freeze window", { description: msg });
    }
  };

  const handleDelete = async (windowId: string) => {
    if (!user?.id) return;
    try {
      await api.deleteFreezeWindow(windowId);
      await fetchWindows();
      setError(null);
      toast.success('Freeze window deleted');
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : 'Failed to delete freeze window';
      setError(msg);
      toast.error("Couldn't delete freeze window", { description: msg });
    }
  };

  const handleEdit = (window: FreezeWindow) => {
    setFormData({
      timezone: window.timezone,
      work_days: window.work_days,
      window_start: window.window_start.slice(0, 5),
      window_end: window.window_end.slice(0, 5),
    });
    setEditingWindowId(window.id);
    setShowForm(true);
    setExpandedWindow(null);
  };

  const resetForm = () => {
    setFormData({
      timezone: 'UTC',
      work_days: [],
      window_start: '09:00',
      window_end: '17:00',
    });
    setEditingWindowId(null);
  };

  const toggleWorkDay = (day: number) =>
    setFormData((prev) => ({
      ...prev,
      work_days: prev.work_days.includes(day)
        ? prev.work_days.filter((d) => d !== day)
        : [...prev.work_days, day].sort(),
    }));


  if (userLoading || loading) {
    return (
      <>
        <Topbar title="Freeze Windows" subtitle="When agents should stand down" />
        <div className="mx-auto max-w-[1320px] px-4 py-6 sm:px-6 sm:py-7 lg:px-8 lg:py-8">
          <FreezeWindowSkeleton />
        </div>
      </>
    );
  }

  return (
    <>
      <Topbar title="Freeze Windows" subtitle="When agents should stand down" />
      <div className="mx-auto max-w-[1320px] px-4 py-6 sm:px-6 sm:py-7 lg:px-8 lg:py-8">
        {error && (
          <div className="mb-6">
            <ErrorBanner
              message={error}
              onDismiss={() => setError(null)}
              onRetry={fetchWindows}
            />
          </div>
        )}

        <motion.header
          className="mb-6 flex flex-wrap items-end justify-between gap-4"
          variants={staggerContainer(0.05, 0.04)}
          initial={reduce ? false : 'hidden'}
          animate="show"
        >
          <div>
            <motion.p
              variants={fadeUp}
              className="mb-2 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-[var(--neutral-soft-400)]"
            >
              Deployment freeze
            </motion.p>
            <motion.h1
              variants={fadeUp}
              className="text-[26px] font-semibold leading-[1.1] tracking-[-0.03em] text-[var(--neutral-strong-950)]"
            >
              Windows when agents shouldn&apos;t ship
            </motion.h1>
            <motion.p
              variants={fadeUp}
              className="mt-2 text-[13.5px] text-[var(--neutral-sub-600)]"
            >
              Block write actions during scheduled windows: releases, on-call hours, weekends.
            </motion.p>
          </div>
          <motion.div variants={fadeUp}>
            <Button
              variant="primary"
              onClick={() => {
                setShowForm((s) => !s);
                if (showForm) resetForm();
              }}
              leadingIcon={<Plus className="h-3.5 w-3.5" strokeWidth={2.25} />}
            >
              {showForm ? 'Cancel' : 'New Window'}
            </Button>
          </motion.div>
        </motion.header>

        {showForm && (
          <motion.div
            className="mb-6 overflow-hidden rounded-[12px] border border-[var(--stroke-soft-200)] bg-white shadow-[0_1px_2px_rgba(23,23,23,0.04)]"
            initial={reduce ? false : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: DUR.default, ease: EASE.out }}
          >
            <div className="border-b border-[var(--stroke-soft-200)] p-4">
              <h2 className="text-[14px] font-semibold tracking-[-0.01em] text-[var(--neutral-strong-950)]">
                {editingWindowId ? 'Edit freeze window' : 'Create freeze window'}
              </h2>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-5">
              <div>
                <label className="mb-1.5 block text-[12px] font-medium text-[var(--neutral-sub-600)]">
                  Timezone
                </label>
                <select
                  value={formData.timezone}
                  onChange={(e) =>
                    setFormData({ ...formData, timezone: e.target.value })
                  }
                  className="h-9 w-full rounded-[8px] border border-[var(--stroke-sub-300)] bg-white px-3 text-[13px] text-[var(--neutral-strong-950)] focus:border-[var(--primary-base)] focus:outline-none focus:ring-[3px] focus:ring-[var(--primary-alpha-16)]"
                >
                  {TIMEZONES.map((tz) => (
                    <option key={tz} value={tz}>
                      {tz}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-2 block text-[12px] font-medium text-[var(--neutral-sub-600)]">
                  Work days (when freeze is in effect)
                </label>
                <div className="flex flex-wrap gap-2">
                  {DAYS_OF_WEEK.map((day) => {
                    const selected = formData.work_days.includes(day.value);
                    return (
                      <button
                        key={day.value}
                        type="button"
                        onClick={() => toggleWorkDay(day.value)}
                        className={[
                          'h-8 rounded-[8px] px-3 text-[12.5px] font-medium transition-colors',
                          selected
                            ? 'border border-[var(--primary-base)] bg-[var(--primary-alpha-10)] text-[var(--primary-base)]'
                            : 'border border-[var(--stroke-sub-300)] bg-white text-[var(--neutral-sub-600)] hover:bg-[var(--neutral-weak-50)]',
                        ].join(' ')}
                      >
                        {day.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1.5 block text-[12px] font-medium text-[var(--neutral-sub-600)]">
                    Start time
                  </label>
                  <input
                    type="time"
                    value={formData.window_start}
                    onChange={(e) =>
                      setFormData({ ...formData, window_start: e.target.value })
                    }
                    className="h-9 w-full rounded-[8px] border border-[var(--stroke-sub-300)] bg-white px-3 text-[13px] text-[var(--neutral-strong-950)] focus:border-[var(--primary-base)] focus:outline-none focus:ring-[3px] focus:ring-[var(--primary-alpha-16)]"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-[12px] font-medium text-[var(--neutral-sub-600)]">
                    End time
                  </label>
                  <input
                    type="time"
                    value={formData.window_end}
                    onChange={(e) =>
                      setFormData({ ...formData, window_end: e.target.value })
                    }
                    className="h-9 w-full rounded-[8px] border border-[var(--stroke-sub-300)] bg-white px-3 text-[13px] text-[var(--neutral-strong-950)] focus:border-[var(--primary-base)] focus:outline-none focus:ring-[3px] focus:ring-[var(--primary-alpha-16)]"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    setShowForm(false);
                    resetForm();
                  }}
                >
                  Cancel
                </Button>
                <Button type="submit" variant="primary">
                  {editingWindowId ? 'Update window' : 'Create window'}
                </Button>
              </div>
            </form>
          </motion.div>
        )}

        {windows.length === 0 ? (
          <div className="overflow-hidden rounded-[12px] border border-[var(--stroke-soft-200)] bg-white shadow-[0_1px_2px_rgba(23,23,23,0.04)]">
            <EmptyState
              icon={<Clock className="h-5 w-5" />}
              title="No freeze windows yet"
              description="Create a window to block deployments during specific times."
              action={
                <Button
                  variant="primary"
                  onClick={() => {
                    setShowForm(true);
                    resetForm();
                  }}
                  leadingIcon={<Plus className="h-3.5 w-3.5" strokeWidth={2.25} />}
                >
                  Create freeze window
                </Button>
              }
            />
          </div>
        ) : (
          <motion.div
            className="overflow-hidden rounded-[12px] border border-[var(--stroke-soft-200)] bg-white shadow-[0_1px_2px_rgba(23,23,23,0.04)]"
            initial={reduce ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: DUR.slow, ease: EASE.out, delay: 0.18 }}
          >
            <div className="flex items-center justify-between p-4">
              <h2 className="text-[14px] font-semibold tracking-[-0.01em] text-[var(--neutral-strong-950)]">
                Active freeze windows
              </h2>
              <span className="inline-flex h-[18px] items-center justify-center rounded-[5px] bg-[var(--neutral-weak-50)] px-[6px] text-[10.5px] font-bold tabular-nums text-[var(--neutral-sub-600)]">
                {windows.length.toLocaleString()}
              </span>
            </div>
            <motion.ul
              className="divide-y divide-[var(--stroke-soft-200)] border-t border-[var(--stroke-soft-200)]"
              variants={staggerContainer(0.03, 0.22)}
              initial={reduce ? false : 'hidden'}
              animate="show"
            >
              {windows.map((w) => (
                <FreezeWindowRow
                  key={w.id}
                  window={w}
                  isExpanded={expandedWindow === w.id}
                  onToggle={() =>
                    setExpandedWindow(expandedWindow === w.id ? null : w.id)
                  }
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                />
              ))}
            </motion.ul>
          </motion.div>
        )}
      </div>
    </>
  );
}

// ─── Single freeze-window row ────────────────────────────────────────────────
function FreezeWindowRow({
  window: w,
  isExpanded,
  onToggle,
  onEdit,
  onDelete,
}: {
  window: FreezeWindow;
  isExpanded: boolean;
  onToggle: () => void;
  onEdit: (w: FreezeWindow) => void;
  onDelete: (id: string) => void;
}) {
  // Delayed visual-expanded state — keeps the trigger row's gradient on
  // screen until the panel below has finished its exit animation,
  // preventing a perceived "snap back" during collapse.
  const [stillExpanded, setStillExpanded] = useState(isExpanded);
  useEffect(() => {
    if (isExpanded) setStillExpanded(true);
  }, [isExpanded]);

  return (
    <motion.li variants={fadeUpSm} className="bg-white">
      <div
        className={
          stillExpanded
            ? 'flex items-center gap-2 bg-gradient-to-b from-[var(--primary-lighter)]/55 to-[var(--primary-lighter)]/45 px-4 py-4 transition-colors sm:gap-3 sm:px-6'
            : 'flex items-center gap-2 px-4 py-4 transition-colors sm:gap-3 sm:px-6'
        }
      >
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] border border-[var(--stroke-soft-200)] bg-white">
          <Calendar className="h-4 w-4 text-[var(--neutral-sub-600)]" strokeWidth={2} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <p className="text-[13.5px] font-semibold text-[var(--neutral-strong-950)]">
              {getDayLabels(w.work_days)}
            </p>
            <span className="inline-flex items-center rounded-[6px] border border-[var(--stroke-soft-200)] bg-[var(--neutral-weak-50)] px-2 py-0.5 text-[11px] text-[var(--neutral-sub-600)]">
              {w.window_start.slice(0, 5)} → {w.window_end.slice(0, 5)}
            </span>
          </div>
          <p className="mt-0.5 text-[11.5px] text-[var(--neutral-soft-400)]">
            {w.timezone}
          </p>
        </div>
        {/* Edit / Delete — icon-only on mobile, label appears at sm+ */}
        <button
          type="button"
          onClick={() => onEdit(w)}
          aria-label="Edit"
          className="inline-flex h-8 items-center justify-center gap-1.5 rounded-[8px] border border-[var(--stroke-sub-300)] bg-white px-2 text-[12.5px] font-medium text-[var(--neutral-sub-600)] transition-colors hover:bg-[var(--neutral-weak-50)] sm:px-3"
        >
          <Edit2 className="h-3.5 w-3.5" strokeWidth={2} />
          <span className="hidden sm:inline">Edit</span>
        </button>
        <button
          type="button"
          onClick={() => {
            if (confirm('Delete this freeze window?')) onDelete(w.id);
          }}
          aria-label="Delete"
          className="inline-flex h-8 items-center justify-center gap-1.5 rounded-[8px] border border-[var(--stroke-sub-300)] bg-white px-2 text-[12.5px] font-medium text-[var(--neutral-sub-600)] transition-colors hover:bg-[var(--neutral-weak-50)] sm:px-3"
        >
          <Trash2 className="h-3.5 w-3.5" strokeWidth={2} />
          <span className="hidden sm:inline">Delete</span>
        </button>
        <button
          onClick={onToggle}
          className="rounded-md p-1 text-[var(--neutral-soft-400)] hover:bg-[var(--neutral-weak-50)] hover:text-[var(--neutral-strong-950)]"
          aria-label="Toggle details"
        >
          <ChevronDown
            className={`h-4 w-4 transition-transform duration-200 ${
              isExpanded ? 'rotate-0' : '-rotate-90'
            }`}
            strokeWidth={2}
          />
        </button>
      </div>

      <AnimatePresence
        initial={false}
        onExitComplete={() => setStillExpanded(false)}
      >
        {isExpanded && (
          <motion.div
            key="expanded"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.24, ease: [0.2, 0.8, 0.2, 1] }}
            style={{ overflow: 'hidden', willChange: 'height' }}
            className="bg-gradient-to-b from-[var(--primary-lighter)]/45 to-white"
          >
            <div className="px-6 pb-5 pt-1">
              <div className="overflow-hidden rounded-[10px] border border-[var(--stroke-soft-200)] bg-white p-4 shadow-[0_1px_2px_rgba(23,23,23,0.04)]">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.05em] text-[var(--neutral-soft-400)]">
                      Days
                    </p>
                    <p className="mt-1 text-[12.5px] text-[var(--neutral-strong-950)]">
                      {w.work_days.map((d) => DAYS_OF_WEEK[d].full).join(', ')}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.05em] text-[var(--neutral-soft-400)]">
                      Window
                    </p>
                    <p className="mt-1 text-[12.5px] text-[var(--neutral-strong-950)]">
                      {w.window_start} → {w.window_end}
                    </p>
                  </div>
                  {w.created_at && (
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.05em] text-[var(--neutral-soft-400)]">
                        Created
                      </p>
                      <p className="mt-1 text-[12.5px] text-[var(--neutral-strong-950)]">
                        {formatFullTimestamp(w.created_at)}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.li>
  );
}
