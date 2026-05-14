'use client';

import { useState, useCallback, useEffect } from 'react';
import { Clock, Plus, Trash2, Edit2, ChevronDown, ChevronRight } from 'lucide-react';
import { api } from '@/lib/api';
import { useUser } from '@/lib/hooks';
import { formatFullTimestamp } from '@/lib/utils';
import Topbar from '@/components/layout/Topbar';
import ErrorBanner from '@/components/ui/ErrorBanner';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import EmptyState from '@/components/ui/EmptyState';

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

const DAYS_OF_WEEK = [
  { label: 'Monday', value: 1 },
  { label: 'Tuesday', value: 2 },
  { label: 'Wednesday', value: 3 },
  { label: 'Thursday', value: 4 },
  { label: 'Friday', value: 5 },
  { label: 'Saturday', value: 6 },
  { label: 'Sunday', value: 7 },
];

const TIMEZONES = [
  'UTC',
  'America/New_York',
  'America/Chicago',
  'Asia/Kolkata',
  'Australia/Sydney',
];

export default function FreezeWindowPage() {
  const { user, isLoading: userLoading } = useUser();
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
    if (user?.id) {
      fetchWindows();
    } else if (!userLoading) {
      setLoading(false);
    }
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
      } else {
        await api.createFreezeWindow(payload);
      }

      await fetchWindows();
      resetForm();
      setShowForm(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save freeze window');
    }
  };

  const handleDelete = async (windowId: string) => {
    if (!user?.id) return;

    try {
      await api.deleteFreezeWindow(windowId);
      await fetchWindows();
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete freeze window');
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

  const toggleWorkDay = (day: number) => {
    setFormData((prev) => ({
      ...prev,
      work_days: prev.work_days.includes(day)
        ? prev.work_days.filter((d) => d !== day)
        : [...prev.work_days, day].sort(),
    }));
  };

  const getDayLabels = (days: number[]): string => {
    if (days.length === 0) return 'No days selected';
    if (days.length === 7) return 'Every day';
    if (days.length === 5 && days.join(',') === '0,1,2,3,4') return 'Weekdays';
    return days.map((d) => DAYS_OF_WEEK[d].label.slice(0, 3)).join(', ');
  };

  if (userLoading || loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Topbar
        title="Deployment Freeze Windows"
        subtitle="Manage time windows when deployments are restricted"
      />

      <div className="p-6">
        {error && (
          <div className="mb-4">
            <ErrorBanner message={error} onDismiss={() => setError(null)} onRetry={fetchWindows} />
          </div>
        )}

        {/* Create/Edit Form */}
        {showForm && (
          <div className="mb-6 rounded-md border border-border bg-card p-6">
            <h2 className="mb-4 text-lg font-semibold text-foreground">
              {editingWindowId ? 'Edit Freeze Window' : 'Create Freeze Window'}
            </h2>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Timezone */}
              <div>
                <label className="mb-2 block text-sm font-medium text-foreground">Timezone</label>
                <select
                  value={formData.timezone}
                  onChange={(e) => setFormData({ ...formData, timezone: e.target.value })}
                  className="w-full rounded-md border border-border bg-muted px-3 py-2 text-sm focus:border-foreground/40 focus:outline-none"
                >
                  {TIMEZONES.map((tz) => (
                    <option key={tz} value={tz}>
                      {tz}
                    </option>
                  ))}
                </select>
              </div>

              {/* Work Days */}
              <div>
                <label className="mb-3 block text-sm font-medium text-foreground">Work Days</label>
                <div className="flex flex-wrap gap-2">
                  {DAYS_OF_WEEK.map((day) => (
                    <button
                      key={day.value}
                      type="button"
                      onClick={() => toggleWorkDay(day.value)}
                      className={`rounded-md px-3 py-2 text-sm font-medium transition-colors cursor-pointer ${
                        formData.work_days.includes(day.value)
                          ? 'bg-foreground text-background'
                          : 'border border-border bg-muted text-foreground hover:border-foreground/40'
                      }`}
                    >
                      {day.label.slice(0, 3)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Time Range */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-2 block text-sm font-medium text-foreground">Start Time</label>
                  <input
                    type="time"
                    value={formData.window_start}
                    onChange={(e) => setFormData({ ...formData, window_start: e.target.value })}
                    className="w-full rounded-md border border-border bg-muted px-3 py-2 text-sm focus:border-foreground/40 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-foreground">End Time</label>
                  <input
                    type="time"
                    value={formData.window_end}
                    onChange={(e) => setFormData({ ...formData, window_end: e.target.value })}
                    className="w-full rounded-md border border-border bg-muted px-3 py-2 text-sm focus:border-foreground/40 focus:outline-none"
                  />
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-4">
                <button
                  type="submit"
                  className="flex-1 rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background hover:bg-foreground/90"
                >
                  {editingWindowId ? 'Update' : 'Create'} Freeze Window
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false);
                    resetForm();
                  }}
                  className="rounded-md border border-border bg-muted px-4 py-2 text-sm font-medium text-foreground hover:bg-muted/80 cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Freeze Windows List */}
        {windows.length === 0 ? (
          <div className="rounded-md border border-border bg-card">
            <EmptyState
              icon={<Clock className="h-6 w-6" />}
              title="No freeze windows configured"
              description="Create a freeze window to restrict deployments during specific times."
              action={
                <button
                  onClick={() => {
                    setShowForm(true);
                    resetForm();
                  }}
                  className="inline-flex items-center gap-1.5 rounded-md bg-foreground px-3 py-1.5 text-sm font-medium text-background hover:bg-foreground/90 cursor-pointer"
                >
                  <Plus className="h-4 w-4" />
                  Create Freeze Window
                </button>
              }
            />
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground">Active Freeze Windows</h3>
              <button
                onClick={() => {
                  setShowForm(true);
                  resetForm();
                }}
                className="inline-flex items-center gap-1.5 rounded-md bg-foreground px-3 py-1.5 text-sm font-medium text-background hover:bg-foreground/90 cursor-pointer"
              >
                <Plus className="h-4 w-4" />
                Add Window
              </button>
            </div>

            {windows.map((window) => (
              <div
                key={window.id}
                className="rounded-md border border-border bg-card overflow-hidden"
              >
                <div
                    onClick={() => setExpandedWindow(expandedWindow === window.id ? null : window.id)}
                    className="w-full px-4 py-3 flex items-center justify-between hover:bg-muted/50 transition-colors cursor-pointer"
                  >
                  <div className="flex-1 text-left">
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium text-foreground">
                        {getDayLabels(window.work_days)}
                      </h4>
                      <span className="text-xs bg-muted px-2 py-1 rounded text-muted-foreground">
                        {window.window_start} - {window.window_end}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{window.timezone}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEdit(window);
                      }}
                      className="p-1.5 hover:bg-muted rounded-md transition-colors cursor-pointer"
                      title="Edit"
                    >
                      <Edit2 className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm('Delete this freeze window?')) {
                          handleDelete(window.id);
                        }
                      }}
                      className="p-1.5 hover:bg-muted rounded-md transition-colors cursor-pointer"
                      title="Delete"
                    >
                      <Trash2 className="h-4 w-4 text-muted-foreground hover:text-red-500" />
                    </button>
                    {expandedWindow === window.id ? (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                </div>

                {expandedWindow === window.id && (
                  <div className="border-t border-border px-4 py-3 bg-muted/30 text-sm">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Days</p>
                        <p className="text-foreground">
                          {window.work_days.map((d) => DAYS_OF_WEEK[d].label).join(', ')}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Time Window</p>
                        <p className="text-foreground font-mono">
                          {window.window_start} → {window.window_end}
                        </p>
                      </div>
                      {window.created_at && (
                        <div className="col-span-2">
                          <p className="text-xs text-muted-foreground mb-1">Created</p>
                          <p className="text-foreground">{formatFullTimestamp(window.created_at)}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}