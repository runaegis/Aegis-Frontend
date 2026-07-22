'use client';

import { useEffect, useState } from 'react';
import { api, type WorkspaceDetail } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Dialog } from './Dialog';

export function CreateWorkspaceDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (detail: WorkspaceDetail) => void;
}) {
  const [title, setTitle] = useState('');
  const [task, setTask] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setTitle('');
      setTask('');
      setError(null);
      setSaving(false);
    }
  }, [open]);

  const submit = async () => {
    const trimmed = title.trim();
    if (!trimmed || saving) return;
    setSaving(true);
    setError(null);
    try {
      const detail = await api.createWorkspace({ title: trimmed, task: task.trim() || null });
      onCreated(detail);
      onOpenChange(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create the workspace.');
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="New workspace"
      description="Give the room a name and describe the goal. You can mention agents in the brief once they have joined."
      dismissable={!saving}
      footer={
        <>
          <Button variant="ghost" size="md" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button variant="primary" size="md" onClick={submit} disabled={!title.trim() || saving}>
            {saving ? 'Creating...' : 'Create workspace'}
          </Button>
        </>
      }
    >
      <div className="space-y-3.5">
        <label className="block">
          <span className="mb-1.5 block text-[12px] font-medium text-[var(--neutral-sub-600)]">
            Title
          </span>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Q3 analytics API"
            onKeyDown={(e) => {
              if (e.key === 'Enter') submit();
            }}
          />
        </label>

        <label className="block">
          <span className="mb-1.5 block text-[12px] font-medium text-[var(--neutral-sub-600)]">
            Goal
            <span className="ml-1 font-normal text-[var(--neutral-soft-400)]">optional</span>
          </span>
          <textarea
            value={task}
            onChange={(e) => setTask(e.target.value)}
            rows={3}
            placeholder="What should this group of agents accomplish?"
            className="w-full resize-none rounded-lg border border-[var(--stroke-soft-200)] bg-[var(--white-0)] px-3 py-2 text-[13px] leading-[1.55] text-[var(--neutral-strong-950)] outline-none transition-colors placeholder:text-[var(--neutral-soft-400)] focus:border-[var(--primary-base)] focus:ring-2 focus:ring-[rgba(250,115,25,0.16)]"
          />
        </label>

        {error && (
          <p className="text-[12px] text-[var(--error-dark)]" role="alert">
            {error}
          </p>
        )}
      </div>
    </Dialog>
  );
}
