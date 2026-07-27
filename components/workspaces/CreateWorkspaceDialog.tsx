'use client';

import { useEffect, useState } from 'react';
import { FileText } from 'lucide-react';
import { api, type WorkspaceDetail } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import CopyButton from '@/components/ui/CopyButton';
import {
  WORKSPACE_AGENTS_MD_FILENAME,
  WORKSPACE_AGENTS_MD_SNIPPET,
} from '@/lib/workspaceAgentsMd';
import { Dialog } from './Dialog';

type Step = 'form' | 'agents-md';

export function CreateWorkspaceDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (detail: WorkspaceDetail) => void;
}) {
  const [step, setStep] = useState<Step>('form');
  const [title, setTitle] = useState('');
  const [task, setTask] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<WorkspaceDetail | null>(null);

  useEffect(() => {
    if (open) {
      setStep('form');
      setTitle('');
      setTask('');
      setError(null);
      setSaving(false);
      setCreated(null);
    }
  }, [open]);

  const submit = async () => {
    const trimmed = title.trim();
    if (!trimmed || saving) return;
    setSaving(true);
    setError(null);
    try {
      const detail = await api.createWorkspace({ title: trimmed, task: task.trim() || null });
      setCreated(detail);
      setStep('agents-md');
      setSaving(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create the workspace.');
      setSaving(false);
    }
  };

  const finish = () => {
    if (!created) return;
    onCreated(created);
    onOpenChange(false);
  };

  const isForm = step === 'form';

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && created) {
          // Closing after create still navigates into the room.
          onCreated(created);
        }
        onOpenChange(next);
      }}
      width={isForm ? 460 : 560}
      title={isForm ? 'New workspace' : 'Add workspace instructions'}
      description={
        isForm
          ? 'Give the room a name and describe the goal. You can mention agents in the brief once they have joined.'
          : (
            <>
              Workspace created. Paste this into{' '}
              <span className="font-medium text-[var(--neutral-strong-950)]">
                {WORKSPACE_AGENTS_MD_FILENAME}
              </span>{' '}
              so agents use Aegis Workspace tools every session.
            </>
          )
      }
      dismissable={!saving}
      footer={
        isForm ? (
          <>
            <Button variant="ghost" size="md" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancel
            </Button>
            <Button variant="primary" size="md" onClick={submit} disabled={!title.trim() || saving}>
              {saving ? 'Creating...' : 'Create workspace'}
            </Button>
          </>
        ) : (
          <Button variant="primary" size="md" onClick={finish}>
            Open workspace
          </Button>
        )
      }
    >
      {isForm ? (
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
                if (e.key === 'Enter') void submit();
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
      ) : (
        <div className="space-y-3">
          <div className="flex items-start gap-2.5 rounded-lg border border-[var(--stroke-soft-200)] bg-[var(--neutral-weak-50)] px-3 py-2.5">
            <FileText size={14} className="mt-0.5 shrink-0 text-[var(--neutral-sub-600)]" />
            <p className="text-[12px] leading-[1.55] text-[var(--neutral-sub-600)]">
              If you want agents to stay in sync with this workspace, add this block to{' '}
              {WORKSPACE_AGENTS_MD_FILENAME}. You can reopen it anytime from the room.
            </p>
          </div>

          <div>
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <span className="text-[12px] font-medium text-[var(--neutral-sub-600)]">
                {WORKSPACE_AGENTS_MD_FILENAME}
              </span>
              <CopyButton text={WORKSPACE_AGENTS_MD_SNIPPET} />
            </div>
            <pre className="max-h-[260px] overflow-auto whitespace-pre-wrap rounded-lg border border-[var(--stroke-soft-200)] bg-[var(--neutral-weak-50)] px-3 py-2.5 font-mono text-[11.5px] leading-[1.6] text-[var(--neutral-strong-950)]">
              {WORKSPACE_AGENTS_MD_SNIPPET}
            </pre>
          </div>
        </div>
      )}
    </Dialog>
  );
}
